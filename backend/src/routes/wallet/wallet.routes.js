import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  createUserWallet,
  creditWallet,
  getWalletBalance
} from "../../controllers/wallet.controller.js";

const router = Router();

// Auto-create wallet
router.post("/create", authenticate, createUserWallet);

// Credit wallet (temporary)
router.post("/credit", authenticate, creditWallet);

// Get balance
router.get("/balance", authenticate, getWalletBalance);

export default router;
