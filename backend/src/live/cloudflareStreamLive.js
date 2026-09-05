import { measureAsync } from "../observability/perf.js";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export function getCloudflareStreamLiveConfig() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "",
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  };
}

export function streamLiveProviderStatus() {
  const config = getCloudflareStreamLiveConfig();
  const missing = [];
  if (!config.accountId) missing.push("CLOUDFLARE_ACCOUNT_ID or R2_ACCOUNT_ID");
  if (!config.apiToken) missing.push("CLOUDFLARE_STREAM_API_TOKEN or CLOUDFLARE_API_TOKEN");
  return {
    provider: "cloudflare-stream-live",
    configured: missing.length === 0,
    browserPublishingConfigured: missing.length === 0,
    browserPublishingTransport: "webrtc-whip",
    recordingDefault: process.env.CLOUDFLARE_STREAM_RECORDING_MODE || "automatic",
    missing,
  };
}

class CloudflareStreamLiveError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

async function cloudflareRequest(path, options = {}) {
  const config = getCloudflareStreamLiveConfig();
  if (!config.accountId || !config.apiToken) {
    throw new CloudflareStreamLiveError("Cloudflare Stream Live is not configured yet.", 503);
  }

  const response = await measureAsync({
    event: "upstream.request",
    domain: "live",
    operation: `cloudflare.stream.${options.method || "GET"} ${path}`,
  }, () => fetch(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  }));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.[0]?.message || payload.error || "Cloudflare Stream Live request failed";
    throw new CloudflareStreamLiveError(message, response.status);
  }
  return payload.result || payload;
}

export async function createStreamLiveInput({ title, sessionId, recordingMode }) {
  const result = await cloudflareRequest("/stream/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      meta: {
        name: title || "Paragon Live",
        paragonLiveSessionId: sessionId,
      },
      recording: {
        mode: recordingMode || process.env.CLOUDFLARE_STREAM_RECORDING_MODE || "automatic",
      },
    }),
  });
  const liveInputId = result.uid || result.id || "";
  const playbackOrigin = streamPlaybackOrigin(result);
  const liveInputHlsUrl = playbackOrigin && liveInputId
    ? `${playbackOrigin}/${liveInputId}/manifest/video.m3u8`
    : "";
  const liveInputDashUrl = playbackOrigin && liveInputId
    ? `${playbackOrigin}/${liveInputId}/manifest/video.mpd`
    : "";

  return {
    liveInputId,
    rtmps: result.rtmps?.url && (result.rtmps?.streamKey || result.rtmps?.stream_key)
      ? `${result.rtmps.url.replace(/\/$/, "")}/${String(result.rtmps.streamKey || result.rtmps.stream_key).replace(/^\//, "")}`
      : "",
    rtmpsUrl: result.rtmps?.url || "",
    rtmpsStreamKey: result.rtmps?.streamKey || result.rtmps?.stream_key || "",
    srtUrl: result.srt?.url || "",
    srtStreamId: result.srt?.streamId || result.srt?.stream_id || "",
    webRtcPublishUrl: result.webRTC?.url || result.webrtc?.url || "",
    webRtcUrl: result.webRTC?.url || result.webrtc?.url || "",
    playbackOrigin,
    playbackId: liveInputId,
    hlsPlaybackUrl: result.playback?.hls || liveInputHlsUrl,
    playbackHlsUrl: result.playback?.hls || liveInputHlsUrl,
    playbackDashUrl: result.playback?.dash || liveInputDashUrl,
    whepPlaybackUrl: result.webRTCPlayback?.url || result.webrtcPlayback?.url || "",
    playbackWebRtcUrl: result.webRTCPlayback?.url || result.webrtcPlayback?.url || "",
    raw: result,
  };
}

