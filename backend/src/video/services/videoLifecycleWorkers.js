import admin from "../../config/firebase.js";
import { createLedgerEntry } from "../../models/ledger.model.js";
import { getCitizenStreamVideo, streamPlaybackFromUid } from "./cloudflareStreamVod.js";
import { getCurrentVideoPricing, VIDEO_BILLING_COLLECTION, VIDEO_POLICY_COLLECTION, VIDEO_RECONCILIATION_COLLECTION } from "./videoEconomy.js";

function now() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function processVideoReconciliationJobs({ db, limit = 5 } = {}) {
  const snapshot = await db.collection(VIDEO_RECONCILIATION_COLLECTION)
    .where("status", "==", "queued")
    .limit(Math.max(1, Math.min(Number(limit) || 5, 20)))
    .get();
  const results = [];
  for (const jobDoc of snapshot.docs) {
    const job = jobDoc.data() || {};
    const videoRef = db.collection("videos").doc(job.videoId);
    await jobDoc.ref.set({ status: "processing", attempts: admin.firestore.FieldValue.increment(1), updatedAt: now() }, { merge: true });
    try {
      const videoSnap = await videoRef.get();
      if (!videoSnap.exists) throw new Error("Video record not found");
      const video = videoSnap.data() || {};
      const updates = {
        lifecycleStatus: video.lifecycleStatus === "READY" ? "READY" : "UPLOADED",
        updatedAt: now(),
      };
      if (video.streamUid) {
        const stream = await getCitizenStreamVideo(video.streamUid);
        if (stream.configured && stream.video) {
          const ready = stream.video.readyToStream || stream.video.status?.state === "ready";
          Object.assign(updates, {
            streamStatus: stream.video.status?.state || (ready ? "ready" : "processing"),
            streamReady: Boolean(ready),
            ...(ready ? streamPlaybackFromUid(video.streamUid) : {}),
            ...(ready ? { lifecycleStatus: "READY", processingStatus: "ready", status: "active" } : {}),
          });
        }
      }
      await videoRef.set(updates, { merge: true });
      await jobDoc.ref.set({ status: "done", completedAt: now(), updatedAt: now() }, { merge: true });
      results.push({ jobId: jobDoc.id, ok: true });
    } catch (error) {
      await jobDoc.ref.set({
        status: "failed",
        error: error.message || "Reconciliation failed",
        updatedAt: now(),
      }, { merge: true });
      results.push({ jobId: jobDoc.id, ok: false, error: error.message });
    }
  }
  return { processed: results.length, results };
}

export async function processVideoMaintenanceJobs({ db, limit = 10 } = {}) {
  const dueSnapshot = await db.collection(VIDEO_BILLING_COLLECTION)
    .where("dueAt", "<=", new Date())
    .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
    .get();
  const results = [];
  for (const doc of dueSnapshot.docs) {
    const obligation = doc.data() || {};
    const amountDue = Number(obligation.amountDue || 0);
    if (amountDue <= 0) {
      const nextStart = obligation.periodEnd?.toDate?.() || new Date();
      const nextEnd = addDays(nextStart, 30);
      await doc.ref.set({
        paymentStatus: "ZERO_PRICE_RENEWED",
        amountCharged: 0,
        periodStart: nextStart,
        periodEnd: nextEnd,
        dueAt: nextEnd,
        attempts: 0,
        updatedAt: now(),
      }, { merge: true });
      results.push({ obligationId: doc.id, ok: true, zeroPrice: true });
      continue;
    }
    const pricingSnap = obligation.pricingVersion
      ? await db.collection(VIDEO_POLICY_COLLECTION).doc(obligation.pricingVersion).get()
      : null;
    const pricing = pricingSnap?.exists ? pricingSnap.data() || {} : await getCurrentVideoPricing(db);
    const shouldDebit = Boolean(pricing.videoFeesEnabled && pricing.automaticWalletDeductionEnabled && obligation.currency === "PARAG");
    if (shouldDebit) {
      const walletRef = db.collection("wallet_accounts").doc(obligation.citizenId);
      const ledgerRef = db.collection("ledger_entries").doc(`video_maintenance_${doc.id}_${Number(obligation.attempts || 0) + 1}`);
      try {
        await db.runTransaction(async (transaction) => {
          const existingLedger = await transaction.get(ledgerRef);
          if (existingLedger.exists) return;
          const walletSnap = await transaction.get(walletRef);
          const availableParag = Number(walletSnap.data()?.balances?.parag || 0);
          if (availableParag < amountDue) {
            const error = new Error("Insufficient PARAG balance for video maintenance.");
            error.status = 402;
            throw error;
          }
          const entry = createLedgerEntry({
            walletId: walletSnap.data()?.walletId || obligation.citizenId,
            type: "DEBIT",
            amount: amountDue,
            currency: "PARAG",
            reason: "Citizen video monthly maintenance",
            reference: doc.id,
          });
          const nextStart = obligation.periodEnd?.toDate?.() || new Date();
          const nextEnd = addDays(nextStart, 30);
          transaction.set(walletRef, {
            balances: { parag: admin.firestore.FieldValue.increment(-amountDue) },
            updatedAt: now(),
          }, { merge: true });
          transaction.set(ledgerRef, {
            ...entry,
            ledgerId: ledgerRef.id,
            accountId: obligation.citizenId,
            referenceType: "citizen_video_maintenance",
            videoId: obligation.videoId,
            createdAt: now(),
          });
          transaction.set(doc.ref, {
            paymentStatus: "PAID",
            amountCharged: amountDue,
            periodStart: nextStart,
            periodEnd: nextEnd,
            dueAt: nextEnd,
            attempts: 0,
            nextRetryAt: null,
            gracePeriodEndsAt: null,
            updatedAt: now(),
          }, { merge: true });
          transaction.set(db.collection("videos").doc(obligation.videoId), {
            billingStatus: "ACTIVE",
            updatedAt: now(),
          }, { merge: true });
        });
        results.push({ obligationId: doc.id, ok: true, charged: true });
        continue;
      } catch (error) {
        if (error.status !== 402) throw error;
      }
    }
    await doc.ref.set({
      paymentStatus: "PAYMENT_DUE",
      attempts: admin.firestore.FieldValue.increment(1),
      nextRetryAt: addDays(new Date(), 3),
      gracePeriodEndsAt: obligation.gracePeriodEndsAt || addDays(new Date(), 14),
      updatedAt: now(),
    }, { merge: true });
    await db.collection("videos").doc(obligation.videoId).set({
      billingStatus: "PAYMENT_DUE",
      updatedAt: now(),
    }, { merge: true });
    results.push({ obligationId: doc.id, ok: true, paymentDue: true });
  }
  return { processed: results.length, results };
}

export async function processVideoDeletionJobs({ db, limit = 10 } = {}) {
  const snapshot = await db.collection("videos")
    .where("billingStatus", "==", "SCHEDULED_FOR_DELETION")
    .where("contentDomain", "==", "citizen")
    .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
    .get();
  const results = [];
  for (const doc of snapshot.docs) {
    await doc.ref.set({
      lifecycleStatus: "DELETED",
      billingStatus: "DELETED",
      feedEligible: false,
      feedKind: "none",
      deletedAt: now(),
      updatedAt: now(),
    }, { merge: true });
    results.push({ videoId: doc.id, ok: true });
  }
  return { processed: results.length, results };
}
