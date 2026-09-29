import { describe, expect, it } from "vitest";
import {
  maximumRecoveryReadinessChecks,
  reconciliationRecoveryDelaySeconds,
} from "../../video/services/videoReconciliationTasks.js";

describe("video reconciliation retry timing", () => {
  it("delays missed-webhook recovery beyond the Cloudflare rate-limit window", () => {
    const first = reconciliationRecoveryDelaySeconds(1, "video-a");
    expect(first).toBe(reconciliationRecoveryDelaySeconds(1, "video-a"));
    expect(first).toBeGreaterThanOrEqual(300);
    expect(first).toBeLessThanOrEqual(599);
  });

  it("uses bounded exponential recovery", () => {
    const delays = [1, 2, 3, 4].map((attempt) => reconciliationRecoveryDelaySeconds(attempt, "video-a"));
    expect(delays[0]).toBeGreaterThanOrEqual(300);
    expect(delays[1]).toBeGreaterThanOrEqual(600);
    expect(delays[2]).toBeGreaterThanOrEqual(1200);
    expect(delays[3]).toBeGreaterThanOrEqual(2400);
    expect(reconciliationRecoveryDelaySeconds(10, "video-a")).toBeLessThanOrEqual(3899);
  });

  it("caps the targeted recovery checks per upload", () => {
    expect(maximumRecoveryReadinessChecks()).toBe(4);
  });
});
