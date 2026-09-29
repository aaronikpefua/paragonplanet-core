import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/admin.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import {
  adminActivateChannel,
  adminCreateChannel,
  adminCreateProgram,
  adminDeactivateChannel,
  adminScheduleProgram,
  adminUpdateChannel,
  adminUpdateProgram,
  publicGetChannel,
  publicGetCurrentProgram,
  publicGetNextProgram,
  publicListChannels,
  publicListSchedule,
} from "../../tv/tv.controller.js";

const router = Router();
const publicReadLimit = rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "tv-public-read" });
const adminWriteLimit = rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "tv-admin-write" });

router.get("/channels", publicReadLimit, publicListChannels);
router.get("/channels/:channelId", publicReadLimit, publicGetChannel);
router.get("/channels/:channelId/current", publicReadLimit, publicGetCurrentProgram);
router.get("/channels/:channelId/next", publicReadLimit, publicGetNextProgram);
router.get("/channels/:channelId/schedule", publicReadLimit, publicListSchedule);

router.post("/admin/channels", authenticate, requireAdmin, adminWriteLimit, adminCreateChannel);
router.put("/admin/channels/:channelId", authenticate, requireAdmin, adminWriteLimit, adminUpdateChannel);
router.post("/admin/channels/:channelId/activate", authenticate, requireAdmin, adminWriteLimit, adminActivateChannel);
router.post("/admin/channels/:channelId/deactivate", authenticate, requireAdmin, adminWriteLimit, adminDeactivateChannel);
router.post("/admin/programs", authenticate, requireAdmin, adminWriteLimit, adminCreateProgram);
router.put("/admin/programs/:programId", authenticate, requireAdmin, adminWriteLimit, adminUpdateProgram);
router.post("/admin/programs/:programId/schedule", authenticate, requireAdmin, adminWriteLimit, adminScheduleProgram);

export default router;
