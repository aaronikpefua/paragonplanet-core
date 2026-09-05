import { describe, expect, it } from "vitest";
import { mapLiveInputProviderState, parseStreamLifecyclePayload } from "../../live/cloudflareStreamLive.js";

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
