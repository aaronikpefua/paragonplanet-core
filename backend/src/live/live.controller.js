import admin from "../config/firebase.js";
import { createStreamLiveInput, getStreamLiveInputPlayback, streamLiveProviderStatus } from "./cloudflareStreamLive.js";

const HOST_ROLES = new Set(["CITIZEN", "AMBASSADOR", "PROMOTER", "BACKER", "SUPERBOSS", "SUPERNAL", "MERCHANT"]);
const LIVE_STATUSES = new Set(["ACTIVE", "LIVE", "STARTING"]);
const ACTIVE_HEARTBEAT_WINDOW_MS = 90 * 1000;
const STARTING_WINDOW_MS = 5 * 60 * 1000;
const UPCOMING_GRACE_MS = 30 * 60 * 1000;
const LIVE_SUPPORT_ACTIONS = {
  vote: { parag: 1, gbazilo: 0, group: "vote" },
  pour_me_water: { parag: 5, gbazilo: 0, group: "spray" },
  spray_money: { parag: 0, gbazilo: 0, group: "spray", variable: true },
  mineral: { parag: 2, gbazilo: 0, group: "bottle" },
  malt: { parag: 3, gbazilo: 0, group: "bottle" },
  juice: { parag: 4, gbazilo: 0, group: "bottle" },
  mocktail: { parag: 5, gbazilo: 0, group: "bottle" },
  beer: { parag: 6, gbazilo: 0, group: "bottle" },
  gin: { parag: 7, gbazilo: 0, group: "bottle" },
  rum: { parag: 8, gbazilo: 0, group: "bottle" },
  vodka: { parag: 9, gbazilo: 0, group: "bottle" },
  whiskey: { parag: 0, gbazilo: 1, group: "bottle" },
  cocktail: { parag: 2, gbazilo: 1, group: "bottle" },
};

function nowField() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function assertAuth(req) {
  const uid = req.user?.uid;
  if (!uid) {
    const error = new Error("Login first");
    error.status = 401;
    throw error;
  }
  return uid;
}

async function optionalAuthUid(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid || "";
  } catch {
    return "";
  }
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "Paragon Member";
}

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function timestampIso(value) {
  const millis = timestampMillis(value);
  return millis ? new Date(millis).toISOString() : "";
}

