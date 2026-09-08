import crypto from "crypto";

const TOKEN_TTL_SECONDS = 10 * 60;

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPart(secret, payloadPart) {
  return crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function workerBaseUrl() {
  return String(process.env.LIVE_ROOM_WORKER_URL || "").trim().replace(/\/+$/, "");
}

function realtimeEnabled() {
  return String(process.env.LIVE_REALTIME_ENABLED || "true").toLowerCase() !== "false";
}

export function liveRoomRealtimeStatus() {
  return {
    provider: "cloudflare-durable-object",
    enabled: realtimeEnabled(),
    configured: Boolean(realtimeEnabled() && workerBaseUrl() && process.env.LIVE_ROOM_SHARED_SECRET && process.env.LIVE_ROOM_SERVER_TOKEN),
    transport: "websocket",
    authority: "backend",
  };
}

export function signLiveRoomToken({ sessionId, uid, displayName, role, mediaGeneration = 0, ttlSeconds = TOKEN_TTL_SECONDS }) {
  const secret = String(process.env.LIVE_ROOM_SHARED_SECRET || "").trim();
  const baseUrl = workerBaseUrl();
  if (!realtimeEnabled() || !secret || !baseUrl) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sessionId,
    uid,
    displayName: String(displayName || "Viewer").slice(0, 120),
    role: String(role || "VIEWER").slice(0, 48),
    mediaGeneration: Math.max(0, Number(mediaGeneration) || 0),
    jti: crypto.randomUUID(),
    scope: "paragon-live-room",
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const payloadPart = base64UrlJson(payload);
  const signaturePart = signPart(secret, payloadPart);
  return {
    token: `${payloadPart}.${signaturePart}`,
    wsUrl: `${baseUrl}/live/${encodeURIComponent(sessionId)}/ws?token=${payloadPart}.${signaturePart}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function isLiveRoomRealtimeConfigured() {
  return liveRoomRealtimeStatus().configured;
}

export async function publishLiveRoomEvent(sessionId, event) {
  const baseUrl = workerBaseUrl();
  const serverToken = String(process.env.LIVE_ROOM_SERVER_TOKEN || "").trim();
  if (!realtimeEnabled() || !baseUrl || !serverToken || !sessionId || !event) return { configured: false, published: false };
  try {
    const response = await fetch(`${baseUrl}/live/${encodeURIComponent(sessionId)}/events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serverToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    return { configured: true, published: response.ok, status: response.status };
  } catch (error) {
    console.warn("[live-room] event publish failed", {
      sessionId,
      type: event?.type || "",
      message: error?.message || "unknown",
    });
    return { configured: true, published: false, error: true };
  }
}
