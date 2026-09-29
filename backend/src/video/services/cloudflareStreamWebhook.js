import crypto from "node:crypto";
import admin from "../../config/firebase.js";
import { VIDEO_RECONCILIATION_COLLECTION } from "./videoEconomy.js";

const SIGNATURE_TOLERANCE_SECONDS = 300;

function signatureParts(header = "") {
  return Object.fromEntries(
    String(header)
      .split(",")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value),
  );
}

export function verifyStreamWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
}) {
  if (!Buffer.isBuffer(rawBody) || !secret) return false;
  const { time = "", sig1 = "" } = signatureParts(signatureHeader);
  const timestamp = Number(time);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  if (!/^[a-f0-9]{64}$/i.test(sig1)) return false;
  const source = Buffer.concat([Buffer.from(`${time}.`, "utf8"), rawBody]);
  const expected = crypto.createHmac("sha256", secret).update(source).digest();
  const actual = Buffer.from(sig1, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function parseStreamWebhookPayload(rawBody) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return null;
  try {
    const payload = JSON.parse(rawBody.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const uid = typeof payload.uid === "string" ? payload.uid.trim() : "";
    const state = typeof payload.status?.state === "string"
      ? payload.status.state.trim().toLowerCase()
      : "";
    if (!uid || !state) return null;
    return { payload, uid, state };
  } catch {
    return null;
  }
}

function failureReason(payload) {
  return String(
    payload.status?.errReasonText
      || payload.status?.errorReasonText
      || payload.status?.errReasonCode
      || payload.status?.errorReasonCode
      || "Cloudflare Stream processing failed",
  ).slice(0, 500);
}

export async function processCitizenStreamWebhook({
  db = admin.firestore(),
  payload,
  serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp(),
}) {
  const uid = typeof payload?.uid === "string" ? payload.uid.trim() : "";
  const state = typeof payload?.status?.state === "string"
    ? payload.status.state.trim().toLowerCase()
    : "";
  if (!uid || !state) return { outcome: "malformed" };

  const matches = await db.collection("videos").where("streamUid", "==", uid).limit(2).get();
  if (matches.empty) return { outcome: "unknown_uid", uid };
  if (matches.size !== 1) return { outcome: "ambiguous_uid", uid };

  const videoRef = matches.docs[0].ref;
  const videoId = matches.docs[0].id;
  const expectedVideoId = typeof payload.meta?.videoId === "string" ? payload.meta.videoId.trim() : "";
  if (expectedVideoId && expectedVideoId !== videoId) {
    return { outcome: "video_id_mismatch", uid, videoId };
  }

  const jobRef = db.collection(VIDEO_RECONCILIATION_COLLECTION).doc(videoId);
  return db.runTransaction(async (transaction) => {
    const [videoSnap, jobSnap] = await Promise.all([
      transaction.get(videoRef),
      transaction.get(jobRef),
    ]);
    if (!videoSnap.exists || videoSnap.data()?.streamUid !== uid) {
      return { outcome: "uid_changed", uid, videoId };
    }

    const video = videoSnap.data() || {};
    const job = jobSnap.exists ? (jobSnap.data() || {}) : {};
    const alreadyReady = video.streamReady === true
      || video.feedEligible === true
      || video.lifecycleStatus === "READY";
    const receivedAt = serverTimestamp();
    const ready = payload.readyToStream === true && state === "ready";

    if (ready) {
      if (alreadyReady && String(job.status || "").toLowerCase() === "done") {
        return { outcome: "duplicate_ready", uid, videoId };
      }
      transaction.set(videoRef, {
        streamStatus: "ready",
        streamReady: true,
        feedEligible: true,
        lifecycleStatus: "READY",
        processingStatus: "ready",
        status: "active",
        contentDomain: "citizen",
        feedKind: "home",
        streamReadyAt: payload.readyToStreamAt || receivedAt,
        streamWebhookReceivedAt: receivedAt,
        streamLastReconciledAt: receivedAt,
        streamError: null,
        updatedAt: receivedAt,
      }, { merge: true });
      transaction.set(jobRef, {
        status: "done",
        nextRetryAt: null,
        completedAt: receivedAt,
        webhookCompletedAt: receivedAt,
        recoveryMode: "webhook",
        error: null,
        updatedAt: receivedAt,
      }, { merge: true });
      return { outcome: "ready", uid, videoId };
    }

    if (state === "error") {
      if (alreadyReady) return { outcome: "stale_error_ignored", uid, videoId };
      const error = failureReason(payload);
      transaction.set(videoRef, {
        streamStatus: "error",
        streamReady: false,
        feedEligible: false,
        lifecycleStatus: "PROCESSING_FAILED",
        processingStatus: "processing_failed",
        streamWebhookReceivedAt: receivedAt,
        streamLastReconciledAt: receivedAt,
        streamError: error,
        updatedAt: receivedAt,
      }, { merge: true });
      transaction.set(jobRef, {
        status: "failed",
        nextRetryAt: null,
        completedAt: receivedAt,
        recoveryMode: "webhook",
        error,
        updatedAt: receivedAt,
      }, { merge: true });
      return { outcome: "failed", uid, videoId };
    }

    return { outcome: alreadyReady ? "stale_processing_ignored" : "processing_ignored", uid, videoId };
  });
}