function streamPlaybackOrigin(liveInput) {
  const candidates = [
    liveInput?.webRTCPlayback?.url,
    liveInput?.webrtcPlayback?.url,
    liveInput?.webRTC?.url,
    liveInput?.webrtc?.url,
    liveInput?.playback?.hls,
    liveInput?.playback?.dash,
  ];
  for (const candidate of candidates) {
    try {
      if (!candidate) continue;
      return new URL(candidate).origin;
    } catch {
      // Try the next candidate.
    }
  }
  return "";
}

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function videoIdFromLifecycle(payload) {
  return firstText(
    payload?.videoUID,
    payload?.videoUid,
    payload?.videoId,
    payload?.uid,
    payload?.result?.videoUID,
    payload?.result?.videoUid,
    payload?.result?.videoId,
    payload?.result?.uid,
    payload?.live?.videoUID,
    payload?.live?.videoUid,
    payload?.live?.videoId,
    payload?.live?.uid,
    payload?.current?.videoUID,
    payload?.current?.videoUid,
    payload?.current?.videoId,
    payload?.current?.uid
  );
}

function lifecycleLiveFromPayload(payload) {
  const value = payload?.live ?? payload?.result?.live;
  return value === true;
}

async function getLiveInputLifecycle(liveInputId, playbackOrigin) {
  if (!liveInputId || !playbackOrigin) {
    return {
      status: "",
      live: false,
      activeVideoUid: "",
      viewerPlayable: false,
      reason: "missing_lifecycle_origin",
      playback: null,
    };
  }
  try {
    const response = await fetch(`${playbackOrigin}/${encodeURIComponent(liveInputId)}/lifecycle`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return {
        status: "",
        live: false,
        activeVideoUid: "",
        viewerPlayable: false,
        reason: `lifecycle_http_${response.status}`,
        playback: null,
      };
    }
    const payload = await response.json().catch(() => null);
    const live = lifecycleLiveFromPayload(payload);
    const videoId = videoIdFromLifecycle(payload);
    const activeVideoUid = videoId && videoId !== liveInputId ? videoId : "";
    const viewerPlayable = Boolean(live && activeVideoUid);
    return {
      status: live ? "live" : "not_live",
      live,
      activeVideoUid,
      viewerPlayable,
      reason: viewerPlayable ? "viewer_ready" : "lifecycle_not_viewer_ready",
      playback: activeVideoUid ? {
        playbackId: activeVideoUid,
        playbackHlsUrl: `https://videodelivery.net/${activeVideoUid}/manifest/video.m3u8`,
        playbackDashUrl: `https://videodelivery.net/${activeVideoUid}/manifest/video.mpd`,
      } : null,
    };
  } catch {
    return {
      status: "",
      live: false,
      activeVideoUid: "",
      viewerPlayable: false,
      reason: "lifecycle_lookup_failed",
      playback: null,
    };
  }
}

async function getLiveInputLifecyclePlayback(liveInputId, playbackOrigin) {
  const lifecycle = await getLiveInputLifecycle(liveInputId, playbackOrigin);
  return lifecycle.playback;
}

export async function getStreamLiveInputPlayback(liveInputId, playbackOrigin = "") {
  if (!liveInputId) return null;
  const lifecyclePlayback = await getLiveInputLifecyclePlayback(liveInputId, playbackOrigin);
  if (lifecyclePlayback) return lifecyclePlayback;

  const videos = await cloudflareRequest(`/stream/live_inputs/${encodeURIComponent(liveInputId)}/videos`, {
    method: "GET",
  });
  const list = Array.isArray(videos) ? videos : [];
  const preferred = list.find((video) => {
    const state = String(video.status?.state || video.state || "").toLowerCase();
    return state.includes("live") || state.includes("ready");
  }) || list[0];
  if (!preferred) return null;
  const videoId = preferred.uid || preferred.id || "";
  return {
    playbackId: videoId,
    playbackHlsUrl: preferred.playback?.hls || (videoId ? `https://videodelivery.net/${videoId}/manifest/video.m3u8` : ""),
    playbackDashUrl: preferred.playback?.dash || (videoId ? `https://videodelivery.net/${videoId}/manifest/video.mpd` : ""),
  };
}

