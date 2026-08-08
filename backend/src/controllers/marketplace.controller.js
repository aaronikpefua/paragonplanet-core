/**
 * Marketplace Controller – Milestone 2
 * Escrow, Settlement, Disputes, Commission, Audit Trail, Notifications
 *
 * Firestore collections:
 *  merchant_orders          – order lifecycle (status)
 *  merchant_order_messages  – chat thread
 *  marketplace_escrow       – single escrow wallet account
 *  marketplace_settings     – platform config (commission rate)
 *  marketplace_deliveries   – merchant delivery submissions
 *  marketplace_disputes     – dispute records
 *  marketplace_audit_log    – append-only audit trail
 *  marketplace_notifications– user notifications
 *  wallet_accounts          – buyer/merchant/admin wallets
 *  ledger_entries           – double-entry ledger
 */

import { createLedgerEntry } from "../models/ledger.model.js";
import { isAdminUser } from "../lib/adminAccess.js";
import admin from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

// ─── Firestore collection helpers ───────────────────────────────────────────
const db = () => admin.firestore();
const orders = () => db().collection("merchant_orders");
const orderMessages = () => db().collection("merchant_order_messages");
const escrowDoc = () => db().collection("marketplace_escrow").doc("MARKETPLACE_ESCROW");
const adminWalletDoc = () => db().collection("wallet_accounts").doc("MARKETPLACE_ADMIN");
const walletRef = (uid) => db().collection("wallet_accounts").doc(uid);
const ledgerEntries = () => db().collection("ledger_entries");
const settingsDoc = () => db().collection("marketplace_settings").doc("global");
const deliveries = () => db().collection("marketplace_deliveries");
const disputes = () => db().collection("marketplace_disputes");
const auditLog = () => db().collection("marketplace_audit_log");
const notifications = () => db().collection("marketplace_notifications");

// ─── Constants ───────────────────────────────────────────────────────────────
const ESCROW_ID = "MARKETPLACE_ESCROW";
const ADMIN_WALLET_ID = "MARKETPLACE_ADMIN";
const DEFAULT_COMMISSION_PCT = 5;

// ─── Status transition allowlist ─────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  request_submitted: ["negotiating", "cancelled"],
  negotiating: ["final_offer_sent", "cancelled"],
  final_offer_sent: ["buyer_accepted", "negotiating", "cancelled", "expired"],
  buyer_accepted: ["escrow_funded", "cancelled"],
  escrow_funded: ["delivering", "cancelled"],
  delivering: ["buyer_review", "disputed"],
  buyer_review: ["completed", "disputed"],
  disputed: ["admin_review"],
  admin_review: ["completed", "refunded", "closed"],
  completed: [],
  refunded: [],
  merchant_paid: ["closed"],
  closed: [],
  cancelled: [],
  expired: [],
};

function isValidTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function isPositiveAmount(amount) {
  return Number.isFinite(Number(amount)) && Number(amount) > 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const snap = await settingsDoc().get();
  if (snap.exists) {
    const data = snap.data();
    const rate = Number(data?.commissionPct ?? DEFAULT_COMMISSION_PCT);
    return { commissionPct: isPositiveAmount(rate) ? rate : DEFAULT_COMMISSION_PCT };
  }
  return { commissionPct: DEFAULT_COMMISSION_PCT };
}

