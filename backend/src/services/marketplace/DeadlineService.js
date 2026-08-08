/**
 * DeadlineService – Marketplace deadline constants and helpers.
 *
 * These values drive every timed automation in the Marketplace:
 *   - How long a merchant has to deliver after escrow is funded
 *   - How long a buyer has to confirm/dispute after delivery
 *   - How long parties have to act in a dispute before the system auto-resolves
 *
 * Cloud Functions import an identical copy of these constants from
 * functions/src/lib/deadlines.js so the two packages remain independently
 * deployable. Any change here MUST be mirrored there.
 */

// ─── Deadline windows ────────────────────────────────────────────────────────

/** Merchant must deliver within 7 days of escrow being funded. */
export const DELIVERY_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Buyer has 72 hours after delivery to confirm or open a dispute. */
export const BUYER_REVIEW_DEADLINE_MS = 72 * 60 * 60 * 1000;

/**
 * If the buyer has not acted after 72 hours, escrow auto-releases to merchant.
 * Matches BUYER_REVIEW_DEADLINE_MS.
 */
export const ESCROW_AUTO_RELEASE_MS = BUYER_REVIEW_DEADLINE_MS;

/** Buyer has 48 hours after opening a dispute to submit evidence. */
export const DISPUTE_EVIDENCE_DEADLINE_MS = 48 * 60 * 60 * 1000;

/** Merchant has 48 hours after a dispute is opened to submit a response. */
export const MERCHANT_RESPONSE_DEADLINE_MS = 48 * 60 * 60 * 1000;

// ─── Reminder thresholds (send a reminder when this much time is left) ──────

export const DELIVERY_REMINDER_MS = 24 * 60 * 60 * 1000;      // 24 h left
export const BUYER_REVIEW_REMINDER_MS = 12 * 60 * 60 * 1000;  // 12 h left
export const DISPUTE_REMINDER_MS = 6 * 60 * 60 * 1000;        // 6 h left
export const ESCROW_RELEASE_REMINDER_MS = 6 * 60 * 60 * 1000; // 6 h left

// ─── Reminder keys (used to deduplicate sent reminders) ─────────────────────

export const REMINDER_DELIVERY_24H = "delivery_24h";
export const REMINDER_BUYER_REVIEW_12H = "buyer_review_12h";
export const REMINDER_DISPUTE_6H = "dispute_6h";
export const REMINDER_ESCROW_RELEASE_6H = "escrow_release_6h";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return a new Date that is `ms` milliseconds after `base`.
 * @param {Date} base
 * @param {number} ms
 * @returns {Date}
 */
export function addMs(base, ms) {
  return new Date(base.getTime() + ms);
}

/** @param {Date} [from=new Date()] */
export const deliveryDeadline = (from = new Date()) =>
  addMs(from, DELIVERY_DEADLINE_MS);

/** @param {Date} [from=new Date()] */
export const buyerReviewDeadline = (from = new Date()) =>
  addMs(from, BUYER_REVIEW_DEADLINE_MS);

/** @param {Date} [from=new Date()] */
export const escrowAutoReleaseDeadline = (from = new Date()) =>
  addMs(from, ESCROW_AUTO_RELEASE_MS);

/** @param {Date} [from=new Date()] */
export const disputeEvidenceDeadline = (from = new Date()) =>
  addMs(from, DISPUTE_EVIDENCE_DEADLINE_MS);

/** @param {Date} [from=new Date()] */
export const merchantResponseDeadline = (from = new Date()) =>
  addMs(from, MERCHANT_RESPONSE_DEADLINE_MS);

/**
 * Return true if `deadlineTs` (a Firestore Timestamp or Date) is in the past.
 * @param {import("firebase-admin").firestore.Timestamp|Date|null} deadlineTs
 * @returns {boolean}
 */
export function isPast(deadlineTs) {
  if (!deadlineTs) return false;
  const ms =
    typeof deadlineTs.toMillis === "function"
      ? deadlineTs.toMillis()
      : deadlineTs instanceof Date
      ? deadlineTs.getTime()
      : Number(deadlineTs);
  return Date.now() > ms;
}

/**
 * Return true if `deadlineTs` is within `windowMs` milliseconds in the future.
 * Used by reminder jobs to decide whether to send a "deadline approaching" notification.
 * @param {import("firebase-admin").firestore.Timestamp|Date|null} deadlineTs
 * @param {number} windowMs
 * @returns {boolean}
 */
export function isApproaching(deadlineTs, windowMs) {
  if (!deadlineTs) return false;
  const ms =
    typeof deadlineTs.toMillis === "function"
      ? deadlineTs.toMillis()
      : deadlineTs instanceof Date
      ? deadlineTs.getTime()
      : Number(deadlineTs);
  const remaining = ms - Date.now();
  return remaining > 0 && remaining <= windowMs;
}
