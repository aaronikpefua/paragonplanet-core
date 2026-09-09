export const LIVE_MEDIA_PROFILE = process.env.LIVE_MEDIA_PROFILE || "STANDARD_RECORDED";
export const LIVE_RECORDING_MODE = "AUTOMATIC";
export const CANONICAL_LIVE_STATES = new Set([
  "CREATING",
  "SCHEDULED",
  "WAITING_FOR_INGEST",
  "INGEST_CONNECTED",
  "VIEWER_PREPARING",
  "LIVE",
  "ENDING",
  "REPLAY_PROCESSING",
  "REPLAY_READY",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

export const TERMINAL_LIVE_STATES = new Set(["REPLAY_READY", "FAILED", "EXPIRED", "CANCELLED"]);

const TRANSITIONS = {
  SCHEDULED: new Set(["CREATING", "WAITING_FOR_INGEST", "CANCELLED", "EXPIRED"]),
  CREATING: new Set(["WAITING_FOR_INGEST", "FAILED", "EXPIRED", "CANCELLED"]),
  WAITING_FOR_INGEST: new Set(["INGEST_CONNECTED", "VIEWER_PREPARING", "LIVE", "ENDING", "FAILED", "EXPIRED", "CANCELLED"]),
  INGEST_CONNECTED: new Set(["VIEWER_PREPARING", "LIVE", "ENDING", "FAILED", "EXPIRED", "CANCELLED"]),
  VIEWER_PREPARING: new Set(["INGEST_CONNECTED", "LIVE", "ENDING", "FAILED", "EXPIRED", "CANCELLED"]),
  LIVE: new Set(["VIEWER_PREPARING", "ENDING", "FAILED", "EXPIRED", "CANCELLED"]),
  ENDING: new Set(["REPLAY_PROCESSING", "REPLAY_READY", "FAILED"]),
  REPLAY_PROCESSING: new Set(["REPLAY_READY", "FAILED"]),
  REPLAY_READY: new Set(),
  FAILED: new Set(),
  EXPIRED: new Set(),
  CANCELLED: new Set(),
};

export function canonicalStateOf(session = {}) {
  const explicit = String(session.sessionStatus || "").trim().toUpperCase();
  if (CANONICAL_LIVE_STATES.has(explicit)) return explicit;
  const legacy = String(session.status || "").trim().toUpperCase();
  if (legacy === "SCHEDULED") return "SCHEDULED";
  if (legacy === "ACTIVE" || legacy === "LIVE") return session.viewerPlayable ? "LIVE" : "VIEWER_PREPARING";
  if (legacy === "STARTING") return session.providerLive ? "VIEWER_PREPARING" : "WAITING_FOR_INGEST";
  if (legacy === "ENDED") return session.replayStatus === "READY" ? "REPLAY_READY" : "REPLAY_PROCESSING";
  return CANONICAL_LIVE_STATES.has(legacy) ? legacy : "CREATING";
}

export function assertLiveTransition(current, next) {
  const from = canonicalStateOf(current);
  const to = String(next || "").trim().toUpperCase();
  if (!CANONICAL_LIVE_STATES.has(to)) throw Object.assign(new Error(`Unknown Live state '${to}'.`), { code: "LIVE_STATE_INVALID", status: 409 });
  if (from === to) return to;
  if (!TRANSITIONS[from]?.has(to)) {
    throw Object.assign(new Error(`Live transition ${from} -> ${to} is not allowed.`), { code: "LIVE_STATE_REGRESSION", status: 409 });
  }
  return to;
}

export function legacyStatusForCanonical(state) {
  if (state === "SCHEDULED") return "SCHEDULED";
  if (["CREATING", "WAITING_FOR_INGEST", "INGEST_CONNECTED", "VIEWER_PREPARING"].includes(state)) return "STARTING";
  if (state === "LIVE") return "ACTIVE";
  if (["ENDING", "REPLAY_PROCESSING"].includes(state)) return "ENDED";
  return state;
}

export function publicStatusForCanonical(state) {
  if (state === "SCHEDULED") return "SCHEDULED";
  if (["INGEST_CONNECTED", "VIEWER_PREPARING"].includes(state)) return "PREPARING";
  if (state === "LIVE") return "LIVE";
  if (state === "REPLAY_READY") return "REPLAY_READY";
  return "OFFLINE";
}

export function canonicalTransitionPatch(current, nextState, patch = {}) {
  const state = assertLiveTransition(current, nextState);
  const currentRevision = Number(current.stateRevision || 0);
  const currentGeneration = Math.max(1, Number(current.mediaGeneration || 1));
  if (patch.mediaGeneration != null && Number(patch.mediaGeneration) !== currentGeneration) {
    throw Object.assign(new Error("Live media generation changed during transition."), { code: "MEDIA_GENERATION_CHANGED", status: 409 });
  }
  return {
    ...patch,
    sessionStatus: state,
    status: legacyStatusForCanonical(state),
    mediaProfile: current.mediaProfile || LIVE_MEDIA_PROFILE,
    recordingMode: current.recordingMode || LIVE_RECORDING_MODE,
    mediaGeneration: currentGeneration,
    stateRevision: currentRevision + 1,
  };
}

export function buildPublicLiveProjection(session, nowMs = Date.now()) {
  const state = canonicalStateOf(session);
  const publicStatus = publicStatusForCanonical(state);
  const visible = ["PREPARING", "LIVE", "REPLAY_READY", "SCHEDULED"].includes(publicStatus);
  const sourceRevision = Number(session.stateRevision || 0);
  const generation = Math.max(1, Number(session.mediaGeneration || 1));
  return {
    sessionId: session.liveSessionId || session.id || "",
    hostUid: session.hostUid || "",
    hostUsername: session.hostUsername || "",
    hostDisplayName: session.hostDisplayName || "",
    hostPhotoUrl: session.hostPhotoUrl || "",
    hostRole: session.hostRole || "",
    title: session.title || "",
    purpose: session.purpose || "",
    description: session.description || "",
    audience: session.audience || "Public",
    publicStatus,
    directoryTab: publicStatus === "REPLAY_READY" ? "Replays" : publicStatus === "SCHEDULED" ? "Upcoming" : "Live Now",
    visible,
    viewerPlayable: state === "LIVE" && Boolean(session.viewerPlayable),
    providerLive: Boolean(session.providerLive),
    gatewayMediaReady: Boolean(session.gatewayMediaReady),
    mediaGatewayEnabled: Boolean(session.mediaGatewayEnabled),
    gatewayIngestPath: session.gatewayIngestPath || "",
    gatewayPlaybackPath: session.gatewayPlaybackPath || "",
    mediaProfile: session.mediaProfile || LIVE_MEDIA_PROFILE,
    mediaGeneration: generation,
    stateRevision: sourceRevision,
    sourceStateRevision: sourceRevision,
    sourceMediaGeneration: generation,
    projectionVersion: 1,
    livePlayback: session.livePlayback || null,
    replayPlayback: session.replayPlayback || null,
    playbackId: session.playbackId || "",
    playbackUrl: session.playbackUrl || "",
    hlsPlaybackUrl: session.hlsPlaybackUrl || session.playbackHlsUrl || "",
    playbackHlsUrl: session.playbackHlsUrl || session.hlsPlaybackUrl || "",
    playbackDashUrl: session.playbackDashUrl || "",
    activeVideoUid: session.activeVideoUid || "",
    replayVideoUid: session.replayVideoUid || "",
    mediaStatus: session.mediaStatus || "",
    ingestStatus: session.ingestStatus || "",
    replayStatus: session.replayStatus || "NONE",
    startedAt: session.actualStartedAt || session.wentLiveAt || session.startedAt || session.createdAt || null,
    scheduledAt: session.scheduledAt || null,
    endedAt: session.endedAt || null,
    rankingKey: Number(session.rankingKey || nowMs),
    visibilityExpiresAt: session.visibilityExpiresAt || null,
  };
}

export function normalizedCloudflareStatus(status) {
  const candidates = [status, status?.state, status?.current, status?.current?.state];
  const allowed = new Set(["connected", "reconnected", "reconnecting", "client_disconnect", "ttl_exceeded", "failed_to_connect", "failed_to_reconnect", "new_configuration_accepted"]);
  for (const value of candidates) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (allowed.has(normalized)) return normalized;
  }
  return "unknown";
}
