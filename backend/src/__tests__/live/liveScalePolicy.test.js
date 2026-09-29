import { describe, expect, it } from "vitest";
import { capacityDecision } from "../../live/liveScalePolicy.js";
import { canClaimRecordingJob, chooseRecordingNode, isRecordingNodeEligible, recordingJobId } from "../../live/liveRecordingPool.js";
import { RECORDING_STATES, recordingAutoscaleConfig, recordingScaleDecision, recordingShutdownDecision } from "../../live/liveRecordingAutoscale.js";

describe("measured Live production capacity policy", () => {
  it("scales an origin at 16 and refuses publisher 21", () => {
    expect(capacityDecision({ activePublishers: 15 }, "origin")).toMatchObject({ acceptingNewWork: true, scaleOutRecommended: false });
    expect(capacityDecision({ activePublishers: 16 }, "origin")).toMatchObject({ acceptingNewWork: true, scaleOutRecommended: true });
    expect(capacityDecision({ activePublishers: 20 }, "origin").acceptingNewWork).toBe(false);
    expect(capacityDecision({ activePublishers: 21 }, "origin").acceptingNewWork).toBe(false);
  });

  it("applies measured CPU and ingress boundaries", () => {
    expect(capacityDecision({ cpu: 58 }, "origin").scaleOutRecommended).toBe(true);
    expect(capacityDecision({ inboundMbps: 45 }, "origin").scaleOutRecommended).toBe(true);
    expect(capacityDecision({ cpu: 70 }, "origin").acceptingNewWork).toBe(false);
    expect(capacityDecision({ cpu: 85 }, "origin").emergency).toBe(true);
  });

  it("scales recording at 12 and refuses worker 16", () => {
    expect(capacityDecision({ activeJobs: 11 }, "recording")).toMatchObject({ acceptingNewWork: true, scaleOutRecommended: false });
    expect(capacityDecision({ activeJobs: 12 }, "recording")).toMatchObject({ acceptingNewWork: true, scaleOutRecommended: true });
    expect(capacityDecision({ activeJobs: 15 }, "recording").acceptingNewWork).toBe(false);
  });
});

describe("recording pool assignment safety", () => {
  const now = 2_000_000;
  const node = (overrides = {}) => ({ recordingNodeId: "rec-a", region: "us-central1", healthy: true, acceptingNewRecordings: true, activeRecordings: 0, cpu: 10, heartbeatAt: now, ...overrides });

  it("uses one deterministic generation-scoped job identity", () => expect(recordingJobId("session-a", 3)).toBe("session-a_3"));
  it("excludes stale, full, and emergency recording nodes", () => {
    expect(isRecordingNodeEligible(node(), now)).toBe(true);
    expect(isRecordingNodeEligible(node({ heartbeatAt: now - 46_000 }), now)).toBe(false);
    expect(isRecordingNodeEligible(node({ activeRecordings: 15 }), now)).toBe(false);
    expect(isRecordingNodeEligible(node({ cpu: 85 }), now)).toBe(false);
  });
  it("prefers a healthy same-region node with safe capacity", () => {
    const selected = chooseRecordingNode([node({ recordingNodeId: "remote", region: "europe-west1" }), node({ recordingNodeId: "local", activeRecordings: 3 })], { region: "us-central1", nowMs: now });
    expect(selected.recordingNodeId).toBe("local");
  });
  it("prevents a second recorder until the current lease heartbeat is stale", () => {
    const job = { state: RECORDING_STATES.ACTIVE, recordingNodeId: "rec-a", heartbeatAt: now - 5_000 };
    expect(canClaimRecordingJob(job, "rec-b", now)).toBe(false);
    expect(canClaimRecordingJob({ ...job, heartbeatAt: now - 31_000 }, "rec-b", now)).toBe(true);
    expect(canClaimRecordingJob({ state: "STOP_REQUESTED" }, "rec-b", now)).toBe(false);
  });
});

describe("on-demand recording capacity", () => {
  const disabled = recordingAutoscaleConfig({});
  const enabled = recordingAutoscaleConfig({
    LIVE_RECORDING_AUTOSCALE_ENABLED: "true",
    LIVE_RECORDING_MACHINE_PROFILE: "e2-highcpu-4",
    LIVE_RECORDING_MIN_NODES: "0",
    LIVE_RECORDING_MAX_NODES: "2",
    LIVE_RECORDING_MONTHLY_BUDGET_USD: "100",
    LIVE_RECORDING_IDLE_TIMEOUT_SECONDS: "300",
    LIVE_RECORDING_SCALE_COOLDOWN_SECONDS: "120",
  });

  it("defaults to scale-to-zero with provisioning disabled", () => {
    expect(disabled).toMatchObject({ enabled: false, minimumNodes: 0, maximumNodes: 0, monthlyBudgetUsd: 0 });
    expect(recordingScaleDecision({ nodes: [], pendingJobs: 1, config: disabled })).toMatchObject({ action: "NONE", reason: "AUTOSCALE_DISABLED" });
  });

  it("requests first-job capacity only when launch controls and budget are enabled", () => {
    expect(recordingScaleDecision({ nodes: [], pendingJobs: 1, config: enabled })).toMatchObject({ action: "REQUEST_CAPACITY", pendingDemand: 1 });
  });

  it("uses per-machine recording capacity profiles", () => {
    expect(enabled.profile).toMatchObject({ machineType: "e2-highcpu-4", maxRecordings: 3, scaleOutRecordings: 2 });
    expect(recordingAutoscaleConfig({ LIVE_RECORDING_MACHINE_PROFILE: "e2-highcpu-16" }).profile).toMatchObject({ maxRecordings: 15, scaleOutRecordings: 12 });
  });

  it("never shuts down a worker with active, pending, or retrying work", () => {
    const base = { recordingNodeId: "rec-a", activeRecordings: 0, assignedPendingJobs: 0, drainComplete: true, idleSince: 1_000_000, lastScaleAt: 1_000_000 };
    const nowMs = 2_000_000;
    expect(recordingShutdownDecision({ node: { ...base, activeRecordings: 1 }, nowMs, config: enabled }).safeToStop).toBe(false);
    expect(recordingShutdownDecision({ node: base, pendingJobs: 1, nowMs, config: enabled }).safeToStop).toBe(false);
    expect(recordingShutdownDecision({ node: base, retryingJobs: 1, nowMs, config: enabled }).safeToStop).toBe(false);
    expect(recordingShutdownDecision({ node: base, nowMs, config: enabled })).toMatchObject({ safeToStop: true, action: "REQUEST_SHUTDOWN" });
  });
});
