import crypto from "crypto";
import admin from "../config/firebase.js";
import { getStreamLiveInputRecording, getStreamLiveInputState, setStreamLiveInputEnabled } from "./cloudflareStreamLive.js";
import { buildPublicLiveProjection, canonicalStateOf, canonicalTransitionPatch, TERMINAL_LIVE_STATES } from "./liveLifecycle.js";

const START_EXPIRY_MS = Number(process.env.LIVE_START_EXPIRY_MS || 5 * 60 * 1000);
const DISCONNECT_GRACE_MS = Number(process.env.LIVE_DISCONNECT_GRACE_MS || 45 * 1000);
const VISIBILITY_LEASE_MS = Number(process.env.LIVE_VISIBILITY_LEASE_MS || 90 * 1000);
const REPLAY_RETRY_MS = Number(process.env.LIVE_REPLAY_RETRY_MS || 15 * 1000);

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function playbackFromProvider(provider, generation) {
  if (!provider.viewerPlayable || !provider.activeVideoUid || !provider.playback?.playbackHlsUrl) return null;
  return {
    transport: "hls",
    manifestUrl: provider.playback.playbackHlsUrl,
    dashManifestUrl: provider.playback.playbackDashUrl || "",
    videoUid: provider.activeVideoUid,
    generation,
  };
}

function projectionWithTimestamps(session, now) {
  const projection = buildPublicLiveProjection(session, now.toMillis());
  return {
    ...projection,
    publishedAt: now,
    visibilityExpiresAt: projection.visible && projection.directoryTab === "Live Now"
      ? admin.firestore.Timestamp.fromMillis(now.toMillis() + VISIBILITY_LEASE_MS)
      : projection.visibilityExpiresAt || null,
  };
}

export async function transitionLiveSession(ref, nextState, patch = {}, { expectedRevision = null } = {}) {
  const db = ref.firestore;
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw Object.assign(new Error("Live session not found"), { status: 404, code: "LIVE_SESSION_NOT_FOUND" });
    const current = { id: snap.id, ...snap.data() };
    if (expectedRevision != null && Number(current.stateRevision || 0) !== Number(expectedRevision)) {
      throw Object.assign(new Error("Live session changed during reconciliation."), { status: 409, code: "LIVE_STATE_REVISION_CHANGED" });
    }
    const now = admin.firestore.Timestamp.now();
    const transition = canonicalTransitionPatch(current, nextState, {
      ...patch,
      updatedAt: now,
    });
    const next = { ...current, ...transition };
    transaction.set(ref, transition, { merge: true });
    transaction.set(db.collection("public_live_sessions").doc(snap.id), projectionWithTimestamps(next, now), { merge: false });
    if (next.hostUid) {
      const releaseLease = ["ENDING", "REPLAY_PROCESSING", "REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"].includes(transition.sessionStatus);
      transaction.set(db.collection("live_host_leases").doc(next.hostUid), {
        hostUid: next.hostUid,
        sessionId: snap.id,
        status: releaseLease ? "RELEASED" : "ACTIVE",
        expiresAt: releaseLease ? now : admin.firestore.Timestamp.fromMillis(now.toMillis() + START_EXPIRY_MS),
        updatedAt: now,
      }, { merge: true });
    }
    return next;
  });
}

export async function refreshLiveProjection(ref) {
  const db = ref.firestore;
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return null;
    const session = { id: snap.id, ...snap.data() };
    transaction.set(db.collection("public_live_sessions").doc(snap.id), projectionWithTimestamps(session, admin.firestore.Timestamp.now()), { merge: false });
    return session;
  });
}

