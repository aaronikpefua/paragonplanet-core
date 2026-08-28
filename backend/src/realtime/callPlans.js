import admin from "../config/firebase.js";

export const CALL_STATUSES = Object.freeze({
  REQUESTED: "REQUESTED",
  RESERVED: "RESERVED",
  RINGING: "RINGING",
  ACCEPTED: "ACCEPTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
  ENDED: "ENDED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
});

export const TERMINAL_STATUSES = new Set([
  CALL_STATUSES.DECLINED,
  CALL_STATUSES.EXPIRED,
  CALL_STATUSES.FAILED,
  CALL_STATUSES.ENDED,
  CALL_STATUSES.CANCELLED,
  CALL_STATUSES.REFUNDED,
]);

export const DEFAULT_CALL_PLANS = [
  {
    id: "quick",
    label: "Quick Call",
    durationMinutes: 10,
    priceParag: 2,
    participantLimit: 2,
    active: true,
    sortOrder: 1,
  },
  {
    id: "standard",
    label: "Standard Call",
    durationMinutes: 30,
    priceParag: 5,
    participantLimit: 2,
    active: true,
    sortOrder: 2,
  },
  {
    id: "extended",
    label: "Extended Call",
    durationMinutes: 60,
    priceParag: 10,
    participantLimit: 2,
    active: true,
    sortOrder: 3,
  },
];

export function normalizePlan(id, data = {}) {
  return {
    id,
    label: String(data.label || data.name || id).trim(),
    durationMinutes: Math.max(1, Math.floor(Number(data.durationMinutes || 0))),
    priceParag: Math.max(0, Math.floor(Number(data.priceParag || 0))),
    participantLimit: Math.max(2, Math.floor(Number(data.participantLimit || 2))),
    active: data.active !== false,
    sortOrder: Number(data.sortOrder || 0),
  };
}

export async function listCallPlans(db = admin.firestore()) {
  const snap = await db.collection("realtime_call_plans").get();
  const configured = snap.docs
    .map((doc) => normalizePlan(doc.id, doc.data() || {}))
    .filter((plan) => plan.active && plan.durationMinutes > 0 && plan.priceParag > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priceParag - b.priceParag);

  return configured.length ? configured : DEFAULT_CALL_PLANS;
}

export async function getCallPlan(planId, db = admin.firestore()) {
  const plans = await listCallPlans(db);
  return plans.find((plan) => plan.id === planId) || null;
}

export function callExpiresAt(durationMs = 60 * 1000) {
  return admin.firestore.Timestamp.fromMillis(Date.now() + durationMs);
}
