import crypto from "node:crypto";
import admin from "../config/firebase.js";

const DEFAULT_GATEWAY_ID = "gateway-primary-us-central1";
const RUNTIME_COLLECTION = "live_gateway_runtime";
const REGISTRY_COLLECTION = "live_media_gateways";

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.trunc(parsed))) : fallback;
}

export function gatewayRuntimeConfig(env = process.env) {
  return Object.freeze({
    enabled: String(env.LIVE_GATEWAY_ON_DEMAND_START_ENABLED || "true").toLowerCase() === "true",
    autoscaleEnabled: String(env.LIVE_GATEWAY_AUTOSCALE_ENABLED || "false").toLowerCase() === "true",
    projectId: String(env.LIVE_GATEWAY_GCP_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || "paragonplanet-core"),
    zone: String(env.LIVE_GATEWAY_GCP_ZONE || "us-central1-a"),
    instanceName: String(env.LIVE_GATEWAY_GCP_INSTANCE || "paragon-live-gateway-1"),
    gatewayId: String(env.LIVE_MEDIA_GATEWAY_ID || DEFAULT_GATEWAY_ID),
    startupTimeoutSeconds: integer(env.LIVE_GATEWAY_STARTUP_TIMEOUT_SECONDS, 120, 30, 300),
    heartbeatFreshnessSeconds: integer(env.LIVE_GATEWAY_HEARTBEAT_FRESHNESS_SECONDS, 60, 15, 300),
    idleTimeoutSeconds: integer(env.LIVE_GATEWAY_IDLE_TIMEOUT_SECONDS, 1800, 300, 86400),
    pollIntervalMs: integer(env.LIVE_GATEWAY_STARTUP_POLL_MS, 2500, 500, 10000),
    leaseSeconds: integer(env.LIVE_GATEWAY_STARTUP_LEASE_SECONDS, 30, 10, 120),
  });
}

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

export function isGatewayHeartbeatFresh(gateway, freshnessSeconds = 60, nowMs = Date.now()) {
  const observedAt = millis(gateway?.updatedAt || gateway?.lastSeen || gateway?.lastHeartbeatAt);
  return observedAt > 0 && nowMs - observedAt <= freshnessSeconds * 1000;
}

export function isGatewayReady(gateway, config = gatewayRuntimeConfig(), nowMs = Date.now()) {
  return Boolean(
    gateway?.gatewayId === config.gatewayId
    && gateway?.healthy === true
    && gateway?.acceptingNewPublishers !== false
    && gateway?.publicUrl
    && isGatewayHeartbeatFresh(gateway, config.heartbeatFreshnessSeconds, nowMs)
  );
}

