import crypto from "crypto";
import admin from "../config/firebase.js";
import { getStreamLiveInputRecording, getStreamLiveInputState, setStreamLiveInputEnabled } from "./cloudflareStreamLive.js";
import { buildPublicLiveProjection, canonicalStateOf, canonicalTransitionPatch, TERMINAL_LIVE_STATES } from "./liveLifecycle.js";
import { publishLiveRoomEvent } from "./liveRoomRealtime.js";

const START_EXPIRY_MS = Number(process.env.LIVE_START_EXPIRY_MS || 5 * 60 * 1000);
const DISCONNECT_GRACE_MS = Number(process.env.LIVE_DISCONNECT_GRACE_MS || 45 * 1000);
const VISIBILITY_LEASE_MS = Number(process.env.LIVE_VISIBILITY_LEASE_MS || 90 * 1000);
const REPLAY_RETRY_MS = Number(process.env.LIVE_REPLAY_RETRY_MS || 15 * 1000);
const REPLAY_PROCESSING_MAX_MS = Number(process.env.LIVE_REPLAY_PROCESSING_MAX_MS || 24 * 60 * 60 * 1000);
const REVISION_RETRY_LIMIT = Math.max(1, Number(process.env.LIVE_REVISION_RETRY_LIMIT || 4));
const RECONCILE_CONCURRENCY = Math.max(1, Number(process.env.LIVE_RECONCILE_CONCURRENCY || 8));
const ACTIVE_RECONCILE_STATES = ["CREATING", "WAITING_FOR_INGEST", "INGEST_CONNECTED", "VIEWER_PREPARING", "LIVE", "ENDING"];

export function isLiveRevisionConflict(error) {
  return error?.code === "LIVE_STATE_REVISION_CHANGED";
}

export async function withLiveRevisionRetry(operation, limit = REVISION_RETRY_LIMIT) {
  let lastError;
  for (let attempt = 0; attempt < limit; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isLiveRevisionConflict(error) || attempt === limit - 1) throw error;
    }
  }
  throw lastError;
}

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

export function isReplayProcessingExpired(session = {}, nowMs = Date.now()) {
  const replayStartedMs = millis(session.endRequestedAt || session.endDetectedAt || session.endedAt);
  return replayStartedMs > 0 && nowMs - replayStartedMs > REPLAY_PROCESSING_MAX_MS;
}

