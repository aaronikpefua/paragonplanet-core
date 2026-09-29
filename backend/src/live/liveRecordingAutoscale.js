export const RECORDING_STATES = Object.freeze({
  CAPACITY_PENDING: "RECORDING_CAPACITY_PENDING",
  ASSIGNED: "RECORDING_ASSIGNED",
  ACTIVE: "RECORDING_ACTIVE",
  RETRYING: "RECORDING_RETRYING",
  FAILED: "RECORDING_FAILED",
  COMPLETED: "RECORDING_COMPLETED",
});

export const RECORDING_MACHINE_PROFILES = Object.freeze({
  "e2-highcpu-4": Object.freeze({ machineType: "e2-highcpu-4", maxRecordings: 3, scaleOutRecordings: 2, cpuScaleOutPercent: 60, cpuEmergencyPercent: 85 }),
  "e2-highcpu-8": Object.freeze({ machineType: "e2-highcpu-8", maxRecordings: 7, scaleOutRecordings: 6, cpuScaleOutPercent: 60, cpuEmergencyPercent: 85 }),
  "e2-highcpu-16": Object.freeze({ machineType: "e2-highcpu-16", maxRecordings: 15, scaleOutRecordings: 12, cpuScaleOutPercent: 60, cpuEmergencyPercent: 85 }),
});

function integer(value, fallback, min = 0, max = 10_000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

export function recordingAutoscaleConfig(env = process.env) {
  const profileName = String(env.LIVE_RECORDING_MACHINE_PROFILE || "e2-highcpu-16");
  const profile = RECORDING_MACHINE_PROFILES[profileName] || RECORDING_MACHINE_PROFILES["e2-highcpu-16"];
  return Object.freeze({
    enabled: String(env.LIVE_RECORDING_AUTOSCALE_ENABLED || "false").toLowerCase() === "true",
    machineProfile: profile.machineType,
    minimumNodes: integer(env.LIVE_RECORDING_MIN_NODES, 0, 0, 100),
    maximumNodes: integer(env.LIVE_RECORDING_MAX_NODES, 0, 0, 100),
    idleTimeoutSeconds: integer(env.LIVE_RECORDING_IDLE_TIMEOUT_SECONDS, 900, 60, 86_400),
    cooldownSeconds: integer(env.LIVE_RECORDING_SCALE_COOLDOWN_SECONDS, 600, 60, 86_400),
    startupTimeoutSeconds: integer(env.LIVE_RECORDING_STARTUP_TIMEOUT_SECONDS, 300, 30, 1_800),
    regions: String(env.LIVE_RECORDING_REGIONS || "us-central1").split(",").map((item) => item.trim()).filter(Boolean),
    monthlyBudgetUsd: Math.max(0, Number(env.LIVE_RECORDING_MONTHLY_BUDGET_USD || 0)),
    profile,
  });
}

export function recordingScaleDecision({ nodes = [], pendingJobs = 0, retryingJobs = 0, nowMs = Date.now(), config = recordingAutoscaleConfig({}) } = {}) {
  const active = nodes.reduce((sum, node) => sum + Math.max(0, Number(node.activeRecordings || 0)), 0);
  const availableSlots = nodes.reduce((sum, node) => sum + Math.max(0, Number(node.maxRecordings || config.profile.maxRecordings) - Number(node.activeRecordings || 0)), 0);
  const scaleOutPressure = nodes.some((node) => Number(node.activeRecordings || 0) >= Number(node.scaleOutRecordings || config.profile.scaleOutRecordings)
    || Number(node.cpu || 0) >= Number(node.cpuScaleOutPercent || config.profile.cpuScaleOutPercent));
  const lastScaleAt = Math.max(0, ...nodes.map((node) => Number(node.lastScaleAt || 0)));
  const cooldownComplete = !lastScaleAt || nowMs - lastScaleAt >= config.cooldownSeconds * 1000;
  const desiredDemand = Math.max(0, Number(pendingJobs || 0)) + Math.max(0, Number(retryingJobs || 0));
  const mayProvision = config.enabled && config.maximumNodes > nodes.length && cooldownComplete && config.monthlyBudgetUsd > 0;
  return {
    enabled: config.enabled,
    action: mayProvision && (desiredDemand > availableSlots || scaleOutPressure) ? "REQUEST_CAPACITY" : "NONE",
    activeRecordings: active,
    availableSlots,
    pendingDemand: desiredDemand,
    reason: !config.enabled ? "AUTOSCALE_DISABLED" : config.monthlyBudgetUsd <= 0 ? "BUDGET_NOT_APPROVED" : !cooldownComplete ? "COOLDOWN" : "CAPACITY_SUFFICIENT",
  };
}

export function recordingShutdownDecision({ node, pendingJobs = 0, retryingJobs = 0, nowMs = Date.now(), config = recordingAutoscaleConfig({}) } = {}) {
  const idleSince = Number(node?.idleSince || 0);
  const safeToStop = Boolean(node)
    && Number(node.activeRecordings || 0) === 0
    && Number(node.assignedPendingJobs || 0) === 0
    && Number(pendingJobs || 0) === 0
    && Number(retryingJobs || 0) === 0
    && node.drainComplete === true
    && idleSince > 0
    && nowMs - idleSince >= config.idleTimeoutSeconds * 1000
    && nowMs - Number(node.lastScaleAt || 0) >= config.cooldownSeconds * 1000;
  return { safeToStop, action: config.enabled && safeToStop ? "REQUEST_SHUTDOWN" : "NONE", reason: !config.enabled ? "AUTOSCALE_DISABLED" : safeToStop ? "IDLE_DRAINED" : "NOT_SAFE" };
}

export function recordingCapacityStatus({ healthyNodes = 0, assigned = false, active = false, retrying = false, failed = false, completed = false } = {}) {
  if (completed) return RECORDING_STATES.COMPLETED;
  if (active) return RECORDING_STATES.ACTIVE;
  if (retrying) return RECORDING_STATES.RETRYING;
  if (failed) return RECORDING_STATES.FAILED;
  if (assigned) return RECORDING_STATES.ASSIGNED;
  return healthyNodes > 0 ? RECORDING_STATES.CAPACITY_PENDING : RECORDING_STATES.CAPACITY_PENDING;
}
