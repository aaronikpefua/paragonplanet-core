import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { eventDedupKey, LiveRoom, safeEvent, verifyRoomToken } from "./index.js";

function fakeRoom(attachments = []) {
  const values = new Map();
  const sockets = attachments.map((attachment) => ({
    attachment,
    deserializeAttachment() { return this.attachment; },
    serializeAttachment(value) { this.attachment = value; },
    send() {},
    close() {},
  }));
  return new LiveRoom({
    getWebSockets: () => sockets,
    storage: {
      get: async (key) => values.get(key),
      put: async (key, value) => values.set(key, value),
    },
  }, {});
}

function token(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

test("accepts a correctly scoped unexpired room token", async () => {
  const payload = { scope: "paragon-live-room", sessionId: "session_123", uid: "user_1", iat: 900, exp: 1100 };
  assert.deepEqual(await verifyRoomToken(token(payload, "secret"), "secret", "session_123", 1000), payload);
});

test("rejects wrong-session, expired, and modified tokens", async () => {
  const payload = { scope: "paragon-live-room", sessionId: "session_123", uid: "user_1", iat: 900, exp: 1100 };
  const signed = token(payload, "secret");
  assert.equal(await verifyRoomToken(signed, "secret", "session_456", 1000), null);
  assert.equal(await verifyRoomToken(signed, "secret", "session_123", 1200), null);
  assert.equal(await verifyRoomToken(`${signed}x`, "secret", "session_123", 1000), null);
});

test("only accepts backend-shaped non-financial reactions", () => {
  assert.equal(safeEvent({ type: "reaction", action: "spray", financial: true }), null);
  assert.equal(safeEvent({ type: "reaction.send", action: "spray" }), null);
  const event = safeEvent({ type: "reaction", eventId: "evt_12345678", action: "spray", uid: "user_1", financial: false, staging: true });
  assert.equal(event.action, "spray");
  assert.equal(event.financial, false);
});

test("sanitizes authoritative chat payloads and rejects spoof-shaped client chat", () => {
  assert.equal(safeEvent({ type: "chat.message", message: { text: "spoof" } }), null);
  const event = safeEvent({ type: "chat.message", message: { id: "m1", sessionId: "session_123", userId: "user_1", userName: "Citizen", text: "x".repeat(500) } });
  assert.equal(event.message.text.length, 280);
  assert.equal(event.message.userId, "user_1");
});

test("deduplication keys cover chat, reactions, and idempotent room closure", () => {
  assert.equal(eventDedupKey({ type: "chat.message", message: { id: "m1" } }), "chat:m1");
  assert.equal(eventDedupKey({ type: "reaction", eventId: "r1" }), "reaction:r1");
  assert.equal(eventDedupKey({ type: "room.closed" }), "room:closed");
  assert.equal(eventDedupKey({ type: "room.state" }), "");
});

test("rejects unknown and financial reaction event shapes", () => {
  assert.equal(safeEvent({ type: "reaction", eventId: "r1", action: "unknown", financial: false }), null);
  assert.equal(safeEvent({ type: "reaction", eventId: "r1", action: "pour", financial: true }), null);
});

test("presence counts logical users and expires stale leases", () => {
  const now = Date.now();
  const room = fakeRoom([
    { uid: "same-user", connectedAt: now, lastSeenAt: now },
    { uid: "same-user", connectedAt: now, lastSeenAt: now },
    { uid: "other-user", connectedAt: now, lastSeenAt: now },
    { uid: "stale-user", connectedAt: now - 80_000, lastSeenAt: now - 80_000 },
  ]);
  assert.equal(room.activeSockets().length, 3);
  assert.equal(room.activeParticipantCount(), 2);
});

test("server event claims are bounded and duplicate-safe", async () => {
  const room = fakeRoom();
  const event = { type: "reaction", eventId: "r1" };
  assert.equal(await room.claimEvent(event), false);
  assert.equal(await room.claimEvent(event), true);
});