async function writeAudit({ orderId, action, userId, extra = {}, ip = null }) {
  await auditLog().add({
    auditId: uuidv4(),
    orderId,
    action,
    userId,
    ip: ip || null,
    extra,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function pushNotification({ recipientId, type, title, body, orderId }) {
  await notifications().add({
    recipientId,
    type,
    title,
    body,
    orderId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function writeLedger(transaction, entry, userId) {
  transaction.set(ledgerEntries().doc(entry.ledgerId), {
    accountId: userId,
    walletId: entry.walletId,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    reason: entry.reason,
    reference: entry.reference,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── PART 5 – Get/Update marketplace settings ───────────────────────────────

export async function getMarketplaceSettings(req, res) {
  try {
    const snap = await settingsDoc().get();
    if (!snap.exists) {
      return res.json({ commissionPct: DEFAULT_COMMISSION_PCT });
    }
    return res.json(snap.data());
  } catch (err) {
    console.error("getMarketplaceSettings failed:", err);
    return res.status(500).json({ message: "Could not load settings" });
  }
}

export async function updateMarketplaceSettings(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  const { commissionPct } = req.body;
  const rate = Number(commissionPct);

  if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
    return res
      .status(400)
      .json({ message: "commissionPct must be a number between 0 and 50" });
  }

  try {
    await settingsDoc().set(
      {
        commissionPct: rate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user.uid,
      },
      { merge: true }
    );
    return res.json({ commissionPct: rate });
  } catch (err) {
    console.error("updateMarketplaceSettings failed:", err);
    return res.status(500).json({ message: "Could not update settings" });
  }
}

// ─── PART 1 – Fund Escrow (buyer pays) ──────────────────────────────────────

export async function fundEscrow(req, res) {
  const buyerId = req.user.uid;
  const { orderId } = req.body;
  const ip = req.ip || null;

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId is required" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderSnap.data();

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ message: "Only the buyer may pay for this order" });
    }

    if (!isValidTransition(order.status, "escrow_funded")) {
      return res.status(409).json({
        message: `Cannot fund escrow from status '${order.status}'. Expected 'final_offer_sent' or 'buyer_accepted'.`,
      });
    }

    // Check expiry for final offer (48 h)
    if (order.finalOfferSentAt) {
      const offerAge =
        Date.now() - (order.finalOfferSentAt?.toMillis?.() ?? 0);
      if (offerAge > 48 * 60 * 60 * 1000) {
        await orderRef.update({
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await writeAudit({ orderId, action: "offer_expired", userId: buyerId, ip });
        return res.status(410).json({ message: "Final offer has expired (48 h limit)" });
      }
    }

    const amount = Number(order.amount || 0);
    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ message: "Invalid order amount" });
    }

    const currency = (order.currency || "PARAG").toUpperCase();
    if (!["PARAG", "GBAZILO"].includes(currency)) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    const buyerWalletRef = walletRef(buyerId);
    const escrowRef = escrowDoc();

    const buyerEntry = createLedgerEntry({
      walletId: buyerId,
      type: "DEBIT",
      amount,
      currency,
      reason: `Escrow hold for order ${orderId}`,
      reference: orderId,
    });

    const escrowEntry = createLedgerEntry({
      walletId: ESCROW_ID,
      type: "CREDIT",
      amount,
      currency,
      reason: `Escrow receipt for order ${orderId}`,
      reference: orderId,
    });

    await db().runTransaction(async (transaction) => {
      const buyerSnap = await transaction.get(buyerWalletRef);
      if (!buyerSnap.exists) throw new Error("Buyer wallet not found");

      const buyerBalances = buyerSnap.data()?.balances || {};
      const available = Number(buyerBalances[currency.toLowerCase()] || 0);
      if (available < amount) {
        const err = new Error("Insufficient balance");
        err.code = "INSUFFICIENT_BALANCE";
        throw err;
      }

      // Debit buyer
      transaction.set(
        buyerWalletRef,
        {
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Credit escrow
      transaction.set(
        escrowRef,
        {
          walletId: ESCROW_ID,
          role: "escrow",
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update order
      transaction.update(orderRef, {
        status: "escrow_funded",
        escrowAmount: amount,
        escrowCurrency: currency,
        escrowFundedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      writeLedger(transaction, buyerEntry, buyerId);
      writeLedger(transaction, escrowEntry, ESCROW_ID);
    });

    await writeAudit({ orderId, action: "escrow_funded", userId: buyerId, ip, extra: { amount, currency } });

    // Notifications
    await pushNotification({
      recipientId: order.merchantId,
      type: "escrow_funded",
      title: "Payment received – funds in escrow",
      body: `${amount} ${currency} is held in escrow for order ${orderId}. Please deliver the product.`,
      orderId,
    });
    await pushNotification({
      recipientId: buyerId,
      type: "escrow_funded",
      title: "Payment held in escrow",
      body: `Your payment of ${amount} ${currency} is secured in escrow. The merchant will deliver soon.`,
      orderId,
    });

    // Order message
    await orderMessages().add({
      orderId,
      senderId: "SYSTEM",
      senderName: "Paragon Platform",
      text: `💰 Escrow funded: ${amount} ${currency} is secured. Merchant, please deliver the product.`,
      type: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, orderId, status: "escrow_funded", amount, currency });
  } catch (err) {
    if (err.code === "INSUFFICIENT_BALANCE") {
      return res.status(402).json({ message: "Insufficient wallet balance" });
    }
    console.error("fundEscrow failed:", err);
    return res.status(500).json({ message: "Could not fund escrow" });
  }
}

// ─── PART 8 – Merchant submits delivery ────────────────────────────────────

export async function submitDelivery(req, res) {
  const merchantId = req.user.uid;
  const { orderId, deliveryNote, links = [], accessCodes = [], files = [] } = req.body;
  const ip = req.ip || null;

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId is required" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.merchantId !== merchantId) {
      return res.status(403).json({ message: "Only the merchant may submit delivery" });
    }

    if (!isValidTransition(order.status, "delivering")) {
      return res.status(409).json({
        message: `Cannot submit delivery from status '${order.status}'. Expected 'escrow_funded'.`,
      });
    }

    const deliveryId = uuidv4();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      tx.set(deliveries().doc(deliveryId), {
        deliveryId,
        orderId,
        merchantId,
        deliveryNote: deliveryNote || "",
        links,
        accessCodes,
        files,
        submittedAt: now,
      });

      tx.update(orderRef, {
        status: "delivering",
        deliveredAt: now,
        updatedAt: now,
      });

      tx.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: `📦 Merchant has submitted delivery. Please review and confirm receipt within 3 days.`,
        type: "system",
        deliveryId,
        createdAt: now,
      });
    });

    await writeAudit({ orderId, action: "merchant_delivered", userId: merchantId, ip, extra: { deliveryId } });

    await pushNotification({
      recipientId: order.buyerId,
      type: "delivery_submitted",
      title: "Your order has been delivered",
      body: "Please review and confirm delivery within 3 days to release payment to the merchant.",
      orderId,
    });

    return res.status(200).json({ success: true, orderId, deliveryId, status: "delivering" });
  } catch (err) {
    console.error("submitDelivery failed:", err);
    return res.status(500).json({ message: "Could not submit delivery" });
  }
}

// ─── PART 4 – Buyer confirms delivery → auto-settle ─────────────────────────

export async function confirmDeliveryAndSettle(req, res) {
  const buyerId = req.user.uid;
  const { orderId } = req.body;
  const ip = req.ip || null;

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId is required" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ message: "Only the buyer may confirm delivery" });
    }

    if (!["delivering", "buyer_review"].includes(order.status)) {
      return res.status(409).json({
        message: `Cannot confirm delivery from status '${order.status}'.`,
      });
    }

    const amount = Number(order.escrowAmount || order.amount || 0);
    const currency = (order.escrowCurrency || order.currency || "PARAG").toUpperCase();

    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ message: "Invalid escrow amount" });
    }
    if (!["PARAG", "GBAZILO"].includes(currency)) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    const { commissionPct } = await getSettings();
    const commissionAmount = Math.round(((amount * commissionPct) / 100) * 1e6) / 1e6;
    const merchantAmount = Math.round((amount - commissionAmount) * 1e6) / 1e6;

    const escrowRef = escrowDoc();
    const merchantWalletRef = walletRef(order.merchantId);
    const adminWalletRef = adminWalletDoc();

    const escrowDebitEntry = createLedgerEntry({
      walletId: ESCROW_ID,
      type: "DEBIT",
      amount,
      currency,
      reason: `Settlement release for order ${orderId}`,
      reference: orderId,
    });

    const commissionEntry = createLedgerEntry({
      walletId: ADMIN_WALLET_ID,
      type: "CREDIT",
      amount: commissionAmount,
      currency,
      reason: `Commission (${commissionPct}%) for order ${orderId}`,
      reference: orderId,
    });

    const merchantEntry = createLedgerEntry({
      walletId: order.merchantId,
      type: "CREDIT",
      amount: merchantAmount,
      currency,
      reason: `Marketplace receipt for order ${orderId}`,
      reference: orderId,
    });

    await db().runTransaction(async (transaction) => {
      const escrowSnap = await transaction.get(escrowRef);
      const escrowBalances = escrowSnap.exists ? (escrowSnap.data()?.balances || {}) : {};
      const escrowAvailable = Number(escrowBalances[currency.toLowerCase()] || 0);

      if (escrowAvailable < amount) {
        const err = new Error("Escrow balance insufficient");
        err.code = "ESCROW_INSUFFICIENT";
        throw err;
      }

      // Debit escrow
      transaction.set(
        escrowRef,
        {
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Credit merchant (after commission)
      transaction.set(
        merchantWalletRef,
        {
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(merchantAmount) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Credit admin wallet (commission)
      transaction.set(
        adminWalletRef,
        {
          walletId: ADMIN_WALLET_ID,
          role: "admin",
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(commissionAmount) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update order
      transaction.update(orderRef, {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        settlementAmount: merchantAmount,
        commissionAmount,
        commissionPct,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Ledger entries
      writeLedger(transaction, escrowDebitEntry, ESCROW_ID);
      writeLedger(transaction, commissionEntry, ADMIN_WALLET_ID);
      writeLedger(transaction, merchantEntry, order.merchantId);

      // System message
      transaction.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: `✅ Order completed. ${merchantAmount} ${currency} released to merchant. Commission: ${commissionAmount} ${currency} (${commissionPct}%).`,
        type: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await writeAudit({
      orderId,
      action: "order_completed",
      userId: buyerId,
      ip,
      extra: { amount, merchantAmount, commissionAmount, commissionPct, currency },
    });

    await pushNotification({
      recipientId: order.merchantId,
      type: "order_completed",
      title: "Payment released to your wallet",
      body: `${merchantAmount} ${currency} has been credited to your wallet. Order ${orderId} is complete.`,
      orderId,
    });
    await pushNotification({
      recipientId: buyerId,
      type: "order_completed",
      title: "Order completed",
      body: "Thank you for your purchase. The merchant has been paid.",
      orderId,
    });

    return res.status(200).json({
      success: true,
      orderId,
      status: "completed",
      merchantAmount,
      commissionAmount,
      commissionPct,
    });
  } catch (err) {
    if (err.code === "ESCROW_INSUFFICIENT") {
      return res.status(402).json({ message: "Escrow balance insufficient for settlement" });
    }
    console.error("confirmDeliveryAndSettle failed:", err);
    return res.status(500).json({ message: "Could not settle order" });
  }
}

// ─── PART 7 – Open dispute (buyer) ──────────────────────────────────────────

export async function openDispute(req, res) {
  const buyerId = req.user.uid;
  const { orderId, reason, description, evidenceUrls = [] } = req.body;
  const ip = req.ip || null;

  if (!orderId || !reason || !description) {
    return res.status(400).json({ message: "orderId, reason, and description are required" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ message: "Only the buyer may open a dispute" });
    }

    if (!["delivering", "buyer_review"].includes(order.status)) {
      return res.status(409).json({
        message: `Disputes can only be opened in 'delivering' or 'buyer_review' status. Current: '${order.status}'.`,
      });
    }

    const disputeId = uuidv4();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      tx.set(disputes().doc(disputeId), {
        disputeId,
        orderId,
        buyerId,
        merchantId: order.merchantId,
        reason,
        description,
        evidenceUrls,
        status: "open",
        buyerSubmittedAt: now,
        merchantResponse: null,
        merchantResponseAt: null,
        adminDecision: null,
        adminDecidedAt: null,
        adminDecidedBy: null,
        createdAt: now,
        updatedAt: now,
      });

      tx.update(orderRef, {
        status: "disputed",
        disputeId,
        disputeOpenedAt: now,
        updatedAt: now,
      });

      tx.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: `⚠️ Dispute opened by buyer. Admin has been notified. Funds remain in escrow pending resolution.`,
        type: "system",
        disputeId,
        createdAt: now,
      });
    });

    await writeAudit({ orderId, action: "dispute_opened", userId: buyerId, ip, extra: { disputeId, reason } });

    await pushNotification({
      recipientId: order.merchantId,
      type: "dispute_opened",
      title: "Dispute opened on your order",
      body: `A dispute has been filed for order ${orderId}. Please submit your response.`,
      orderId,
    });

    // Notify admins (generic admin notification)
    await pushNotification({
      recipientId: "ADMIN",
      type: "dispute_opened",
      title: "New marketplace dispute",
      body: `Dispute filed for order ${orderId}. Buyer: ${buyerId}. Merchant: ${order.merchantId}.`,
      orderId,
    });

    return res.status(201).json({ success: true, disputeId, orderId, status: "disputed" });
  } catch (err) {
    console.error("openDispute failed:", err);
    return res.status(500).json({ message: "Could not open dispute" });
  }
}

// ─── PART 7 – Merchant submits dispute response ──────────────────────────────

export async function respondToDispute(req, res) {
  const merchantId = req.user.uid;
  const { orderId } = req.params;
  const { response, evidenceUrls = [] } = req.body;
  const ip = req.ip || null;

  if (!response) {
    return res.status(400).json({ message: "response is required" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.merchantId !== merchantId) {
      return res.status(403).json({ message: "Only the merchant may respond to this dispute" });
    }

    if (order.status !== "disputed") {
      return res.status(409).json({ message: "Order is not in dispute status" });
    }

    const disputeRef = disputes().doc(order.disputeId);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      tx.update(disputeRef, {
        merchantResponse: response,
        merchantEvidenceUrls: evidenceUrls,
        merchantResponseAt: now,
        status: "merchant_responded",
        updatedAt: now,
      });

      tx.update(orderRef, {
        status: "admin_review",
        updatedAt: now,
      });

      tx.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: "📝 Merchant has submitted their dispute response. Admin is reviewing.",
        type: "system",
        createdAt: now,
      });
    });

    await writeAudit({ orderId, action: "dispute_merchant_responded", userId: merchantId, ip });

    await pushNotification({
      recipientId: order.buyerId,
      type: "dispute_update",
      title: "Merchant responded to dispute",
      body: `The merchant has submitted their response for order ${orderId}. Admin is now reviewing.`,
      orderId,
    });
    await pushNotification({
      recipientId: "ADMIN",
      type: "dispute_ready_for_review",
      title: "Dispute ready for admin review",
      body: `Order ${orderId}: Both parties have responded. Please resolve the dispute.`,
      orderId,
    });

    return res.status(200).json({ success: true, orderId, status: "admin_review" });
  } catch (err) {
    console.error("respondToDispute failed:", err);
    return res.status(500).json({ message: "Could not submit dispute response" });
  }
}

