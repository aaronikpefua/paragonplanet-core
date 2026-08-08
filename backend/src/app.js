import videoRoutes from "./video/routes/video.routes.js";
import authRoutes from "./auth/auth.routes.js";
import walletRoutes from "./routes/wallet/wallet.routes.js";
import marketplaceRoutes from "./routes/marketplace/marketplace.routes.js";
import googlePlayBillingRoutes from "./routes/googlePlayBilling.routes.js";
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
import {
  requestUploadUrl,
  listVideos,
  triggerCompression,
  processVideoQueue
} from "./video/controllers/video.controller.js";
import { supportSuperboss, supportVideo } from "./controllers/support.controller.js";
import { initializeDeposit, verifyDeposit } from "./controllers/deposit.controller.js";
import { listBanks, resolveBankAccount, requestWithdraw } from "./controllers/bank.controller.js";

const app = express();
const allowedOrigins = new Set(
  [
    "https://www.paragonplanet.com",
    "https://paragonplanet.com",
    process.env.FRONTEND_ORIGIN
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, keyPrefix: "api" }));

// Health check endpoint
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "Paragon Planet Backend",
    timestamp: new Date().toISOString()
  });
});

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
app.post("/support/superboss/:supernalId", verifyAppCheckOrAuthenticatedUser, authenticate, supportSuperboss);
app.post("/support/:videoId", verifyAppCheckOrAuthenticatedUser, authenticate, supportVideo);
app.post("/deposit/initialize", verifyAppCheckOrAuthenticatedUser, authenticate, initializeDeposit);
app.post("/deposit/verify", verifyAppCheckOrAuthenticatedUser, authenticate, verifyDeposit);
app.get("/deposit/verify", verifyAppCheckOrAuthenticatedUser, authenticate, verifyDeposit);
app.get("/bank/list", verifyAppCheckOrAuthenticatedUser, authenticate, listBanks);
app.post("/bank/resolve", verifyAppCheckOrAuthenticatedUser, authenticate, resolveBankAccount);
app.post("/withdraw/request", verifyAppCheckOrAuthenticatedUser, authenticate, requestWithdraw);
app.get("/api/video/list", listVideos);
app.use("/api/wallet", verifyAppCheckOrAuthenticatedUser, walletRoutes);
app.use("/api/marketplace", verifyAppCheckOrAuthenticatedUser, marketplaceRoutes);
app.use("/api/google-play-billing", verifyAppCheckOrAuthenticatedUser, googlePlayBillingRoutes);
app.use("/api/auth", verifyAppCheckOrTrustedTester, authRoutes);
app.use("/api/video", verifyAppCheck, videoRoutes);
export default app;
