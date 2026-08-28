import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import {
  endLiveSession,
  getLiveStatus,
  heartbeatLiveSession,
  listLiveChatMessages,
  listLiveSessions,
  markLiveSessionActive,
  postLiveChatMessage,
  scheduleLiveSession,
  startLiveSession,
  supportLiveSession,
} from "../../live/live.controller.js";

const router = Router();

router.get("/status", rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "live-status" }), getLiveStatus);
router.get("/sessions", rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-sessions" }), listLiveSessions);
router.post("/sessions/schedule", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "live-schedule" }), scheduleLiveSession);
router.post(
  "/sessions/start",
  authenticate,
  rateLimit({ windowMs: 60 * 1000, limit: 5, keyPrefix: "live-start" }),
  startLiveSession
);
router.post("/sessions/:sessionId/active", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "live-active" }), markLiveSessionActive);
router.post("/sessions/:sessionId/heartbeat", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "live-heartbeat" }), heartbeatLiveSession);
router.post("/sessions/:sessionId/end", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "live-end" }), endLiveSession);
router.get("/sessions/:sessionId/chat", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-chat-list" }), listLiveChatMessages);
router.post("/sessions/:sessionId/chat", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "live-chat-post" }), postLiveChatMessage);
router.post("/sessions/:sessionId/support", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "live-support" }), supportLiveSession);

export default router;
