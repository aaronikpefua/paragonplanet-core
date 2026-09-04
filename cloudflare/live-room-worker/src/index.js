const MAX_MESSAGE_BYTES = 4096;
const MAX_CHAT_LENGTH = 280;

export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      return this.connect(request);
    }
    if (request.method === "POST" && url.pathname.endsWith("/events")) {
      const event = await request.json().catch(() => null);
      if (!event || typeof event !== "object") {
        return json({ error: "Invalid room event" }, 400);
      }
      this.broadcast(safeEvent(event));
      return json({ ok: true, connections: this.clients.size });
    }
    if (request.method === "GET" && url.pathname.endsWith("/snapshot")) {
      return json({ connections: this.clients.size });
    }
    return json({ error: "Not found" }, 404);
  }

  connect(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const identity = {
      uid: request.headers.get("x-live-uid") || "",
      displayName: request.headers.get("x-live-display-name") || "Viewer",
      role: request.headers.get("x-live-role") || "VIEWER",
      sessionId: request.headers.get("x-live-session-id") || "",
    };

    server.accept();
    this.clients.set(server, identity);
    server.send(JSON.stringify({
      type: "room.snapshot",
      viewerCount: this.clients.size,
      serverTime: new Date().toISOString(),
    }));
    this.broadcastPresence();

    server.addEventListener("message", (event) => this.handleMessage(server, event));
    server.addEventListener("close", () => this.disconnect(server));
    server.addEventListener("error", () => this.disconnect(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(socket, event) {
    const raw = typeof event.data === "string" ? event.data : "";
    if (!raw || byteLength(raw) > MAX_MESSAGE_BYTES) return;
    let message = null;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!message || typeof message !== "object") return;

    if (message.type === "presence.ping") {
      socket.send(JSON.stringify({ type: "presence.pong", serverTime: new Date().toISOString() }));
      return;
    }

    if (message.type === "reaction.send") {
      const identity = this.clients.get(socket) || {};
      this.broadcast({
        type: "reaction",
        action: String(message.action || "").slice(0, 48),
        uid: identity.uid,
        displayName: identity.displayName,
        createdAt: new Date().toISOString(),
      });
    }
  }

  disconnect(socket) {
    if (!this.clients.has(socket)) return;
    this.clients.delete(socket);
    this.broadcastPresence();
  }

  broadcastPresence() {
    this.broadcast({
      type: "presence.count",
      viewerCount: this.clients.size,
      serverTime: new Date().toISOString(),
    });
  }

  broadcast(event) {
    const payload = JSON.stringify(safeEvent(event));
    for (const socket of this.clients.keys()) {
      try {
        socket.send(payload);
      } catch {
        this.disconnect(socket);
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env, origin) });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "paragon-live-room-worker",
        durableObject: "LiveRoom",
      }, 200, env, origin);
    }

    const match = url.pathname.match(/^\/live\/([^/]+)\/(ws|events)$/);
    if (!match) return json({ error: "Not found" }, 404, env, origin);

    const sessionId = decodeURIComponent(match[1] || "").trim();
    const action = match[2];
    if (!sessionId) return json({ error: "Live session id is required" }, 400, env, origin);

    if (action === "events") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, env, origin);
      const bearer = request.headers.get("Authorization") || "";
      if (!env.LIVE_ROOM_SERVER_TOKEN || bearer !== `Bearer ${env.LIVE_ROOM_SERVER_TOKEN}`) {
        return json({ error: "Unauthorized" }, 401, env, origin);
      }
      const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(sessionId));
      return room.fetch(new Request(`${url.origin}/live/${encodeURIComponent(sessionId)}/events`, request));
    }

    if (action === "ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "WebSocket upgrade required" }, 426, env, origin);
      }
      const token = url.searchParams.get("token") || "";
      const identity = await verifyRoomToken(token, env.LIVE_ROOM_SHARED_SECRET, sessionId);
      if (!identity) return json({ error: "Unauthorized" }, 401, env, origin);

      const headers = new Headers(request.headers);
      headers.set("x-live-session-id", sessionId);
      headers.set("x-live-uid", identity.uid || "");
      headers.set("x-live-display-name", identity.displayName || "Viewer");
      headers.set("x-live-role", identity.role || "VIEWER");

      const room = env.LIVE_ROOM.get(env.LIVE_ROOM.idFromName(sessionId));
      return room.fetch(new Request(request, { headers }));
    }

    return json({ error: "Not found" }, 404, env, origin);
  },
};

async function verifyRoomToken(token, secret, sessionId) {
  try {
    if (!token || !secret || !token.includes(".")) return null;
    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) return null;
    const expected = await hmacBase64Url(secret, payloadPart);
    if (!constantTimeEqual(signaturePart, expected)) return null;
    const payload = JSON.parse(textDecode(base64UrlToBytes(payloadPart)));
    if (payload.sessionId !== sessionId) return null;
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function hmacBase64Url(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEvent(event) {
  const type = String(event.type || "").slice(0, 80);
  if (type === "chat.message") {
    const message = event.message && typeof event.message === "object" ? event.message : {};
    return {
      type,
      message: {
        id: String(message.id || "").slice(0, 128),
        sessionId: String(message.sessionId || "").slice(0, 128),
        userName: String(message.userName || "Viewer").slice(0, 80),
        displayName: String(message.displayName || "").slice(0, 120),
        text: String(message.text || "").slice(0, MAX_CHAT_LENGTH),
        createdAt: String(message.createdAt || new Date().toISOString()),
      },
    };
  }
  return {
    ...event,
    type,
    serverTime: event.serverTime || new Date().toISOString(),
  };
}

function json(payload, status = 200, env = null, origin = "") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(env ? corsHeaders(env, origin) : {}),
    },
  });
}

function corsHeaders(env, origin) {
  const allowed = String(env?.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "https://paragonplanet.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function textDecode(bytes) {
  return new TextDecoder().decode(bytes);
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
