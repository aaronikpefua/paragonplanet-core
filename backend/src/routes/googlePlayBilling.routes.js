import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { verifyWalletPurchase } from "../controllers/googlePlayBilling.controller.js";

const router = Router();

router.post("/wallet/verify", authenticate, verifyWalletPurchase);

export default router;
