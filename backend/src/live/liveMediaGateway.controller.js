import admin from "../config/firebase.js";
import { canonicalStateOf } from "./liveLifecycle.js";
import { authorizeGatewayInternalAccess, authorizeGatewayServer, gatewayPaths, verifyGatewayToken } from "./liveMediaGateway.js";
import { refreshLiveProjection, transitionLiveSession, withLiveRevisionRetry } from "./liveReconciler.js";
import { getLiveTariff, grantLiveEntitlement } from "./liveTariff.js";
import { persistGatewayHealth } from "./liveGatewayRegistry.js";
import { RECORDING_STATES } from "./liveRecordingAutoscale.js";

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

export async function authorizeLiveMediaGateway(req, res) {
  const { token: bodyToken, password, action, path, protocol, query } = req.body || {};
  const queryToken = new URLSearchParams(String(query || "").replace(/^\?/, "")).get("token") || "";
  const token = String(bodyToken || password || queryToken || bearer(req) || "").trim();
  const normalizedAction = action === "publish" ? "publish" : ["read", "playback"].includes(action) ? "read" : "";
  if (!normalizedAction || !["rtmp", "srt", "webrtc", "rtsp"].includes(String(protocol || ""))) return res.status(403).end();
  if (authorizeGatewayInternalAccess(token, { action: normalizedAction, path: String(path || "") })) return res.status(204).end();
  const claims = verifyGatewayToken(token, { action: normalizedAction, path: String(path || "") });
  if (!claims) return res.status(403).end();
  const snap = await admin.firestore().collection("live_sessions").doc(claims.sid).get();
  if (!snap.exists) return res.status(403).end();
  const session = snap.data() || {};
  if (Number(session.mediaGeneration || 1) !== Number(claims.gen || 0)) return res.status(403).end();
  const state = canonicalStateOf(session);
  if (["ENDING", "REPLAY_PROCESSING", "REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"].includes(state)) return res.status(403).end();
  const expected = gatewayPaths(claims.sid, claims.gen);
  if (normalizedAction === "publish" && expected.ingestPath !== claims.path) return res.status(403).end();
  if (normalizedAction === "read" && expected.playbackPath !== claims.path) return res.status(403).end();
  return res.status(204).end();
}

export async function getLiveGatewayRestreamConfig(req, res) {
  if (!authorizeGatewayServer(req)) return res.status(401).json({ error: "Unauthorized" });
  const sessionId = String(req.query.sessionId || "").trim();
  const generation = Math.max(1, Number(req.query.mediaGeneration || 1));
  const snap = await admin.firestore().collection("live_sessions").doc(sessionId).get();
  if (!snap.exists) return res.status(404).json({ error: "Live session not found" });
  const session = snap.data() || {};
  if (Number(session.mediaGeneration || 1) !== generation) return res.status(409).json({ error: "Media generation changed" });
  if (!session.rtmps || !session.liveInputId) return res.status(409).json({ error: "Recording destination unavailable" });
  return res.json({ sessionId, mediaGeneration: generation, cloudflareRtmps: session.rtmps });
}

