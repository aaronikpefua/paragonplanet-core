const MAX_MESSAGE_BYTES = 4096;
const MAX_CHAT_LENGTH = 280;
const MAX_HISTORY = 40;
const MAX_DEDUPE_KEYS = 200;
const PRESENCE_LEASE_MS = 70_000;

export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") return this.connect(request);
    if (request.method === "POST" && url.pathname.endsWith("/events")) {
      const event = safeEvent(await request.json().catch(() => null));
      if (!event) return json({ error: "Invalid room event" }, 400);
      const closed = await this.state.storage.get("closed");
      if (closed && event.type !== "room.closed") return json({ error: "Live room is closed" }, 409);
      const duplicate = await this.claimEvent(event);
      if (duplicate) return json({ ok: true, duplicate: true, connections: this.activeParticipantCount() });
      if (event.type === "room.closed") await this.state.storage.put("closed", event);
      if (event.type === "chat.message" || event.type === "moderation.message.hidden") await this.appendHistory(event);
      this.broadcast(event);
      if (event.type === "moderation.user.removed") this.removeUser(event.targetUserId);
      if (event.type === "room.closed") this.closeSockets(4000, "Live room closed");
      return json({ ok: true, duplicate: false, connections: this.activeParticipantCount() });
    }
    if (request.method === "GET" && url.pathname.endsWith("/snapshot")) {
      return json({ connections: this.activeParticipantCount(), history: await this.history(), closed: await this.state.storage.get("closed") || null });
    }
    return json({ error: "Not found" }, 404);
  }

  async connect(request) {
    if (await this.state.storage.get("closed")) return json({ error: "Live room is closed" }, 409);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const now = Date.now();
    server.serializeAttachment({
      uid: request.headers.get("x-live-uid") || "",
      displayName: request.headers.get("x-live-display-name") || "Viewer",
      role: request.headers.get("x-live-role") || "VIEWER",
      sessionId: request.headers.get("x-live-session-id") || "",
      mediaGeneration: Number(request.headers.get("x-live-media-generation") || 0),
      connectedAt: now,
      lastSeenAt: now,
    });
    this.state.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "room.snapshot", viewerCount: this.activeParticipantCount(), history: await this.history(), serverTime: new Date().toISOString() }));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, rawValue) {
    const raw = typeof rawValue === "string" ? rawValue : "";
    if (!raw || byteLength(raw) > MAX_MESSAGE_BYTES) return socket.close(1009, "Message too large");
    const message = parseJson(raw);
    if (!message) return;
    const identity = socket.deserializeAttachment() || {};
    identity.lastSeenAt = Date.now();
    socket.serializeAttachment(identity);
    if (message.type === "presence.ping") {
      socket.send(JSON.stringify({ type: "presence.pong", viewerCount: this.activeParticipantCount(), serverTime: new Date().toISOString() }));
    } else if (message.type === "reaction.send") {
      socket.send(JSON.stringify({ type: "event.rejected", code: "BACKEND_AUTHORITY_REQUIRED", serverTime: new Date().toISOString() }));
    }
  }

  webSocketClose(socket) { try { socket.close(); } catch {} this.broadcastPresence(); }
  webSocketError(socket) { try { socket.close(1011, "Room connection error"); } catch {} this.broadcastPresence(); }

  activeSockets() {
    const now = Date.now();
    return this.state.getWebSockets().filter((socket) => {
      const item = socket.deserializeAttachment() || {};
      return now - Number(item.lastSeenAt || item.connectedAt || now) <= PRESENCE_LEASE_MS;
    });
  }

  activeParticipantCount() {
    const identities = new Set();
    for (const socket of this.activeSockets()) {
      const item = socket.deserializeAttachment() || {};
      identities.add(item.uid || `connection:${item.connectedAt || identities.size}`);
    }
    return identities.size;
  }

  async history() { const value = await this.state.storage.get("history"); return Array.isArray(value) ? value.slice(-MAX_HISTORY) : []; }
  async appendHistory(event) {
    const recent = await this.history();
    if (event.type === "chat.message" && recent.some((item) => item.type === "chat.message" && item.message?.id === event.message?.id)) return;
    await this.state.storage.put("history", [...recent, event].slice(-MAX_HISTORY));
  }
  async claimEvent(event) {
    const key = eventDedupKey(event);
    if (!key) return false;
    const recent = await this.state.storage.get("dedupeKeys");
    const keys = Array.isArray(recent) ? recent : [];
    if (keys.includes(key)) return true;
    await this.state.storage.put("dedupeKeys", [...keys, key].slice(-MAX_DEDUPE_KEYS));
    return false;
  }
  broadcastPresence() { this.broadcast({ type: "presence.count", viewerCount: this.activeParticipantCount(), approximate: true, serverTime: new Date().toISOString() }); }
  broadcast(event) { const payload = JSON.stringify(event); for (const socket of this.state.getWebSockets()) { try { socket.send(payload); } catch {} } }
  closeSockets(code, reason) { for (const socket of this.state.getWebSockets()) { try { socket.close(code, reason); } catch {} } }
  removeUser(uid) { for (const socket of this.state.getWebSockets()) { const item = socket.deserializeAttachment() || {}; if (item.uid === uid) { try { socket.close(4003, "Removed from Live room"); } catch {} } } }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: allowedOrigin(env, origin) ? 204 : 403, headers: corsHeaders(env, origin) });
    if (url.pathname === "/health") return json({ ok: true, service: "paragon-live-room-worker", durableObject: "LiveRoom", hibernation: true }, 200, env, origin);
    const match = url.pathname.match(/^\/live\/([^/]+)\/(ws|events)$/);
    if (!match) return json({ error: "Not found" }, 404, env, origin);
    if (origin && !allowedOrigin(env, origin)) return json({ error: "Origin not allowed" }, 403, env, origin);
    const sessionId = decodeURIComponent(match[1] || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) return json({ error: "Invalid Live session id" }, 400, env, origin);
    const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(sessionId));
    if (match[2] === "events") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, env, origin);
      if (!constantTimeEqual(bearerToken(request), String(env.LIVE_ROOM_SERVER_TOKEN || ""))) return json({ error: "Unauthorized" }, 401, env, origin);
      return room.fetch(new Request(`${url.origin}/live/${encodeURIComponent(sessionId)}/events`, request));
    }
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "WebSocket upgrade required" }, 426, env, origin);
    const identity = await verifyRoomToken(url.searchParams.get("token") || "", env.LIVE_ROOM_SHARED_SECRET, sessionId);
    if (!identity) return json({ error: "Unauthorized" }, 401, env, origin);
    const headers = new Headers(request.headers);
    headers.set("x-live-session-id", sessionId);
    headers.set("x-live-uid", identity.uid || "");
    headers.set("x-live-display-name", identity.displayName || "Viewer");
    headers.set("x-live-role", identity.role || "VIEWER");
    headers.set("x-live-media-generation", String(identity.mediaGeneration || 0));
    return room.fetch(new Request(request, { headers }));
  },
};

