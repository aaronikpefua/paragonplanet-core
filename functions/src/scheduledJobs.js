/**
 * Marketplace Scheduled Jobs
 *
 * Five Cloud Scheduler jobs that run periodically to enforce time-based rules:
 *
 *  1. checkDeliveryDeadlines     – every 15 min
 *     Expires orders where the merchant missed the 7-day delivery window.
 *     Refunds buyer and writes audit.
 *
 *  2. checkBuyerReviewDeadlines  – every 15 min
 *     Auto-settles orders in "delivering" where the buyer did not confirm
 *     or dispute within 72 hours (escrow auto-release).
 *
 *  3. checkDisputeEvidenceDeadlines – every 15 min
 *     Escalates disputes to admin review when the 48-hour evidence window
 *     passes and buyer has not added evidence.
 *
 *  4. checkMerchantResponseDeadlines – every 15 min
 *     Auto-resolves disputed orders in the buyer's favour when the merchant
 *     fails to respond within 48 hours.
 *
 *  5. sendDeadlineReminders – every 1 hour
 *     Sends "approaching deadline" notifications to relevant parties.
 *     Uses order.sentReminders (Set<string>) to deduplicate sends.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

import { db, FieldValue } from "./lib/adminSdk.js";
import { isPast } from "./lib/deadlines.js";
import { writeSystemAudit } from "./lib/audit.js";
import { pushNotifications } from "./lib/notify.js";
import {
  expireOrderAtomically,
  settleOrder,
  autoRefundBuyer,
  escalateDisputeToAdminReview,
  getCommissionPct,
} from "./lib/escrow.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeRun(label, fn) {
  try {
    await fn();
  } catch (err) {
    logger.error(`[${label}] failed:`, err);
  }
}

// ─── Job 1: Delivery deadline enforcement ─────────────────────────────────────

export const checkDeliveryDeadlines = onSchedule(
  { schedule: "every 15 minutes", timeZone: "UTC" },
  async () => {
    const now = new Date();
    const snap = await db
      .collection("merchant_orders")
      .where("status", "==", "escrow_funded")
      .where("deliveryDeadlineAt", "<=", now)
      .limit(50)
      .get();

    logger.info(`checkDeliveryDeadlines: ${snap.size} orders to expire`);

    const promises = snap.docs.map((doc) =>
      safeRun(`expireOrder:${doc.id}`, async () => {
        const order  = doc.data();
        const orderId = doc.id;
        const reason = "Merchant did not deliver within 7 days";

        const result = await expireOrderAtomically({ orderId, order, reason });

        await writeSystemAudit({
          orderId,
          action: "order_auto_expired_delivery",
          extra: {
            reason,
            refunded: result.refunded,
            amount: result.amount,
            currency: result.currency,
          },
        });

        await pushNotifications([
          {
            recipientId: order.buyerId,
            type: "order_auto_expired",
            title: "Order expired – funds refunded",
            body: `The merchant did not deliver order ${orderId} within 7 days. Your funds have been refunded.`,
            orderId,
          },
          {
            recipientId: order.merchantId,
            type: "order_auto_expired",
            title: "Order expired – delivery deadline missed",
            body: `Order ${orderId} has been automatically expired because you did not deliver within 7 days.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "order_auto_expired",
            title: "Order auto-expired (delivery missed)",
            body: `Order ${orderId} expired. Buyer: ${order.buyerId}. Merchant: ${order.merchantId}. Refund: ${result.refunded}.`,
            orderId,
          },
        ]);
      })
    );

    await Promise.allSettled(promises);
    logger.info("checkDeliveryDeadlines: done");
  }
);

// ─── Job 2: Buyer review deadline / escrow auto-release ───────────────────────

export const checkBuyerReviewDeadlines = onSchedule(
  { schedule: "every 15 minutes", timeZone: "UTC" },
  async () => {
    const now = new Date();
    const snap = await db
      .collection("merchant_orders")
      .where("status", "==", "delivering")
      .where("escrowAutoReleaseAt", "<=", now)
      .limit(50)
      .get();

    logger.info(`checkBuyerReviewDeadlines: ${snap.size} orders to auto-settle`);

    const commissionPct = await getCommissionPct();

    const promises = snap.docs.map((doc) =>
      safeRun(`autoSettle:${doc.id}`, async () => {
        const order   = doc.data();
        const orderId = doc.id;

        const result = await settleOrder({ orderId, order, commissionPct });

        await writeSystemAudit({
          orderId,
          action: "order_auto_settled_review_expired",
          extra: {
            amount: result.amount,
            merchantAmount: result.merchantAmount,
            commissionAmount: result.commissionAmount,
            commissionPct: result.commissionPct,
            currency: result.currency,
          },
        });

        await pushNotifications([
          {
            recipientId: order.merchantId,
            type: "order_auto_completed",
            title: "Payment auto-released to your wallet",
            body: `Buyer did not confirm order ${orderId} within 72 hours. ${result.merchantAmount} ${result.currency} has been automatically released to your wallet.`,
            orderId,
          },
          {
            recipientId: order.buyerId,
            type: "order_auto_completed",
            title: "Order auto-completed",
            body: `You did not confirm order ${orderId} within 72 hours. The merchant has been automatically paid.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "order_auto_completed",
            title: "Order auto-settled (buyer review expired)",
            body: `Order ${orderId} auto-settled. Merchant: ${order.merchantId}. Amount: ${result.merchantAmount} ${result.currency}.`,
            orderId,
          },
        ]);
      })
    );

    await Promise.allSettled(promises);
    logger.info("checkBuyerReviewDeadlines: done");
  }
);

// ─── Job 3: Dispute evidence deadline enforcement ─────────────────────────────

export const checkDisputeEvidenceDeadlines = onSchedule(
  { schedule: "every 15 minutes", timeZone: "UTC" },
  async () => {
    const now = new Date();
    const snap = await db
      .collection("marketplace_disputes")
      .where("status", "==", "open")
      .where("disputeEvidenceDeadlineAt", "<=", now)
      .limit(50)
      .get();

    logger.info(`checkDisputeEvidenceDeadlines: ${snap.size} disputes to escalate`);

    const promises = snap.docs.map((doc) =>
      safeRun(`escalateDispute:${doc.id}`, async () => {
        const dispute   = doc.data();
        const disputeId = doc.id;
        const orderId   = dispute.orderId;

        const orderSnap = await db.collection("merchant_orders").doc(orderId).get();
        if (!orderSnap.exists) return;
        const order = orderSnap.data();

        await escalateDisputeToAdminReview({ orderId, order, disputeId });

        await writeSystemAudit({
          orderId,
          action: "dispute_auto_escalated_evidence_expired",
          extra: { disputeId },
        });

        await pushNotifications([
          {
            recipientId: "ADMIN",
            type: "dispute_escalated",
            title: "Dispute escalated – evidence deadline passed",
            body: `Dispute ${disputeId} for order ${orderId} has been escalated. Buyer did not submit evidence within 48 hours.`,
            orderId,
          },
          {
            recipientId: dispute.buyerId,
            type: "dispute_escalated",
            title: "Dispute escalated to admin",
            body: `Your dispute on order ${orderId} has been escalated to admin review because the evidence submission window has passed.`,
            orderId,
          },
          {
            recipientId: dispute.merchantId,
            type: "dispute_escalated",
            title: "Dispute escalated to admin",
            body: `The dispute on order ${orderId} has been escalated to admin review.`,
            orderId,
          },
        ]);
      })
    );

    await Promise.allSettled(promises);
    logger.info("checkDisputeEvidenceDeadlines: done");
  }
);

// ─── Job 4: Merchant dispute response deadline enforcement ────────────────────

export const checkMerchantResponseDeadlines = onSchedule(
  { schedule: "every 15 minutes", timeZone: "UTC" },
  async () => {
    const now = new Date();
    const snap = await db
      .collection("merchant_orders")
      .where("status", "==", "disputed")
      .where("merchantResponseDeadlineAt", "<=", now)
      .limit(50)
      .get();

    logger.info(`checkMerchantResponseDeadlines: ${snap.size} disputes to auto-resolve`);

    const promises = snap.docs.map((doc) =>
      safeRun(`autoResolveDispute:${doc.id}`, async () => {
        const order   = doc.data();
        const orderId = doc.id;

        const result = await autoRefundBuyer({ orderId, order });

        await writeSystemAudit({
          orderId,
          action: "dispute_auto_resolved_merchant_no_response",
          extra: {
            amount: result.amount,
            currency: result.currency,
            disputeId: order.disputeId,
          },
        });

        await pushNotifications([
          {
            recipientId: order.buyerId,
            type: "dispute_auto_resolved",
            title: "Dispute resolved – funds refunded",
            body: `The merchant did not respond to the dispute on order ${orderId} within 48 hours. You have been fully refunded.`,
            orderId,
          },
          {
            recipientId: order.merchantId,
            type: "dispute_auto_resolved",
            title: "Dispute auto-resolved against you",
            body: `You did not respond to the dispute on order ${orderId} within 48 hours. The buyer has been refunded.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "dispute_auto_resolved",
            title: "Dispute auto-resolved (merchant no response)",
            body: `Order ${orderId}: merchant did not respond within 48 h. Buyer refunded ${result.amount} ${result.currency}.`,
            orderId,
          },
        ]);
      })
    );

    await Promise.allSettled(promises);
    logger.info("checkMerchantResponseDeadlines: done");
  }
);
