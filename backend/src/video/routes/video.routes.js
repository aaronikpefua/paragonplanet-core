import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  requestUploadUrl,
  listVideos,
  triggerCompression,
  processVideoQueue
} from "../controllers/video.controller.js";

const router = Router();

router.post("/upload", authenticate, requestUploadUrl);
router.post("/trigger-compression", authenticate, triggerCompression);
router.post("/trigger-merchant-product-compression", authenticate, triggerCompression);
router.post("/process-queue", authenticate, processVideoQueue);
router.get("/list", listVideos);

export default router;
