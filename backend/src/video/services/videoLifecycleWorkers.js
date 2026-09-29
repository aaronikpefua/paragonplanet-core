import admin from "../../config/firebase.js";
import { createLedgerEntry } from "../../models/ledger.model.js";
import { getCitizenStreamStorageUsage, getCitizenStreamVideo, importCitizenStreamFromUrl, streamPlaybackFromUid } from "./cloudflareStreamVod.js";
import { getCurrentVideoPricing, VIDEO_BILLING_COLLECTION, VIDEO_POLICY_COLLECTION, VIDEO_RECONCILIATION_COLLECTION } from "./videoEconomy.js";
import { reconcileCitizenR2Usage } from "./video.service.js";
import {
  reconciliationRecoveryDelaySeconds,
  scheduleVideoReconciliation,
  VIDEO_RECOVERY_TASK_ATTEMPTS,
} from "./videoReconciliationTasks.js";

function now() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function processVideoReconciliationJobs({ db, limit = 5, videoId = "" } = {}) {
  const snapshot = videoId
    ? await db.collection(VIDEO_RECONCILIATION_COLLECTION).where("videoId", "==", videoId).limit(1).get()
    : await db.collection(VIDEO_RECONCILIATION_COLLECTION)
      .where("status", "==", "queued")
      .limit(Math.max(1, Math.min(Number(limit) || 5, 20)))
      .get();
  const results = [];
  for (const jobDoc of snapshot.docs) {
    const job = jobDoc.data() || {};
    if (["done", "failed"].includes(String(job.status || "").toLowerCase())) {
      results.push({ jobId: jobDoc.id, ok: true, skipped: true, reason: `job_${job.status}` });
      continue;
    }
    const nextRetryAt = job.nextRetryAt?.toDate?.() || job.nextRetryAt;
    // A targeted Cloud Task is already a bounded per-video retry. Let it run
    // even if clock/second rounding puts it just before nextRetryAt. Recovery
    // scheduler scans must continue respecting nextRetryAt.
    if (!videoId && nextRetryAt instanceof Date && nextRetryAt.getTime() > Date.now()) continue;
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
      let streamStillProcessing = false;
      let importedThisAttempt = null;
      if (!video.streamUid && ["stream_import_retry", "upload_completed"].includes(job.reason)) {
        const imported = await importCitizenStreamFromUrl({
          videoId: job.videoId,
          sourceUrl: video.originalUrl || video.fileUrl,
          metadata: { citizenId: video.uid, uploadId: job.uploadId },
        });
        if (imported.enabled && imported.streamUid) {
          importedThisAttempt = imported;
          streamStillProcessing = true;
          Object.assign(updates, {
            streamUid: imported.streamUid,
            streamStatus: "STREAM_PROCESSING",
            streamProvider: "cloudflare_stream",
            streamCreatedAt: now(),
            streamError: null,
            ...streamPlaybackFromUid(imported.streamUid),
          });
        }
      }
      const effectiveStreamUid = updates.streamUid || video.streamUid;
      if (effectiveStreamUid) {
        const stream = importedThisAttempt
          ? { configured: true, video: importedThisAttempt.video }
          : await getCitizenStreamVideo(effectiveStreamUid);
        if (stream.configured && stream.video) {
          const ready = stream.video.readyToStream || stream.video.status?.state === "ready";
          const streamState = String(stream.video.status?.state || "").toLowerCase();
          if (streamState === "error") {
            throw new Error(stream.video.status?.errorReasonText || "Cloudflare Stream processing failed");
          }
          streamStillProcessing = !ready;
          Object.assign(updates, {
            streamStatus: stream.video.status?.state || (ready ? "ready" : "processing"),
            streamReady: Boolean(ready),
            streamDurationSeconds: Number(stream.video.duration || 0),
            streamThumbnailUrl: stream.video.thumbnail || streamPlaybackFromUid(effectiveStreamUid).streamThumbnailUrl,
            streamReadyAt: ready ? (stream.video.readyToStreamAt || now()) : null,
            streamLastReconciledAt: now(),
            streamError: stream.video.status?.state === "error" ? (stream.video.status?.errorReasonText || "Stream processing failed") : null,
            ...(!ready ? { lifecycleStatus: "STREAM_PROCESSING", processingStatus: "processing", feedEligible: false } : {}),
            ...(ready ? streamPlaybackFromUid(effectiveStreamUid) : {}),
            ...(ready ? { lifecycleStatus: "READY", processingStatus: "ready", status: "active", contentDomain: "citizen", feedKind: "home", feedEligible: true } : {}),
          });
        }
      }
      await videoRef.set(updates, { merge: true });
      if (streamStillProcessing) {
        const nextAttempt = Number(job.attempts || 0) + 1;
        const retryDelaySeconds = reconciliationRecoveryDelaySeconds(nextAttempt, job.videoId);
        const taskRecoveryExhausted = nextAttempt > VIDEO_RECOVERY_TASK_ATTEMPTS;
        await jobDoc.ref.set({
          status: "queued",
          nextRetryAt: new Date(Date.now() + (taskRecoveryExhausted ? 6 * 60 * 60 : retryDelaySeconds) * 1000),
          completedAt: null,
          recoveryMode: taskRecoveryExhausted ? "scheduler" : "cloud_task",
          updatedAt: now(),
        }, { merge: true });
        if (!taskRecoveryExhausted) {
          await scheduleVideoReconciliation({ videoId: job.videoId, delaySeconds: retryDelaySeconds, attempt: nextAttempt });
        }
        results.push({ jobId: jobDoc.id, ok: true, pending: true, recoveryMode: taskRecoveryExhausted ? "scheduler" : "cloud_task" });
      } else {
        await jobDoc.ref.set({ status: "done", nextRetryAt: null, completedAt: now(), updatedAt: now() }, { merge: true });
        results.push({ jobId: jobDoc.id, ok: true, pending: false });
      }
    } catch (error) {
      const attempts = Number(job.attempts || 0) + 1;
      await jobDoc.ref.set({
        status: attempts < 3 ? "queued" : "failed",
        error: error.message || "Reconciliation failed",
        nextRetryAt: attempts < 3 ? new Date(Date.now() + attempts * 60_000) : null,
        updatedAt: now(),
      }, { merge: true });
      if (attempts < 3) {
        await scheduleVideoReconciliation({
          videoId: job.videoId,
          delaySeconds: reconciliationRecoveryDelaySeconds(attempts, job.videoId),
          attempt: attempts,
        }).catch(() => {});
      }
      results.push({ jobId: jobDoc.id, ok: false, error: error.message });
    }
  }
  // Per-video Cloud Tasks must remain targeted and fast. Provider-wide usage
  // reconciliation belongs to the bounded recovery scheduler, not every
  // readiness check in a potentially large upload burst.
  if (!videoId) {
    try {
      const usage = await getCitizenStreamStorageUsage();
      await db.collection("provider_reconciliation").doc("citizen_video_stream").set({
        provider: "cloudflare_stream", enabled: Boolean(usage.configured), activeAssets: usage.configured ? Number(usage.videoCount || 0) : null,
        storageMinutes: usage.configured ? Number(usage.totalStorageMinutes || 0) : null,
        status: usage.configured ? "CONNECTED" : "DISABLED", lastReconciledAt: now(),
      }, { merge: true });
    } catch (error) {
      await db.collection("provider_reconciliation").doc("citizen_video_stream").set({ status: "RECONCILIATION_FAILED", error: error.message, lastAttemptAt: now() }, { merge: true });
    }
    try {
      const usage = await reconcileCitizenR2Usage({ maxPages: 100 });
      await db.collection("provider_reconciliation").doc("citizen_video_r2").set({ provider: "cloudflare_r2", status: usage.complete ? "CONNECTED" : "PARTIAL", storageBytes: usage.storageBytes, objectCount: usage.objectCount, pages: usage.pages, lastReconciledAt: now() }, { merge: true });
    } catch (error) {
      await db.collection("provider_reconciliation").doc("citizen_video_r2").set({ status: "RECONCILIATION_FAILED", error: error.message, lastAttemptAt: now() }, { merge: true });
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