export async function reconcileLiveSession(sessionId, { reason = "periodic" } = {}) {
  const db = admin.firestore();
  const ref = db.collection("live_sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return { outcome: "missing", sessionId };
  const session = { id: snap.id, ...snap.data() };
  const state = canonicalStateOf(session);
  if (TERMINAL_LIVE_STATES.has(state)) {
    await refreshLiveProjection(ref);
    return { outcome: "terminal", sessionId, state };
  }

  const generation = Math.max(1, Number(session.mediaGeneration || 1));
  const provider = await getStreamLiveInputState(session.liveInputId, session.playbackOrigin || "");
  const common = {
    providerStatus: provider.providerStatus,
    providerState: provider.providerState,
    providerLive: provider.providerLive,
    viewerPlayable: provider.viewerPlayable,
    lifecycleStatus: provider.lifecycleStatus,
    lifecycleLive: provider.lifecycleLive,
    activeVideoUid: provider.activeVideoUid || "",
    providerLiveReason: provider.reason || reason,
    lastProviderObservedAt: admin.firestore.Timestamp.now(),
    lastProviderCheckedAt: admin.firestore.Timestamp.now(),
    mediaGeneration: generation,
  };

  if (["ENDING", "REPLAY_PROCESSING"].includes(state)) {
    if (provider.providerLive) {
      return { outcome: "still-ending", session: await transitionLiveSession(ref, "ENDING", { ...common, ingestStatus: provider.providerState, mediaStatus: "ENDING", replayStatus: "NONE" }, { expectedRevision: session.stateRevision || 0 }) };
    }
    const recording = await getStreamLiveInputRecording(session.liveInputId, {
      sessionId,
      mediaGeneration: generation,
      startedAt: millis(session.actualStartedAt || session.startedAt || session.createdAt),
    }).catch(() => null);
    if (!recording) {
      return { outcome: "replay-processing", session: await transitionLiveSession(ref, "REPLAY_PROCESSING", { ...common, ingestStatus: "DISCONNECTED", mediaStatus: "ENDED", replayStatus: "PROCESSING", nextReplayCheckAt: admin.firestore.Timestamp.fromMillis(Date.now() + REPLAY_RETRY_MS) }, { expectedRevision: session.stateRevision || 0 }) };
    }
    const replayPlayback = {
      transport: "hls",
      manifestUrl: recording.playbackHlsUrl,
      dashManifestUrl: recording.playbackDashUrl || "",
      videoUid: recording.videoUid,
      generation,
    };
    return { outcome: "replay-ready", session: await transitionLiveSession(ref, "REPLAY_READY", {
      ...common,
      ingestStatus: "DISCONNECTED",
      mediaStatus: "ENDED",
      replayStatus: "READY",
      replayVideoUid: recording.videoUid,
      replayPlayback,
      playbackId: recording.videoUid,
      playbackUrl: recording.playbackHlsUrl,
      hlsPlaybackUrl: recording.playbackHlsUrl,
      playbackHlsUrl: recording.playbackHlsUrl,
      playbackDashUrl: recording.playbackDashUrl || "",
      replayReadyAt: admin.firestore.Timestamp.now(),
    }, { expectedRevision: session.stateRevision || 0 }) };
  }

  if (provider.viewerPlayable) {
    const livePlayback = playbackFromProvider(provider, generation);
    return { outcome: "live", session: await transitionLiveSession(ref, "LIVE", {
      ...common,
      ingestStatus: "INGEST_CONNECTED",
      mediaStatus: "VIEWER_READY",
      replayStatus: "NONE",
      livePlayback,
      playbackId: provider.activeVideoUid,
      playbackUrl: livePlayback.manifestUrl,
      hlsPlaybackUrl: livePlayback.manifestUrl,
      playbackHlsUrl: livePlayback.manifestUrl,
      playbackDashUrl: livePlayback.dashManifestUrl,
      lastProviderLiveAt: admin.firestore.Timestamp.now(),
      ...(!session.actualStartedAt ? { actualStartedAt: admin.firestore.Timestamp.now(), wentLiveAt: admin.firestore.Timestamp.now() } : {}),
    }, { expectedRevision: session.stateRevision || 0 }) };
  }

  if (provider.providerLive) {
    return { outcome: "preparing", session: await transitionLiveSession(ref, "VIEWER_PREPARING", {
      ...common,
      ingestStatus: "INGEST_CONNECTED",
      mediaStatus: "PREPARING",
      replayStatus: "NONE",
      lastProviderLiveAt: admin.firestore.Timestamp.now(),
    }, { expectedRevision: session.stateRevision || 0 }) };
  }

  const startedMs = millis(session.startedAt || session.createdAt || session.updatedAt);
  const lastLiveMs = millis(session.lastProviderLiveAt || session.lastProviderActivityAt);
  if (["LIVE", "VIEWER_PREPARING", "INGEST_CONNECTED"].includes(state) && lastLiveMs && Date.now() - lastLiveMs <= DISCONNECT_GRACE_MS) {
    return { outcome: "reconnecting", session: await transitionLiveSession(ref, "VIEWER_PREPARING", { ...common, ingestStatus: "RECONNECTING", mediaStatus: "PREPARING" }, { expectedRevision: session.stateRevision || 0 }) };
  }
  if (["LIVE", "VIEWER_PREPARING", "INGEST_CONNECTED"].includes(state) && lastLiveMs && Date.now() - lastLiveMs > DISCONNECT_GRACE_MS) {
    return { outcome: "ending-after-disconnect", session: await transitionLiveSession(ref, "ENDING", {
      ...common,
      ingestStatus: "DISCONNECTED",
      mediaStatus: "ENDING",
      replayStatus: "NONE",
      endDetectedAt: admin.firestore.Timestamp.now(),
      endReason: "provider_disconnect_timeout",
    }, { expectedRevision: session.stateRevision || 0 }) };
  }
  if (startedMs && Date.now() - startedMs > START_EXPIRY_MS) {
    return { outcome: "expired", session: await transitionLiveSession(ref, "EXPIRED", { ...common, ingestStatus: provider.providerState, mediaStatus: "EXPIRED", expiredAt: admin.firestore.Timestamp.now(), expiryReason: "provider_never_became_live" }, { expectedRevision: session.stateRevision || 0 }) };
  }
  if (["INGEST_CONNECTED", "VIEWER_PREPARING", "LIVE"].includes(state)) {
    return { outcome: "disconnected", session: await transitionLiveSession(ref, "VIEWER_PREPARING", { ...common, ingestStatus: provider.providerState, mediaStatus: "PREPARING" }, { expectedRevision: session.stateRevision || 0 }) };
  }
  return { outcome: "waiting", session: await transitionLiveSession(ref, "WAITING_FOR_INGEST", { ...common, ingestStatus: provider.providerState, mediaStatus: "WAITING_FOR_INGEST" }, { expectedRevision: session.stateRevision || 0 }) };
}

export async function requestLiveEnd(sessionId) {
  const ref = admin.firestore().collection("live_sessions").doc(sessionId);
  const ending = await transitionLiveSession(ref, "ENDING", {
    endRequestedAt: admin.firestore.Timestamp.now(),
    mediaStatus: "ENDING",
    replayStatus: "NONE",
  });
  await setStreamLiveInputEnabled(ending.liveInputId, false).catch(() => null);
  return reconcileLiveSession(sessionId, { reason: "end-request" });
}

export async function reconcileOpenLiveSessions({ limit = 100 } = {}) {
  const db = admin.firestore();
  const states = ["CREATING", "WAITING_FOR_INGEST", "INGEST_CONNECTED", "VIEWER_PREPARING", "LIVE", "ENDING", "REPLAY_PROCESSING"];
  const snap = await db.collection("live_sessions").where("sessionStatus", "in", states).limit(Math.min(100, Math.max(1, limit))).get();
  const results = [];
  for (const doc of snap.docs) {
    try {
      results.push(await reconcileLiveSession(doc.id));
    } catch (error) {
      results.push({ sessionId: doc.id, outcome: "error", code: error.code || "RECONCILE_FAILED", message: error.message });
    }
  }
  return results;
}

function secureEqual(provided, expected) {
  const left = Buffer.from(String(provided || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

export function authorizeInternalRequest(req, secretName) {
  const expected = String(process.env[secretName] || "").trim();
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const provided = String(
    req.headers["cf-webhook-auth"]
      || req.headers["x-paragon-internal-secret"]
      || bearer
  ).trim();
  return Boolean(expected) && secureEqual(provided, expected);
}

export function liveWebhookEventId(payload = {}) {
  const data = payload.data || {};
  const raw = [data.input_id, data.event_type, data.updated_at, payload.ts].map((value) => String(value || "")).join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}
