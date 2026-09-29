import admin from "../config/firebase.js";
import { capacityDecision, LIVE_SCALE_POLICY } from "./liveScalePolicy.js";
import { gatewayRuntimeConfig, isGatewayHeartbeatFresh } from "./liveGatewayRuntime.js";

const DEFAULT_THRESHOLDS = Object.freeze({ publishers: 20, viewers: 600, cpu: 70, memory: 80, network: 75 });

function legacyGateway() {
  return {
    gatewayId: String(process.env.LIVE_MEDIA_GATEWAY_ID || "gateway-primary-us-central1"),
    region: String(process.env.LIVE_MEDIA_GATEWAY_REGION || "us-central1"),
    role: "origin-viewer",
    publicUrl: String(process.env.LIVE_MEDIA_GATEWAY_PUBLIC_URL || "").replace(/\/$/, ""),
    rtmpsUrl: String(process.env.LIVE_MEDIA_GATEWAY_RTMPS_URL || "").replace(/\/$/, ""),
    srtUrl: String(process.env.LIVE_MEDIA_GATEWAY_SRT_URL || "").replace(/\/$/, ""),
    healthy: true,
    acceptingNewPublishers: true,
    acceptingNewViewers: true,
    activePublishers: 0,
    activeViewers: 0,
    cpu: 0,
    memory: 0,
    networkLoad: 0,
    priority: 100,
  };
}

export function isGatewayEligible(gateway, role) {
  if (!gateway?.gatewayId || !gateway.publicUrl || gateway.healthy === false) return false;
  if (!isGatewayHeartbeatFresh(gateway, gatewayRuntimeConfig().heartbeatFreshnessSeconds)) return false;
  if (role === "publisher" && gateway.acceptingNewPublishers === false) return false;
  if (role === "viewer" && gateway.acceptingNewViewers === false) return false;
  if (role === "publisher" && !capacityDecision(gateway, "origin").acceptingNewWork) return false;
  return true;
}

function advertisedUrl(value, allowedProtocols) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return allowedProtocols.includes(parsed.protocol) ? raw : "";
  } catch {
    return "";
  }
}

function score(gateway, role) {
  const utilization = role === "publisher"
    ? Number(gateway.activePublishers || 0) / Math.max(1, Number(gateway.publisherCapacity || DEFAULT_THRESHOLDS.publishers))
    : Number(gateway.activeViewers || 0) / Math.max(1, Number(gateway.viewerCapacity || DEFAULT_THRESHOLDS.viewers));
  return utilization * 100 + Number(gateway.cpu || 0) + Number(gateway.memory || 0) * 0.5
    + Number(gateway.networkLoad || 0) * 1.5 - Number(gateway.priority || 0) * 0.01;
}

export async function listHealthyGateways({ role = "publisher", region = "" } = {}) {
  const db = admin.firestore();
  const snapshot = await db.collection("live_media_gateways").where("healthy", "==", true).limit(100).get().catch(() => null);
  let gateways = snapshot?.docs?.map((doc) => ({ gatewayId: doc.id, ...doc.data() })) || [];
  if (!gateways.length) gateways = [legacyGateway()];
  const regionMatches = region ? gateways.filter((gateway) => gateway.region === region && isGatewayEligible(gateway, role)) : [];
  return (regionMatches.length ? regionMatches : gateways.filter((gateway) => isGatewayEligible(gateway, role))).sort((a, b) => score(a, role) - score(b, role));
}

export async function chooseIngestGateway({ region = "" } = {}) {
  const [gateway] = await listHealthyGateways({ role: "publisher", region });
  if (!gateway) throw Object.assign(new Error("No healthy Live ingest gateway is accepting publishers."), { status: 503 });
  return gateway;
}

