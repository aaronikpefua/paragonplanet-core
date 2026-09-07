import { describe, expect, it } from "vitest";
import { assertLiveHostPolicy, isFreshActiveSession, serializeLiveSession } from "../../live/live.controller.js";

describe("Live session public policy", () => {
  it("keeps a connected provider visible while playback is preparing", () => {
    const now = Date.now();
    expect(isFreshActiveSession({
      status: "ACTIVE",
      providerLive: true,
      viewerPlayable: false,
      lastProviderLiveAt: now,
    }, now)).toBe(true);
  });

  it("does not let a host heartbeat substitute for provider proof", () => {
    const now = Date.now();
    expect(isFreshActiveSession({ status: "ACTIVE", providerLive: true, lastHeartbeatAt: now }, now)).toBe(false);
  });

  it("does not expose publishing credentials", () => {
    const result = serializeLiveSession({
      id: "session-1",
      status: "STARTING",
      rtmps: "rtmps://secret",
      rtmpsUrl: "rtmps://host",
      rtmpsStreamKey: "secret-key",
      srtUrl: "srt://secret",
      srtStreamId: "secret-id",
      webRtcPublishUrl: "https://publish.example/secret",
      webRtcUrl: "https://publish.example/secret",
      startRequestId: "private-retry-key",
    });
    expect(result).not.toHaveProperty("rtmps");
    expect(result).not.toHaveProperty("rtmpsStreamKey");
    expect(result).not.toHaveProperty("webRtcPublishUrl");
    expect(result).not.toHaveProperty("startRequestId");
  });

  it("authorizes the canonical profile role and its permitted purpose", () => {
    expect(assertLiveHostPolicy({ role: "CITIZEN" }, "Live Performance")).toBe("CITIZEN");
    expect(() => assertLiveHostPolicy({ role: "VIEWER" }, "Live Performance")).toThrow(/cannot host/i);
    expect(() => assertLiveHostPolicy({ role: "CITIZEN" }, "Product Launch")).toThrow(/purpose/i);
  });
});