async function metadataAccessToken(fetchImpl = fetch) {
  const response = await fetchImpl("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Could not obtain gateway controller token (${response.status}).`);
  const payload = await response.json();
  if (!payload?.access_token) throw new Error("Gateway controller token was empty.");
  return payload.access_token;
}

function instanceUrl(config) {
  return `https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(config.projectId)}/zones/${encodeURIComponent(config.zone)}/instances/${encodeURIComponent(config.instanceName)}`;
}

export async function readGatewayVmState({ config = gatewayRuntimeConfig(), fetchImpl = fetch, tokenProvider = metadataAccessToken } = {}) {
  const token = await tokenProvider(fetchImpl);
  const response = await fetchImpl(instanceUrl(config), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Object.assign(new Error(`Could not read Live gateway VM state (${response.status}).`), { code: "LIVE_GATEWAY_VM_READ_FAILED" });
  const payload = await response.json();
  return String(payload?.status || "UNKNOWN").toUpperCase();
}

export async function requestGatewayVmStart({ config = gatewayRuntimeConfig(), fetchImpl = fetch, tokenProvider = metadataAccessToken } = {}) {
  const token = await tokenProvider(fetchImpl);
  const response = await fetchImpl(`${instanceUrl(config)}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Object.assign(new Error(`Could not start Live gateway VM (${response.status}).`), { code: "LIVE_GATEWAY_VM_START_FAILED" });
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimStartupLease(db, config, owner, nowMs = Date.now()) {
  const ref = db.collection(RUNTIME_COLLECTION).doc(config.gatewayId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists ? snap.data() || {} : {};
    const leaseExpiresMs = millis(current.leaseExpiresAt);
    const ownsActiveLease = current.runtimeState === "STARTING" && leaseExpiresMs > nowMs && current.leaseOwner !== owner;
    if (ownsActiveLease) return { leader: false, operationGeneration: Number(current.operationGeneration || 1) };
    const generation = Number(current.operationGeneration || 0) + 1;
    transaction.set(ref, {
      gatewayId: config.gatewayId,
      projectId: config.projectId,
      zone: config.zone,
      instanceName: config.instanceName,
      desiredState: "RUNNING",
      runtimeState: "STARTING",
      operationGeneration: generation,
      leaseOwner: owner,
      leaseExpiresAt: admin.firestore.Timestamp.fromMillis(nowMs + config.leaseSeconds * 1000),
      startupRequestedAt: current.startupRequestedAt || admin.firestore.Timestamp.fromMillis(nowMs),
      updatedAt: admin.firestore.Timestamp.fromMillis(nowMs),
    }, { merge: true });
    return { leader: true, operationGeneration: generation };
  });
}

async function updateRuntime(db, config, patch) {
  await db.collection(RUNTIME_COLLECTION).doc(config.gatewayId).set({
    gatewayId: config.gatewayId,
    projectId: config.projectId,
    zone: config.zone,
    instanceName: config.instanceName,
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function ensureGatewayReady({
  db = admin.firestore(),
  config = gatewayRuntimeConfig(),
  readVmState = (options) => readGatewayVmState(options),
  startVm = (options) => requestGatewayVmStart(options),
  sleep = delay,
  now = () => Date.now(),
} = {}) {
  if (!config.enabled) return { ready: true, bypassed: true, gatewayId: config.gatewayId };
  const startedAt = now();
  const deadline = startedAt + config.startupTimeoutSeconds * 1000;
  const owner = crypto.randomUUID();
  const registryRef = db.collection(REGISTRY_COLLECTION).doc(config.gatewayId);

  const initialGateway = await registryRef.get();
  let vmState = await readVmState({ config });
  if (vmState === "RUNNING" && initialGateway.exists && isGatewayReady({ gatewayId: initialGateway.id, ...initialGateway.data() }, config, now())) {
    await updateRuntime(db, config, { desiredState: "RUNNING", observedVmState: vmState, runtimeState: "READY", readyAt: admin.firestore.FieldValue.serverTimestamp(), lastErrorCode: "" });
    return { ready: true, startedVm: false, gatewayId: config.gatewayId, durationMs: now() - startedAt };
  }

  const lease = await claimStartupLease(db, config, owner, now());
  let startRequested = false;
  if (lease.leader && !["RUNNING", "STAGING"].includes(vmState)) {
    await startVm({ config }).then(() => { startRequested = true; });
  }

  while (now() < deadline) {
    vmState = await readVmState({ config });
    const gatewaySnap = await registryRef.get();
    const gateway = gatewaySnap.exists ? { gatewayId: gatewaySnap.id, ...gatewaySnap.data() } : null;
    if (vmState === "RUNNING" && isGatewayReady(gateway, config, now())) {
      await updateRuntime(db, config, {
        desiredState: "RUNNING",
        observedVmState: vmState,
        runtimeState: "READY",
        readyAt: admin.firestore.FieldValue.serverTimestamp(),
        lastHealthyHeartbeatAt: gateway.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        leaseOwner: "",
        leaseExpiresAt: null,
        lastErrorCode: "",
      });
      return { ready: true, startedVm: startRequested, joinedStartup: !lease.leader, gatewayId: config.gatewayId, durationMs: now() - startedAt };
    }
    if (lease.leader) {
      await updateRuntime(db, config, {
        observedVmState: vmState,
        runtimeState: vmState === "RUNNING" ? "HEALTH_CHECKING" : "STARTING",
        leaseOwner: owner,
        leaseExpiresAt: admin.firestore.Timestamp.fromMillis(now() + config.leaseSeconds * 1000),
      });
    }
    await sleep(config.pollIntervalMs);
  }

  await updateRuntime(db, config, {
    observedVmState: vmState,
    runtimeState: "FAILED",
    leaseOwner: "",
    leaseExpiresAt: null,
    lastErrorCode: "LIVE_GATEWAY_START_TIMEOUT",
    lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  throw Object.assign(new Error("Paragon Live could not start. Please try again shortly."), {
    status: 503,
    code: "LIVE_GATEWAY_START_TIMEOUT",
  });
}

export const LIVE_GATEWAY_RUNTIME_COLLECTION = RUNTIME_COLLECTION;
