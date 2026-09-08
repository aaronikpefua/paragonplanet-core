import { API_URL, appCheckFetch } from "./supportActions";

const MAX_RECONNECT_DELAY_MS = 15000;

export async function openLiveRoomClient({ sessionId, currentUser, onEvent, onState, onReconnect }) {
  if (!sessionId || !currentUser || typeof WebSocket === "undefined") return null;
  let socket = null;
  let heartbeat = null;
  let retryTimer = null;
  let stopped = false;
  let attempt = 0;
  let connectionGeneration = 0;
  const delivered = new Set();

  const deliver = (data) => {
    const key = data?.type === "chat.message" ? `chat:${data.message?.id || ""}`
      : data?.type === "reaction" ? `reaction:${data.eventId || ""}` : "";
    if (key && delivered.has(key)) return;
    if (key) {
      delivered.add(key);
      if (delivered.size > 256) delivered.delete(delivered.values().next().value);
    }
    onEvent?.(data);
  };

  const clearTimers = () => {
    if (heartbeat) window.clearInterval(heartbeat);
    if (retryTimer) window.clearTimeout(retryTimer);
    heartbeat = null;
    retryTimer = null;
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 750 * (2 ** Math.min(attempt, 5))) + Math.floor(Math.random() * 300);
    attempt += 1;
    onState?.("reconnecting", { attempt, delay });
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect(true).catch(scheduleReconnect);
    }, delay);
  };

  const connect = async (reconnecting = false) => {
    if (stopped) return;
    const generation = ++connectionGeneration;
    const token = await currentUser.getIdToken();
    const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/room-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.configured || !payload.wsUrl) {
      onState?.("unavailable", payload);
      if (response.status >= 500) scheduleReconnect();
      return;
    }
    socket = new WebSocket(payload.wsUrl);
    socket.addEventListener("open", () => {
      if (stopped || generation !== connectionGeneration) return socket.close();
      clearTimers();
      attempt = 0;
      onState?.("connected");
      if (reconnecting) onReconnect?.();
      heartbeat = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "presence.ping" }));
      }, 25000);
    });
    socket.addEventListener("message", (event) => {
      let data = null;
      try { data = JSON.parse(event.data); } catch { return; }
      if (generation !== connectionGeneration) return;
      if (data?.type === "room.snapshot" && Array.isArray(data.history)) data.history.forEach(deliver);
      if (data && typeof data === "object") deliver(data);
    });
    socket.addEventListener("close", (event) => {
      if (generation !== connectionGeneration) return;
      if (heartbeat) window.clearInterval(heartbeat);
      heartbeat = null;
      onState?.(event.code === 4000 ? "closed" : "disconnected", { code: event.code });
      if (!stopped && event.code !== 4000) scheduleReconnect();
    });
    socket.addEventListener("error", () => onState?.("error"));
  };

  await connect(false);
  return {
    close() {
      stopped = true;
      clearTimers();
      socket?.close(1000, "Viewer left room");
    },
    async sendReaction(action) {
      const token = await currentUser.getIdToken();
      const eventId = createClientEventId();
      const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, eventId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send Live reaction.");
      return payload;
    },
  };
}

function createClientEventId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, "")
    || `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${Date.now().toString(36)}_${random}`;
}