// ─── PART 7 – Admin resolves dispute ────────────────────────────────────────

export async function resolveDispute(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  const adminId = req.user.uid;
  const { orderId } = req.params;
  const { decision, notes = "" } = req.body;
  // decision: "buyer_wins" | "merchant_wins" | "partial_refund"
  // partialBuyerPct: number (only for partial_refund)
  const { partialBuyerPct } = req.body;
  const ip = req.ip || null;

  const VALID_DECISIONS = ["buyer_wins", "merchant_wins", "partial_refund"];
  if (!VALID_DECISIONS.includes(decision)) {
    return res.status(400).json({ message: `decision must be one of: ${VALID_DECISIONS.join(", ")}` });
  }

  if (decision === "partial_refund") {
    const pct = Number(partialBuyerPct);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
      return res.status(400).json({ message: "partialBuyerPct must be between 1 and 99" });
    }
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (!["disputed", "admin_review"].includes(order.status)) {
      return res.status(409).json({ message: "Order is not under dispute" });
    }

    const escrowAmount = Number(order.escrowAmount || order.amount || 0);
    const currency = (order.escrowCurrency || order.currency || "PARAG").toUpperCase();

    const { commissionPct } = await getSettings();

    let buyerRefund = 0;
    let merchantPay = 0;
    let commissionAmount = 0;
    let finalStatus = "closed";

    if (decision === "buyer_wins") {
      buyerRefund = escrowAmount;
      finalStatus = "refunded";
    } else if (decision === "merchant_wins") {
      commissionAmount = Math.round(((escrowAmount * commissionPct) / 100) * 1e6) / 1e6;
      merchantPay = Math.round((escrowAmount - commissionAmount) * 1e6) / 1e6;
      finalStatus = "completed";
    } else {
      // partial_refund
      const buyerPct = Number(partialBuyerPct);
      buyerRefund = Math.round(((escrowAmount * buyerPct) / 100) * 1e6) / 1e6;
      const remaining = Math.round((escrowAmount - buyerRefund) * 1e6) / 1e6;
      commissionAmount = Math.round(((remaining * commissionPct) / 100) * 1e6) / 1e6;
      merchantPay = Math.round((remaining - commissionAmount) * 1e6) / 1e6;
      finalStatus = "closed";
    }

    const escrowRef = escrowDoc();
    const adminWalletRef = adminWalletDoc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      // Always debit the full escrow amount
      tx.set(
        escrowRef,
        {
          balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-escrowAmount) },
          updatedAt: now,
        },
        { merge: true }
      );

      if (buyerRefund > 0) {
        tx.set(
          walletRef(order.buyerId),
          {
            balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(buyerRefund) },
            updatedAt: now,
          },
          { merge: true }
        );
        const e = createLedgerEntry({
          walletId: order.buyerId,
          type: "CREDIT",
          amount: buyerRefund,
          currency,
          reason: `Dispute refund (${decision}) for order ${orderId}`,
          reference: orderId,
        });
        writeLedger(tx, e, order.buyerId);
      }

      if (merchantPay > 0) {
        tx.set(
          walletRef(order.merchantId),
          {
            balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(merchantPay) },
            updatedAt: now,
          },
          { merge: true }
        );
        const e = createLedgerEntry({
          walletId: order.merchantId,
          type: "CREDIT",
          amount: merchantPay,
          currency,
          reason: `Dispute settlement (${decision}) for order ${orderId}`,
          reference: orderId,
        });
        writeLedger(tx, e, order.merchantId);
      }

      if (commissionAmount > 0) {
        tx.set(
          adminWalletRef,
          {
            walletId: ADMIN_WALLET_ID,
            role: "admin",
            balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(commissionAmount) },
            updatedAt: now,
          },
          { merge: true }
        );
        const e = createLedgerEntry({
          walletId: ADMIN_WALLET_ID,
          type: "CREDIT",
          amount: commissionAmount,
          currency,
          reason: `Commission (${commissionPct}%) on dispute settlement for order ${orderId}`,
          reference: orderId,
        });
        writeLedger(tx, e, ADMIN_WALLET_ID);
      }

      // Escrow debit ledger
      const escrowDebit = createLedgerEntry({
        walletId: ESCROW_ID,
        type: "DEBIT",
        amount: escrowAmount,
        currency,
        reason: `Dispute resolution (${decision}) for order ${orderId}`,
        reference: orderId,
      });
      writeLedger(tx, escrowDebit, ESCROW_ID);

      tx.update(orderRef, {
        status: finalStatus,
        disputeDecision: decision,
        disputeResolvedAt: now,
        disputeResolvedBy: adminId,
        disputeNotes: notes,
        updatedAt: now,
      });

      if (order.disputeId) {
        tx.update(disputes().doc(order.disputeId), {
          adminDecision: decision,
          adminNotes: notes,
          adminDecidedAt: now,
          adminDecidedBy: adminId,
          status: "resolved",
          updatedAt: now,
        });
      }

      tx.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: `⚖️ Admin has resolved the dispute. Decision: ${decision}. ${notes ? "Notes: " + notes : ""}`,
        type: "system",
        createdAt: now,
      });
    });

    await writeAudit({
      orderId,
      action: "dispute_resolved",
      userId: adminId,
      ip,
      extra: { decision, buyerRefund, merchantPay, commissionAmount, notes },
    });

    await pushNotification({
      recipientId: order.buyerId,
      type: "dispute_resolved",
      title: "Dispute resolved",
      body: `Decision: ${decision}. ${buyerRefund > 0 ? `${buyerRefund} ${currency} refunded to your wallet.` : ""}`,
      orderId,
    });
    await pushNotification({
      recipientId: order.merchantId,
      type: "dispute_resolved",
      title: "Dispute resolved",
      body: `Decision: ${decision}. ${merchantPay > 0 ? `${merchantPay} ${currency} released to your wallet.` : ""}`,
      orderId,
    });

    return res.status(200).json({
      success: true,
      orderId,
      status: finalStatus,
      decision,
      buyerRefund,
      merchantPay,
      commissionAmount,
    });
  } catch (err) {
    console.error("resolveDispute failed:", err);
    return res.status(500).json({ message: "Could not resolve dispute" });
  }
}

