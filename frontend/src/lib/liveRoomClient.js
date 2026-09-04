import { API_URL, appCheckFetch } from "./supportActions";

export async function openLiveRoomClient({ sessionId, currentUser, onEvent, onState }) {
  if (!sessionId || !currentUser || typeof WebSocket === "undefined") return null;
  const token = await currentUser.getIdToken();
  const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/room-token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.configured || !payload.wsUrl) return null;

  const socket = new WebSocket(payload.wsUrl);
  let heartbeat = null;

  socket.addEventListener("open", () => {
    onState?.("connected");
    heartbeat = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "presence.ping" }));
    }, 25000);
  });
  socket.addEventListener("message", (event) => {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data && typeof data === "object") onEvent?.(data);
  });
  socket.addEventListener("close", () => {
    if (heartbeat) window.clearInterval(heartbeat);
    onState?.("closed");
  });
  socket.addEventListener("error", () => {
    if (heartbeat) window.clearInterval(heartbeat);
    onState?.("error");
  });

  return {
    close() {
      if (heartbeat) window.clearInterval(heartbeat);
      socket.close();
    },
    sendReaction(action) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "reaction.send", action }));
      }
    },
  };
}
