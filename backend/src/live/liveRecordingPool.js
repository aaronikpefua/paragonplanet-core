import { LIVE_SCALE_POLICY, capacityDecision } from "./liveScalePolicy.js";
import { RECORDING_STATES } from "./liveRecordingAutoscale.js";

export const RECORDING_JOB_ACTIVE_STATES = Object.freeze([RECORDING_STATES.ASSIGNED, RECORDING_STATES.ACTIVE]);

export function recordingJobId(sessionId, mediaGeneration) {
  return `${String(sessionId)}_${Math.max(1, Number(mediaGeneration || 1))}`;
}

export function isRecordingNodeEligible(node, nowMs = Date.now()) {
  if (!node?.recordingNodeId || node.healthy === false || node.acceptingNewRecordings === false) return false;
  const heartbeat = typeof node.heartbeatAt?.toMillis === "function" ? node.heartbeatAt.toMillis() : Number(node.heartbeatAt || node.updatedAt || 0);
  if (!heartbeat || nowMs - heartbeat > 45_000) return false;
  const maxRecordings = Math.max(1, Number(node.maxRecordings || LIVE_SCALE_POLICY.recordingWorker.maxConcurrentJobs));
  return Number(node.activeRecordings || 0) < maxRecordings
    && Number(node.cpu || 0) < Number(node.cpuEmergencyPercent || LIVE_SCALE_POLICY.recordingWorker.cpuEmergencyPercent)
    && capacityDecision({ ...node, activeJobs: Math.min(Number(node.activeRecordings || 0), LIVE_SCALE_POLICY.recordingWorker.maxConcurrentJobs - 1) }, "recording").acceptingNewWork;
}

export function chooseRecordingNode(nodes, { region = "", nowMs = Date.now() } = {}) {
  const eligible = (nodes || []).filter((node) => isRecordingNodeEligible(node, nowMs));
  const regional = region ? eligible.filter((node) => node.region === region) : [];
  return [...(regional.length ? regional : eligible)].sort((a, b) => {
    const loadA = Number(a.activeRecordings || 0) / Math.max(1, Number(a.maxRecordings || LIVE_SCALE_POLICY.recordingWorker.maxConcurrentJobs)) + Number(a.cpu || 0) / 100;
    const loadB = Number(b.activeRecordings || 0) / Math.max(1, Number(b.maxRecordings || LIVE_SCALE_POLICY.recordingWorker.maxConcurrentJobs)) + Number(b.cpu || 0) / 100;
    return loadA - loadB || String(a.recordingNodeId).localeCompare(String(b.recordingNodeId));
  })[0] || null;
}

export function canClaimRecordingJob(job, recordingNodeId, nowMs = Date.now()) {
  if (!job || ["STOP_REQUESTED", RECORDING_STATES.COMPLETED, "CANCELLED"].includes(job.state)) return false;
  if (!RECORDING_JOB_ACTIVE_STATES.includes(job.state)) return true;
  if (job.recordingNodeId === recordingNodeId) return true;
  const heartbeat = typeof job.heartbeatAt?.toMillis === "function" ? job.heartbeatAt.toMillis() : Number(job.heartbeatAt || 0);
  return Boolean(heartbeat && nowMs - heartbeat > 30_000);
}

export function recordingAssignmentPatch({ job, node, now, leaseId }) {
  return {
    recordingNodeId: node.recordingNodeId,
    recordingNodeRegion: node.region || "",
    state: RECORDING_STATES.ASSIGNED,
    leaseId,
    retryCount: Math.max(0, Number(job.retryCount || 0)) + (job.recordingNodeId && job.recordingNodeId !== node.recordingNodeId ? 1 : 0),
    assignedAt: now,
    heartbeatAt: now,
    updatedAt: now,
  };
}