// ─── Cancel order ─────────────────────────────────────────────────────────────

export async function cancelOrder(req, res) {
  const userId = req.user.uid;
  const { orderId, reason = "" } = req.body;
  const ip = req.ip || null;

  if (!orderId) return res.status(400).json({ message: "orderId is required" });

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    const isBuyer = order.buyerId === userId;
    const isMerchant = order.merchantId === userId;

    if (!isBuyer && !isMerchant) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!isValidTransition(order.status, "cancelled")) {
      return res.status(409).json({
        message: `Cannot cancel order with status '${order.status}'.`,
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      // If escrow was funded, refund buyer
      if (order.status === "escrow_funded" || order.status === "buyer_accepted") {
        const amount = Number(order.escrowAmount || 0);
        const currency = (order.escrowCurrency || "PARAG").toUpperCase();
        if (amount > 0) {
          tx.set(
            escrowDoc(),
            {
              balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount) },
              updatedAt: now,
            },
            { merge: true }
          );
          tx.set(
            walletRef(order.buyerId),
            {
              balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount) },
              updatedAt: now,
            },
            { merge: true }
          );
          const refundEntry = createLedgerEntry({
            walletId: order.buyerId,
            type: "CREDIT",
            amount,
            currency,
            reason: `Cancellation refund for order ${orderId}`,
            reference: orderId,
          });
          writeLedger(tx, refundEntry, order.buyerId);
          const escrowDebit = createLedgerEntry({
            walletId: ESCROW_ID,
            type: "DEBIT",
            amount,
            currency,
            reason: `Cancellation escrow release for order ${orderId}`,
            reference: orderId,
          });
          writeLedger(tx, escrowDebit, ESCROW_ID);
        }
      }

      tx.update(orderRef, {
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: userId,
        cancelReason: reason,
        updatedAt: now,
      });

      tx.set(orderMessages().doc(), {
        orderId,
        senderId: "SYSTEM",
        senderName: "Paragon Platform",
        text: `❌ Order cancelled by ${isBuyer ? "buyer" : "merchant"}${reason ? ": " + reason : ""}. Any escrowed funds have been refunded.`,
        type: "system",
        createdAt: now,
      });
    });

    await writeAudit({ orderId, action: "order_cancelled", userId, ip, extra: { reason } });

    await pushNotification({
      recipientId: isBuyer ? order.merchantId : order.buyerId,
      type: "order_cancelled",
      title: "Order cancelled",
      body: `Order ${orderId} has been cancelled${reason ? ": " + reason : ""}.`,
      orderId,
    });

    return res.status(200).json({ success: true, orderId, status: "cancelled" });
  } catch (err) {
    console.error("cancelOrder failed:", err);
    return res.status(500).json({ message: "Could not cancel order" });
  }
}

