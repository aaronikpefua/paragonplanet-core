import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createSignedObjectUploadUrl,
  getPublicUrlForObject,
} from "./video.service.js";
import { MAX_VIDEO_DURATION_SECONDS } from "./video.policy.js";

const MAX_PROCESSING_BYTES =
  Number(process.env.MAX_VIDEO_PROCESSING_MB || 350) * 1024 * 1024;

function getVideoIdFromObjectPath(objectPath = "") {
  const cleanName = String(objectPath).split("/").pop() || "";
  return cleanName.split("-")[0] || "";
}

function getProcessedObjectPath(objectPath, variant) {
  const safePath = String(objectPath || "").replace(/^videos\//, "");
  const withoutExtension = safePath.replace(/\.[a-z0-9]+$/i, "");
  return `processed/${variant}/${withoutExtension}.mp4`;
}

function getThumbnailObjectPath(objectPath) {
  const safePath = String(objectPath || "").replace(/^videos\//, "");
  const withoutExtension = safePath.replace(/\.[a-z0-9]+$/i, "");
  return `processed/thumbnails/${withoutExtension}.jpg`;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) {
        stderr = stderr.slice(-8000);
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
    });
  });
}

function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout.trim());
      return reject(new Error(`FFprobe failed with code ${code}: ${stderr}`));
    });
  });
}

async function getVideoDurationSeconds(inputPath) {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);

  return Number(output);
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download source video (${response.status})`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_PROCESSING_BYTES) {
    throw new Error("Video is too large for affordable processing");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_PROCESSING_BYTES) {
    throw new Error("Video is too large for affordable processing");
  }

  await writeFile(targetPath, buffer);
}

async function uploadFileToR2({ objectPath, filePath, contentType }) {
  const uploadUrl = createSignedObjectUploadUrl({
    objectPath,
    expiresSeconds: 900,
  });
  const body = await readFile(filePath);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Could not upload processed video (${response.status})`);
  }

  return getPublicUrlForObject(objectPath);
}

function buildFitFilter({ width, height }) {
  return [
    "[0:v]split=2[bg][fg];",
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,`,
    `crop=${width}:${height},boxblur=24:1[bg];`,
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];`,
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]",
  ].join("");
}

