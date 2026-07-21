import admin from "../../config/firebase.js";

export const MAX_UPLOAD_BYTES =
  Number(process.env.MAX_VIDEO_UPLOAD_MB || 250) * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS =
  Number(process.env.MAX_VIDEO_DURATION_SECONDS || 900);
export const DAILY_UPLOAD_LIMIT = Number(process.env.DAILY_VIDEO_UPLOAD_LIMIT || 20);

export function validateUploadPolicy({ contentType, fileSize = 0, durationSeconds = 0 }) {
  const isVideo = String(contentType || "").startsWith("video/");
  if (!isVideo) return;

  const size = Number(fileSize || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Video file size is required");
  }

  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Video is too large. Maximum upload size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`
    );
  }

  const duration = Number(durationSeconds || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Video duration is required");
  }

  if (duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(
      `Video is too long. Maximum duration is ${MAX_VIDEO_DURATION_SECONDS / 60} minutes (${MAX_VIDEO_DURATION_SECONDS} seconds).`
    );
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function reserveDailyVideoUpload({ db, userId, uploadPurpose = "home_video" }) {
  if (!db || !userId) {
    throw new Error("db and userId are required");
  }

  const key = `${userId}_${dayKey()}_${uploadPurpose}`;
  const ref = db.collection("upload_daily_limits").doc(key);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const count = Number(snap.data()?.count || 0);

    if (count >= DAILY_UPLOAD_LIMIT) {
      throw new Error(`Daily upload limit reached. Try again tomorrow.`);
    }

    transaction.set(
      ref,
      {
        userId,
        uploadPurpose,
        day: dayKey(),
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: snap.exists
          ? snap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}


