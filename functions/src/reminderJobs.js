/**
 * Reminder Jobs – send "deadline approaching" notifications.
 *
 * Runs every hour. Uses order.sentReminders (array of string keys) to
 * deduplicate sends so parties are not spammed across multiple runs.
 *
 * Reminder keys (also defined in DeadlineService/deadlines.js):
 *   delivery_24h       – merchant: 24 h before delivery deadline
 *   buyer_review_12h   – buyer: 12 h before review / auto-release
 *   dispute_6h         – both parties + admin: 6 h before dispute deadline
 *   escrow_release_6h  – buyer + admin: 6 h before auto-release
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

import { db, FieldValue } from "./lib/adminSdk.js";
import {
  isApproaching,
  DELIVERY_REMINDER_MS,
  BUYER_REVIEW_REMINDER_MS,
  DISPUTE_REMINDER_MS,
  ESCROW_RELEASE_REMINDER_MS,
  REMINDER_DELIVERY_24H,
  REMINDER_BUYER_REVIEW_12H,
  REMINDER_DISPUTE_6H,
  REMINDER_ESCROW_RELEASE_6H,
} from "./lib/deadlines.js";
import { pushNotifications } from "./lib/notify.js";
import { writeSystemAudit } from "./lib/audit.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return true if a reminder key has NOT already been sent for this order.
 * @param {object} order  Firestore document data
 * @param {string} key
 */
function reminderNotSent(order, key) {
  return !(order.sentReminders || []).includes(key);
}

/**
 * Atomically mark a reminder as sent so it is not re-sent on the next run.
 * @param {string} orderId
 * @param {string} key
 */
