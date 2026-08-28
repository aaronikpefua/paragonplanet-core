export class RealtimeProviderError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

function getRealtimeConfig() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "",
    apiToken: process.env.CLOUDFLARE_REALTIME_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
    appId: process.env.CLOUDFLARE_REALTIME_APP_ID || "",
    organizationId: process.env.CLOUDFLARE_REALTIME_ORG_ID || "",
  };
}

export function realtimeProviderStatus() {
  const config = getRealtimeConfig();
  return {
    provider: "cloudflare-realtimekit",
    configured: Boolean(config.accountId && config.apiToken),
    recordingDefault: "OFF",
  };
}

async function cloudflareRequest(path, options = {}) {
  const config = getRealtimeConfig();
  if (!config.accountId || !config.apiToken) {
    throw new RealtimeProviderError("Cloudflare Realtime is not configured yet.", 503);
  }

  const response = await fetch(`${CLOUDFLARE_API_BASE}/accounts/${config.accountId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const detail = payload.errors?.[0]?.message || payload.message || `Cloudflare request failed (${response.status})`;
    throw new RealtimeProviderError(detail, response.status);
  }
  return payload.result || payload;
}

export async function createRealtimeRoom({ callId, durationMinutes, participantLimit }) {
  const roomName = `paragon-private-${callId}`;
  const result = await cloudflareRequest("/calls/apps", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      type: "sfu",
      recording: { mode: "off" },
      metadata: {
        callId,
        durationMinutes,
        participantLimit,
        product: "paragon-private-video-call",
      },
    }),
  });

  return {
    provider: "cloudflare-realtimekit",
    roomId: result.id || result.appId || result.roomId || roomName,
    roomName,
    raw: result,
  };
}

export async function createParticipantToken({ roomId, participantId, participantName, callId }) {
  const result = await cloudflareRequest(`/calls/apps/${encodeURIComponent(roomId)}/sessions/new`, {
    method: "POST",
    body: JSON.stringify({
      sessionId: `${callId}-${participantId}`,
      participantId,
      participantName,
      permissions: {
        canPublish: true,
        canSubscribe: true,
        canScreenshare: false,
        canRecord: false,
      },
    }),
  });

  return {
    authToken: result.token || result.authToken || result.sessionToken || "",
    roomId,
    participantId,
    provider: "cloudflare-realtimekit",
    raw: result,
  };
}
