import videoRoutes from "./video/routes/video.routes.js";
import authRoutes from "./auth/auth.routes.js";
import walletRoutes from "./routes/wallet/wallet.routes.js";
import marketplaceRoutes from "./routes/marketplace/marketplace.routes.js";
import googlePlayBillingRoutes from "./routes/googlePlayBilling.routes.js";
import nativeXAuthRoutes from "./routes/nativeXAuth.routes.js";
import realtimeRoutes from "./routes/realtime/realtime.routes.js";
import liveRoutes from "./routes/live/live.routes.js";
import tvRoutes from "./routes/tv/tv.routes.js";
import { receiveCloudflareLiveWebhook, runLiveReconciliation } from "./live/liveInternal.controller.js";
import { authorizeLiveMediaGateway, getLiveGatewayRestreamConfig, receiveLiveGatewayEvent, receiveLiveGatewayMetrics } from "./live/liveMediaGateway.controller.js";
import { createM1StagingTestToken } from "./auth/stagingTestAuth.controller.js";
import express from "express";
import cors from "cors";
import testRoutes from "./routes/test.routes.js";
import {
  verifyAppCheck,
  verifyAppCheckOrTrustedTester,
  verifyAppCheckOrUploadAuth,
  verifyAppCheckOrAuthenticatedUser
} from "./middlewares/appcheck.middleware.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { rateLimit } from "./middlewares/rateLimit.middleware.js";
import { requestObservability } from "./middlewares/observability.middleware.js";
import {
  completeVideoUpload,
  getVideoUploadPolicy,
  requestUploadUrl,
  listVideos,
  triggerCompression,
  processVideoQueue
} from "./video/controllers/video.controller.js";
import {
  runVideoDeletion,
  runVideoMaintenance,
  runVideoReconciliation,
} from "./video/controllers/videoWorker.controller.js";
import { receiveCloudflareStreamWebhook } from "./video/controllers/videoWebhook.controller.js";
import { supportBacker, supportSuperboss, supportVideo } from "./controllers/support.controller.js";
import { initializeDeposit, verifyDeposit } from "./controllers/deposit.controller.js";
import { listBanks, resolveBankAccount, requestWithdraw } from "./controllers/bank.controller.js";

const app = express();
const additionalCorsOrigins = (process.env.ADDITIONAL_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  [
    "https://www.paragonplanet.com",
    "https://paragonplanet.com",
    process.env.FRONTEND_ORIGIN,
    ...additionalCorsOrigins
  ].filter(Boolean)
);

// Global middlewares
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck", "X-Request-Id", "Idempotency-Key"],
  })
);
app.use(express.json({
  limit: "1mb",
  verify(req, _res, buffer) {
    if (String(req.originalUrl || "").split("?")[0] === "/internal/video/cloudflare-webhook") {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(requestObservability);
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyPrefix: "api",
  skip: (req) => String(req.path || "").startsWith("/api/live")
    || String(req.path || "") === "/internal/video/cloudflare-webhook",
}));

// Health check endpoint
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "Paragon Planet Backend",
    timestamp: new Date().toISOString()
  });
});
app.post("/internal/live/cloudflare-webhook", rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-webhook" }), receiveCloudflareLiveWebhook);
app.post("/internal/video/cloudflare-webhook", rateLimit({ windowMs: 60 * 1000, limit: 5000, keyPrefix: "video-stream-webhook" }), receiveCloudflareStreamWebhook);
app.post("/internal/live/reconcile", rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "live-reconcile" }), runLiveReconciliation);
app.post("/internal/live/media-gateway/auth", rateLimit({ windowMs: 60 * 1000, limit: 1200, keyPrefix: "live-gateway-auth" }), authorizeLiveMediaGateway);
app.get("/internal/live/media-gateway/restream", rateLimit({ windowMs: 60 * 1000, limit: 120, keyPrefix: "live-gateway-restream" }), getLiveGatewayRestreamConfig);
app.post("/internal/live/media-gateway/event", rateLimit({ windowMs: 60 * 1000, limit: 240, keyPrefix: "live-gateway-event" }), receiveLiveGatewayEvent);
app.post("/internal/live/media-gateway/metrics", rateLimit({ windowMs: 60 * 1000, limit: 240, keyPrefix: "live-gateway-metrics" }), receiveLiveGatewayMetrics);
app.post("/internal/staging/m1-test-login", rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "m1-test-login" }), createM1StagingTestToken);

// Test protected routes
app.use("/api/test", testRoutes);
app.post(
  "/generate-upload-url",
  verifyAppCheckOrUploadAuth,
  authenticate,
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "upload-url" }),
  requestUploadUrl
);
app.post("/trigger-compression", verifyAppCheckOrUploadAuth, authenticate, triggerCompression);
app.post("/trigger-merchant-product-compression", verifyAppCheckOrUploadAuth, authenticate, triggerCompression);
app.post("/internal/video/process-queue", processVideoQueue);
app.post("/internal/video/reconcile", runVideoReconciliation);
app.post("/internal/video/maintenance", runVideoMaintenance);
app.post("/internal/video/delete", runVideoDeletion);
app.post("/support/superboss/:supernalId", verifyAppCheckOrAuthenticatedUser, authenticate, supportSuperboss);
app.post("/support/backer/:backerId", verifyAppCheckOrAuthenticatedUser, authenticate, supportBacker);
app.post("/support/:videoId", verifyAppCheckOrAuthenticatedUser, authenticate, supportVideo);
app.use("/api/native-x-auth", rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "native-x-auth" }), nativeXAuthRoutes);
app.post("/deposit/initialize", verifyAppCheckOrAuthenticatedUser, authenticate, initializeDeposit);
app.post("/deposit/verify", verifyAppCheckOrAuthenticatedUser, authenticate, verifyDeposit);
app.get("/deposit/verify", verifyAppCheckOrAuthenticatedUser, authenticate, verifyDeposit);
app.get("/bank/list", verifyAppCheckOrAuthenticatedUser, authenticate, listBanks);
app.post("/bank/resolve", verifyAppCheckOrAuthenticatedUser, authenticate, resolveBankAccount);
app.post("/withdraw/request", verifyAppCheckOrAuthenticatedUser, authenticate, requestWithdraw);
app.get("/api/video/list", listVideos);
app.get("/api/video/upload-policy", verifyAppCheckOrAuthenticatedUser, authenticate, getVideoUploadPolicy);
app.post("/api/video/upload-complete", verifyAppCheckOrAuthenticatedUser, authenticate, completeVideoUpload);
app.use("/api/wallet", verifyAppCheckOrAuthenticatedUser, walletRoutes);
app.use("/api/marketplace", verifyAppCheckOrAuthenticatedUser, marketplaceRoutes);
app.use("/api/google-play-billing", verifyAppCheckOrAuthenticatedUser, googlePlayBillingRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/live", verifyAppCheckOrAuthenticatedUser, liveRoutes);
app.use("/api/tv", verifyAppCheckOrAuthenticatedUser, tvRoutes);
app.use("/api/auth", verifyAppCheckOrTrustedTester, authRoutes);
app.use("/api/video", verifyAppCheck, videoRoutes);
export default app;
