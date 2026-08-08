import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/admin.middleware.js";
import {
  // Escrow / transaction flow
  fundEscrow,
  submitDelivery,
  confirmDeliveryAndSettle,
  cancelOrder,
  expireOrder,
  autoSettleReviewExpired,
  // Disputes
  openDispute,
  respondToDispute,
  resolveDispute,
  // Delivery
  getOrderDelivery,
  // Settings
  getMarketplaceSettings,
  updateMarketplaceSettings,
  // Notifications
  getUserNotifications,
  markNotificationRead,
  // Admin dashboard
  adminListOrders,
  adminListDisputes,
  adminGetEscrowBalance,
  adminGetAdminWallet,
  adminCommissionReport,
  adminListAuditLog,
  adminOverrideOrder,
} from "../../controllers/marketplace.controller.js";

const router = Router();

// Apply a base rate limit to all marketplace routes (300 req/min per user).
// Individual financial routes have stricter limits applied per-route below.
router.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

// ── Buyer / Merchant transaction flow ─────────────────────────────────────────
router.post(
  "/pay",
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authenticate,
  fundEscrow
);

router.post(
  "/deliver",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate,
  submitDelivery
);

router.post(
  "/confirm",
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authenticate,
  confirmDeliveryAndSettle
);

router.post(
  "/cancel",
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authenticate,
  cancelOrder
);

// ── Disputes ──────────────────────────────────────────────────────────────────
router.post(
  "/dispute",
  rateLimit({ windowMs: 60 * 1000, max: 5 }),
  authenticate,
  openDispute
);

router.post(
  "/dispute/:orderId/respond",
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  authenticate,
  respondToDispute
);

// ── Delivery history ──────────────────────────────────────────────────────────
router.get(
  "/delivery/:orderId",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate,
  getOrderDelivery
);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get(
  "/notifications",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate,
  getUserNotifications
);
router.post(
  "/notifications/:notificationId/read",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate,
  markNotificationRead
);

// ── Marketplace settings (public read) ───────────────────────────────────────
router.get(
  "/settings",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate,
  getMarketplaceSettings
);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.post(
  "/admin/settings",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate, requireAdmin, updateMarketplaceSettings
);
router.get(
  "/admin/orders",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate, requireAdmin, adminListOrders
);
router.get(
  "/admin/disputes",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate, requireAdmin, adminListDisputes
);
router.get(
  "/admin/escrow",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate, requireAdmin, adminGetEscrowBalance
);
router.get(
  "/admin/admin-wallet",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate, requireAdmin, adminGetAdminWallet
);
router.get(
  "/admin/commission-report",
  rateLimit({ windowMs: 60 * 1000, max: 30 }),
  authenticate, requireAdmin, adminCommissionReport
);
router.get(
  "/admin/audit-log",
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  authenticate, requireAdmin, adminListAuditLog
);
router.post(
  "/admin/override",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate, requireAdmin, adminOverrideOrder
);
router.post(
  "/admin/expire",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate, requireAdmin, expireOrder
);
router.post(
  "/admin/auto-settle",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate, requireAdmin, autoSettleReviewExpired
);
router.post(
  "/admin/dispute/:orderId/resolve",
  rateLimit({ windowMs: 60 * 1000, max: 20 }),
  authenticate, requireAdmin, resolveDispute
);

export default router;
