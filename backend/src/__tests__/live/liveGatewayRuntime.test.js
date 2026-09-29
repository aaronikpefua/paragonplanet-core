import { describe, expect, it } from "vitest";
import { gatewayRuntimeConfig, isGatewayHeartbeatFresh, isGatewayReady } from "../../live/liveGatewayRuntime.js";

describe("Live gateway on-demand runtime", () => {
  it("keeps automatic shutdown disabled by default", () => {
    const config = gatewayRuntimeConfig({});
    expect(config.autoscaleEnabled).toBe(false);
    expect(config.idleTimeoutSeconds).toBe(1800);
    expect(config.startupTimeoutSeconds).toBe(120);
    expect(config.heartbeatFreshnessSeconds).toBe(60);
  });

  it("rejects stale gateway heartbeats", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    expect(isGatewayHeartbeatFresh({ updatedAt: now - 59_000 }, 60, now)).toBe(true);
    expect(isGatewayHeartbeatFresh({ updatedAt: now - 61_000 }, 60, now)).toBe(false);
    expect(isGatewayHeartbeatFresh({}, 60, now)).toBe(false);
  });

  it("does not declare a running VM ready without a fresh healthy MediaMTX heartbeat", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    const config = gatewayRuntimeConfig({ LIVE_MEDIA_GATEWAY_ID: "gateway-primary-us-central1" });
    const base = {
      gatewayId: "gateway-primary-us-central1",
      publicUrl: "https://live.example.test:8889",
      healthy: true,
      acceptingNewPublishers: true,
      updatedAt: now,
    };
    expect(isGatewayReady(base, config, now)).toBe(true);
    expect(isGatewayReady({ ...base, healthy: false }, config, now)).toBe(false);
    expect(isGatewayReady({ ...base, updatedAt: now - 61_000 }, config, now)).toBe(false);
  });
});
