import { describe, expect, it } from "vitest";
import { mapLiveInputProviderState, parseStreamLifecyclePayload, selectStreamRecording } from "../../live/cloudflareStreamLive.js";
import { normalizedCloudflareStatus } from "../../live/liveLifecycle.js";

describe("Cloudflare Stream Live status mapping", () => {
  it.each([
    ["connected", "INGEST_CONNECTED"],
    ["reconnected", "INGEST_CONNECTED"],
    ["reconnecting", "RECONNECTING"],
    ["new_configuration_accepted", "WAITING_FOR_INGEST"],
    ["client_disconnect", "DISCONNECTED"],
    ["failed_to_connect", "FAILED_TO_CONNECT"],
    ["failed_to_reconnect", "FAILED_TO_RECONNECT"],
    ["ttl_exceeded", "EXPIRED"],
    ["", "WAITING_FOR_INGEST"],
  ])("maps %s to %s", (providerStatus, expectedState) => {
    expect(mapLiveInputProviderState(providerStatus)).toBe(expectedState);
  });
});

describe("Cloudflare status normalization", () => {
  it.each([
    ["connected", "connected"],
    [{ state: "connected" }, "connected"],
    [{ current: "reconnected" }, "reconnected"],
    [{ current: { state: "reconnecting" } }, "reconnecting"],
    [{ unexpected: "connected" }, "unknown"],
  ])("normalizes documented and observed status structures", (value, expected) => {
    expect(normalizedCloudflareStatus(value)).toBe(expected);
  });
});

describe("Cloudflare Stream lifecycle readiness", () => {
  it("requires lifecycle.live and videoUID together", () => {
    expect(parseStreamLifecyclePayload({ live: true })).toMatchObject({ live: true, viewerPlayable: false });
    expect(parseStreamLifecyclePayload({ live: false, videoUID: "video-1" })).toMatchObject({ live: false, activeVideoUid: "video-1", viewerPlayable: false });
    expect(parseStreamLifecyclePayload({ live: true, videoUID: "video-1" })).toEqual({ live: true, activeVideoUid: "video-1", viewerPlayable: true });
  });

  it("does not mistake a Live Input id for a playable videoUID", () => {
    expect(parseStreamLifecyclePayload({ live: true, liveInputId: "input-1", videoUID: "input-1" })).toEqual({
      live: true,
      activeVideoUid: "",
      viewerPlayable: false,
    });
  });
});

describe("Cloudflare replay association", () => {
  it("selects only a ready recording for the matching session generation", () => {
    const selected = selectStreamRecording([
      { uid: "old-video", status: { state: "ready" }, created: "2026-01-01T00:00:00Z", meta: { paragonLiveSessionId: "old", paragonMediaGeneration: "1" } },
      { uid: "current-video", status: { state: "ready" }, created: "2026-01-02T00:00:00Z", meta: { paragonLiveSessionId: "session-1", paragonMediaGeneration: "2" } },
    ], { liveInputId: "input-1", sessionId: "session-1", mediaGeneration: 2 });
    expect(selected).toMatchObject({ videoUid: "current-video", playbackId: "current-video" });
  });

  it("does not use an arbitrary old recording", () => {
    expect(selectStreamRecording([
      { uid: "old-video", status: { state: "ready" }, created: "2025-01-01T00:00:00Z", meta: { paragonLiveSessionId: "old", paragonMediaGeneration: "1" } },
    ], { liveInputId: "input-1", sessionId: "session-1", mediaGeneration: 2, startedAt: Date.parse("2026-01-01T00:00:00Z") })).toBeNull();
  });
});
