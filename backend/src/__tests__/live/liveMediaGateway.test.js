import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorizeGatewayInternalAccess, gatewayPaths, gatewayPublisherDescriptor, gatewayViewerDescriptor, mediaGatewayStatus, signGatewayToken, verifyGatewayToken } from "../../live/liveMediaGateway.js";
import { isGatewayEligible } from "../../live/liveGatewayRegistry.js";

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
  it("rejects heartbeat records without a routable endpoint while accepting a complete healthy origin", () => {
    const heartbeat = { gatewayId: "gateway-primary-us-central1", healthy: true, acceptingNewPublishers: true, updatedAt: Date.now() };
    expect(isGatewayEligible(heartbeat, "publisher")).toBe(false);
    expect(isGatewayEligible({ ...heartbeat, publicUrl: "https://gateway.example.test:8889" }, "publisher")).toBe(true);
  });

  it("makes gateway heartbeats advertise the endpoints required by placement", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const script = fs.readFileSync(path.resolve(testDir, "../../../../media-gateway/scripts/gateway-metrics.sh"), "utf8");
    expect(script).toContain("publicUrl:$publicUrl");
    expect(script).toContain("rtmpsUrl:$rtmpsUrl");
    expect(script).toContain("srtUrl:$srtUrl");
  });

  it("URL-encodes the internal RTSP token instead of placing raw secret characters in user-info", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const script = fs.readFileSync(path.resolve(testDir, "../../../../media-gateway/scripts/restream.sh"), "utf8");
    expect(script).toContain("'$token|@uri'");
    expect(script).toContain("?token=${internal_token_encoded}");
    expect(script).not.toContain("rtsp://paragon:${PARAGON_GATEWAY_INTERNAL_TOKEN");
  });

  it("keeps the internal token in MediaMTX's query-token channel", () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const controller = fs.readFileSync(path.resolve(testDir, "../../live/liveMediaGateway.controller.js"), "utf8");
    expect(controller).toContain('new URLSearchParams(String(query || "").replace(/^\\?/, "")).get("token")');
  });

  it("creates deterministic generation-scoped paths", () => {
    expect(gatewayPaths("AbCdEfGh12345678", 3)).toEqual({
      ingestPath: "ingest_AbCdEfGh12345678_3",
      playbackPath: "live_AbCdEfGh12345678_3",
    });
  });

  it("limits the internal restream credential to ingest reads and normalized-path publishes", () => {
    expect(authorizeGatewayInternalAccess("test-internal-token", { action: "read", path: "ingest_AbCdEfGh12345678_1" })).toBe(true);
    expect(authorizeGatewayInternalAccess("test-internal-token", { action: "publish", path: "live_AbCdEfGh12345678_1" })).toBe(true);
    expect(authorizeGatewayInternalAccess("test-internal-token", { action: "read", path: "live_AbCdEfGh12345678_1" })).toBe(false);
    expect(authorizeGatewayInternalAccess("test-internal-token", { action: "publish", path: "ingest_AbCdEfGh12345678_1" })).toBe(false);
    expect(authorizeGatewayInternalAccess("wrong", { action: "read", path: "ingest_AbCdEfGh12345678_1" })).toBe(false);
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

  it("routes descriptors through the assigned gateway without changing session paths", () => {
    const gateway = { gatewayId: "lagos-origin-2", region: "africa-west1", publicUrl: "https://viewer.example.test:8889", rtmpsUrl: "rtmps://ingest.example.test:1936", srtUrl: "srt://ingest.example.test:8890" };
    const publish = gatewayPublisherDescriptor({ sessionId: "AbCdEfGh12345678", gateway });
    const view = gatewayViewerDescriptor({ sessionId: "AbCdEfGh12345678", gateway });
    expect(publish.rtmps).toContain("ingest.example.test:1936/ingest_AbCdEfGh12345678_1");
    expect(view.url).toBe("https://viewer.example.test:8889/live_AbCdEfGh12345678_1/whep");
    expect(view.gatewayId).toBe("lagos-origin-2");
  });
});
