import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  requestUploadUrl,
  listVideos
} from "../controllers/video.controller.js";

const router = Router();

router.post("/upload", authenticate, requestUploadUrl);
router.get("/list", listVideos);

export default router;
