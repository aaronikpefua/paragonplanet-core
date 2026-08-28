import admin from "../config/firebase.js";
import { ensureVideoThumbnail } from "../video/services/video.processor.js";

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const limit = Math.max(Number(getArg("limit", "20")) || 20, 1);
const apply = process.argv.includes("--apply");
const collectionName = getArg("collection", "videos");
const videoId = getArg("videoId", "");
const title = getArg("title", "");

const db = admin.firestore();

let snapshot;
if (videoId) {
  const doc = await db.collection(collectionName).doc(videoId).get();
  snapshot = {
    size: doc.exists ? 1 : 0,
    docs: doc.exists ? [doc] : [],
  };
} else if (title) {
  snapshot = await db
    .collection(collectionName)
    .where("title", "==", title)
    .limit(limit)
    .get();
} else {
  snapshot = await db
    .collection(collectionName)
    .limit(limit)
    .get();
}

const records = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
const alreadyWithThumbnail = records.filter(({ data }) => data.thumbnailUrl || data.posterUrl);
const missingThumbnail = records.filter(({ data }) => !data.thumbnailUrl && !data.posterUrl);
const missingVideoUrl = missingThumbnail.filter(
  ({ data }) => !(data.mobileUrl || data.desktopUrl || data.streamUrl || data.originalUrl || data.fileUrl)
);
const candidates = missingThumbnail.filter(
  ({ data }) => data.mobileUrl || data.desktopUrl || data.streamUrl || data.originalUrl || data.fileUrl
);

console.log(
  JSON.stringify(
    {
      collectionName,
      limit,
      apply,
      videoId: videoId || null,
      title: title || null,
      scanned: snapshot.size,
      alreadyWithThumbnail: alreadyWithThumbnail.length,
      eligibleForGeneration: candidates.length,
      skippedMissingVideoUrl: missingVideoUrl.length,
      skippedTotal: alreadyWithThumbnail.length + missingVideoUrl.length,
    },
    null,
    2
  )
);

if (!apply) {
  candidates.forEach(({ id }) => {
    console.log(`[dry-run] would generate thumbnail for ${id}`);
  });
  missingVideoUrl.forEach(({ id }) => {
    console.log(`[dry-run] missing video URL for ${id}`);
  });
  process.exit(0);
}

for (const candidate of candidates) {
  try {
    const result = await ensureVideoThumbnail({
      videoId: candidate.id,
      collectionName,
      db,
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(
      JSON.stringify({
        videoId: candidate.id,
        error: error.message || "thumbnail backfill failed",
      })
    );
  }
}