// ─── Expire order (admin / system) ───────────────────────────────────────────

export async function expireOrder(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  const { orderId, reason = "System expiry" } = req.body;
  const ip = req.ip || null;

  if (!orderId) return res.status(400).json({ message: "orderId is required" });

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    const now = admin.firestore.FieldValue.serverTimestamp();

    await db().runTransaction(async (tx) => {
      // Refund buyer if escrow was funded
      const amount = Number(order.escrowAmount || 0);
      const currency = (order.escrowCurrency || "PARAG").toUpperCase();
      if (amount > 0 && order.status === "escrow_funded") {
        tx.set(escrowDoc(), { balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount) }, updatedAt: now }, { merge: true });
        tx.set(walletRef(order.buyerId), { balances: { [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount) }, updatedAt: now }, { merge: true });
        const re = createLedgerEntry({ walletId: order.buyerId, type: "CREDIT", amount, currency, reason: `Expiry refund for order ${orderId}`, reference: orderId });
        const ed = createLedgerEntry({ walletId: ESCROW_ID, type: "DEBIT", amount, currency, reason: `Expiry escrow release for order ${orderId}`, reference: orderId });
        writeLedger(tx, re, order.buyerId);
        writeLedger(tx, ed, ESCROW_ID);
      }

      tx.update(orderRef, { status: "expired", expiredAt: now, expireReason: reason, updatedAt: now });
      tx.set(orderMessages().doc(), {
        orderId, senderId: "SYSTEM", senderName: "Paragon Platform",
        text: `⏱️ Order expired: ${reason}.`, type: "system", createdAt: now,
      });
    });

    await writeAudit({ orderId, action: "order_expired", userId: req.user.uid, ip, extra: { reason } });

    return res.status(200).json({ success: true, orderId, status: "expired" });
  } catch (err) {
    console.error("expireOrder failed:", err);
    return res.status(500).json({ message: "Could not expire order" });
  }
}

