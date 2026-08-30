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
    rtmpsUrl: result.rtmps?.url || "",
    rtmpsStreamKey: result.rtmps?.streamKey || result.rtmps?.stream_key || "",
    srtUrl: result.srt?.url || "",
    srtStreamId: result.srt?.streamId || result.srt?.stream_id || "",
    webRtcUrl: result.webRTC?.url || result.webrtc?.url || "",
    playbackOrigin,
    playbackId: liveInputId,
    playbackHlsUrl: result.playback?.hls || liveInputHlsUrl,
    playbackDashUrl: result.playback?.dash || liveInputDashUrl,
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

async function getLiveInputLifecyclePlayback(liveInputId, playbackOrigin) {
  if (!liveInputId || !playbackOrigin) return null;
  try {
    const response = await fetch(`${playbackOrigin}/${encodeURIComponent(liveInputId)}/lifecycle`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const videoId = videoIdFromLifecycle(payload);
    if (!videoId || videoId === liveInputId) return null;
    return {
      playbackId: videoId,
      playbackHlsUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8`,
      playbackDashUrl: `https://videodelivery.net/${videoId}/manifest/video.mpd`,
    };
  } catch {
    return null;
  }
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
