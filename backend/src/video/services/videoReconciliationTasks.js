import { CloudTasksClient } from "@google-cloud/tasks";

let client;

export const VIDEO_RECOVERY_BASE_DELAY_SECONDS = 300;
export const VIDEO_RECOVERY_JITTER_SECONDS = 299;
export const VIDEO_RECOVERY_MAX_DELAY_SECONDS = 3600;
export const VIDEO_RECOVERY_TASK_ATTEMPTS = 4;

function tasksClient() {
  if (!client) client = new CloudTasksClient();
  return client;
}

function stableJitterIndex(videoId, attempt, bucketCount) {
  if (!videoId || bucketCount <= 1) return 0;
  const input = `${videoId}:${Number(attempt) || 0}`;
  let hash = 0;
  for (const character of input) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  return hash % bucketCount;
}

export function reconciliationRecoveryDelaySeconds(attempt = 1, videoId = "") {
  const recoveryAttempt = Math.max(1, Number(attempt) || 1);
  const exponentialDelay = Math.min(
    VIDEO_RECOVERY_MAX_DELAY_SECONDS,
    VIDEO_RECOVERY_BASE_DELAY_SECONDS * (2 ** (recoveryAttempt - 1)),
  );
  const jitter = stableJitterIndex(videoId, recoveryAttempt, VIDEO_RECOVERY_JITTER_SECONDS + 1);
  return exponentialDelay + jitter;
}

export function maximumRecoveryReadinessChecks() {
  return VIDEO_RECOVERY_TASK_ATTEMPTS;
}

export async function scheduleVideoReconciliation({ videoId, delaySeconds = 10, attempt = 0 } = {}) {
  const client = tasksClient();
  const project = process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID
    || await client.getProjectId();
  const location = process.env.VIDEO_RECONCILIATION_TASK_LOCATION || "us-central1";
  const queue = process.env.VIDEO_RECONCILIATION_TASK_QUEUE || "";
  const url = process.env.VIDEO_RECONCILIATION_URL || "";
  const workerSecret = process.env.VIDEO_WORKER_SECRET || "";
  if (!project || !queue || !url || !workerSecret || !videoId) return { scheduled: false };

  const parent = client.queuePath(project, location, queue);
  const suffix = `${String(videoId).replace(/[^A-Za-z0-9_-]/g, "-")}-${Number(attempt) || 0}`;
  const task = {
    name: `${parent}/tasks/video-reconcile-${suffix}`,
    // Round up after adding the delay. Rounding the current time down could
    // dispatch a task just before Firestore nextRetryAt, consuming the retry
    // without performing a Stream status check.
    scheduleTime: { seconds: Math.ceil((Date.now() + (Math.max(0, Number(delaySeconds) || 0) * 1000)) / 1000) },
    httpRequest: {
      httpMethod: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: Buffer.from(JSON.stringify({ videoId })).toString("base64"),
    },
  };
  try {
    await client.createTask({ parent, task });
    return { scheduled: true, taskName: task.name };
  } catch (error) {
    if (Number(error?.code) === 6 || String(error?.message || "").includes("ALREADY_EXISTS")) {
      return { scheduled: true, duplicate: true, taskName: task.name };
    }
    throw error;
  }
}
