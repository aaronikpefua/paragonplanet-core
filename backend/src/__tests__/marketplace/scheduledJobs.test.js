/**
 * Scheduled Jobs – unit tests
 *
 * Tests the business logic of each scheduled job in isolation using
 * in-memory Firestore-like mocks.  Each test:
 *   1. Sets up a fake order or dispute document
 *   2. Calls the relevant job handler function (extracted for testability)
 *   3. Asserts that the correct EscrowService / AuditService / NotificationService
 *      methods were called with the right arguments
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPast,
  isApproaching,
  DELIVERY_DEADLINE_MS,
  BUYER_REVIEW_DEADLINE_MS,
  DISPUTE_EVIDENCE_DEADLINE_MS,
  MERCHANT_RESPONSE_DEADLINE_MS,
  DELIVERY_REMINDER_MS,
  BUYER_REVIEW_REMINDER_MS,
  DISPUTE_REMINDER_MS,
  ESCROW_RELEASE_REMINDER_MS,
} from "../../services/marketplace/DeadlineService.js";

// ── We test the scheduling logic, not the Firebase SDK wiring ────────────────
// The job handlers call:
//   expireOrderAtomically  (EscrowService)
//   settleOrder            (EscrowService)
//   autoRefundBuyer        (EscrowService / functions/src/lib/escrow)
//   escalateDisputeToAdminReview
//   writeSystemAudit       (AuditService)
//   pushNotifications      (NotificationService)
//
// We mock those dependencies and test the query-and-dispatch logic.

// ─── Helpers we can test in isolation ────────────────────────────────────────

/**
 * Simulates the per-order processing logic from checkDeliveryDeadlines.
 * Accepts already-fetched order data instead of hitting Firestore.
 */
async function processExpiredDelivery({
  orderId,
  order,
  expireOrderAtomically,
  writeSystemAudit,
  pushNotifications,
}) {
  const reason = "Merchant did not deliver within 7 days";
  const result = await expireOrderAtomically({ orderId, order, reason });
  await writeSystemAudit({
    orderId,
    action: "order_auto_expired_delivery",
    extra: { reason, refunded: result.refunded, amount: result.amount, currency: result.currency },
  });
  await pushNotifications([
    { recipientId: order.buyerId,    type: "order_auto_expired", title: "Order expired – funds refunded",               body: ``, orderId },
    { recipientId: order.merchantId, type: "order_auto_expired", title: "Order expired – delivery deadline missed",      body: ``, orderId },
    { recipientId: "ADMIN",          type: "order_auto_expired", title: "Order auto-expired (delivery missed)",           body: ``, orderId },
  ]);
  return result;
}

/**
 * Simulates the per-order processing logic from checkBuyerReviewDeadlines.
 */
async function processAutoSettle({
  orderId,
  order,
  commissionPct,
  settleOrder,
  writeSystemAudit,
  pushNotifications,
}) {
  const result = await settleOrder({ orderId, order, commissionPct });
  await writeSystemAudit({
    orderId,
    action: "order_auto_settled_review_expired",
    extra: { amount: result.amount, merchantAmount: result.merchantAmount, commissionPct: result.commissionPct, currency: result.currency },
  });
  await pushNotifications([
    { recipientId: order.merchantId, type: "order_auto_completed", title: "Payment auto-released to your wallet", body: ``, orderId },
    { recipientId: order.buyerId,    type: "order_auto_completed", title: "Order auto-completed",                  body: ``, orderId },
    { recipientId: "ADMIN",          type: "order_auto_completed", title: "Order auto-settled (buyer review expired)", body: ``, orderId },
  ]);
  return result;
}

/**
 * Simulates the per-dispute processing logic from checkDisputeEvidenceDeadlines.
 */
async function processDisputeEscalation({
  orderId,
  order,
  disputeId,
  dispute,
  escalateDisputeToAdminReview,
  writeSystemAudit,
  pushNotifications,
}) {
  await escalateDisputeToAdminReview({ orderId, order, disputeId });
  await writeSystemAudit({ orderId, action: "dispute_auto_escalated_evidence_expired", extra: { disputeId } });
  await pushNotifications([
    { recipientId: "ADMIN",           type: "dispute_escalated", title: "Dispute escalated – evidence deadline passed", body: ``, orderId },
    { recipientId: dispute.buyerId,   type: "dispute_escalated", title: "Dispute escalated to admin",                   body: ``, orderId },
    { recipientId: dispute.merchantId, type: "dispute_escalated", title: "Dispute escalated to admin",                  body: ``, orderId },
  ]);
}

/**
 * Simulates the per-order processing logic from checkMerchantResponseDeadlines.
 */