async function markReminderSent(orderId, key) {
  await db
    .collection("merchant_orders")
    .doc(orderId)
    .update({
      sentReminders: FieldValue.arrayUnion(key),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

async function safeRun(label, fn) {
  try {
    await fn();
  } catch (err) {
    logger.error(`[reminder:${label}] failed:`, err);
  }
}

// ─── Reminder Job ─────────────────────────────────────────────────────────────

export const sendDeadlineReminders = onSchedule(
  { schedule: "every 1 hours", timeZone: "UTC" },
  async () => {
    const now     = new Date();
    const in24h   = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in12h   = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const in6h    = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // ── 1. Delivery reminder (24 h window) ──────────────────────────────────
    const deliverySnap = await db
      .collection("merchant_orders")
      .where("status", "==", "escrow_funded")
      .where("deliveryDeadlineAt", "<=", in24h)
      .limit(100)
      .get();

    for (const doc of deliverySnap.docs) {
      const order   = doc.data();
      const orderId = doc.id;
      if (!isApproaching(order.deliveryDeadlineAt, DELIVERY_REMINDER_MS)) continue;
      if (!reminderNotSent(order, REMINDER_DELIVERY_24H)) continue;

      await safeRun(`delivery_24h:${orderId}`, async () => {
        await pushNotifications([
          {
            recipientId: order.merchantId,
            type: "delivery_deadline_reminder",
            title: "⏰ Delivery deadline in 24 hours",
            body: `You have less than 24 hours to deliver order ${orderId}. Failure will result in automatic cancellation and buyer refund.`,
            orderId,
          },
        ]);
        await markReminderSent(orderId, REMINDER_DELIVERY_24H);
        await writeSystemAudit({ orderId, action: "reminder_delivery_24h_sent", extra: {} });
      });
    }

    // ── 2. Buyer review / auto-release reminder (12 h window) ───────────────
    const reviewSnap = await db
      .collection("merchant_orders")
      .where("status", "==", "delivering")
      .where("escrowAutoReleaseAt", "<=", in12h)
      .limit(100)
      .get();

    for (const doc of reviewSnap.docs) {
      const order   = doc.data();
      const orderId = doc.id;
      if (!isApproaching(order.escrowAutoReleaseAt, BUYER_REVIEW_REMINDER_MS)) continue;
      if (!reminderNotSent(order, REMINDER_BUYER_REVIEW_12H)) continue;

      await safeRun(`buyer_review_12h:${orderId}`, async () => {
        await pushNotifications([
          {
            recipientId: order.buyerId,
            type: "review_deadline_reminder",
            title: "⏰ Review deadline in 12 hours",
            body: `You have less than 12 hours to confirm or dispute delivery on order ${orderId}. If you take no action, payment will be automatically released to the merchant.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "escrow_release_approaching",
            title: "Escrow auto-release in 12 hours",
            body: `Order ${orderId}: escrow will auto-release in ~12 hours if buyer takes no action.`,
            orderId,
          },
        ]);
        await markReminderSent(orderId, REMINDER_BUYER_REVIEW_12H);
        await writeSystemAudit({ orderId, action: "reminder_buyer_review_12h_sent", extra: {} });
      });
    }

    // ── 3. Escrow release reminder (6 h window) ──────────────────────────────
    const escrowReleaseSnap = await db
      .collection("merchant_orders")
      .where("status", "==", "delivering")
      .where("escrowAutoReleaseAt", "<=", in6h)
      .limit(100)
      .get();

    for (const doc of escrowReleaseSnap.docs) {
      const order   = doc.data();
      const orderId = doc.id;
      if (!isApproaching(order.escrowAutoReleaseAt, ESCROW_RELEASE_REMINDER_MS)) continue;
      if (!reminderNotSent(order, REMINDER_ESCROW_RELEASE_6H)) continue;

      await safeRun(`escrow_release_6h:${orderId}`, async () => {
        await pushNotifications([
          {
            recipientId: order.buyerId,
            type: "escrow_release_reminder",
            title: "⚠️ Escrow auto-release in 6 hours",
            body: `Order ${orderId}: funds will be automatically released to the merchant in ~6 hours. Confirm or open a dispute now if you have an issue.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "escrow_release_approaching",
            title: "Escrow auto-release in 6 hours",
            body: `Order ${orderId}: escrow auto-release imminent.`,
            orderId,
          },
        ]);
        await markReminderSent(orderId, REMINDER_ESCROW_RELEASE_6H);
        await writeSystemAudit({ orderId, action: "reminder_escrow_release_6h_sent", extra: {} });
      });
    }

    // ── 4. Dispute deadline reminder (6 h window) ────────────────────────────
    const disputeSnap = await db
      .collection("marketplace_disputes")
      .where("status", "==", "open")
      .where("disputeEvidenceDeadlineAt", "<=", in6h)
      .limit(100)
      .get();

    for (const doc of disputeSnap.docs) {
      const dispute   = doc.data();
      const orderId   = dispute.orderId;

      // Use a unique key per dispute document, not order
      const disputeId = doc.id;

      // Check if order already has this reminder recorded
      const orderSnap = await db.collection("merchant_orders").doc(orderId).get();
      if (!orderSnap.exists) continue;
      const order = orderSnap.data();

      if (!isApproaching(dispute.disputeEvidenceDeadlineAt, DISPUTE_REMINDER_MS)) continue;
      if (!reminderNotSent(order, REMINDER_DISPUTE_6H)) continue;

      await safeRun(`dispute_6h:${orderId}`, async () => {
        await pushNotifications([
          {
            recipientId: dispute.buyerId,
            type: "dispute_deadline_reminder",
            title: "⏰ Dispute evidence deadline in 6 hours",
            body: `You have less than 6 hours to submit evidence for dispute on order ${orderId}.`,
            orderId,
          },
          {
            recipientId: dispute.merchantId,
            type: "dispute_deadline_reminder",
            title: "⏰ Dispute response deadline in 6 hours",
            body: `You have less than 6 hours to respond to the dispute on order ${orderId}. Failure to respond will result in automatic buyer refund.`,
            orderId,
          },
          {
            recipientId: "ADMIN",
            type: "dispute_deadline_reminder",
            title: "Dispute deadline approaching",
            body: `Dispute ${disputeId} on order ${orderId} deadline in ~6 hours.`,
            orderId,
          },
        ]);
        await markReminderSent(orderId, REMINDER_DISPUTE_6H);
        await writeSystemAudit({ orderId, action: "reminder_dispute_6h_sent", extra: { disputeId } });
      });
    }

    logger.info("sendDeadlineReminders: done");
  }
);
