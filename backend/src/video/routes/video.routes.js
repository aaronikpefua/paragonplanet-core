import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  acceptCitizenVideoTerms,
  completeVideoUpload,
  getCitizenVideoTerms,
  getVideoUploadPolicy,
  requestUploadUrl,
  listVideos,
  triggerCompression,
  processVideoQueue
} from "../controllers/video.controller.js";
import {
  getCitizenVideoAdminSettings,
  getCitizenVideoOperationalQueues,
  getCitizenVideoVersionHistory,
  getCitizenVideoAdminRecord,
  listCitizenVideoAnalytics,
  listCitizenVideoBilling,
  listCitizenVideoCitizens,
  listCitizenVideoAdminRecords,
  updateCitizenVideoPricing,
  updateCitizenVideoTerms,
} from "../controllers/videoAdmin.controller.js";
import { requireAdmin } from "../../middlewares/admin.middleware.js";
import { heartbeatVideoView, startVideoView } from "../controllers/videoAnalytics.controller.js";

const router = Router();

router.get("/upload-policy", authenticate, getVideoUploadPolicy);
router.get("/terms", authenticate, getCitizenVideoTerms);
router.post("/terms/accept", authenticate, acceptCitizenVideoTerms);
router.post("/upload", authenticate, requestUploadUrl);
router.post("/upload-complete", authenticate, completeVideoUpload);
router.post("/trigger-compression", authenticate, triggerCompression);
router.post("/trigger-merchant-product-compression", authenticate, triggerCompression);
router.post("/process-queue", authenticate, processVideoQueue);
router.get("/list", listVideos);
router.post("/analytics/views", authenticate, startVideoView);
router.post("/analytics/views/:sessionId/heartbeat", authenticate, heartbeatVideoView);
router.get("/admin/settings", authenticate, requireAdmin, getCitizenVideoAdminSettings);
router.put("/admin/pricing", authenticate, requireAdmin, updateCitizenVideoPricing);
router.put("/admin/terms", authenticate, requireAdmin, updateCitizenVideoTerms);
router.get("/admin/videos", authenticate, requireAdmin, listCitizenVideoAdminRecords);
router.get("/admin/videos/:videoId", authenticate, requireAdmin, getCitizenVideoAdminRecord);
router.get("/admin/analytics", authenticate, requireAdmin, listCitizenVideoAnalytics);
router.get("/admin/billing", authenticate, requireAdmin, listCitizenVideoBilling);
router.get("/admin/citizens", authenticate, requireAdmin, listCitizenVideoCitizens);
router.get("/admin/versions", authenticate, requireAdmin, getCitizenVideoVersionHistory);
router.get("/admin/queues", authenticate, requireAdmin, getCitizenVideoOperationalQueues);

export default router;
