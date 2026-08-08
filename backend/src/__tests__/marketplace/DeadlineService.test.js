/**
 * DeadlineService unit tests
 *
 * Pure functions only – no Firestore, no firebase-admin needed.
 */

import { describe, it, expect } from "vitest";
import {
  DELIVERY_DEADLINE_MS,
  BUYER_REVIEW_DEADLINE_MS,
  ESCROW_AUTO_RELEASE_MS,
  DISPUTE_EVIDENCE_DEADLINE_MS,
  MERCHANT_RESPONSE_DEADLINE_MS,
  addMs,
  deliveryDeadline,
  buyerReviewDeadline,
  escrowAutoReleaseDeadline,
  disputeEvidenceDeadline,
  merchantResponseDeadline,
  isPast,
  isApproaching,
} from "../../services/marketplace/DeadlineService.js";

describe("DeadlineService – constants", () => {
  it("DELIVERY_DEADLINE_MS is 7 days", () => {
    expect(DELIVERY_DEADLINE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("BUYER_REVIEW_DEADLINE_MS is 72 h", () => {
    expect(BUYER_REVIEW_DEADLINE_MS).toBe(72 * 60 * 60 * 1000);
  });

  it("ESCROW_AUTO_RELEASE_MS equals BUYER_REVIEW_DEADLINE_MS", () => {
    expect(ESCROW_AUTO_RELEASE_MS).toBe(BUYER_REVIEW_DEADLINE_MS);
  });

  it("DISPUTE_EVIDENCE_DEADLINE_MS is 48 h", () => {
    expect(DISPUTE_EVIDENCE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
  });

  it("MERCHANT_RESPONSE_DEADLINE_MS is 48 h", () => {
    expect(MERCHANT_RESPONSE_DEADLINE_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("DeadlineService – addMs", () => {
  it("adds milliseconds to a base date", () => {
    const base = new Date("2024-01-01T00:00:00Z");
    const result = addMs(base, 1000);
    expect(result.getTime()).toBe(base.getTime() + 1000);
  });
});

describe("DeadlineService – helpers", () => {
  const base = new Date("2024-01-01T00:00:00Z");

  it("deliveryDeadline adds 7 days", () => {
    const d = deliveryDeadline(base);
    expect(d.getTime() - base.getTime()).toBe(DELIVERY_DEADLINE_MS);
  });

  it("buyerReviewDeadline adds 72 h", () => {
    const d = buyerReviewDeadline(base);
    expect(d.getTime() - base.getTime()).toBe(BUYER_REVIEW_DEADLINE_MS);
  });

  it("escrowAutoReleaseDeadline adds 72 h", () => {
    const d = escrowAutoReleaseDeadline(base);
    expect(d.getTime() - base.getTime()).toBe(ESCROW_AUTO_RELEASE_MS);
  });

  it("disputeEvidenceDeadline adds 48 h", () => {
    const d = disputeEvidenceDeadline(base);
    expect(d.getTime() - base.getTime()).toBe(DISPUTE_EVIDENCE_DEADLINE_MS);
  });

  it("merchantResponseDeadline adds 48 h", () => {
    const d = merchantResponseDeadline(base);
    expect(d.getTime() - base.getTime()).toBe(MERCHANT_RESPONSE_DEADLINE_MS);
  });
});

describe("DeadlineService – isPast", () => {
  it("returns false for a future date", () => {
    const future = new Date(Date.now() + 60_000);
    expect(isPast(future)).toBe(false);
  });

  it("returns true for a past date", () => {
    const past = new Date(Date.now() - 1);
    expect(isPast(past)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isPast(null)).toBe(false);
  });

  it("handles Firestore-like Timestamp objects with toMillis()", () => {
    const past = { toMillis: () => Date.now() - 1000 };
    expect(isPast(past)).toBe(true);

    const future = { toMillis: () => Date.now() + 1000 };
    expect(isPast(future)).toBe(false);
  });
});

describe("DeadlineService – isApproaching", () => {
  it("returns true if deadline is within windowMs", () => {
    const nearFuture = new Date(Date.now() + 30_000); // 30 s from now
    expect(isApproaching(nearFuture, 60_000)).toBe(true); // window 60 s
  });

  it("returns false if deadline is further than windowMs", () => {
    const farFuture = new Date(Date.now() + 120_000); // 2 min
    expect(isApproaching(farFuture, 60_000)).toBe(false); // window 60 s
  });

  it("returns false for a past deadline", () => {
    const past = new Date(Date.now() - 1000);
    expect(isApproaching(past, 60_000)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isApproaching(null, 60_000)).toBe(false);
  });
});