export async function verifyRoomToken(token, secret, sessionId, nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !secret) return null;
    if (!constantTimeEqual(parts[1], await hmacBase64Url(secret, parts[0]))) return null;
    const payload = JSON.parse(textDecode(base64UrlToBytes(parts[0])));
    if (payload.scope !== "paragon-live-room" || payload.sessionId !== sessionId || !payload.uid) return null;
    if (!payload.exp || Number(payload.exp) < nowSeconds || Number(payload.iat || 0) > nowSeconds + 30) return null;
    return payload;
  } catch { return null; }
}

export function safeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const type = String(event.type || "").slice(0, 80);
  if (type === "chat.message") {
    const message = event.message && typeof event.message === "object" ? event.message : {};
    if (!message.id || !message.sessionId || !message.userId || !String(message.text || "").trim()) return null;
    return { type, message: { id: String(message.id).slice(0, 128), sessionId: String(message.sessionId).slice(0, 128), userId: String(message.userId).slice(0, 128), userName: String(message.userName || "Viewer").slice(0, 80), displayName: String(message.displayName || "").slice(0, 120), text: String(message.text).slice(0, MAX_CHAT_LENGTH), createdAt: String(message.createdAt || new Date().toISOString()) } };
  }
  if (type === "reaction") {
    const action = String(event.action || "").toLowerCase();
    if (!["vote", "pour", "spray", "pop"].includes(action) || event.financial !== false) return null;
    return { type, eventId: String(event.eventId || "").slice(0, 128), action, uid: String(event.uid || "").slice(0, 128), displayName: String(event.displayName || "Viewer").slice(0, 120), mediaGeneration: Math.max(0, Number(event.mediaGeneration) || 0), financial: false, staging: Boolean(event.staging), createdAt: String(event.createdAt || new Date().toISOString()) };
  }
  if (["room.closed", "room.state", "moderation.message.hidden", "moderation.user.muted", "moderation.user.removed"].includes(type)) return { ...event, type, serverTime: event.serverTime || new Date().toISOString() };
  return null;
}

export function eventDedupKey(event) {
  if (event?.type === "chat.message" && event.message?.id) return `chat:${event.message.id}`;
  if (event?.type === "reaction" && event.eventId) return `reaction:${event.eventId}`;
  if (event?.type === "room.closed") return "room:closed";
  return "";
}

function parseJson(value) { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : null; } catch { return null; } }
function bearerToken(request) { const value = request.headers.get("Authorization") || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; }
function allowedOrigin(env, origin) { if (!origin) return true; return String(env?.ALLOWED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean).includes(origin); }
function corsHeaders(env, origin) { return { "Access-Control-Allow-Origin": allowedOrigin(env, origin) && origin ? origin : "null", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Authorization,Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" }; }
function json(payload, status = 200, env = null, origin = "") { return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", ...(env ? corsHeaders(env, origin) : {}) } }); }
function byteLength(value) { return new TextEncoder().encode(value).length; }
function textDecode(bytes) { return new TextDecoder().decode(bytes); }
function base64UrlToBytes(value) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="); const binary = atob(base64); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); }
function bytesToBase64Url(bytes) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function hmacBase64Url(secret, data) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))); }
function constantTimeEqual(left, right) { if (!left || !right || left.length !== right.length) return false; let result = 0; for (let i = 0; i < left.length; i += 1) result |= left.charCodeAt(i) ^ right.charCodeAt(i); return result === 0; }