async function createDisplayVideo({ inputPath, outputPath, width, height }) {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-filter_complex",
    buildFitFilter({ width, height }),
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "24",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

async function createVideoThumbnail({ inputPath, outputPath }) {
  await runFfmpeg([
    "-y",
    "-ss",
    "00:00:01",
    "-i",
    inputPath,
    "-filter_complex",
    buildFitFilter({ width: 720, height: 1280 }),
    "-map",
    "[v]",
    "-frames:v",
    "1",
    "-q:v",
    "4",
    outputPath,
  ]);
}

export async function processUploadedVideo({
  objectPath,
  originalUrl,
  videoId = getVideoIdFromObjectPath(objectPath),
  collectionName = "videos",
  documentId = videoId,
  db,
}) {
  if (!objectPath || !originalUrl || !documentId) {
    throw new Error("objectPath, originalUrl, and documentId are required");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "paragon-video-"));
  const inputPath = path.join(tempDir, "original");
  const mobilePath = path.join(tempDir, "mobile.mp4");
  const desktopPath = path.join(tempDir, "desktop.mp4");
  const thumbnailPath = path.join(tempDir, "thumbnail.jpg");

  try {
    const videoRef = db.collection(collectionName).doc(documentId);
    await videoRef.set(
      {
        processingStatus: "processing_display_versions",
        updatedAt: new Date(),
      },
      { merge: true }
    );

    await downloadFile(originalUrl, inputPath);

    const inputStat = await stat(inputPath);
    if (inputStat.size > MAX_PROCESSING_BYTES) {
      throw new Error("Video is too large for affordable processing");
    }

    const durationSeconds = await getVideoDurationSeconds(inputPath);
    if (
      Number.isFinite(durationSeconds) &&
      durationSeconds > MAX_VIDEO_DURATION_SECONDS
    ) {
      throw new Error(
        `Video is too long. Maximum duration is ${MAX_VIDEO_DURATION_SECONDS / 60} minutes (${MAX_VIDEO_DURATION_SECONDS} seconds).`
      );
    }

    await createDisplayVideo({
      inputPath,
      outputPath: mobilePath,
      width: 1080,
      height: 1920,
    });
    await createDisplayVideo({
      inputPath,
      outputPath: desktopPath,
      width: 1920,
      height: 1080,
    });
    await createVideoThumbnail({
      inputPath,
      outputPath: thumbnailPath,
    });

    const mobileObjectPath = getProcessedObjectPath(objectPath, "mobile");
    const desktopObjectPath = getProcessedObjectPath(objectPath, "desktop");
    const thumbnailObjectPath = getThumbnailObjectPath(objectPath);
    const mobileUrl = await uploadFileToR2({
      objectPath: mobileObjectPath,
      filePath: mobilePath,
      contentType: "video/mp4",
    });
    const desktopUrl = await uploadFileToR2({
      objectPath: desktopObjectPath,
      filePath: desktopPath,
      contentType: "video/mp4",
    });
    const thumbnailUrl = await uploadFileToR2({
      objectPath: thumbnailObjectPath,
      filePath: thumbnailPath,
      contentType: "image/jpeg",
    });
    const existingSnap = await videoRef.get();
    const existing = existingSnap.exists ? existingSnap.data() || {} : {};
    const isCitizenVideo = collectionName === "videos" && String(existing.contentDomain || "citizen") === "citizen";
    const isMeetUp = existing.uploadPurpose === "meet_up_video" || existing.visibility === "meet_up";
    const isMarketplace = existing.uploadPurpose === "merchant_product" || existing.visibility === "marketplace" || existing.productId || existing.merchantId;

    await videoRef.set(
      {
        thumbnailUrl,
        mobileUrl,
        desktopUrl,
        streamUrl: desktopUrl,
        status: "active",
        processingStatus: "ready",
        lifecycleStatus: "READY",
        ...(isCitizenVideo && !isMeetUp && !isMarketplace
          ? { contentDomain: "citizen", feedKind: "home", feedEligible: true }
          : { feedEligible: false, feedKind: isMarketplace ? "marketplace" : "none" }),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return {
      videoId: documentId,
      thumbnailUrl,
      mobileUrl,
      desktopUrl,
    };
  } catch (error) {
    if (documentId && db) {
      await db.collection(collectionName).doc(documentId).set(
        {
          processingStatus: "processing_failed",
          processingError: error.message || "Video processing failed",
          status: "processing",
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function ensureVideoThumbnail({
  videoId,
  collectionName = "videos",
  db,
}) {
  if (!videoId || !db) {
    throw new Error("videoId and db are required");
  }

  const videoRef = db.collection(collectionName).doc(videoId);
  const snapshot = await videoRef.get();
  if (!snapshot.exists) {
    throw new Error(`Video document ${videoId} does not exist`);
  }

  const data = snapshot.data() || {};
  if (data.thumbnailUrl || data.posterUrl) {
    return {
      videoId,
      skipped: true,
      reason: "thumbnail_exists",
      thumbnailUrl: data.thumbnailUrl || data.posterUrl,
    };
  }

  const sourceUrl =
    data.mobileUrl ||
    data.desktopUrl ||
    data.streamUrl ||
    data.originalUrl ||
    data.fileUrl ||
    "";
  if (!sourceUrl) {
    return {
      videoId,
      skipped: true,
      reason: "missing_source_url",
    };
  }

  const objectPath = data.objectPath || data.fileName || `videos/${videoId}.mp4`;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "paragon-thumb-"));
  const inputPath = path.join(tempDir, "source");
  const thumbnailPath = path.join(tempDir, "thumbnail.jpg");

  try {
    await downloadFile(sourceUrl, inputPath);
    await createVideoThumbnail({
      inputPath,
      outputPath: thumbnailPath,
    });

    const thumbnailObjectPath = getThumbnailObjectPath(objectPath);
    const thumbnailUrl = await uploadFileToR2({
      objectPath: thumbnailObjectPath,
      filePath: thumbnailPath,
      contentType: "image/jpeg",
    });

    await videoRef.set(
      {
        thumbnailUrl,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return {
      videoId,
      skipped: false,
      thumbnailUrl,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