// ─── Admin manual override ────────────────────────────────────────────────────

export async function adminOverrideOrder(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  const adminId = req.user.uid;
  const { orderId, newStatus, notes = "" } = req.body;
  const ip = req.ip || null;

  if (!orderId || !newStatus) {
    return res.status(400).json({ message: "orderId and newStatus are required" });
  }

  const ALLOWED_OVERRIDE_STATUSES = [
    "request_submitted", "negotiating", "final_offer_sent", "buyer_accepted",
    "escrow_funded", "delivering", "buyer_review", "completed",
    "cancelled", "expired", "disputed", "admin_review", "refunded",
    "merchant_paid", "closed",
  ];

  if (!ALLOWED_OVERRIDE_STATUSES.includes(newStatus)) {
    return res.status(400).json({ message: "Invalid target status" });
  }

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });

    await orderRef.update({
      status: newStatus,
      adminOverrideBy: adminId,
      adminOverrideAt: admin.firestore.FieldValue.serverTimestamp(),
      adminOverrideNotes: notes,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAudit({
      orderId,
      action: "admin_override",
      userId: adminId,
      ip,
      extra: { newStatus, notes },
    });

    await orderMessages().add({
      orderId,
      senderId: "SYSTEM",
      senderName: "Paragon Platform",
      text: `🔧 Admin has manually set order status to '${newStatus}'. ${notes ? "Notes: " + notes : ""}`,
      type: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, orderId, status: newStatus });
  } catch (err) {
    console.error("adminOverrideOrder failed:", err);
    return res.status(500).json({ message: "Could not override order" });
  }
}