async function mapWithConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
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
  const result = await db.runTransaction(async (transaction) => {
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
  if (["ENDING", "REPLAY_PROCESSING", "REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"].includes(result.sessionStatus)) {
    await publishLiveRoomEvent(result.id, {
      type: "room.closed",
      sessionId: result.id,
      stateRevision: result.stateRevision,
      mediaGeneration: result.mediaGeneration,
      reason: result.endReason || result.expiryReason || result.sessionStatus,
    });
  }
  return result;
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

async function reconcileLiveSessionOnce(sessionId, { reason = "periodic" } = {}) {
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

  if (state === "REPLAY_PROCESSING" && isReplayProcessingExpired(session)) {
    return {
      outcome: "replay-expired",
      session: await transitionLiveSession(ref, "FAILED", {
        ingestStatus: "DISCONNECTED",
        mediaStatus: "ENDED",
        replayStatus: "FAILED",
        replayFailureReason: "recording_not_available_before_timeout",
        replayFailedAt: admin.firestore.Timestamp.now(),
      }, { expectedRevision: session.stateRevision || 0 }),
    };
  }

  const generation = Math.max(1, Number(session.mediaGeneration || 1));
  const provider = await getStreamLiveInputState(session.liveInputId, session.playbackOrigin || "");
  const observedAt = admin.firestore.Timestamp.now();
  const gatewayMediaReady = session.gatewayMediaReady === true;
  const gatewayIngestConnected = session.gatewayIngestConnected === true;
  const common = {
    providerStatus: gatewayMediaReady ? "gateway_media_ready" : gatewayIngestConnected ? "gateway_ingest_connected" : provider.providerStatus,
    providerState: gatewayIngestConnected ? "INGEST_CONNECTED" : provider.providerState,
    providerLive: Boolean(gatewayIngestConnected || provider.providerLive),
    viewerPlayable: Boolean(gatewayMediaReady || provider.viewerPlayable),
    recordingProviderStatus: provider.providerStatus,
    recordingProviderState: provider.providerState,
    recordingProviderLive: Boolean(provider.providerLive),
    recordingViewerPlayable: Boolean(provider.viewerPlayable),
    recordingLifecycleStatus: provider.lifecycleStatus,
    recordingLifecycleLive: Boolean(provider.lifecycleLive),
    recordingVideoUid: provider.activeVideoUid || session.recordingVideoUid || "",
    cloudflareViewerPlayable: provider.viewerPlayable,
    cloudflareProviderLive: provider.providerLive,
    lifecycleStatus: provider.lifecycleStatus,
    lifecycleLive: provider.lifecycleLive,
    activeVideoUid: provider.activeVideoUid || session.activeVideoUid || "",
    providerLiveReason: gatewayMediaReady ? "gateway_media_ready" : gatewayIngestConnected ? "gateway_ingest_connected" : provider.reason || reason,
    lastProviderObservedAt: observedAt,
    lastProviderCheckedAt: observedAt,
    mediaGeneration: generation,
    ...(provider.providerLive && !session.ingestConnectedAt ? { ingestConnectedAt: observedAt } : {}),
    ...(provider.activeVideoUid && !session.videoUidObservedAt ? { videoUidObservedAt: observedAt } : {}),
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

  if (provider.viewerPlayable || gatewayMediaReady) {
    const livePlayback = playbackFromProvider(provider, generation);
    return { outcome: "live", session: await transitionLiveSession(ref, "LIVE", {
      ...common,
      ingestStatus: "INGEST_CONNECTED",
      mediaStatus: "VIEWER_READY",
      replayStatus: "NONE",
      ...(livePlayback ? {
        livePlayback,
        playbackId: provider.activeVideoUid,
        playbackUrl: livePlayback.manifestUrl,
        hlsPlaybackUrl: livePlayback.manifestUrl,
        playbackHlsUrl: livePlayback.manifestUrl,
        playbackDashUrl: livePlayback.dashManifestUrl,
      } : {}),
      lastProviderLiveAt: provider.providerLive ? observedAt : session.lastProviderLiveAt || null,
      ...(!session.viewerReadyAt ? { viewerReadyAt: observedAt, projectionLiveAt: observedAt } : {}),
      ...(!session.actualStartedAt ? { actualStartedAt: observedAt, wentLiveAt: observedAt } : {}),
    }, { expectedRevision: session.stateRevision || 0 }) };
  }

  if (gatewayIngestConnected) {
    return { outcome: "gateway-preparing", session: await transitionLiveSession(ref, "VIEWER_PREPARING", {
      ...common,
      ingestStatus: "INGEST_CONNECTED",
      mediaStatus: "PREPARING",
      replayStatus: "NONE",
      lastProviderLiveAt: session.gatewayIngestConnectedAt || observedAt,
    }, { expectedRevision: session.stateRevision || 0 }) };
  }

  if (provider.providerLive) {
    return { outcome: "preparing", session: await transitionLiveSession(ref, "VIEWER_PREPARING", {
      ...common,
      ingestStatus: "INGEST_CONNECTED",
      mediaStatus: "PREPARING",
      replayStatus: "NONE",
      lastProviderLiveAt: observedAt,
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

export async function reconcileLiveSession(sessionId, options = {}) {
  return withLiveRevisionRetry(() => reconcileLiveSessionOnce(sessionId, options));
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
  const boundedLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const activeLimit = Math.max(1, Math.min(80, boundedLimit));
  const replayLimit = Math.max(1, Math.min(20, boundedLimit));
  const now = admin.firestore.Timestamp.now();
  const [activeSnap, replaySnap] = await Promise.all([
    db.collection("live_sessions")
      .where("sessionStatus", "in", ACTIVE_RECONCILE_STATES)
      .limit(activeLimit)
      .get(),
    db.collection("live_sessions")
      .where("sessionStatus", "==", "REPLAY_PROCESSING")
      .where("nextReplayCheckAt", "<=", now)
      .orderBy("nextReplayCheckAt", "asc")
      .limit(replayLimit)
      .get(),
  ]);
  const docs = [...activeSnap.docs, ...replaySnap.docs];
  return mapWithConcurrency(docs, RECONCILE_CONCURRENCY, async (doc) => {
    try {
      return await reconcileLiveSession(doc.id);
    } catch (error) {
      return { sessionId: doc.id, outcome: "error", code: error.code || "RECONCILE_FAILED", message: error.message };
    }
  });
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
