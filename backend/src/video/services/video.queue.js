import admin from "../../config/firebase.js";
import { processUploadedVideo } from "./video.processor.js";

const JOB_COLLECTION = "video_processing_jobs";
const DEFAULT_BATCH_LIMIT = 1;
const MAX_BATCH_LIMIT = 5;

function nowField() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function cleanJobId(value = "") {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
}

export async function enqueueVideoProcessingJob({
  db,
  objectPath,
  originalUrl,
  collectionName = "videos",
  documentId,
  requestedBy = "",
  uploadPurpose = "",
}) {
  if (!db || !objectPath || !originalUrl || !documentId) {
    throw new Error("db, objectPath, originalUrl, and documentId are required");
  }

  const jobId = cleanJobId(`${collectionName}_${documentId}`);
  const jobRef = db.collection(JOB_COLLECTION).doc(jobId);
  const targetRef = db.collection(collectionName).doc(documentId);

  await db.runTransaction(async (transaction) => {
    transaction.set(
      jobRef,
      {
        objectPath,
        originalUrl,
        collectionName,
        documentId,
        requestedBy,
        uploadPurpose,
        status: "queued",
        attempts: 0,
        createdAt: nowField(),
        updatedAt: nowField(),
      },
      { merge: true }
    );

    transaction.set(
      targetRef,
      {
        status: "processing",
        processingStatus: "queued",
        processingJobId: jobId,
        updatedAt: nowField(),
      },
      { merge: true }
    );
  });

  return { jobId };
}

async function claimQueuedJob(db) {
  const snap = await db
    .collection(JOB_COLLECTION)
    .where("status", "==", "queued")
    .limit(1)
    .get();

  if (snap.empty) return null;

  const queuedDoc = snap.docs[0];
  const jobRef = queuedDoc.ref;

  return db.runTransaction(async (transaction) => {
    const freshDoc = await transaction.get(jobRef);
    const freshData = freshDoc.data() || {};

    if (freshData.status !== "queued") {
      return null;
    }

    transaction.set(
      jobRef,
      {
        status: "processing",
        attempts: Number(freshData.attempts || 0) + 1,
        lockedAt: nowField(),
        updatedAt: nowField(),
      },
      { merge: true }
    );

    return {
      id: jobRef.id,
      ref: jobRef,
      data: freshData,
    };
  });
}

export async function processQueuedVideoJobs({ db, limit = DEFAULT_BATCH_LIMIT }) {
  if (!db) throw new Error("db is required");

  const batchLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_BATCH_LIMIT, 1),
    MAX_BATCH_LIMIT
  );
  const processed = [];

  for (let index = 0; index < batchLimit; index += 1) {
    const claimed = await claimQueuedJob(db);
    if (!claimed) break;

    const { id, ref, data } = claimed;

    try {
      const result = await processUploadedVideo({
        objectPath: data.objectPath,
        originalUrl: data.originalUrl,
        videoId: data.documentId,
        collectionName: data.collectionName,
        documentId: data.documentId,
        db,
      });

      await ref.set(
        {
          status: "done",
          result,
          finishedAt: nowField(),
          updatedAt: nowField(),
        },
        { merge: true }
      );

      processed.push({ jobId: id, status: "done", result });
    } catch (error) {
      await ref.set(
        {
          status: "failed",
          error: error.message || "Video processing failed",
          failedAt: nowField(),
          updatedAt: nowField(),
        },
        { merge: true }
      );

      processed.push({
        jobId: id,
        status: "failed",
        error: error.message || "Video processing failed",
      });
    }
  }

  return {
    processed,
    count: processed.length,
    limit: batchLimit,
  };
}
