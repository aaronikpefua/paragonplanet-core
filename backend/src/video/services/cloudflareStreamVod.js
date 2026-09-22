const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export function citizenStreamConfig() {
  return {
    enabled: process.env.CITIZEN_STREAM_ENABLED === "true",
    directUploadEnabled: process.env.CITIZEN_STREAM_DIRECT_UPLOAD_ENABLED === "true",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || "",
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
    directUploadExpiryMinutes: Number(process.env.CITIZEN_STREAM_DIRECT_UPLOAD_EXPIRY_MINUTES || 60),
  };
}

export function streamConfigured(config = citizenStreamConfig()) {
  return Boolean(config.enabled && config.accountId && config.apiToken);
}

export async function createCitizenStreamDirectUpload({ videoId, maxDurationSeconds, metadata = {} }) {
  const config = citizenStreamConfig();
  if (!streamConfigured(config) || !config.directUploadEnabled) {
    return {
      enabled: false,
      configured: streamConfigured(config),
      directUploadEnabled: config.directUploadEnabled,
      reason: "CITIZEN_STREAM_DIRECT_UPLOAD_DISABLED",
    };
  }

  const expiry = new Date(Date.now() + config.directUploadExpiryMinutes * 60 * 1000).toISOString();
  const response = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/stream/direct_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds,
      expiry,
      meta: {
        videoId,
        contentDomain: "citizen",
        ...metadata,
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body.errors?.[0]?.message || `Cloudflare Stream direct upload failed (${response.status})`);
    error.status = 502;
    throw error;
  }

  return {
    enabled: true,
    uploadUrl: body.result?.uploadURL || body.result?.uploadUrl || "",
    streamUid: body.result?.uid || "",
    expiresAt: expiry,
  };
}

export function streamPlaybackFromUid(streamUid) {
  if (!streamUid) return {};
  return {
    streamUid,
    streamPlaybackUrl: `https://iframe.videodelivery.net/${streamUid}`,
    streamHlsUrl: `https://videodelivery.net/${streamUid}/manifest/video.m3u8`,
    streamThumbnailUrl: `https://videodelivery.net/${streamUid}/thumbnails/thumbnail.jpg`,
  };
}

export async function getCitizenStreamVideo(streamUid) {
  const config = citizenStreamConfig();
  if (!streamConfigured(config)) {
    return { configured: false, streamUid };
  }
  const response = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/stream/${streamUid}`, {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const error = new Error(body.errors?.[0]?.message || `Cloudflare Stream lookup failed (${response.status})`);
    error.status = 502;
    throw error;
  }
  return { configured: true, video: body.result };
}
