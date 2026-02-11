import videoRoutes from "./video/routes/video.routes.js";
import authRoutes from "./auth/auth.routes.js";
import walletRoutes from "./routes/wallet/wallet.routes.js";
import express from "express";
import cors from "cors";
import testRoutes from "./routes/test.routes.js";

const app = express();

// Global middlewares
app.use(cors());
app.use(express.json());

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
app.use("/api/wallet", walletRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/video", videoRoutes);
export default app;