export async function getStreamLiveInputState(liveInputId, playbackOrigin = "") {
  if (!liveInputId) {
    return {
      providerStatus: "",
      providerState: "WAITING_FOR_INGEST",
      providerLive: false,
      viewerPlayable: false,
      activeVideoUid: "",
      lifecycleStatus: "",
      reason: "missing_live_input_id",
      playback: null,
    };
  }

  let liveInput = null;
  try {
    liveInput = await cloudflareRequest(`/stream/live_inputs/${encodeURIComponent(liveInputId)}`, {
      method: "GET",
    });
  } catch (error) {
    return {
      providerStatus: "",
      providerState: "FAILED_TO_CONNECT",
      providerLive: false,
      viewerPlayable: false,
      activeVideoUid: "",
      lifecycleStatus: "",
      reason: "cloudflare_live_input_lookup_failed",
      error: error.message || "",
      playback: null,
    };
  }

  const origin = firstText(playbackOrigin, streamPlaybackOrigin(liveInput));
  const providerStatus = String(liveInput?.status || "").trim().toLowerCase();
  const providerState = mapLiveInputProviderState(providerStatus);
  const providerLive = providerState === "INGEST_CONNECTED";
  const lifecycle = await getLiveInputLifecycle(liveInputId, origin);
  const viewerPlayable = providerLive && lifecycle.viewerPlayable;
  logProviderDiagnostic("live.provider.input_status", {
    liveInputId,
    providerStatus,
    providerState,
    providerLive,
  });
  logProviderDiagnostic("live.provider.lifecycle", {
    liveInputId,
    lifecycleStatus: lifecycle.status,
    lifecycleLive: lifecycle.live,
    hasVideoUid: Boolean(lifecycle.activeVideoUid),
    viewerPlayable,
  });
  if (viewerPlayable) {
    logProviderDiagnostic("live.provider.viewer_ready", {
      liveInputId,
      providerStatus,
      lifecycleStatus: lifecycle.status,
      lifecycleLive: lifecycle.live,
    });
  } else if (providerLive) {
    logProviderDiagnostic("live.provider.ingest_connected", {
      liveInputId,
      providerStatus,
      lifecycleStatus: lifecycle.status,
      lifecycleLive: lifecycle.live,
      hasVideoUid: Boolean(lifecycle.activeVideoUid),
    });
  } else if (["DISCONNECTED", "FAILED_TO_CONNECT", "FAILED_TO_RECONNECT", "EXPIRED"].includes(providerState)) {
    logProviderDiagnostic("live.provider.ingest_failed", {
      liveInputId,
      providerStatus,
      providerState,
    });
  }

  return {
    providerStatus,
    providerState,
    providerLive,
    viewerPlayable,
    activeVideoUid: lifecycle.activeVideoUid,
    lifecycleStatus: lifecycle.status,
    lifecycleLive: lifecycle.live,
    reason: viewerPlayable ? "viewer_ready" : providerState.toLowerCase(),
    playback: viewerPlayable ? lifecycle.playback : null,
  };
}

function logProviderDiagnostic(event, details) {
  console.info(JSON.stringify({
    event,
    domain: "live",
    ...details,
  }));
}

export function mapLiveInputProviderState(status) {
  switch (String(status || "").trim().toLowerCase()) {
    case "connected":
    case "reconnected":
      return "INGEST_CONNECTED";
    case "reconnecting":
      return "RECONNECTING";
    case "new_configuration_accepted":
      return "WAITING_FOR_INGEST";
    case "client_disconnect":
      return "DISCONNECTED";
    case "failed_to_connect":
      return "FAILED_TO_CONNECT";
    case "failed_to_reconnect":
      return "FAILED_TO_RECONNECT";
    case "ttl_exceeded":
      return "EXPIRED";
    default:
      return "WAITING_FOR_INGEST";
  }
}
