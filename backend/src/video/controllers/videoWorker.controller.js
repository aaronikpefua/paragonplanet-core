import admin from "../../config/firebase.js";
import { isAdminUser } from "../../lib/adminAccess.js";
import {
  processVideoDeletionJobs,
  processVideoMaintenanceJobs,
  processVideoReconciliationJobs,
} from "../services/videoLifecycleWorkers.js";

function assertWorker(req) {
  const workerSecret = process.env.VIDEO_WORKER_SECRET || "";
  const providedSecret = req.headers["x-worker-secret"];
  if (workerSecret && providedSecret === workerSecret) return;
  if (isAdminUser(req.user)) return;
  const error = new Error("Worker permission required");
  error.status = 403;
  throw error;
}

export async function runVideoReconciliation(req, res) {
  try {
    assertWorker(req);
    const result = await processVideoReconciliationJobs({
      db: admin.firestore(),
      limit: req.body?.limit,
      videoId: req.body?.videoId,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Video reconciliation failed" });
  }
}

export async function runVideoMaintenance(req, res) {
  try {
    assertWorker(req);
    const result = await processVideoMaintenanceJobs({
      db: admin.firestore(),
      limit: req.body?.limit,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Video maintenance worker failed" });
  }
}

export async function runVideoDeletion(req, res) {
  try {
    assertWorker(req);
    const result = await processVideoDeletionJobs({
      db: admin.firestore(),
      limit: req.body?.limit,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Video deletion worker failed" });
  }
}