export async function chooseViewerGateway(session, { region = "" } = {}) {
  const replicas = Array.isArray(session.viewerGatewayIds) ? session.viewerGatewayIds : [];
  if (replicas.length) {
    const healthy = await listHealthyGateways({ role: "viewer", region });
    const selected = healthy.find((gateway) => replicas.includes(gateway.gatewayId));
    if (selected) return selected;
  }
  return {
    ...legacyGateway(),
    gatewayId: session.gatewayId || session.originGatewayId || legacyGateway().gatewayId,
    region: session.gatewayRegion || legacyGateway().region,
    publicUrl: session.gatewayPublicUrl || legacyGateway().publicUrl,
    rtmpsUrl: session.gatewayRtmpsUrl || legacyGateway().rtmpsUrl,
    srtUrl: session.gatewaySrtUrl || legacyGateway().srtUrl,
  };
}

export function gatewayAssignment(gateway) {
  return {
    gatewayId: gateway.gatewayId,
    originGatewayId: gateway.gatewayId,
    gatewayRegion: gateway.region || "",
    gatewayRole: gateway.role || "origin-viewer",
    gatewayPublicUrl: gateway.publicUrl,
    gatewayRtmpsUrl: gateway.rtmpsUrl || "",
    gatewaySrtUrl: gateway.srtUrl || "",
    gatewayAssignedAt: admin.firestore.FieldValue.serverTimestamp(),
    viewerGatewayIds: [gateway.gatewayId],
  };
}

export async function persistGatewayHealth(gatewayId, metrics) {
  const safeId = String(gatewayId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  if (!safeId) throw Object.assign(new Error("gatewayId is required"), { status: 400 });
  const numeric = (name) => Math.max(0, Number(metrics?.[name] || 0));
  const patch = {
    gatewayId: safeId,
    region: String(metrics?.region || "unknown").slice(0, 40),
    role: String(metrics?.role || "origin-viewer").slice(0, 40),
    healthy: metrics?.healthy !== false,
    acceptingNewPublishers: metrics?.acceptingNewPublishers !== false && capacityDecision({
      cpu: numeric("cpu"), memory: numeric("memory"), networkLoad: numeric("networkLoad"),
      inboundMbps: numeric("inboundMbps"), activePublishers: numeric("activePublishers"),
    }, "origin").acceptingNewWork,
    acceptingNewViewers: metrics?.acceptingNewViewers !== false && numeric("memory") < DEFAULT_THRESHOLDS.memory && numeric("networkLoad") < DEFAULT_THRESHOLDS.network,
    activePublishers: numeric("activePublishers"), activeViewers: numeric("activeViewers"),
    cpu: numeric("cpu"), memory: numeric("memory"), networkLoad: numeric("networkLoad"),
    inboundMbps: numeric("inboundMbps"), outboundMbps: numeric("outboundMbps"),
    turnAllocations: numeric("turnAllocations"), zombieProcessCount: numeric("zombieProcessCount"),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const publicUrl = advertisedUrl(metrics?.publicUrl, ["https:"]);
  const rtmpsUrl = advertisedUrl(metrics?.rtmpsUrl, ["rtmps:"]);
  const srtUrl = advertisedUrl(metrics?.srtUrl, ["srt:"]);
  if (publicUrl) patch.publicUrl = publicUrl;
  if (rtmpsUrl) patch.rtmpsUrl = rtmpsUrl;
  if (srtUrl) patch.srtUrl = srtUrl;

  // During a single-gateway migration, repair a heartbeat-created registry
  // document from the backend's configured endpoint without bypassing health
  // or admission checks. New gateways must advertise their own endpoints.
  const configured = legacyGateway();
  if (safeId === configured.gatewayId) {
    if (!patch.publicUrl && configured.publicUrl) patch.publicUrl = configured.publicUrl;
    if (!patch.rtmpsUrl && configured.rtmpsUrl) patch.rtmpsUrl = configured.rtmpsUrl;
    if (!patch.srtUrl && configured.srtUrl) patch.srtUrl = configured.srtUrl;
  }
  await admin.firestore().collection("live_media_gateways").doc(safeId).set(patch, { merge: true });
  return patch;
}

export const LIVE_GATEWAY_CAPACITY_THRESHOLDS = DEFAULT_THRESHOLDS;
export const LIVE_ORIGIN_MEASURED_POLICY = LIVE_SCALE_POLICY.origin;
