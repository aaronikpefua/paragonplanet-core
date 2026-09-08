import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import {
  endLiveSession,
  getLiveRoomToken,
  getLiveSession,
  getLiveStatus,
  heartbeatLiveSession,
  listLiveChatMessages,
  listLiveSessions,
  markLiveSessionActive,
  moderateLiveRoom,
  postLiveChatMessage,
  postLiveReaction,
  scheduleLiveSession,
  startLiveSession,
  supportLiveSession,
} from "../../live/live.controller.js";

const router = Router();

router.get("/status", rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "live-status" }), getLiveStatus);
router.get("/sessions", rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-sessions" }), listLiveSessions);
router.get("/sessions/:sessionId", rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-session" }), getLiveSession);
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
router.get("/sessions/:sessionId/room-token", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "live-room-token" }), getLiveRoomToken);
router.get("/sessions/:sessionId/chat", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-chat-list" }), listLiveChatMessages);
router.post("/sessions/:sessionId/chat", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "live-chat-post" }), postLiveChatMessage);
router.post("/sessions/:sessionId/reactions", authenticate, rateLimit({ windowMs: 10 * 1000, limit: 20, keyPrefix: "live-reaction-post" }), postLiveReaction);
router.post("/sessions/:sessionId/moderation", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "live-room-moderation" }), moderateLiveRoom);
router.post("/sessions/:sessionId/support", authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "live-support" }), supportLiveSession);

export default router;
