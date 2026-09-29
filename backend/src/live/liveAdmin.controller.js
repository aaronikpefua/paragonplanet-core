import admin from "../config/firebase.js";
import { getLiveTariff, updateLiveTariff } from "./liveTariff.js";
import { listHealthyGateways } from "./liveGatewayRegistry.js";
import { LIVE_SCALE_POLICY } from "./liveScalePolicy.js";

export async function getLiveAdminSettings(_req, res) {
  const [tariff, gateways] = await Promise.all([getLiveTariff(), listHealthyGateways({ role: "publisher" })]);
  return res.json({ tariff, developmentStatus: "FREE", financialEnforcementActive: false, gateways, scalePolicy: LIVE_SCALE_POLICY });
}

export async function updateLiveAdminSettings(req, res) {
  const tariff = await updateLiveTariff(req.body || {}, req.user?.uid || "admin");
  return res.json({ tariff, developmentStatus: "FREE", walletMutationsEnabled: false });
}

export async function listLiveEntitlements(req, res) {
  const snapshot = await admin.firestore().collection("live_entitlements").orderBy("createdAt", "desc").limit(Math.min(200, Number(req.query.limit || 50))).get();
  return res.json({ entitlements: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
}