export async function receiveLiveGatewayEvent(req, res) {
  if (!authorizeGatewayServer(req)) return res.status(401).json({ error: "Unauthorized" });
  const sessionId = String(req.body?.sessionId || "").trim();
  const generation = Math.max(1, Number(req.body?.mediaGeneration || 1));
  const event = String(req.body?.event || "").toLowerCase();
  const eventPath = String(req.body?.path || "").trim();
  const gatewayId = String(req.body?.gatewayId || process.env.LIVE_MEDIA_GATEWAY_ID || "gateway-primary-us-central1").trim();
  if (!sessionId || !["ingest-online", "media-online", "media-offline"].includes(event)) return res.status(400).json({ error: "Invalid gateway event" });
  const result = await withLiveRevisionRetry(async () => {
    const ref = admin.firestore().collection("live_sessions").doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return { status: 404, body: { error: "Live session not found" } };
    const session = { id: snap.id, ...snap.data() };
    if (session.gatewayId && session.gatewayId !== gatewayId) return { status: 409, body: { error: "Gateway assignment changed" } };
    if (Number(session.mediaGeneration || 1) !== generation) return { status: 409, body: { error: "Media generation changed" } };
    const state = canonicalStateOf(session);
    if (["ENDING", "REPLAY_PROCESSING", "REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"].includes(state)) return { status: 409, body: { error: "Live session is terminal" } };
    const now = admin.firestore.Timestamp.now();
    const expectedPaths = gatewayPaths(sessionId, generation);
    const isIngestPath = eventPath === expectedPaths.ingestPath;
    const isPlaybackPath = eventPath === expectedPaths.playbackPath;
    if (eventPath && !isIngestPath && !isPlaybackPath) return { status: 409, body: { error: "Media path does not match session generation" } };
    if (event === "ingest-online") {
      const next = state === "CREATING" ? "WAITING_FOR_INGEST" : state === "WAITING_FOR_INGEST" ? "INGEST_CONNECTED" : state;
      const updated = await transitionLiveSession(ref, next, {
        gatewayIngestConnected: true,
        gatewayIngestConnectedAt: session.gatewayIngestConnectedAt || now,
        gatewayLastEventAt: now,
        ingestStatus: "INGEST_CONNECTED",
        providerStatus: "gateway_ingest_connected",
        providerState: "INGEST_CONNECTED",
        providerLive: true,
        mediaStatus: "PREPARING",
      }, { expectedRevision: session.stateRevision || 0 });
      return { status: 200, body: { accepted: true, state: canonicalStateOf(updated) } };
    }
    if (event === "media-online") {
      let current = session;
      if (state === "CREATING") {
        current = await transitionLiveSession(ref, "WAITING_FOR_INGEST", {
          gatewayIngestConnected: true,
          gatewayIngestConnectedAt: session.gatewayIngestConnectedAt || now,
          gatewayLastEventAt: now,
          ingestStatus: "INGEST_CONNECTED",
          providerStatus: "gateway_ingest_connected",
          providerState: "INGEST_CONNECTED",
          providerLive: true,
          mediaStatus: "PREPARING",
        }, { expectedRevision: session.stateRevision || 0 });
      }
      const updated = await transitionLiveSession(ref, "LIVE", {
        gatewayIngestConnected: true,
        gatewayMediaReady: true,
        gatewayMediaReadyAt: current.gatewayMediaReadyAt || now,
        gatewayLastFrameAt: now,
        gatewayLastEventAt: now,
        ingestStatus: "INGEST_CONNECTED",
        providerStatus: "gateway_media_ready",
        providerState: "INGEST_CONNECTED",
        providerLive: true,
        providerLiveReason: "gateway_media_ready",
        mediaStatus: "VIEWER_READY",
        viewerPlayable: true,
        ...(!current.actualStartedAt ? { actualStartedAt: now, wentLiveAt: now } : {}),
        ...(!current.viewerReadyAt ? { viewerReadyAt: now, projectionLiveAt: now } : {}),
      }, { expectedRevision: current.stateRevision || 0 });
      await grantLiveEntitlement({ userId: current.hostUid, sessionId, mediaGeneration: generation, role: "broadcaster", blockStartedAt: updated.actualStartedAt || now });
      await admin.firestore().collection("live_recording_jobs").doc(`${sessionId}_${generation}`).set({
        state: RECORDING_STATES.CAPACITY_PENDING,
        recordingStatus: RECORDING_STATES.CAPACITY_PENDING,
        mediaReadyAt: now,
        updatedAt: now,
      }, { merge: true });
      await ref.set({ recordingStatus: RECORDING_STATES.CAPACITY_PENDING, updatedAt: now }, { merge: true });
      return { status: 200, body: { accepted: true, state: canonicalStateOf(updated) } };
    }
    const updated = await transitionLiveSession(ref, state === "LIVE" ? "VIEWER_PREPARING" : state, {
      ...((isIngestPath || !eventPath) ? { gatewayIngestConnected: false, gatewayIngestDisconnectedAt: now } : {}),
      gatewayMediaReady: false,
      gatewayMediaOfflineAt: now,
      gatewayLastEventAt: now,
      providerStatus: isPlaybackPath && session.gatewayIngestConnected ? "gateway_ingest_connected" : "gateway_disconnected",
      providerState: isPlaybackPath && session.gatewayIngestConnected ? "INGEST_CONNECTED" : "DISCONNECTED",
      providerLive: Boolean(isPlaybackPath && session.gatewayIngestConnected),
      providerLiveReason: "gateway_media_offline",
      mediaStatus: "PREPARING",
      viewerPlayable: false,
    }, { expectedRevision: session.stateRevision || 0 });
    await refreshLiveProjection(ref);
    return { status: 200, body: { accepted: true, state: canonicalStateOf(updated) } };
  });
  return res.status(result.status).json(result.body);
}

export async function receiveLiveGatewayMetrics(req, res) {
  if (!authorizeGatewayServer(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    await getLiveTariff();
    const gateway = await persistGatewayHealth(req.body?.gatewayId, req.body || {});
    const now = admin.firestore.Timestamp.now();
    const samples = Array.isArray(req.body?.sessions) ? req.body.sessions.slice(0, 200) : [];
    const batch = admin.firestore().batch();
    for (const sample of samples) {
      const sessionId = String(sample.sessionId || "").slice(0, 128);
      const generation = Math.max(1, Number(sample.mediaGeneration || 1));
      if (!sessionId) continue;
      const id = `${sessionId}_${generation}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      batch.set(admin.firestore().collection("live_media_metrics").doc(id), {
        sessionId, mediaGeneration: generation, gatewayId: gateway.gatewayId, timestamp: now,
        packetLoss: Math.max(0, Number(sample.packetLoss || 0)), jitter: Math.max(0, Number(sample.jitter || 0)),
        rtt: Math.max(0, Number(sample.rtt || 0)), fps: Math.max(0, Number(sample.fps || 0)),
        bitrate: Math.max(0, Number(sample.bitrate || 0)), framesDropped: Math.max(0, Number(sample.framesDropped || 0)),
        reconnectReason: String(sample.reconnectReason || "").slice(0, 80),
        candidateType: String(sample.candidateType || "").slice(0, 20), protocol: String(sample.protocol || "").slice(0, 20),
      });
    }
    if (samples.length) await batch.commit();
    return res.json({ accepted: true, gatewayId: gateway.gatewayId });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not persist gateway metrics" });
  }
}
