import { describe, expect, it } from "vitest";
import { mapLiveInputProviderState } from "../../live/cloudflareStreamLive.js";

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
