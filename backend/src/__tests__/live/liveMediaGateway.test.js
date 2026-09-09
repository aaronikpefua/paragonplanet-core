import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gatewayPaths, gatewayPublisherDescriptor, gatewayViewerDescriptor, mediaGatewayStatus, signGatewayToken, verifyGatewayToken } from "../../live/liveMediaGateway.js";

const original = {};
const variables = [
  "LIVE_MEDIA_GATEWAY_PUBLIC_URL",
  "LIVE_MEDIA_GATEWAY_RTMPS_URL",
  "LIVE_MEDIA_GATEWAY_SRT_URL",
  "LIVE_MEDIA_GATEWAY_SIGNING_SECRET",
  "LIVE_MEDIA_GATEWAY_SERVER_TOKEN",
  "LIVE_MEDIA_GATEWAY_INTERNAL_TOKEN",
];

beforeEach(() => {
  for (const key of variables) original[key] = process.env[key];
  process.env.LIVE_MEDIA_GATEWAY_PUBLIC_URL = "https://live-gateway.example.test:8889";
  process.env.LIVE_MEDIA_GATEWAY_RTMPS_URL = "rtmps://live-gateway.example.test:1936";
  process.env.LIVE_MEDIA_GATEWAY_SRT_URL = "srt://live-gateway.example.test:8890";
  process.env.LIVE_MEDIA_GATEWAY_SIGNING_SECRET = "test-signing-secret-with-sufficient-entropy";
  process.env.LIVE_MEDIA_GATEWAY_SERVER_TOKEN = "test-server-token";
  process.env.LIVE_MEDIA_GATEWAY_INTERNAL_TOKEN = "test-internal-token";
});

afterEach(() => {
  for (const key of variables) {
    if (original[key] == null) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("Live media gateway credentials", () => {
  it("creates deterministic generation-scoped paths", () => {
    expect(gatewayPaths("AbCdEfGh12345678", 3)).toEqual({
      ingestPath: "ingest_AbCdEfGh12345678_3",
      playbackPath: "live_AbCdEfGh12345678_3",
    });
  });

  it("rejects action, path, and signature substitution", () => {
    const token = signGatewayToken({ sessionId: "AbCdEfGh12345678", mediaGeneration: 1, action: "publish", path: "ingest_AbCdEfGh12345678_1" });
    expect(verifyGatewayToken(token, { action: "publish", path: "ingest_AbCdEfGh12345678_1" })?.sid).toBe("AbCdEfGh12345678");
    expect(verifyGatewayToken(token, { action: "read", path: "ingest_AbCdEfGh12345678_1" })).toBeNull();
    expect(verifyGatewayToken(token, { action: "publish", path: "ingest_other_1" })).toBeNull();
    expect(verifyGatewayToken(`${token}x`, { action: "publish", path: "ingest_AbCdEfGh12345678_1" })).toBeNull();
  });

  it("normalizes Secret Manager line endings at the configuration boundary", () => {
    process.env.LIVE_MEDIA_GATEWAY_SIGNING_SECRET = "test-signing-secret-with-sufficient-entropy\r\n";
    const token = signGatewayToken({ sessionId: "AbCdEfGh12345678", action: "read", path: "live_AbCdEfGh12345678_1" });
    expect(verifyGatewayToken(token, { action: "read", path: "live_AbCdEfGh12345678_1" })).not.toBeNull();
  });

  it("issues distinct publish and viewer descriptors without permanent credentials", () => {
    expect(mediaGatewayStatus().configured).toBe(true);
    const publish = gatewayPublisherDescriptor({ sessionId: "AbCdEfGh12345678", publisherTransport: "whip", subject: "host" });
    const view = gatewayViewerDescriptor({ sessionId: "AbCdEfGh12345678", subject: "viewer" });
    expect(publish.webRtcPublishUrl).toContain("/ingest_AbCdEfGh12345678_1/whip");
    expect(view.url).toContain("/live_AbCdEfGh12345678_1/whep");
    expect(publish.publishToken).not.toBe(view.token);
    expect(JSON.stringify(publish)).not.toContain(process.env.LIVE_MEDIA_GATEWAY_SIGNING_SECRET);
  });
});
