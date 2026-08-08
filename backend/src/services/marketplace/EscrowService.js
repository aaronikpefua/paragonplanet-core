/**
 * EscrowService – reusable escrow financial operations.
 *
 * Extracts the core Firestore transaction logic from marketplace.controller.js
 * so it can be called by:
 *   • HTTP controllers  (buyer confirms, admin resolves, etc.)
 *   • Cloud Functions   (scheduled auto-settle, expiry, dispute escalation)
 *
 * Cloud Functions import an equivalent implementation from
 * functions/src/lib/escrow.js so the two packages remain independently
 * deployable. Any change here MUST be mirrored there.
 *
 * All methods throw named errors (err.code) that callers can inspect:
 *   ESCROW_INSUFFICIENT  – escrow balance too low to settle
 *   INVALID_AMOUNT       – amount is not a positive finite number
 */

import admin from "../../config/firebase.js";
import { createLedgerEntry } from "../../models/ledger.model.js";

// ─── Collection helpers ──────────────────────────────────────────────────────

const ESCROW_ID = "MARKETPLACE_ESCROW";
const ADMIN_WALLET_ID = "MARKETPLACE_ADMIN";

const db = () => admin.firestore();
const escrowRef = () =>
  db().collection("marketplace_escrow").doc(ESCROW_ID);
const adminWalletRef = () =>
  db().collection("wallet_accounts").doc(ADMIN_WALLET_ID);
const walletRef = (uid) => db().collection("wallet_accounts").doc(uid);
const ledgerEntries = () => db().collection("ledger_entries");
const orderRef = (orderId) => db().collection("merchant_orders").doc(orderId);
const orderMessages = () => db().collection("merchant_order_messages");

// ─── Internal helpers ────────────────────────────────────────────────────────

