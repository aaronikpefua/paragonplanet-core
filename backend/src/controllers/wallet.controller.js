import { createWallet } from "../models/wallet.model.js";
import { createLedgerEntry } from "../models/ledger.model.js";

// TEMP in-memory storage (we’ll replace with DB later)
const wallets = new Map();
const ledger = [];

/**
 * Create wallet automatically for user
 */
export function createUserWallet(req, res) {
  const userId = req.user.uid;

  if (wallets.has(userId)) {
    return res.status(200).json(wallets.get(userId));
  }

  const wallet = createWallet(userId);
  wallets.set(userId, wallet);

  return res.status(201).json(wallet);
}

/**
 * Credit wallet (ADMIN / SYSTEM only for now)
 */
export function creditWallet(req, res) {
  const { currency, amount, reason } = req.body;
  const userId = req.user.uid;

  const wallet = wallets.get(userId);
  if (!wallet) {
    return res.status(404).json({ message: "Wallet not found" });
  }

  const entry = createLedgerEntry({
    walletId: wallet.walletId,
    type: "CREDIT",
    amount,
    currency,
    reason,
    reference: "SYSTEM"
  });

  ledger.push(entry);

  return res.status(201).json(entry);
}

/**
 * Get wallet balance
 */
export function getWalletBalance(req, res) {
  const userId = req.user.uid;
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
}
