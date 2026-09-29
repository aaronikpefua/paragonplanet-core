import crypto from "crypto";
import admin from "../config/firebase.js";

export const DEFAULT_LIVE_TARIFF = Object.freeze({
  currency: "PARAG", chargingUnitMinutes: 30,
  broadcasterPricePer30Min: 0, viewerPricePer30Min: 0,
  broadcasterChargingEnabled: false, viewerChargingEnabled: false,
  financialEnforcementEnabled: false, autoRenewPolicy: "manual",
  tariffVersion: 1, effectiveAt: null,
});

export async function getLiveTariff(db = admin.firestore()) {
  const ref = db.collection("platform_settings").doc("paragon_live_tariff");
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...DEFAULT_LIVE_TARIFF, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
    return { ...DEFAULT_LIVE_TARIFF };
  }
  return { ...DEFAULT_LIVE_TARIFF, ...snap.data() };
}

export function sanitizeLiveTariff(input, current = DEFAULT_LIVE_TARIFF) {
  const price = (name) => Math.max(0, Number(input?.[name] ?? current[name] ?? 0));
  return {
    currency: "PARAG", chargingUnitMinutes: 30,
    broadcasterPricePer30Min: price("broadcasterPricePer30Min"),
    viewerPricePer30Min: price("viewerPricePer30Min"),
    broadcasterChargingEnabled: Boolean(input?.broadcasterChargingEnabled ?? current.broadcasterChargingEnabled),
    viewerChargingEnabled: Boolean(input?.viewerChargingEnabled ?? current.viewerChargingEnabled),
    financialEnforcementEnabled: Boolean(input?.financialEnforcementEnabled ?? current.financialEnforcementEnabled),
    autoRenewPolicy: ["manual", "auto"].includes(input?.autoRenewPolicy) ? input.autoRenewPolicy : current.autoRenewPolicy,
    tariffVersion: Math.max(1, Number(input?.tariffVersion || current.tariffVersion || 1)),
    effectiveAt: input?.effectiveAt || current.effectiveAt || null,
  };
}

export function liveSettlementDecision(tariff, role) {
  const price = role === "broadcaster" ? Number(tariff.broadcasterPricePer30Min || 0) : Number(tariff.viewerPricePer30Min || 0);
  const roleEnabled = role === "broadcaster" ? tariff.broadcasterChargingEnabled === true : tariff.viewerChargingEnabled === true;
  const settlementRequired = tariff.financialEnforcementEnabled === true && roleEnabled && price > 0;
  return { price, roleEnabled, settlementRequired, amountCharged: 0, walletMutationApplied: false };
}

export async function grantLiveEntitlement({ userId, sessionId, mediaGeneration = 1, role, blockNumber = 1, blockStartedAt = null }, db = admin.firestore()) {
  if (!userId || !sessionId || !["broadcaster", "viewer"].includes(role)) throw Object.assign(new Error("Invalid Live entitlement request"), { status: 400 });
  const tariff = await getLiveTariff(db);
  const settlement = liveSettlementDecision(tariff, role);
  const { price } = settlement;
  if (settlement.settlementRequired) {
    throw Object.assign(new Error("Paid Live settlement is not enabled in this release."), { status: 503, code: "LIVE_SETTLEMENT_DISABLED" });
  }
  const start = blockStartedAt || admin.firestore.Timestamp.now();
  const startMs = typeof start.toMillis === "function" ? start.toMillis() : Date.now();
  const entitlementId = crypto.createHash("sha256").update(`${userId}:${sessionId}:${mediaGeneration}:${role}:${blockNumber}`).digest("hex").slice(0, 40);
  const entitlement = {
    entitlementId, userId, sessionId, mediaGeneration: Math.max(1, Number(mediaGeneration || 1)), role,
    tariffVersion: Number(tariff.tariffVersion), pricePer30Minutes: price, currency: "PARAG", blockNumber,
    blockStartedAt: start, blockEndsAt: admin.firestore.Timestamp.fromMillis(startMs + 30 * 60 * 1000),
    amountDue: price, amountCharged: 0, paymentStatus: "GRANTED_FREE",
    financialEnforcementApplied: false, walletMutationApplied: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = db.collection("live_entitlements").doc(entitlementId);
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return existing.data();
    transaction.create(ref, entitlement);
    return entitlement;
  });
}

export async function updateLiveTariff(input, actorUid, db = admin.firestore()) {
  const current = await getLiveTariff(db);
  const next = sanitizeLiveTariff(input, current);
  if (JSON.stringify(next) !== JSON.stringify(sanitizeLiveTariff(current, current))) next.tariffVersion = Number(current.tariffVersion || 1) + 1;
  next.effectiveAt = admin.firestore.Timestamp.now();
  await db.collection("platform_settings").doc("paragon_live_tariff").set({ ...next, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid }, { merge: false });
  return next;
}