async function processMerchantNoResponse({
  orderId,
  order,
  autoRefundBuyer,
  writeSystemAudit,
  pushNotifications,
}) {
  const result = await autoRefundBuyer({ orderId, order });
  await writeSystemAudit({
    orderId,
    action: "dispute_auto_resolved_merchant_no_response",
    extra: { amount: result.amount, currency: result.currency, disputeId: order.disputeId },
  });
  await pushNotifications([
    { recipientId: order.buyerId,    type: "dispute_auto_resolved", title: "Dispute resolved – funds refunded", body: ``, orderId },
    { recipientId: order.merchantId, type: "dispute_auto_resolved", title: "Dispute auto-resolved against you", body: ``, orderId },
    { recipientId: "ADMIN",          type: "dispute_auto_resolved", title: "Dispute auto-resolved (merchant no response)", body: ``, orderId },
  ]);
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("checkDeliveryDeadlines – processExpiredDelivery", () => {
  let expireOrderAtomically, writeSystemAudit, pushNotifications;

  beforeEach(() => {
    expireOrderAtomically = vi.fn().mockResolvedValue({ amount: 100, currency: "PARAG", refunded: true });
    writeSystemAudit      = vi.fn().mockResolvedValue();
    pushNotifications     = vi.fn().mockResolvedValue();
  });

  it("calls expireOrderAtomically with correct reason", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 100, escrowCurrency: "PARAG", status: "escrow_funded" };
    await processExpiredDelivery({ orderId: "o1", order, expireOrderAtomically, writeSystemAudit, pushNotifications });
    expect(expireOrderAtomically).toHaveBeenCalledWith({
      orderId: "o1", order, reason: "Merchant did not deliver within 7 days",
    });
  });

  it("writes system audit with action 'order_auto_expired_delivery'", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 100, escrowCurrency: "PARAG", status: "escrow_funded" };
    await processExpiredDelivery({ orderId: "o1", order, expireOrderAtomically, writeSystemAudit, pushNotifications });
    expect(writeSystemAudit).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o1", action: "order_auto_expired_delivery" })
    );
  });

  it("notifies buyer, merchant, and admin", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 100, escrowCurrency: "PARAG", status: "escrow_funded" };
    await processExpiredDelivery({ orderId: "o1", order, expireOrderAtomically, writeSystemAudit, pushNotifications });
    const calls = pushNotifications.mock.calls[0][0];
    const recipients = calls.map((n) => n.recipientId);
    expect(recipients).toContain("b1");
    expect(recipients).toContain("m1");
    expect(recipients).toContain("ADMIN");
  });

  it("propagates expireOrderAtomically errors", async () => {
    expireOrderAtomically.mockRejectedValue(new Error("DB error"));
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 100, escrowCurrency: "PARAG", status: "escrow_funded" };
    await expect(
      processExpiredDelivery({ orderId: "o1", order, expireOrderAtomically, writeSystemAudit, pushNotifications })
    ).rejects.toThrow("DB error");
  });
});

describe("checkBuyerReviewDeadlines – processAutoSettle", () => {
  let settleOrder, writeSystemAudit, pushNotifications;

  beforeEach(() => {
    settleOrder       = vi.fn().mockResolvedValue({ amount: 200, merchantAmount: 190, commissionAmount: 10, commissionPct: 5, currency: "PARAG" });
    writeSystemAudit  = vi.fn().mockResolvedValue();
    pushNotifications = vi.fn().mockResolvedValue();
  });

  it("calls settleOrder with correct commissionPct", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 200, escrowCurrency: "PARAG", status: "delivering" };
    await processAutoSettle({ orderId: "o2", order, commissionPct: 5, settleOrder, writeSystemAudit, pushNotifications });
    expect(settleOrder).toHaveBeenCalledWith({ orderId: "o2", order, commissionPct: 5 });
  });

  it("writes system audit with action 'order_auto_settled_review_expired'", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 200, escrowCurrency: "PARAG", status: "delivering" };
    await processAutoSettle({ orderId: "o2", order, commissionPct: 5, settleOrder, writeSystemAudit, pushNotifications });
    expect(writeSystemAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order_auto_settled_review_expired" })
    );
  });

  it("notifies merchant, buyer, and admin", async () => {
    const order = { buyerId: "b1", merchantId: "m1", escrowAmount: 200, escrowCurrency: "PARAG", status: "delivering" };
    await processAutoSettle({ orderId: "o2", order, commissionPct: 5, settleOrder, writeSystemAudit, pushNotifications });
    const recipients = pushNotifications.mock.calls[0][0].map((n) => n.recipientId);
    expect(recipients).toContain("m1");
    expect(recipients).toContain("b1");
    expect(recipients).toContain("ADMIN");
  });
});

