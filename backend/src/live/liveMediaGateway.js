import crypto from "crypto";
import { issueTurnCredentials } from "./liveTurnPool.js";

const TOKEN_TTL_SECONDS = Math.max(30, Number(process.env.LIVE_MEDIA_GATEWAY_TOKEN_TTL_SECONDS || 120));

function config() {
  return {
    publicUrl: String(process.env.LIVE_MEDIA_GATEWAY_PUBLIC_URL || "").replace(/\/$/, ""),
    rtmpsUrl: String(process.env.LIVE_MEDIA_GATEWAY_RTMPS_URL || "").replace(/\/$/, ""),
    srtUrl: String(process.env.LIVE_MEDIA_GATEWAY_SRT_URL || "").replace(/\/$/, ""),
    signingSecret: String(process.env.LIVE_MEDIA_GATEWAY_SIGNING_SECRET || "").trim(),
    serverToken: String(process.env.LIVE_MEDIA_GATEWAY_SERVER_TOKEN || "").trim(),
    internalToken: String(process.env.LIVE_MEDIA_GATEWAY_INTERNAL_TOKEN || "").trim(),
  };
}

export function mediaGatewayStatus() {
  const current = config();
  const missing = [];
  if (!current.publicUrl) missing.push("LIVE_MEDIA_GATEWAY_PUBLIC_URL");
  if (!current.rtmpsUrl) missing.push("LIVE_MEDIA_GATEWAY_RTMPS_URL");
  if (!current.srtUrl) missing.push("LIVE_MEDIA_GATEWAY_SRT_URL");
  if (!current.signingSecret) missing.push("LIVE_MEDIA_GATEWAY_SIGNING_SECRET");
  if (!current.serverToken) missing.push("LIVE_MEDIA_GATEWAY_SERVER_TOKEN");
  if (!current.internalToken) missing.push("LIVE_MEDIA_GATEWAY_INTERNAL_TOKEN");
  return { configured: missing.length === 0, provider: "paragon-mediamtx", missing };
}

function safeSessionId(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(normalized)) throw Object.assign(new Error("Invalid Live session identity."), { status: 400 });
  return normalized;
}

export function gatewayPaths(sessionId, mediaGeneration = 1) {
  const id = safeSessionId(sessionId);
  const generation = Math.max(1, Number(mediaGeneration || 1));
  return {
    ingestPath: `ingest_${id}_${generation}`,
    playbackPath: `live_${id}_${generation}`,
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signGatewayToken({ sessionId, mediaGeneration = 1, action, path, subject = "public", ttlSeconds = TOKEN_TTL_SECONDS }) {
  const current = config();
  if (!current.signingSecret) throw Object.assign(new Error("Live media gateway is not configured."), { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    v: 1,
    sid: safeSessionId(sessionId),
    gen: Math.max(1, Number(mediaGeneration || 1)),
    action: String(action || ""),
    path: String(path || ""),
    sub: String(subject || "public").slice(0, 128),
    iat: now,
    exp: now + Math.max(30, Math.min(900, Number(ttlSeconds || TOKEN_TTL_SECONDS))),
    nonce: crypto.randomBytes(8).toString("base64url"),
  });
  return `${payload}.${signature(payload, current.signingSecret)}`;
}

export function verifyGatewayToken(token, { action, path } = {}) {
  const current = config();
  const [payload, providedSignature, ...extra] = String(token || "").split(".");
  if (!current.signingSecret || !payload || !providedSignature || extra.length) return null;
  const expected = signature(payload, current.signingSecret);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.v !== 1 || Number(claims.exp || 0) <= now || Number(claims.iat || 0) > now + 30) return null;
  if (action && claims.action !== action) return null;
  if (path && claims.path !== path) return null;
  return claims;
}

export function gatewayPublisherDescriptor({ sessionId, mediaGeneration = 1, publisherTransport = "rtmps", subject, gateway = null }) {
  const current = config();
  const endpoint = {
    publicUrl: String(gateway?.publicUrl || current.publicUrl).replace(/\/$/, ""),
    rtmpsUrl: String(gateway?.rtmpsUrl || current.rtmpsUrl).replace(/\/$/, ""),
    srtUrl: String(gateway?.srtUrl || current.srtUrl).replace(/\/$/, ""),
  };
  const paths = gatewayPaths(sessionId, mediaGeneration);
  const publishToken = signGatewayToken({ sessionId, mediaGeneration, action: "publish", path: paths.ingestPath, subject });
  const transport = String(publisherTransport || "rtmps").toLowerCase();
  return {
    mediaGateway: true,
    publisherTransport: transport === "srt" ? "srt" : transport === "whip" ? "whip" : "rtmps",
    ingestPath: paths.ingestPath,
    playbackPath: paths.playbackPath,
    publishToken,
    gatewayId: gateway?.gatewayId || "",
    gatewayRegion: gateway?.region || "",
    rtmpsUrl: endpoint.rtmpsUrl,
    rtmpsStreamKey: `${paths.ingestPath}?token=${encodeURIComponent(publishToken)}`,
    rtmps: `${endpoint.rtmpsUrl}/${paths.ingestPath}?token=${encodeURIComponent(publishToken)}`,
    srtUrl: endpoint.srtUrl,
    srtStreamId: `publish:${paths.ingestPath}:paragon:${publishToken}`,
    webRtcPublishUrl: `${endpoint.publicUrl}/${paths.ingestPath}/whip`,
    webRtcPublishToken: publishToken,
  };
}

export function gatewayViewerDescriptor({ sessionId, mediaGeneration = 1, subject = "public", gateway = null }) {
  const current = config();
  const publicUrl = String(gateway?.publicUrl || current.publicUrl).replace(/\/$/, "");
  const paths = gatewayPaths(sessionId, mediaGeneration);
  const playbackToken = signGatewayToken({ sessionId, mediaGeneration, action: "read", path: paths.playbackPath, subject });
  return {
    transport: "whep",
    gatewayId: gateway?.gatewayId || "",
    gatewayRegion: gateway?.region || "",
    url: `${publicUrl}/${paths.playbackPath}/whep`,
    token: playbackToken,
    path: paths.playbackPath,
    iceServers: issueTurnCredentials({ subject, region: gateway?.region || "" }),
  };
}

export function authorizeGatewayServer(req) {
  const expected = config().serverToken;
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return Boolean(expected) && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function authorizeGatewayInternalAccess(token, { action, path } = {}) {
  const expected = config().internalToken;
  const left = Buffer.from(String(token || ""));
  const right = Buffer.from(expected);
  const allowedPath = (action === "read" && /^ingest_[A-Za-z0-9_-]+_[1-9][0-9]*$/.test(String(path || "")))
    || (action === "publish" && /^live_[A-Za-z0-9_-]+_[1-9][0-9]*$/.test(String(path || "")));
  return Boolean(expected)
    && allowedPath
    && left.length === right.length
    && crypto.timingSafeEqual(left, right);
}
