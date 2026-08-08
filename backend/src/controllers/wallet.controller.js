import { createWallet } from "../models/wallet.model.js";
import { createLedgerEntry } from "../models/ledger.model.js";
import { isAdminUser } from "../lib/adminAccess.js";
import admin from "../config/firebase.js";

// TEMP in-memory storage (we’ll replace with DB later)
const wallets = new Map();
const ledger = [];
const walletAccounts = () => admin.firestore().collection("wallet_accounts");
const ledgerEntries = () => admin.firestore().collection("ledger_entries");

function isPositiveAmount(amount) {
  return Number.isFinite(Number(amount)) && Number(amount) > 0;
}

/**
 * Create wallet automatically for user
 */
export async function createUserWallet(req, res) {
  const userId = req.user.uid;

  try {
    const walletRef = walletAccounts().doc(userId);
    const walletSnap = await walletRef.get();

    if (walletSnap.exists) {
      const data = walletSnap.data() || {};
      return res.status(200).json({
        walletId: data.walletId || userId,
        userId,
        createdAt: data.createdAt || null,
        status: data.status || "ACTIVE",
      });
    }

    const wallet = createWallet(userId);
    await walletRef.set(
      {
        walletId: wallet.walletId,
        role: "wallet",
        status: wallet.status,
        balances: {
          parag: 0,
          gbazilo: 0,
        },
        lockedBalances: {
          parag: 0,
          gbazilo: 0,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(201).json(wallet);
  } catch (error) {
    console.error("Create wallet failed:", error);
    return res.status(500).json({ message: "Could not create wallet" });
  }
}

/**
 * Credit wallet (ADMIN / SYSTEM only for now)
 */
export async function creditWallet(req, res) {
  const { currency, amount, reason } = req.body;
  const userId = req.user.uid;

  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: "Admin permission required" });
  }

  if (!["PARAG", "GBAZILO"].includes(currency) || !isPositiveAmount(amount)) {
    return res.status(400).json({ message: "Invalid wallet credit request" });
  }

  try {
    const walletRef = walletAccounts().doc(userId);
    const walletSnap = await walletRef.get();
    if (!walletSnap.exists) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const entry = createLedgerEntry({
      walletId: walletSnap.data()?.walletId || userId,
      type: "CREDIT",
      amount: Number(amount),
      currency,
      reason,
      reference: "SYSTEM"
    });

    await admin.firestore().runTransaction(async (transaction) => {
      transaction.set(walletRef, {
        balances: {
          [currency.toLowerCase()]: admin.firestore.FieldValue.increment(Number(amount)),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

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
    });

    return res.status(201).json(entry);
  } catch (error) {
    console.error("Credit wallet failed:", error);
    return res.status(500).json({ message: "Could not credit wallet" });
  }
}

/**
 * Settle a marketplace order atomically:
 * - Debit buyer's PARAG wallet by the agreed amount
 * - Credit merchant's PARAG wallet by the agreed amount
 * - Update merchant_orders status to "paid"
 * - Create ledger entries for both parties
 */
export async function settleMarketplaceOrder(req, res) {
  const buyerId = req.user.uid;
  const { orderId } = req.body;

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId is required" });
  }

  try {
    const orderRef = admin.firestore().collection("merchant_orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderSnap.data();

    if (order.buyerId !== buyerId) {
      return res.status(403).json({ message: "Only the buyer may settle this order" });
    }

    if (order.status !== "final_offer_sent") {
      return res.status(409).json({ message: "Order is not awaiting payment" });
    }

    const amount = Number(order.amount || 0);
    if (!isPositiveAmount(amount)) {
      return res.status(400).json({ message: "Invalid order amount" });
    }

    const currency = (order.currency || "PARAG").toUpperCase();
    if (!["PARAG", "GBAZILO"].includes(currency)) {
      return res.status(400).json({ message: "Unsupported currency" });
    }

    const merchantId = order.merchantId;
    const buyerWalletRef = walletAccounts().doc(buyerId);
    const merchantWalletRef = walletAccounts().doc(merchantId);

    const buyerEntry = createLedgerEntry({
      walletId: buyerId,
      type: "DEBIT",
      amount,
      currency,
      reason: `Marketplace payment for order ${orderId}`,
      reference: orderId,
    });

    const merchantEntry = createLedgerEntry({
      walletId: merchantId,
      type: "CREDIT",
      amount,
      currency,
      reason: `Marketplace receipt for order ${orderId}`,
      reference: orderId,
    });

    await admin.firestore().runTransaction(async (transaction) => {
      const buyerSnap = await transaction.get(buyerWalletRef);
      if (!buyerSnap.exists) {
        throw new Error("Buyer wallet not found");
      }
      const buyerBalances = buyerSnap.data()?.balances || {};
      const buyerAvailable = Number(buyerBalances[currency.toLowerCase()] || 0);
      if (buyerAvailable < amount) {
        throw Object.assign(new Error("Insufficient balance"), { code: "INSUFFICIENT_BALANCE" });
      }

      // Debit buyer
      transaction.set(
        buyerWalletRef,
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(-amount),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Credit merchant (create wallet doc if missing)
      transaction.set(
        merchantWalletRef,
        {
          balances: {
            [currency.toLowerCase()]: admin.firestore.FieldValue.increment(amount),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update order status
      transaction.update(orderRef, {
        status: "paid",
        paymentStatus: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Ledger entries
      transaction.set(ledgerEntries().doc(buyerEntry.ledgerId), {
        accountId: buyerId,
        walletId: buyerEntry.walletId,
        type: buyerEntry.type,
        amount: buyerEntry.amount,
        currency: buyerEntry.currency,
        reason: buyerEntry.reason,
        reference: buyerEntry.reference,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(ledgerEntries().doc(merchantEntry.ledgerId), {
        accountId: merchantId,
        walletId: merchantEntry.walletId,
        type: merchantEntry.type,
        amount: merchantEntry.amount,
        currency: merchantEntry.currency,
        reason: merchantEntry.reason,
        reference: merchantEntry.reference,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return res.status(200).json({ success: true, orderId, status: "paid" });
  } catch (error) {
    if (error.code === "INSUFFICIENT_BALANCE") {
      return res.status(402).json({ message: "Insufficient wallet balance" });
    }
    console.error("Settle marketplace order failed:", error);
    return res.status(500).json({ message: "Could not settle order" });
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(req, res) {
  const userId = req.user.uid;

  try {
    const walletSnap = await walletAccounts().doc(userId).get();

    if (walletSnap.exists) {
      const data = walletSnap.data() || {};
      const balances = data.balances || {};

      return res.json({
        walletId: data.walletId || userId,
        balance: {
          PARAG: Number(balances.parag || 0),
          GBAZILO: Number(balances.gbazilo || 0),
        }
      });
    }

    const wallet = wallets.get(userId);

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const balance = {
      PARAG: 0,
      GBAZILO: 0
    };

    ledger
      .filter(e => e.walletId === wallet.walletId)
      .forEach(e => {
        if (e.type === "CREDIT") balance[e.currency] += e.amount;
        if (e.type === "DEBIT") balance[e.currency] -= e.amount;
      });

    return res.json({
      walletId: wallet.walletId,
      balance
    });
  } catch (error) {
    console.error("Get wallet balance failed:", error);
    return res.status(500).json({ message: "Could not load wallet balance" });
  }
}
