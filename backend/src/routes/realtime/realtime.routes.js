import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import {
  acceptCall,
  cancelCall,
  declineCall,
  endCall,
  getRealtimePlans,
  joinCall,
  listMyCalls,
  markConnected,
  requestPrivateCall,
} from "../../realtime/realtime.controller.js";

const router = Router();

router.get("/plans", getRealtimePlans);
router.get("/calls", authenticate, listMyCalls);
router.post("/calls/request", rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "realtime-call-request" }), authenticate, requestPrivateCall);
router.post("/calls/:callId/accept", authenticate, acceptCall);
router.post("/calls/:callId/cancel", authenticate, cancelCall);
router.post("/calls/:callId/decline", authenticate, declineCall);
router.post("/calls/:callId/join", authenticate, joinCall);
router.post("/calls/:callId/connected", authenticate, markConnected);
router.post("/calls/:callId/end", authenticate, endCall);

export default router;