function writeLedger(tx, entry) {
  tx.set(ledgerEntries().doc(entry.ledgerId), {
    accountId: entry.walletId,
    walletId: entry.walletId,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    reason: entry.reason,
    reference: entry.reference,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function ts() {
  return admin.firestore.FieldValue.serverTimestamp();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Release escrow to merchant (minus platform commission).
 *
 * Runs a single atomic Firestore transaction that:
 *   1. Verifies escrow balance
 *   2. Debits escrow
 *   3. Credits merchant wallet
 *   4. Credits admin wallet (commission)
 *   5. Marks order as "completed"
 *   6. Writes double-entry ledger entries
 *   7. Posts a system order-thread message
 *
 * @param {object} params
 * @param {string}  params.orderId
 * @param {object}  params.order       Firestore order document data
 * @param {number}  params.commissionPct
 * @returns {Promise<{amount:number, merchantAmount:number, commissionAmount:number, commissionPct:number, currency:string}>}
 * @throws  If escrow balance is insufficient (err.code === "ESCROW_INSUFFICIENT")
 */
export async function settleOrder({ orderId, order, commissionPct }) {
  const amount = Number(order.escrowAmount || order.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("Invalid escrow amount");
    err.code = "INVALID_AMOUNT";
    throw err;
  }

  const currency = (order.escrowCurrency || order.currency || "PARAG").toUpperCase();
  const commissionAmount =
    Math.round(((amount * commissionPct) / 100) * 1e6) / 1e6;
  const merchantAmount = Math.round((amount - commissionAmount) * 1e6) / 1e6;

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

  await db().runTransaction(async (tx) => {
    const escrowSnap = await tx.get(escrowRef());
    const escrowBalances = escrowSnap.exists
      ? escrowSnap.data()?.balances || {}
      : {};
    const available = Number(escrowBalances[currency.toLowerCase()] || 0);

    if (available < amount) {
      const err = new Error("Escrow balance insufficient");
      err.code = "ESCROW_INSUFFICIENT";
      throw err;
    }

    // Debit escrow
    tx.set(
      escrowRef(),
      {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );

    // Credit merchant
    tx.set(
      walletRef(order.merchantId),
      {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(merchantAmount),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );

    // Credit admin (commission)
    tx.set(
      adminWalletRef(),
      {
        walletId: ADMIN_WALLET_ID,
        role: "admin",
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(commissionAmount),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );

    // Update order
    tx.update(orderRef(orderId), {
      status: "completed",
      completedAt: ts(),
      settlementAmount: merchantAmount,
      commissionAmount,
      commissionPct,
      updatedAt: ts(),
    });

    // Ledger
    writeLedger(tx, escrowDebitEntry);
    writeLedger(tx, commissionEntry);
    writeLedger(tx, merchantEntry);

    // System thread message
    tx.set(orderMessages().doc(), {
      orderId,
      senderId: "SYSTEM",
      senderName: "Paragon Platform",
      text: `✅ Order completed. ${merchantAmount} ${currency} released to merchant. Commission: ${commissionAmount} ${currency} (${commissionPct}%).`,
      type: "system",
      createdAt: ts(),
    });
  });

  return { amount, merchantAmount, commissionAmount, commissionPct, currency };
}

/**
 * Refund the full escrowed amount to the buyer.
 *
 * Runs a single atomic Firestore transaction that:
 *   1. Debits escrow
 *   2. Credits buyer wallet
 *   3. Writes double-entry ledger entries
 *
 * The caller is responsible for updating order status and posting audit/notifications.
 *
 * @param {object} params
 * @param {string}  params.orderId
 * @param {object}  params.order   Firestore order document data
 * @param {string}  params.reason  Human-readable reason for ledger entries
 * @returns {Promise<{amount:number, currency:string}>}
 */
export async function refundBuyer({ orderId, order, reason }) {
  const amount = Number(order.escrowAmount || 0);
  const currency = (order.escrowCurrency || "PARAG").toUpperCase();

  if (amount <= 0) return { amount: 0, currency };

  const refundEntry = createLedgerEntry({
    walletId: order.buyerId,
    type: "CREDIT",
    amount,
    currency,
    reason: `${reason} for order ${orderId}`,
    reference: orderId,
  });
  const escrowDebitEntry = createLedgerEntry({
    walletId: ESCROW_ID,
    type: "DEBIT",
    amount,
    currency,
    reason: `${reason} escrow release for order ${orderId}`,
    reference: orderId,
  });

  await db().runTransaction(async (tx) => {
    tx.set(
      escrowRef(),
      {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );
    tx.set(
      walletRef(order.buyerId),
      {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );
    writeLedger(tx, refundEntry);
    writeLedger(tx, escrowDebitEntry);
  });

  return { amount, currency };
}

/**
 * Atomically expire an order: refund buyer (if escrow was funded) and mark
 * the order as "expired".
 *
 * Suitable for both admin-initiated HTTP calls and Cloud Function scheduled jobs.
 *
 * @param {object} params
 * @param {string}  params.orderId
 * @param {object}  params.order   Firestore order document data
 * @param {string}  params.reason  Human-readable expiry reason
 * @returns {Promise<{amount:number, currency:string, refunded:boolean}>}
 */
export async function expireOrderAtomically({ orderId, order, reason }) {
  const amount = Number(order.escrowAmount || 0);
  const currency = (order.escrowCurrency || "PARAG").toUpperCase();
  const shouldRefund = amount > 0 && order.status === "escrow_funded";

  await db().runTransaction(async (tx) => {
    if (shouldRefund) {
      const refundEntry = createLedgerEntry({
        walletId: order.buyerId,
        type: "CREDIT",
        amount,
        currency,
        reason: `Expiry refund for order ${orderId}`,
        reference: orderId,
      });
      const escrowDebitEntry = createLedgerEntry({
        walletId: ESCROW_ID,
        type: "DEBIT",
        amount,
        currency,
        reason: `Expiry escrow release for order ${orderId}`,
        reference: orderId,
      });

      tx.set(
        escrowRef(),
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount),
          },
          updatedAt: ts(),
        },
        { merge: true }
      );
      tx.set(
        walletRef(order.buyerId),
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount),
          },
          updatedAt: ts(),
        },
        { merge: true }
      );
      writeLedger(tx, refundEntry);
      writeLedger(tx, escrowDebitEntry);
    }

    tx.update(orderRef(orderId), {
      status: "expired",
      expiredAt: ts(),
      expireReason: reason,
      updatedAt: ts(),
    });

    tx.set(orderMessages().doc(), {
      orderId,
      senderId: "SYSTEM",
      senderName: "Paragon Platform",
      text: `⏱️ Order expired: ${reason}.`,
      type: "system",
      createdAt: ts(),
    });
  });

  return { amount, currency, refunded: shouldRefund };
}

/**
 * Split escrow between buyer and merchant according to a dispute decision.
 *
 * Runs a single atomic Firestore transaction that debits the full escrow
 * balance and distributes it to buyer, merchant (minus commission), and
 * admin, according to the percentages provided.
 *
 * @param {object} params
 * @param {string}  params.orderId
 * @param {object}  params.order
 * @param {number}  params.commissionPct   Platform commission %
 * @param {string}  params.decision        "buyer_wins" | "merchant_wins" | "partial_refund"
 * @param {number}  [params.partialBuyerPct]  Required when decision === "partial_refund"
 * @param {string}  [params.notes]
 * @param {string}  params.adminId
 * @returns {Promise<{escrowAmount:number, buyerRefund:number, merchantPay:number, commissionAmount:number, finalStatus:string, currency:string}>}
 */
export async function resolveDisputeEscrow({
  orderId,
  order,
  commissionPct,
  decision,
  partialBuyerPct,
  notes = "",
  adminId,
}) {
  const escrowAmount = Number(order.escrowAmount || order.amount || 0);
  const currency = (order.escrowCurrency || order.currency || "PARAG").toUpperCase();

  let buyerRefund = 0;
  let merchantPay = 0;
  let commissionAmount = 0;
  let finalStatus = "closed";

  if (decision === "buyer_wins") {
    buyerRefund = escrowAmount;
    finalStatus = "refunded";
  } else if (decision === "merchant_wins") {
    commissionAmount =
      Math.round(((escrowAmount * commissionPct) / 100) * 1e6) / 1e6;
    merchantPay = Math.round((escrowAmount - commissionAmount) * 1e6) / 1e6;
    finalStatus = "completed";
  } else {
    // partial_refund
    const buyerPct = Number(partialBuyerPct);
    buyerRefund = Math.round(((escrowAmount * buyerPct) / 100) * 1e6) / 1e6;
    const remaining = Math.round((escrowAmount - buyerRefund) * 1e6) / 1e6;
    commissionAmount =
      Math.round(((remaining * commissionPct) / 100) * 1e6) / 1e6;
    merchantPay = Math.round((remaining - commissionAmount) * 1e6) / 1e6;
    finalStatus = "closed";
  }

  await db().runTransaction(async (tx) => {
    // Debit full escrow
    tx.set(
      escrowRef(),
      {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(
            -escrowAmount
          ),
        },
        updatedAt: ts(),
      },
      { merge: true }
    );

    if (buyerRefund > 0) {
      tx.set(
        walletRef(order.buyerId),
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(buyerRefund),
          },
          updatedAt: ts(),
        },
        { merge: true }
      );
      writeLedger(
        tx,
        createLedgerEntry({
          walletId: order.buyerId,
          type: "CREDIT",
          amount: buyerRefund,
          currency,
          reason: `Dispute refund (${decision}) for order ${orderId}`,
          reference: orderId,
        })
      );
    }

    if (merchantPay > 0) {
      tx.set(
        walletRef(order.merchantId),
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(merchantPay),
          },
          updatedAt: ts(),
        },
        { merge: true }
      );
      writeLedger(
        tx,
        createLedgerEntry({
          walletId: order.merchantId,
          type: "CREDIT",
          amount: merchantPay,
          currency,
          reason: `Dispute settlement (${decision}) for order ${orderId}`,
          reference: orderId,
        })
      );
    }

    if (commissionAmount > 0) {
      tx.set(
        adminWalletRef(),
        {
          walletId: ADMIN_WALLET_ID,
          role: "admin",
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(commissionAmount),
          },
          updatedAt: ts(),
        },
        { merge: true }
      );
      writeLedger(
        tx,
        createLedgerEntry({
          walletId: ADMIN_WALLET_ID,
          type: "CREDIT",
          amount: commissionAmount,
          currency,
          reason: `Commission (${commissionPct}%) on dispute settlement for order ${orderId}`,
          reference: orderId,
        })
      );
    }

    // Escrow debit ledger
    writeLedger(
      tx,
      createLedgerEntry({
        walletId: ESCROW_ID,
        type: "DEBIT",
        amount: escrowAmount,
        currency,
        reason: `Dispute resolution (${decision}) for order ${orderId}`,
        reference: orderId,
      })
    );

    // Update order
    tx.update(orderRef(orderId), {
      status: finalStatus,
      disputeDecision: decision,
      disputeResolvedAt: ts(),
      disputeResolvedBy: adminId,
      disputeNotes: notes,
      updatedAt: ts(),
    });

    // Update dispute document
    if (order.disputeId) {
      tx.update(
        db().collection("marketplace_disputes").doc(order.disputeId),
        {
          adminDecision: decision,
          adminNotes: notes,
          adminDecidedAt: ts(),
          adminDecidedBy: adminId,
          status: "resolved",
          updatedAt: ts(),
        }
      );
    }

    // System thread message
    tx.set(orderMessages().doc(), {
      orderId,
      senderId: "SYSTEM",
      senderName: "Paragon Platform",
      text: `⚖️ Admin has resolved the dispute. Decision: ${decision}. ${notes ? "Notes: " + notes : ""}`,
      type: "system",
      createdAt: ts(),
    });
  });

  return {
    escrowAmount,
    buyerRefund,
    merchantPay,
    commissionAmount,
    finalStatus,
    currency,
  };
}
