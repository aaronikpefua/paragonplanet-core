import { describe, expect, it } from "vitest";
import { buildPublicLiveProjection, canonicalStateOf, canonicalTransitionPatch } from "../../live/liveLifecycle.js";
import { isReplayProcessingExpired, withLiveRevisionRetry } from "../../live/liveReconciler.js";

describe("canonical Live lifecycle", () => {
  it("progresses PREPARING to LIVE with monotonic revision and stable generation", () => {
    const preparing = { sessionStatus: "VIEWER_PREPARING", stateRevision: 4, mediaGeneration: 2 };
    const next = canonicalTransitionPatch(preparing, "LIVE", { activeVideoUid: "video-2", mediaGeneration: 2 });
    expect(next).toMatchObject({ sessionStatus: "LIVE", status: "ACTIVE", stateRevision: 5, mediaGeneration: 2, activeVideoUid: "video-2" });
  });

  it("rejects a delayed heartbeat that would regress a terminal state", () => {
    expect(() => canonicalTransitionPatch({ sessionStatus: "REPLAY_READY", stateRevision: 9 }, "LIVE", {})).toThrow(/not allowed/i);
  });

  it("rejects a mismatched media generation", () => {
    expect(() => canonicalTransitionPatch({ sessionStatus: "VIEWER_PREPARING", mediaGeneration: 3 }, "LIVE", { mediaGeneration: 2 })).toThrow(/generation/i);
  });

  it("maps legacy records additively without deleting legacy fields", () => {
    expect(canonicalStateOf({ status: "ACTIVE", viewerPlayable: false })).toBe("VIEWER_PREPARING");
    expect(canonicalStateOf({ status: "ACTIVE", viewerPlayable: true })).toBe("LIVE");
  });
});

describe("public Live projection", () => {
  it("publishes provider-connected sessions as PREPARING", () => {
    const projection = buildPublicLiveProjection({
      id: "live-1",
      sessionStatus: "VIEWER_PREPARING",
      providerLive: true,
      viewerPlayable: false,
      stateRevision: 3,
      mediaGeneration: 1,
    }, 1000);
    expect(projection).toMatchObject({ sessionId: "live-1", publicStatus: "PREPARING", directoryTab: "Live Now", visible: true, viewerPlayable: false });
  });

  it("tombstones terminal failures instead of exposing them", () => {
    expect(buildPublicLiveProjection({ id: "live-1", sessionStatus: "EXPIRED" })).toMatchObject({ publicStatus: "OFFLINE", visible: false });
  });
});

describe("Live reconciliation concurrency", () => {
  it("expires replay recovery only after the bounded recovery window", () => {
    const now = Date.parse("2026-09-28T00:00:00Z");
    expect(isReplayProcessingExpired({ endRequestedAt: "2026-09-27T23:30:00Z" }, now)).toBe(false);
    expect(isReplayProcessingExpired({ endRequestedAt: "2026-09-26T23:00:00Z" }, now)).toBe(true);
    expect(isReplayProcessingExpired({}, now)).toBe(false);
  });

  it("retries an optimistic revision conflict without weakening revision checks", async () => {
    let attempts = 0;
    const result = await withLiveRevisionRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("changed"), { code: "LIVE_STATE_REVISION_CHANGED" });
      return "fresh-state-applied";
    });
    expect(result).toBe("fresh-state-applied");
    expect(attempts).toBe(3);
  });

  it("does not retry non-concurrency failures", async () => {
    let attempts = 0;
    await expect(withLiveRevisionRetry(async () => {
      attempts += 1;
      throw Object.assign(new Error("forbidden"), { code: "NOT_AUTHORIZED" });
    })).rejects.toThrow("forbidden");
    expect(attempts).toBe(1);
  });
});
