import { beforeEach, describe, expect, it } from "vitest";
import { liveRoomRealtimeStatus, signLiveRoomToken } from "../../live/liveRoomRealtime.js";

describe("Live room token authority", () => {
  beforeEach(() => {
    process.env.LIVE_ROOM_WORKER_URL = "https://paragon-live-room-staging.example.workers.dev";
    process.env.LIVE_ROOM_SHARED_SECRET = "test-only-secret";
    process.env.LIVE_ROOM_SERVER_TOKEN = "test-only-server-token";
  });

  it("binds identity, session, scope, generation, and expiry into the signed token", () => {
    const result = signLiveRoomToken({ sessionId: "session_123", uid: "user_1", displayName: "Citizen", role: "CITIZEN", mediaGeneration: 7 });
    const [payloadPart] = result.token.split(".");
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    expect(payload).toMatchObject({ sessionId: "session_123", uid: "user_1", role: "CITIZEN", scope: "paragon-live-room", mediaGeneration: 7 });
    expect(payload.jti).toBeTruthy();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("reports configured only when all private server settings exist", () => {
    expect(liveRoomRealtimeStatus().configured).toBe(true);
    delete process.env.LIVE_ROOM_SERVER_TOKEN;
    expect(liveRoomRealtimeStatus().configured).toBe(false);
  });
});