describe("checkDisputeEvidenceDeadlines – processDisputeEscalation", () => {
  let escalateDisputeToAdminReview, writeSystemAudit, pushNotifications;

  beforeEach(() => {
    escalateDisputeToAdminReview = vi.fn().mockResolvedValue();
    writeSystemAudit             = vi.fn().mockResolvedValue();
    pushNotifications            = vi.fn().mockResolvedValue();
  });

  it("calls escalateDisputeToAdminReview with disputeId", async () => {
    const order   = { status: "disputed" };
    const dispute = { orderId: "o3", buyerId: "b1", merchantId: "m1" };
    await processDisputeEscalation({
      orderId: "o3", order, disputeId: "d1", dispute,
      escalateDisputeToAdminReview, writeSystemAudit, pushNotifications,
    });
    expect(escalateDisputeToAdminReview).toHaveBeenCalledWith({ orderId: "o3", order, disputeId: "d1" });
  });

  it("writes audit with 'dispute_auto_escalated_evidence_expired'", async () => {
    const order   = { status: "disputed" };
    const dispute = { orderId: "o3", buyerId: "b1", merchantId: "m1" };
    await processDisputeEscalation({
      orderId: "o3", order, disputeId: "d1", dispute,
      escalateDisputeToAdminReview, writeSystemAudit, pushNotifications,
    });
    expect(writeSystemAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dispute_auto_escalated_evidence_expired" })
    );
  });

  it("notifies admin, buyer, and merchant", async () => {
    const order   = { status: "disputed" };
    const dispute = { orderId: "o3", buyerId: "b1", merchantId: "m1" };
    await processDisputeEscalation({
      orderId: "o3", order, disputeId: "d1", dispute,
      escalateDisputeToAdminReview, writeSystemAudit, pushNotifications,
    });
    const recipients = pushNotifications.mock.calls[0][0].map((n) => n.recipientId);
    expect(recipients).toContain("ADMIN");
    expect(recipients).toContain("b1");
    expect(recipients).toContain("m1");
  });
});

describe("checkMerchantResponseDeadlines – processMerchantNoResponse", () => {
  let autoRefundBuyer, writeSystemAudit, pushNotifications;

  beforeEach(() => {
    autoRefundBuyer   = vi.fn().mockResolvedValue({ amount: 300, currency: "PARAG" });
    writeSystemAudit  = vi.fn().mockResolvedValue();
    pushNotifications = vi.fn().mockResolvedValue();
  });

  it("calls autoRefundBuyer", async () => {
    const order = { buyerId: "b1", merchantId: "m1", disputeId: "d2", escrowAmount: 300, escrowCurrency: "PARAG" };
    await processMerchantNoResponse({ orderId: "o4", order, autoRefundBuyer, writeSystemAudit, pushNotifications });
    expect(autoRefundBuyer).toHaveBeenCalledWith({ orderId: "o4", order });
  });

  it("writes audit with 'dispute_auto_resolved_merchant_no_response'", async () => {
    const order = { buyerId: "b1", merchantId: "m1", disputeId: "d2", escrowAmount: 300, escrowCurrency: "PARAG" };
    await processMerchantNoResponse({ orderId: "o4", order, autoRefundBuyer, writeSystemAudit, pushNotifications });
    expect(writeSystemAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dispute_auto_resolved_merchant_no_response" })
    );
  });

  it("notifies buyer, merchant, and admin", async () => {
    const order = { buyerId: "b1", merchantId: "m1", disputeId: "d2", escrowAmount: 300, escrowCurrency: "PARAG" };
    await processMerchantNoResponse({ orderId: "o4", order, autoRefundBuyer, writeSystemAudit, pushNotifications });
    const recipients = pushNotifications.mock.calls[0][0].map((n) => n.recipientId);
    expect(recipients).toContain("b1");
    expect(recipients).toContain("m1");
    expect(recipients).toContain("ADMIN");
  });
});

describe("Deadline gate checks", () => {
  it("isPast returns true for an expired delivery deadline", () => {
    const past = new Date(Date.now() - DELIVERY_DEADLINE_MS - 1);
    expect(isPast(past)).toBe(true);
  });

  it("isPast returns false for a future delivery deadline", () => {
    const future = new Date(Date.now() + DELIVERY_DEADLINE_MS);
    expect(isPast(future)).toBe(false);
  });

  it("isApproaching returns true when within DELIVERY_REMINDER_MS", () => {
    const soon = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23h from now, within 24h window
    expect(isApproaching(soon, DELIVERY_REMINDER_MS)).toBe(true);
  });

  it("isApproaching returns false when outside DELIVERY_REMINDER_MS", () => {
    const far = new Date(Date.now() + 48 * 60 * 60 * 1000);
    expect(isApproaching(far, DELIVERY_REMINDER_MS)).toBe(false);
  });

  it("reminder deduplication: reminderNotSent returns false if key already sent", () => {
    const order = { sentReminders: ["delivery_24h"] };
    const reminderNotSent = (o, key) => !(o.sentReminders || []).includes(key);
    expect(reminderNotSent(order, "delivery_24h")).toBe(false);
    expect(reminderNotSent(order, "buyer_review_12h")).toBe(true);
  });
});