// ─── Automatic settlement (buyer_review timeout) ──────────────────────────────

export async function autoSettleReviewExpired(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  const { orderId } = req.body;
  const ip = req.ip || null;

  try {
    const orderRef = orders().doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.status !== "buyer_review") {
      return res.status(409).json({ message: "Order is not in buyer_review status" });
    }

    // Check 3-day window
    const deliveredAt = order.deliveredAt?.toMillis?.() ?? 0;
    if (Date.now() - deliveredAt < 3 * 24 * 60 * 60 * 1000) {
      return res.status(409).json({ message: "3-day review window has not expired yet" });
    }

    // Reuse confirmDeliveryAndSettle logic by creating a synthetic req
    const syntheticReq = {
      user: { uid: order.buyerId },
      body: { orderId },
      ip,
    };

    return await confirmDeliveryAndSettle(syntheticReq, res);
  } catch (err) {
    console.error("autoSettleReviewExpired failed:", err);
    return res.status(500).json({ message: "Could not auto-settle order" });
  }
}

// ─── PART 11 – Admin dashboard reads ─────────────────────────────────────────

export async function adminListOrders(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const { status, limit: limitParam = 50 } = req.query;
    let q = orders().orderBy("updatedAt", "desc").limit(Number(limitParam));
    if (status) q = orders().where("status", "==", status).orderBy("updatedAt", "desc").limit(Number(limitParam));

    const snap = await q.get();
    return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("adminListOrders failed:", err);
    return res.status(500).json({ message: "Could not list orders" });
  }
}

