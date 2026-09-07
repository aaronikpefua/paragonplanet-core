import admin from "../config/firebase.js";
import { authorizeInternalRequest, liveWebhookEventId, reconcileLiveSession, reconcileOpenLiveSessions } from "./liveReconciler.js";

export async function receiveCloudflareLiveWebhook(req, res) {
  try {
  if (!authorizeInternalRequest(req, "CLOUDFLARE_LIVE_WEBHOOK_SECRET")) {
    return res.status(401).json({ error: "Webhook authorization failed", code: "NOT_AUTHORIZED" });
  }
  const payload = req.body || {};
  const data = payload.data || {};
  const inputId = String(data.input_id || "").trim();
  const eventType = String(data.event_type || "").trim();
  if (!inputId || !["live_input.connected", "live_input.disconnected", "live_input.errored"].includes(eventType)) {
    return res.status(400).json({ error: "Unsupported Live webhook payload", code: "LIVE_WEBHOOK_INVALID" });
  }
  const db = admin.firestore();
  const eventId = liveWebhookEventId(payload);
  const eventRef = db.collection("live_provider_events").doc(eventId);
  try {
    await eventRef.create({
      provider: "cloudflare-stream-live",
      inputId,
      eventType,
      providerUpdatedAt: data.updated_at || null,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });
  } catch (error) {
    if (Number(error.code) === 6 || String(error.message || "").toLowerCase().includes("already exists")) {
      return res.status(202).json({ accepted: true, duplicate: true, eventId });
    }
    throw error;
  }

  const matches = await db.collection("live_sessions").where("liveInputId", "==", inputId).limit(2).get();
  if (matches.empty) {
    await eventRef.set({ processed: true, outcome: "unknown-input", processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return res.status(202).json({ accepted: true, outcome: "unknown-input", eventId });
  }
  const results = [];
  for (const doc of matches.docs) {
    const accepted = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(doc.ref);
      if (!fresh.exists) return false;
      const current = fresh.data() || {};
      const incomingMs = Date.parse(data.updated_at || "") || Number(payload.ts || 0) * 1000 || Date.now();
      const currentMs = current.lastProviderEventAt?.toMillis?.() || Date.parse(current.lastProviderEventAt || "") || 0;
      if (currentMs && incomingMs <= currentMs) return false;
      transaction.set(doc.ref, {
        lastProviderEventAt: admin.firestore.Timestamp.fromMillis(incomingMs),
        providerEventRevision: Number(current.providerEventRevision || 0) + 1,
      }, { merge: true });
      return true;
    });
    results.push(accepted
      ? await reconcileLiveSession(doc.id, { reason: eventType })
      : { sessionId: doc.id, outcome: "out-of-order-event-ignored" });
  }
  await eventRef.set({ processed: true, outcome: "reconciled", sessionIds: matches.docs.map((doc) => doc.id), processedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return res.status(202).json({ accepted: true, eventId, results: results.map((item) => ({ sessionId: item.sessionId || item.session?.id, outcome: item.outcome })) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Live webhook failed", code: error.code || "LIVE_WEBHOOK_FAILED" });
  }
}

export async function runLiveReconciliation(req, res) {
  try {
  if (!authorizeInternalRequest(req, "LIVE_RECONCILE_SECRET")) {
    return res.status(401).json({ error: "Reconciliation authorization failed", code: "NOT_AUTHORIZED" });
  }
  const results = await reconcileOpenLiveSessions({ limit: Number(req.body?.limit || 100) });
  return res.json({ processed: results.length, results });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Live reconciliation failed", code: error.code || "LIVE_RECONCILE_FAILED" });
  }
}
