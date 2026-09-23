import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsPolicy } from "../../video/services/videoAnalytics.js";
import { importCitizenStreamFromUrl } from "../../video/services/cloudflareStreamVod.js";

describe("Citizen video production completion", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.CITIZEN_STREAM_ENABLED; delete process.env.CLOUDFLARE_ACCOUNT_ID; delete process.env.CLOUDFLARE_STREAM_API_TOKEN; });

  it("uses a five-second qualified view and ninety-percent completion policy", () => {
    expect(analyticsPolicy()).toMatchObject({ qualifiedViewSeconds: 5, completionRatio: 0.9 });
  });

  it("imports R2 once through the supported Stream copy endpoint", async () => {
    process.env.CITIZEN_STREAM_ENABLED = "true"; process.env.CLOUDFLARE_ACCOUNT_ID = "account"; process.env.CLOUDFLARE_STREAM_API_TOKEN = "secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, result: { uid: "stream-1" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(importCitizenStreamFromUrl({ videoId: "video-1", sourceUrl: "https://videos.example/source.mp4" })).resolves.toMatchObject({ streamUid: "stream-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/stream/copy");
  });

  it("does not call Stream when production integration is disabled", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(importCitizenStreamFromUrl({ videoId: "video-1", sourceUrl: "https://videos.example/source.mp4" })).resolves.toMatchObject({ enabled: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