export async function adminListDisputes(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const snap = await disputes().orderBy("createdAt", "desc").limit(100).get();
    return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("adminListDisputes failed:", err);
    return res.status(500).json({ message: "Could not list disputes" });
  }
}

export async function adminGetEscrowBalance(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const snap = await escrowDoc().get();
    const data = snap.exists ? snap.data() : {};
    return res.json({ escrowId: ESCROW_ID, balances: data.balances || { parag: 0, gbazilo: 0 } });
  } catch (err) {
    console.error("adminGetEscrowBalance failed:", err);
    return res.status(500).json({ message: "Could not get escrow balance" });
  }
}

export async function adminGetAdminWallet(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const snap = await adminWalletDoc().get();
    const data = snap.exists ? snap.data() : {};
    return res.json({ walletId: ADMIN_WALLET_ID, balances: data.balances || { parag: 0, gbazilo: 0 } });
  } catch (err) {
    console.error("adminGetAdminWallet failed:", err);
    return res.status(500).json({ message: "Could not get admin wallet" });
  }
}

export async function adminCommissionReport(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const snap = await ledgerEntries()
      .where("walletId", "==", ADMIN_WALLET_ID)
      .where("type", "==", "CREDIT")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalParag = entries.filter((e) => e.currency === "PARAG").reduce((s, e) => s + Number(e.amount), 0);
    const totalGbazilo = entries.filter((e) => e.currency === "GBAZILO").reduce((s, e) => s + Number(e.amount), 0);

    return res.json({ entries, totalParag, totalGbazilo });
  } catch (err) {
    console.error("adminCommissionReport failed:", err);
    return res.status(500).json({ message: "Could not generate commission report" });
  }
}

export async function adminListAuditLog(req, res) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  try {
    const { orderId, limit: limitParam = 100 } = req.query;
    let q = auditLog().orderBy("createdAt", "desc").limit(Number(limitParam));
    if (orderId) q = auditLog().where("orderId", "==", orderId).orderBy("createdAt", "desc").limit(Number(limitParam));

    const snap = await q.get();
    return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("adminListAuditLog failed:", err);
    return res.status(500).json({ message: "Could not list audit log" });
  }
}

export async function getOrderDelivery(req, res) {
  const userId = req.user.uid;
  const { orderId } = req.params;

  try {
    const orderSnap = await orders().doc(orderId).get();
    if (!orderSnap.exists) return res.status(404).json({ message: "Order not found" });
    const order = orderSnap.data();

    if (order.buyerId !== userId && order.merchantId !== userId && !isAdminUser(req.user)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const snap = await deliveries().where("orderId", "==", orderId).orderBy("submittedAt", "desc").get();
    return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("getOrderDelivery failed:", err);
    return res.status(500).json({ message: "Could not get delivery" });
  }
}

export async function getUserNotifications(req, res) {
  const userId = req.user.uid;

  try {
    const snap = await notifications()
      .where("recipientId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error("getUserNotifications failed:", err);
    return res.status(500).json({ message: "Could not get notifications" });
  }
}

export async function markNotificationRead(req, res) {
  const userId = req.user.uid;
  const { notificationId } = req.params;

  try {
    const ref = notifications().doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: "Notification not found" });
    if (snap.data().recipientId !== userId && !isAdminUser(req.user)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    await ref.update({ read: true });
    return res.json({ success: true });
  } catch (err) {
    console.error("markNotificationRead failed:", err);
    return res.status(500).json({ message: "Could not mark notification" });
  }
}