function originFromUrl(value) {
  try {
    if (!value) return "";
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function serializeLiveSession(session) {
  return {
    ...session,
    createdAt: timestampIso(session.createdAt) || session.createdAt || "",
    updatedAt: timestampIso(session.updatedAt) || session.updatedAt || "",
    startedAt: timestampIso(session.startedAt) || session.startedAt || "",
    wentLiveAt: timestampIso(session.wentLiveAt) || session.wentLiveAt || "",
    actualStartedAt: timestampIso(session.actualStartedAt) || session.actualStartedAt || "",
    scheduledAt: timestampIso(session.scheduledAt) || session.scheduledAt || "",
    endedAt: timestampIso(session.endedAt) || session.endedAt || "",
    lastHeartbeatAt: timestampIso(session.lastHeartbeatAt) || session.lastHeartbeatAt || "",
    lastProviderActivityAt: timestampIso(session.lastProviderActivityAt) || session.lastProviderActivityAt || "",
  };
}

function isFreshActiveSession(session, now = Date.now()) {
  if (session.endedAt || ["ENDED", "REPLAY_READY", "CANCELLED", "FAILED", "MISSED", "EXPIRED"].includes(session.status)) return false;
  if (session.status === "STARTING") {
    const startedMs = timestampMillis(session.startedAt || session.createdAt || session.updatedAt);
    const hasFreshStartup = startedMs > 0 && now - startedMs <= STARTING_WINDOW_MS;
    return hasFreshStartup && Boolean(session.playbackHlsUrl || session.playbackDashUrl || session.playbackUrl) && Boolean(session.lastHeartbeatAt);
  }
  if (["ACTIVE", "LIVE"].includes(session.status)) {
    const heartbeatMs = timestampMillis(session.lastHeartbeatAt || session.lastProviderActivityAt || session.wentLiveAt || session.updatedAt);
    return heartbeatMs > 0 && now - heartbeatMs <= ACTIVE_HEARTBEAT_WINDOW_MS;
  }
  return false;
}

function isUpcomingSession(session, now = Date.now()) {
  if (session.status !== "SCHEDULED") return false;
  const scheduledMs = timestampMillis(session.scheduledAt);
  return scheduledMs > now - UPCOMING_GRACE_MS;
}

function hasReplayPlayback(session) {
  return ["ENDED", "REPLAY_READY"].includes(session.status) && Boolean(session.playbackHlsUrl || session.playbackDashUrl || session.playbackUrl);
}

function isRecentOpenHostSession(session, now = Date.now()) {
  if (!["ACTIVE", "LIVE"].includes(session.status)) return false;
  if (session.endedAt) return false;
  const recentMs = timestampMillis(session.startedAt || session.createdAt || session.updatedAt || session.lastHeartbeatAt);
  return recentMs > 0 && now - recentMs <= ACTIVE_HEARTBEAT_WINDOW_MS;
}

function liveCollection(db) {
  return db.collection("live_sessions");
}

function liveChatCollection(db, sessionId) {
  return liveCollection(db).doc(sessionId).collection("chat_messages");
}

function getSupportAmounts(action, body = {}) {
  if (!action.variable) {
    return {
      amountParag: Number(action.parag || 0),
      amountGbazilo: Number(action.gbazilo || 0),
    };
  }

  const amountParag = Math.max(0, Number(body.customParagAmount || 0) || 0);
  const amountGbazilo = Math.max(0, Number(body.customGbaziloAmount || 0) || 0);
  if (amountParag <= 0 && amountGbazilo <= 0) {
    return { amountParag: 1, amountGbazilo: 0 };
  }
  return { amountParag, amountGbazilo };
}

async function profileForHost(db, uid) {
  const snap = await db.collection("public_profiles").doc(uid).get();
  const data = snap.data() || {};
  return {
    username: firstText(data.username, data.stageName, data.displayName, data.realName, data.brandName, data.email, "username"),
    displayName: firstText(data.displayName, data.stageName, data.realName, data.brandName, data.email, "Paragon Member"),
    photoUrl: firstText(data.photoUrl, data.profilePhotoUrl, data.avatarUrl, data.imageUrl, ""),
    role: normalizeRole(data.role || data.accountRole || ""),
  };
}

export async function getLiveStatus(req, res) {
  return res.json({ provider: streamLiveProviderStatus() });
}

export async function listLiveSessions(req, res) {
  try {
    const db = admin.firestore();
    const tab = String(req.query.tab || "Live Now").toLowerCase();
    const statuses = tab.includes("upcoming")
      ? ["SCHEDULED"]
      : tab.includes("replay")
        ? ["ENDED", "REPLAY_READY"]
        : tab.includes("following")
          ? ["ACTIVE", "LIVE", "STARTING", "SCHEDULED"]
          : ["ACTIVE", "LIVE", "STARTING"];
    let followedCreatorIds = null;
    if (tab.includes("following")) {
      const viewerUid = await optionalAuthUid(req);
      if (!viewerUid) return res.json({ sessions: [], provider: streamLiveProviderStatus() });
      const followSnap = await db.collection("creator_follows").where("followerId", "==", viewerUid).limit(200).get();
      followedCreatorIds = new Set(followSnap.docs.map((doc) => doc.data()?.creatorId).filter(Boolean));
      if (!followedCreatorIds.size) return res.json({ sessions: [], provider: streamLiveProviderStatus() });
    }
    const snap = await liveCollection(db).where("status", "in", statuses).limit(50).get();
    const sessions = [];
    const now = Date.now();
    for (const doc of snap.docs) {
      const session = await hydrateLivePlayback(db, doc);
      if (followedCreatorIds && !followedCreatorIds.has(session.hostUid)) continue;
      if (tab.includes("following")) {
        if (isFreshActiveSession(session, now) || isUpcomingSession(session, now)) sessions.push(session);
      } else if (tab.includes("upcoming")) {
        if (isUpcomingSession(session, now)) sessions.push(session);
      } else if (tab.includes("replay")) {
        if (hasReplayPlayback(session)) sessions.push(session);
      } else if (isFreshActiveSession(session, now)) {
        sessions.push(session);
      }
    }
    sessions.sort((a, b) => {
      if (tab.includes("upcoming")) return timestampMillis(a.scheduledAt) - timestampMillis(b.scheduledAt);
      return timestampMillis(b.lastHeartbeatAt || b.wentLiveAt || b.updatedAt) - timestampMillis(a.lastHeartbeatAt || a.wentLiveAt || a.updatedAt);
    });
    return res.json({ sessions: sessions.map(serializeLiveSession), provider: streamLiveProviderStatus() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not load Live sessions" });
  }
}

async function hydrateLivePlayback(db, doc) {
  const session = { id: doc.id, ...doc.data() };
  const currentPlayback = String(session.playbackHlsUrl || session.playbackUrl || "");
  const hasLiveInputPlayback = session.liveInputId && currentPlayback.includes(`${session.liveInputId}/manifest/`);
  const needsPlayback = !currentPlayback || hasLiveInputPlayback || session.playbackId === session.liveInputId;
  if (!session.liveInputId || !needsPlayback) return session;

  try {
    const playbackOrigin = firstText(
      session.playbackOrigin,
      originFromUrl(session.playbackWebRtcUrl),
      originFromUrl(currentPlayback)
    );
    const playback = await getStreamLiveInputPlayback(session.liveInputId, playbackOrigin);
    if (!playback?.playbackHlsUrl && !playback?.playbackDashUrl) return session;
    const patch = {
      playbackId: playback.playbackId || session.playbackId || "",
      playbackUrl: playback.playbackHlsUrl || playback.playbackDashUrl || "",
      playbackHlsUrl: playback.playbackHlsUrl || "",
      playbackDashUrl: playback.playbackDashUrl || "",
      updatedAt: nowField(),
    };
    await liveCollection(db).doc(doc.id).set(patch, { merge: true });
    return { ...session, ...patch };
  } catch {
    return session;
  }
}

export async function startLiveSession(req, res) {
  try {
    const hostUid = assertAuth(req);
    const db = admin.firestore();
    const {
      hostRole,
      purpose,
      title,
      description = "",
      audience = "Public",
      publisherTransport = "rtmps",
    } = req.body || {};
    const normalizedRole = normalizeRole(hostRole);
    if (!HOST_ROLES.has(normalizedRole)) return res.status(403).json({ error: "This role cannot host Paragon Live yet." });
    if (!purpose || !title) return res.status(400).json({ error: "Live purpose and title are required." });

    const provider = streamLiveProviderStatus();
    if (!provider.configured) {
      return res.status(503).json({
        error: "Live streaming service is not configured yet.",
        provider,
      });
    }

    const profile = await profileForHost(db, hostUid);
    const openSessionSnap = await liveCollection(db)
      .where("hostUid", "==", hostUid)
      .limit(20)
      .get();
    const openSession = openSessionSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .find((session) => isRecentOpenHostSession(session));
    if (openSession) {
      return res.status(409).json({
        error: "You already have a Live session starting or active. End it before starting another.",
        session: serializeLiveSession(openSession),
      });
    }

    const sessionRef = liveCollection(db).doc();
    const sessionId = sessionRef.id;

    await sessionRef.set({
      liveSessionId: sessionId,
      hostUid,
      hostUsername: profile.username,
      hostDisplayName: profile.displayName,
      hostPhotoUrl: profile.photoUrl,
      hostRole: normalizedRole,
      purpose,
      title,
      description,
      audience,
      status: "STARTING",
      viewerCount: 0,
      peakViewerCount: 0,
      createdAt: nowField(),
      lastHeartbeatAt: nowField(),
      updatedAt: nowField(),
    });

    const liveInput = await createStreamLiveInput({ title, sessionId });
    const normalizedPublisherTransport = String(publisherTransport || "").toLowerCase() === "whip" ? "whip" : "rtmps";
    const playbackTransport = normalizedPublisherTransport === "whip" ? "whep" : "hls";
    await sessionRef.set({
      status: "STARTING",
      publisherTransport: normalizedPublisherTransport,
      playbackTransport,
      liveInputId: liveInput.liveInputId,
      playbackOrigin: liveInput.playbackOrigin,
      playbackId: liveInput.playbackId,
      playbackUrl: liveInput.playbackHlsUrl || liveInput.playbackDashUrl || "",
      playbackHlsUrl: liveInput.playbackHlsUrl,
      playbackDashUrl: liveInput.playbackDashUrl,
      playbackWebRtcUrl: liveInput.playbackWebRtcUrl,
      webRtcPlaybackUrl: liveInput.playbackWebRtcUrl,
      provider: provider.provider,
      providerConfigured: true,
      startedAt: nowField(),
      updatedAt: nowField(),
    }, { merge: true });

    const snap = await sessionRef.get();
    return res.status(201).json({
      session: serializeLiveSession({ id: snap.id, ...snap.data() }),
      ingest: {
        rtmpsUrl: liveInput.rtmpsUrl,
        rtmpsStreamKey: liveInput.rtmpsStreamKey,
        srtUrl: liveInput.srtUrl,
        srtStreamId: liveInput.srtStreamId,
        webRtcUrl: liveInput.webRtcUrl,
      },
      provider,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not start Paragon Live" });
  }
}

export async function markLiveSessionActive(req, res) {
  try {
    const hostUid = assertAuth(req);
    const db = admin.firestore();
    const ref = liveCollection(db).doc(req.params.sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Live session not found" });
    const session = snap.data() || {};
    if (session.hostUid !== hostUid) return res.status(403).json({ error: "Only the host can update this Live." });
    if (!LIVE_STATUSES.has(session.status)) return res.status(409).json({ error: "Live session is not starting." });
    await ref.set({ status: "ACTIVE", wentLiveAt: nowField(), actualStartedAt: nowField(), lastHeartbeatAt: nowField(), updatedAt: nowField() }, { merge: true });
    const updated = await ref.get();
    return res.json({ session: serializeLiveSession({ id: updated.id, ...updated.data() }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not mark Live active" });
  }
}

export async function heartbeatLiveSession(req, res) {
  try {
    const hostUid = assertAuth(req);
    const db = admin.firestore();
    const ref = liveCollection(db).doc(req.params.sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Live session not found" });
    const session = snap.data() || {};
    if (session.hostUid !== hostUid) return res.status(403).json({ error: "Only the host can heartbeat this Live." });
    if (!LIVE_STATUSES.has(session.status)) return res.status(409).json({ error: "Live session is not active." });
    await ref.set({ status: "ACTIVE", lastHeartbeatAt: nowField(), updatedAt: nowField() }, { merge: true });
    const updated = await ref.get();
    return res.json({ session: serializeLiveSession({ id: updated.id, ...updated.data() }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not heartbeat Live" });
  }
}

export async function scheduleLiveSession(req, res) {
  try {
    const hostUid = assertAuth(req);
    const db = admin.firestore();
    const {
      hostRole,
      purpose,
      title,
      description = "",
      audience = "Public",
      scheduledAt,
    } = req.body || {};
    const normalizedRole = normalizeRole(hostRole);
    const scheduledMs = timestampMillis(scheduledAt);
    if (!HOST_ROLES.has(normalizedRole)) return res.status(403).json({ error: "This role cannot schedule Paragon Live yet." });
    if (!purpose || !title || !scheduledMs) return res.status(400).json({ error: "Live purpose, title, date and time are required." });
    if (scheduledMs <= Date.now()) return res.status(400).json({ error: "Scheduled Live time must be in the future." });

    const profile = await profileForHost(db, hostUid);
    const sessionRef = liveCollection(db).doc();
    const sessionId = sessionRef.id;
    await sessionRef.set({
      liveSessionId: sessionId,
      hostUid,
      hostUsername: profile.username,
      hostDisplayName: profile.displayName,
      hostPhotoUrl: profile.photoUrl,
      hostRole: normalizedRole,
      purpose,
      title,
      description,
      audience,
      status: "SCHEDULED",
      scheduledAt: new Date(scheduledMs).toISOString(),
      viewerCount: 0,
      peakViewerCount: 0,
      createdAt: nowField(),
      updatedAt: nowField(),
    });
    const snap = await sessionRef.get();
    return res.status(201).json({ session: serializeLiveSession({ id: snap.id, ...snap.data() }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not schedule Paragon Live" });
  }
}

export async function endLiveSession(req, res) {
  try {
    const hostUid = assertAuth(req);
    const db = admin.firestore();
    const ref = liveCollection(db).doc(req.params.sessionId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Live session not found" });
    const session = snap.data() || {};
    if (session.hostUid !== hostUid) return res.status(403).json({ error: "Only the host can end this Live." });
    await ref.set({
      status: "ENDED",
      endedAt: nowField(),
      updatedAt: nowField(),
    }, { merge: true });
    const updated = await ref.get();
    return res.json({ session: serializeLiveSession({ id: updated.id, ...updated.data() }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not end Live" });
  }
}

export async function listLiveChatMessages(req, res) {
  try {
    const db = admin.firestore();
    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "Live session id is required" });
    const sessionSnap = await liveCollection(db).doc(sessionId).get();
    if (!sessionSnap.exists) return res.status(404).json({ error: "Live session not found" });
    const snap = await liveChatCollection(db, sessionId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const messages = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), createdAt: timestampIso(doc.data()?.createdAt) }))
      .reverse();
    return res.json({ messages });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not load Live chat" });
  }
}

export async function postLiveChatMessage(req, res) {
  try {
    const userId = assertAuth(req);
    const db = admin.firestore();
    const sessionId = String(req.params.sessionId || "").trim();
    const text = String(req.body?.text || "").trim().slice(0, 280);
    if (!sessionId) return res.status(400).json({ error: "Live session id is required" });
    if (!text) return res.status(400).json({ error: "Write a message first" });
    const sessionSnap = await liveCollection(db).doc(sessionId).get();
    if (!sessionSnap.exists) return res.status(404).json({ error: "Live session not found" });
    const session = sessionSnap.data() || {};
    if (!isFreshActiveSession(session) && !["ACTIVE", "LIVE", "STARTING"].includes(session.status)) {
      return res.status(409).json({ error: "This Live is not accepting chat right now." });
    }
    const profile = await profileForHost(db, userId);
    const ref = liveChatCollection(db, sessionId).doc();
    const payload = {
      sessionId,
      userId,
      userName: profile.username,
      displayName: profile.displayName,
      text,
      createdAt: nowField(),
    };
    await ref.set(payload);
    return res.status(201).json({
      message: {
        id: ref.id,
        ...payload,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not post Live chat" });
  }
}

export async function supportLiveSession(req, res) {
  const userId = req.user?.uid;
  const sessionId = String(req.params.sessionId || "").trim();
  const actionKey = String(req.body?.actionKey || "").trim().toLowerCase();
  const action = LIVE_SUPPORT_ACTIONS[actionKey];

  if (!sessionId) return res.status(400).json({ error: "Live session id is required" });
  if (!userId) return res.status(401).json({ error: "Login first" });
  if (!action) return res.status(400).json({ error: "Unsupported support action" });

  const { amountParag, amountGbazilo } = getSupportAmounts(action, req.body);
  const db = admin.firestore();
  const sessionRef = liveCollection(db).doc(sessionId);
  const supportRef = db.collection("live_supports").doc();
  const supporterWalletRef = db.collection("wallet_accounts").doc(userId);
  const supporterLedgerRef = db.collection("ledger_entries").doc();
  const hostLedgerRef = db.collection("ledger_entries").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const [sessionSnap, supporterWalletSnap] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(supporterWalletRef),
      ]);
      if (!sessionSnap.exists) {
        throw Object.assign(new Error("Live session not found"), { status: 404 });
      }
      const session = sessionSnap.data() || {};
      const hostUid = session.hostUid || "";
      if (hostUid === userId) {
        throw Object.assign(new Error("You cannot support your own Live."), { status: 400 });
      }
      if (!["ACTIVE", "LIVE", "STARTING"].includes(session.status) || session.endedAt) {
        throw Object.assign(new Error("This Live is not accepting support right now."), { status: 409 });
      }
      const wallet = supporterWalletSnap.data() || {};
      const supporterParag = Number(wallet.balances?.parag || 0);
      const supporterGbazilo = Number(wallet.balances?.gbazilo || 0);
      if (amountParag > 0 && supporterParag < amountParag) {
        throw Object.assign(new Error("Insufficient PARAG balance."), { status: 402 });
      }
      if (amountGbazilo > 0 && supporterGbazilo < amountGbazilo) {
        throw Object.assign(new Error("Insufficient GBAZILO balance."), { status: 402 });
      }

      const createdAt = nowField();
      const currency =
        amountParag > 0 && amountGbazilo > 0
          ? "MIXED"
          : amountGbazilo > 0
            ? "GBAZILO"
            : "PARAG";
      const ledgerAmount = amountParag > 0 && amountGbazilo > 0 ? amountParag + amountGbazilo : amountParag || amountGbazilo;
      const updates = {
        [`supportCounts.${actionKey}`]: admin.firestore.FieldValue.increment(1),
        [`supportTotals.${actionKey}.parag`]: admin.firestore.FieldValue.increment(amountParag),
        [`supportTotals.${actionKey}.gbazilo`]: admin.firestore.FieldValue.increment(amountGbazilo),
        updatedAt: createdAt,
      };
      if (action.group === "vote") updates.votes = admin.firestore.FieldValue.increment(1);

      transaction.set(supporterWalletRef, {
        role: "wallet",
        balances: {
          parag: admin.firestore.FieldValue.increment(-amountParag),
          gbazilo: admin.firestore.FieldValue.increment(-amountGbazilo),
        },
        lockedBalances: {
          parag: admin.firestore.FieldValue.increment(0),
          gbazilo: admin.firestore.FieldValue.increment(0),
        },
        updatedAt: createdAt,
      }, { merge: true });

      if (hostUid) {
        transaction.set(db.collection("wallet_accounts").doc(hostUid), {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(amountParag),
            gbazilo: admin.firestore.FieldValue.increment(amountGbazilo),
          },
          lockedBalances: {
            parag: admin.firestore.FieldValue.increment(0),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          updatedAt: createdAt,
        }, { merge: true });
      }

      transaction.update(sessionRef, updates);
      transaction.set(supportRef, {
        sessionId,
        actionKey,
        group: action.group,
        supporterId: userId,
        hostUid,
        amountParag,
        amountGbazilo,
        createdAt,
      });
      transaction.set(supporterLedgerRef, {
        accountId: userId,
        counterpartyId: hostUid,
        direction: "debit",
        amount: ledgerAmount,
        amountParag,
        amountGbazilo,
        currency,
        reason: `Live support: ${actionKey}`,
        supportId: supportRef.id,
        sessionId,
        createdAt,
      });
      if (hostUid) {
        transaction.set(hostLedgerRef, {
          accountId: hostUid,
          counterpartyId: userId,
          direction: "credit",
          amount: ledgerAmount,
          amountParag,
          amountGbazilo,
          currency,
          reason: `Live support received: ${actionKey}`,
          supportId: supportRef.id,
          sessionId,
          createdAt,
        });
      }
    });

    return res.json({ ok: true, sessionId, actionKey, amountParag, amountGbazilo });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "This Live support action could not be completed." });
  }
}
