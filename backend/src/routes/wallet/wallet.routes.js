import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
import {
  createUserWallet,
  creditWallet,
  getWalletBalance,
  settleMarketplaceOrder,
} from "../../controllers/wallet.controller.js";

const router = Router();

// Auto-create wallet
router.post("/create", authenticate, createUserWallet);

// Credit wallet (temporary)
router.post("/credit", authenticate, creditWallet);

// Get balance
router.get("/balance", authenticate, getWalletBalance);

// Settle a marketplace order (debit buyer, credit merchant)
router.post(
  "/settle-order",
  rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "settle-order" }),
  authenticate,
  settleMarketplaceOrder
);

export default router;
