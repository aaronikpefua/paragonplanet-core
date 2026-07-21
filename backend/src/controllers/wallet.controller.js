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
