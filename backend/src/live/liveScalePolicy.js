export const LIVE_SCALE_POLICY = Object.freeze({
  origin: {
    scaleOutPublishers: 16,
    maxPublishers: 20,
    cpuScaleOutPercent: 58,
    cpuAdmissionStopPercent: 70,
    cpuEmergencyPercent: 85,
    ingressScaleOutMbps: 45,
    memoryScaleOutPercent: 80,
    networkScaleOutPercent: 75,
  },
  replica: { maxViewers: 600, cpuScaleOutPercent: 70, memoryScaleOutPercent: 75, networkScaleOutPercent: 70 },
  recordingWorker: { scaleOutJobs: 12, maxConcurrentJobs: 15, cpuScaleOutPercent: 60, cpuEmergencyPercent: 85, memoryScaleOutPercent: 80 },
  hlsOverflow: { enabled: false, interactiveViewerLimitPerRoom: 0, passiveDelivery: "cloudflare-hls" },
  placement: { stickyForActiveSession: true, failoverNewSessionsOnly: true },
});

export function capacityDecision(metrics, role) {
  const policy = role === "origin" ? LIVE_SCALE_POLICY.origin : role === "recording" ? LIVE_SCALE_POLICY.recordingWorker : LIVE_SCALE_POLICY.replica;
  const scaleOutRecommended = Number(metrics.cpu || 0) >= policy.cpuScaleOutPercent
    || Number(metrics.memory || 0) >= policy.memoryScaleOutPercent
    || Number(metrics.networkLoad || 0) >= Number(policy.networkScaleOutPercent || 101)
    || (role === "origin" && (Number(metrics.activePublishers || 0) >= policy.scaleOutPublishers || Number(metrics.inboundMbps || 0) >= policy.ingressScaleOutMbps))
    || (role === "replica" && Number(metrics.activeViewers || 0) >= policy.maxViewers)
    || (role === "recording" && Number(metrics.activeJobs || metrics.activeRecordings || 0) >= policy.scaleOutJobs);
  const admissionStopped = Number(metrics.cpu || 0) >= Number(policy.cpuAdmissionStopPercent || policy.cpuEmergencyPercent || 101)
    || (role === "origin" && Number(metrics.activePublishers || 0) >= policy.maxPublishers)
    || (role === "replica" && Number(metrics.activeViewers || 0) >= policy.maxViewers)
    || (role === "recording" && Number(metrics.activeJobs || metrics.activeRecordings || 0) >= policy.maxConcurrentJobs);
  return { acceptingNewWork: !admissionStopped, scaleOutRecommended, emergency: Number(metrics.cpu || 0) >= Number(policy.cpuEmergencyPercent || 101), policy };
}
