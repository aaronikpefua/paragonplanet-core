import admin from "../config/firebase.js";
import { canonicalStateOf } from "./liveLifecycle.js";
import { authorizeGatewayInternalPublisher, authorizeGatewayServer, gatewayPaths, verifyGatewayToken } from "./liveMediaGateway.js";
import { refreshLiveProjection, transitionLiveSession } from "./liveReconciler.js";

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

export async function authorizeLiveMediaGateway(req, res) {
  const { token: bodyToken, password, action, path, protocol } = req.body || {};
  const token = String(bodyToken || password || bearer(req) || "").trim();
  const normalizedAction = action === "publish" ? "publish" : ["read", "playback"].includes(action) ? "read" : "";
  if (!normalizedAction || !["rtmp", "srt", "webrtc", "rtsp"].includes(String(protocol || ""))) return res.status(403).end();
  if (normalizedAction === "publish" && authorizeGatewayInternalPublisher(token, String(path || ""))) return res.status(204).end();
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
  if (!sessionId || !["ingest-online", "media-online", "media-offline"].includes(event)) return res.status(400).json({ error: "Invalid gateway event" });
  const ref = admin.firestore().collection("live_sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Live session not found" });
  const session = { id: snap.id, ...snap.data() };
  if (Number(session.mediaGeneration || 1) !== generation) return res.status(409).json({ error: "Media generation changed" });
  const state = canonicalStateOf(session);
  if (["ENDING", "REPLAY_PROCESSING", "REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"].includes(state)) return res.status(409).json({ error: "Live session is terminal" });
  const now = admin.firestore.Timestamp.now();
  if (event === "ingest-online") {
    const next = state === "CREATING" ? "WAITING_FOR_INGEST" : state === "WAITING_FOR_INGEST" ? "INGEST_CONNECTED" : state;
    const updated = await transitionLiveSession(ref, next, {
      gatewayIngestConnected: true,
      gatewayIngestConnectedAt: session.gatewayIngestConnectedAt || now,
      gatewayLastEventAt: now,
      ingestStatus: "INGEST_CONNECTED",
      providerLive: true,
      mediaStatus: state === "LIVE" ? "VIEWER_READY" : "PREPARING",
    }, { expectedRevision: session.stateRevision || 0 });
    return res.json({ accepted: true, state: canonicalStateOf(updated) });
  }
  if (event === "media-online") {
    let current = session;
    if (state === "CREATING") {
      current = await transitionLiveSession(ref, "WAITING_FOR_INGEST", {
        gatewayIngestConnected: true,
        gatewayIngestConnectedAt: session.gatewayIngestConnectedAt || now,
        gatewayLastEventAt: now,
        ingestStatus: "INGEST_CONNECTED",
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
      providerLive: true,
      mediaStatus: "VIEWER_READY",
      viewerPlayable: true,
      ...(!current.actualStartedAt ? { actualStartedAt: now, wentLiveAt: now } : {}),
      ...(!current.viewerReadyAt ? { viewerReadyAt: now, projectionLiveAt: now } : {}),
    }, { expectedRevision: current.stateRevision || 0 });
    return res.json({ accepted: true, state: canonicalStateOf(updated) });
  }
  const updated = await transitionLiveSession(ref, state === "LIVE" ? "VIEWER_PREPARING" : state, {
    gatewayMediaReady: false,
    gatewayMediaOfflineAt: now,
    gatewayLastEventAt: now,
    mediaStatus: "PREPARING",
    viewerPlayable: false,
  }, { expectedRevision: session.stateRevision || 0 });
  await refreshLiveProjection(ref);
  return res.json({ accepted: true, state: canonicalStateOf(updated) });
}
