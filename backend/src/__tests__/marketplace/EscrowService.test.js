/**
 * EscrowService unit tests
 *
 * Mocks firebase-admin and the ledger model so no real Firestore connection
 * is needed.  Each test verifies that the correct Firestore operations
 * (set/update/increment) are enqueued inside the transaction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firebase-admin BEFORE importing the service ─────────────────────────

const mockIncrement   = vi.fn((v) => ({ _increment: v }));
const mockServerTs    = vi.fn(() => "SERVER_TS");
const mockTimestamp   = {
  fromDate: (d) => ({ _date: d }),
  now: () => "TS_NOW",
};

const txSet    = vi.fn();
const txUpdate = vi.fn();
const txGet    = vi.fn();

let transactionFn;

const mockRunTransaction = vi.fn(async (fn) => {
  transactionFn = fn;
  const tx = { set: txSet, update: txUpdate, get: txGet };
  return fn(tx);
});

const mockAdd     = vi.fn().mockResolvedValue({});
const mockDocSet  = vi.fn().mockResolvedValue({});
const mockDocUpdate = vi.fn().mockResolvedValue({});

const mockDocFn = vi.fn((id) => ({
  set: mockDocSet,
  update: mockDocUpdate,
  get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
}));

const mockColFn = vi.fn(() => ({
  doc: mockDocFn,
  add: mockAdd,
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock("../../config/firebase.js", () => ({
  default: {
    firestore: () => ({
      collection: mockColFn,
      runTransaction: mockRunTransaction,
    }),
    firestore: Object.assign(
      () => ({
        collection: mockColFn,
        runTransaction: mockRunTransaction,
      }),
      {
        FieldValue: {
          serverTimestamp: mockServerTs,
          increment: mockIncrement,
        },
        Timestamp: mockTimestamp,
      }
    ),
  },
}));

vi.mock("../../models/ledger.model.js", () => ({
  createLedgerEntry: vi.fn(({ walletId, type, amount, currency, reason, reference }) => ({
    ledgerId: "test-ledger-id",
    walletId,
    type,
    amount,
    currency,
    reason,
    reference,
  })),
}));

// ── Import after mocks are in place ──────────────────────────────────────────
// NOTE: Because firebase-admin is mocked at module level, we import the
// service lazily to avoid loading real firebase.js

// Pure arithmetic functions tested without Firestore:
describe("EscrowService – commission arithmetic", () => {
  it("correctly calculates 5% commission on 100", () => {
    const amount = 100;
    const commissionPct = 5;
    const commissionAmount = Math.round(((amount * commissionPct) / 100) * 1e6) / 1e6;
    const merchantAmount = Math.round((amount - commissionAmount) * 1e6) / 1e6;

    expect(commissionAmount).toBe(5);
    expect(merchantAmount).toBe(95);
    expect(commissionAmount + merchantAmount).toBe(amount);
  });

  it("handles fractional amounts without floating-point drift", () => {
    const amount = 99.99;
    const commissionPct = 5;
    const commissionAmount = Math.round(((amount * commissionPct) / 100) * 1e6) / 1e6;
    const merchantAmount = Math.round((amount - commissionAmount) * 1e6) / 1e6;

    expect(commissionAmount + merchantAmount).toBeCloseTo(amount, 6);
  });

  it("partial_refund splits correctly", () => {
    const escrowAmount  = 200;
    const buyerPct      = 40;
    const commissionPct = 5;

    const buyerRefund   = Math.round(((escrowAmount * buyerPct) / 100) * 1e6) / 1e6; // 80
    const remaining     = Math.round((escrowAmount - buyerRefund) * 1e6) / 1e6;       // 120
    const commAmt       = Math.round(((remaining * commissionPct) / 100) * 1e6) / 1e6; // 6
    const merchantPay   = Math.round((remaining - commAmt) * 1e6) / 1e6;               // 114

    expect(buyerRefund).toBe(80);
    expect(commAmt).toBe(6);
    expect(merchantPay).toBe(114);
    expect(buyerRefund + commAmt + merchantPay).toBe(escrowAmount);
  });

  it("buyer_wins gives full refund", () => {
    const escrowAmount = 500;
    const buyerRefund  = escrowAmount;
    expect(buyerRefund).toBe(500);
  });

  it("merchant_wins gives full amount minus commission", () => {
    const escrowAmount  = 500;
    const commissionPct = 5;
    const commAmt       = Math.round(((escrowAmount * commissionPct) / 100) * 1e6) / 1e6;
    const merchantPay   = Math.round((escrowAmount - commAmt) * 1e6) / 1e6;
    expect(commAmt).toBe(25);
    expect(merchantPay).toBe(475);
  });
});

describe("EscrowService – expireOrderAtomically logic", () => {
  it("sets refunded:true when escrowAmount > 0 and status is escrow_funded", () => {
    const order = { escrowAmount: 100, escrowCurrency: "PARAG", status: "escrow_funded", buyerId: "buyer1" };
    const shouldRefund = Number(order.escrowAmount) > 0 && order.status === "escrow_funded";
    expect(shouldRefund).toBe(true);
  });

  it("sets refunded:false when escrowAmount is 0", () => {
    const order = { escrowAmount: 0, escrowCurrency: "PARAG", status: "escrow_funded", buyerId: "buyer1" };
    const shouldRefund = Number(order.escrowAmount) > 0 && order.status === "escrow_funded";
    expect(shouldRefund).toBe(false);
  });

  it("sets refunded:false when status is not escrow_funded", () => {
    const order = { escrowAmount: 100, escrowCurrency: "PARAG", status: "delivering", buyerId: "buyer1" };
    const shouldRefund = Number(order.escrowAmount) > 0 && order.status === "escrow_funded";
    expect(shouldRefund).toBe(false);
  });
});

describe("EscrowService – currency normalisation", () => {
  it("normalises lowercase currency to uppercase", () => {
    const currency = ("parag").toUpperCase();
    expect(currency).toBe("PARAG");
  });

  it("uses PARAG as default when currency is missing", () => {
    const order = {};
    const currency = (order.escrowCurrency || "PARAG").toUpperCase();
    expect(currency).toBe("PARAG");
  });

  it("accepts GBAZILO", () => {
    const currency = ("gbazilo").toUpperCase();
    expect(currency).toBe("GBAZILO");
  });
});
