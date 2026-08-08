import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireAdmin } from "../../middlewares/admin.middleware.js";
import { rateLimit } from "../../middlewares/rateLimit.middleware.js";
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
router.use(rateLimit({ windowMs: 60 * 1000, limit: 300, keyPrefix: "mp-base" }));

// ── Buyer / Merchant transaction flow ─────────────────────────────────────────
router.post(
  "/pay",
  rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "mp-pay" }),
  authenticate,
  fundEscrow
);

router.post(
  "/deliver",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-deliver" }),
  authenticate,
  submitDelivery
);

router.post(
  "/confirm",
  rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "mp-confirm" }),
  authenticate,
  confirmDeliveryAndSettle
);

router.post(
  "/cancel",
  rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "mp-cancel" }),
  authenticate,
  cancelOrder
);

// ── Disputes ──────────────────────────────────────────────────────────────────
router.post(
  "/dispute",
  rateLimit({ windowMs: 60 * 1000, limit: 5, keyPrefix: "mp-dispute" }),
  authenticate,
  openDispute
);

router.post(
  "/dispute/:orderId/respond",
  rateLimit({ windowMs: 60 * 1000, limit: 10, keyPrefix: "mp-dispute-respond" }),
  authenticate,
  respondToDispute
);

// ── Delivery history ──────────────────────────────────────────────────────────
router.get(
  "/delivery/:orderId",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-delivery-read" }),
  authenticate,
  getOrderDelivery
);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get(
  "/notifications",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-notifications" }),
  authenticate,
  getUserNotifications
);
router.post(
  "/notifications/:notificationId/read",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-notif-read" }),
  authenticate,
  markNotificationRead
);

// ── Marketplace settings (public read) ───────────────────────────────────────
router.get(
  "/settings",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-settings" }),
  authenticate,
  getMarketplaceSettings
);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.post(
  "/admin/settings",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-admin-settings" }),
  authenticate, requireAdmin, updateMarketplaceSettings
);
router.get(
  "/admin/orders",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-admin-orders" }),
  authenticate, requireAdmin, adminListOrders
);
router.get(
  "/admin/disputes",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-admin-disputes" }),
  authenticate, requireAdmin, adminListDisputes
);
router.get(
  "/admin/escrow",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-admin-escrow" }),
  authenticate, requireAdmin, adminGetEscrowBalance
);
router.get(
  "/admin/admin-wallet",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-admin-wallet" }),
  authenticate, requireAdmin, adminGetAdminWallet
);
router.get(
  "/admin/commission-report",
  rateLimit({ windowMs: 60 * 1000, limit: 30, keyPrefix: "mp-admin-commission" }),
  authenticate, requireAdmin, adminCommissionReport
);
router.get(
  "/admin/audit-log",
  rateLimit({ windowMs: 60 * 1000, limit: 60, keyPrefix: "mp-admin-audit" }),
  authenticate, requireAdmin, adminListAuditLog
);
router.post(
  "/admin/override",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-admin-override" }),
  authenticate, requireAdmin, adminOverrideOrder
);
router.post(
  "/admin/expire",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-admin-expire" }),
  authenticate, requireAdmin, expireOrder
);
router.post(
  "/admin/auto-settle",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-admin-auto-settle" }),
  authenticate, requireAdmin, autoSettleReviewExpired
);
router.post(
  "/admin/dispute/:orderId/resolve",
  rateLimit({ windowMs: 60 * 1000, limit: 20, keyPrefix: "mp-admin-resolve" }),
  authenticate, requireAdmin, resolveDispute
);

export default router;
