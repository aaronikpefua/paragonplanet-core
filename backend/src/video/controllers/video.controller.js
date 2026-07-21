import { createSignedUploadUrl } from "../services/video.service.js";
import { createVideo } from "../models/video.model.js";
import {
  enqueueVideoProcessingJob,
  processQueuedVideoJobs,
} from "../services/video.queue.js";
import {
  reserveDailyVideoUpload,
  validateUploadPolicy,
} from "../services/video.policy.js";
import admin from "../../config/firebase.js";
import { isAdminUser } from "../../lib/adminAccess.js";
import { getPublicUrlForObject } from "../services/video.service.js";

function isHomeFeedVideo(video = {}) {
  const productCategories = new Set([
    "ebooks",
    "notion_templates",
    "canva_templates",
    "printables",
    "mini_courses",
    "presets_filters",
    "swipe_files",
    "toolkits_bundles",
    "digital_wallpapers",
    "video_products",
    "audio_products",
  ]);
  const source = String(video.source || "").toLowerCase();
  const purpose = String(video.uploadPurpose || "").toLowerCase();
  const visibility = String(video.visibility || "").toLowerCase();
  const category = String(video.category || video.genre || "").toLowerCase();
  const objectPath = String(video.objectPath || video.fileName || "").toLowerCase();

  if (purpose === "meet_up_video") return false;
  if (purpose === "merchant_product") return false;
  if (video.productId || video.merchantId) return false;
  if (source === "admin_meetup_area_upload") return false;
  if (source.includes("merchant")) return false;
  if (visibility === "meet_up") return false;
  if (visibility === "marketplace") return false;
  if (productCategories.has(category)) return false;
  if (objectPath.includes("merchant-")) return false;

  return Boolean(
    video.mobileUrl ||
      video.desktopUrl ||
      video.streamUrl ||
      video.originalUrl ||
      video.fileUrl ||
      video.objectPath
  );
}

function normalizeVideoDocument(doc) {
  const data = doc.data() || {};
  const objectPath = data.objectPath || "";
  const inferredOriginalUrl =
    data.originalUrl ||
    data.fileUrl ||
    (objectPath ? getPublicUrlForObject(objectPath) : "");

  return {
    videoId: doc.id,
    userId: data.uid || data.userId || "",
    title: data.title || "Untitled performance",
    description: data.description || data.about || "",
    about: data.about || data.description || "",
    category: data.category || data.genre || "General",
    genre: data.genre || data.category || "General",
    votes: Number(data.votes || 0),
    supportCounts: data.supportCounts || {},
    objectPath: objectPath || "",
    mobileUrl: data.mobileUrl || "",
    desktopUrl: data.desktopUrl || "",
    streamUrl: data.streamUrl || "",
    originalUrl: inferredOriginalUrl || "",
    fileUrl: data.fileUrl || inferredOriginalUrl || "",
    status: data.status || "",
    processingStatus: data.processingStatus || "",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    visibility: data.visibility || "",
    uploadPurpose: data.uploadPurpose || "",
    source: data.source || "",
    fileName: data.fileName || "",
  };
}

function collectMediaKeys(item = {}) {
  return [
    item.objectPath,
    item.fileName,
    item.sourceFileName,
    item.mediaUrl,
    item.streamUrl,
    item.originalUrl,
    item.fileUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

async function loadMerchantProductMediaKeys(db) {
  const snapshot = await db.collection("merchant_products").get();
  const keys = new Set();
  snapshot.docs.forEach((doc) => {
    collectMediaKeys(doc.data() || {}).forEach((key) => keys.add(key));
  });
  return keys;
}

export async function requestUploadUrl(req, res) {
  try {
    const {
      fileName,
      fileType,
      filename = fileName,
      contentType = fileType,
      title = "",
      description = "",
      category = "",
      uploadPurpose = "",
      fileSize = 0,
      durationSeconds = 0,
    } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: "fileName and fileType are required" });
    }

    if (uploadPurpose === "meet_up_video" && !isAdminUser(req.user)) {
      return res.status(403).json({ error: "Only admin can upload meet-up videos" });
    }

    validateUploadPolicy({ contentType, fileSize, durationSeconds });

    if (String(contentType).startsWith("video/") && !isAdminUser(req.user)) {
      await reserveDailyVideoUpload({
        db: admin.firestore(),
        userId: req.user.uid,
        uploadPurpose,
      });
    }

    const upload = await createSignedUploadUrl({
      userId: req.user.uid,
      filename,
      contentType
    });

    const video = createVideo({
      userId: req.user.uid,
      title,
      category,
      bucket: upload.bucket,
      objectPath: upload.objectPath
    });
    await admin.firestore().collection("videos").doc(video.videoId).set(
      {
        uid: req.user.uid,
        title: title || "",
        description: description || "",
        about: description || "",
        category: category || "",
        genre: category || "",
        fileName: upload.objectPath,
        originalUrl: upload.fileUrl,
        fileUrl: upload.fileUrl,
        bucket: upload.bucket,
        objectPath: upload.objectPath,
        streamUrl: upload.fileUrl,
        durationSeconds: Number(durationSeconds || 0),
        fileSize: Number(fileSize || 0),
        status: "processing",
        processingStatus: "queued",
        uploadPurpose,
        visibility:
          uploadPurpose === "merchant_product"
            ? "marketplace"
            : uploadPurpose === "meet_up_video"
              ? "meet_up"
              : "home",
        source:
          uploadPurpose === "merchant_product"
            ? "merchant_product_upload"
            : uploadPurpose === "meet_up_video"
              ? "admin_meetup_area_upload"
              : "citizen_upload",
        votes: 0,
        supportCounts: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(201).json({
      uploadUrl: upload.uploadUrl,
      fileName: upload.objectPath,
      fileUrl: upload.fileUrl,
      video
    });
  } catch (error) {
    console.error("Upload URL request failed:", error);
    res.status(400).json({ error: error.message || "Could not create upload URL" });
  }
}

export async function triggerCompression(req, res) {
  try {
    const {
      fileName,
      objectPath = fileName,
      originalUrl,
      fileUrl = originalUrl,
      productId = "",
      videoId: requestedVideoId = "",
    } = req.body || {};

    if (!objectPath || !fileUrl) {
      return res.status(400).json({
        error: "fileName and originalUrl are required for processing",
      });
    }

    const db = admin.firestore();
    const collectionName = productId ? "merchant_products" : "videos";
    let documentId = productId || requestedVideoId || "";
    let targetSnap = documentId
      ? await db.collection(collectionName).doc(documentId).get()
      : null;

    if ((!targetSnap || !targetSnap.exists) && !productId) {
      const objectPathMatch = await db
        .collection("videos")
        .where("objectPath", "==", objectPath)
        .limit(1)
        .get();

      if (!objectPathMatch.empty) {
        targetSnap = objectPathMatch.docs[0];
        documentId = targetSnap.id;
      }
    }

    if (!targetSnap?.exists) {
      return res.status(404).json({ error: "Upload record was not found" });
    }

    const targetData = targetSnap.data() || {};
    const ownsVideo = targetData.uid === req.user.uid || targetData.ownerId === req.user.uid;
    const ownsProduct = targetData.merchantId === req.user.uid;
    const adminUser = isAdminUser(req.user);

    if (targetData.uploadPurpose === "meet_up_video" && !adminUser) {
      return res.status(403).json({ error: "Only admin can process meet-up videos" });
    }

    if (!adminUser && !ownsVideo && !ownsProduct) {
      return res.status(403).json({ error: "You can only process your own upload" });
    }

    const result = await enqueueVideoProcessingJob({
      db,
      objectPath,
      originalUrl: fileUrl,
      collectionName,
      documentId,
      requestedBy: req.user.uid,
      uploadPurpose: targetData.uploadPurpose || "",
    });

    return res.status(202).json({
      message: "Video processing queued.",
      ...result,
    });
  } catch (error) {
    console.warn("Video processing queue failed:", error);
    return res.status(500).json({
      error: error.message || "Video processing queue failed",
    });
  }
}

export async function processVideoQueue(req, res) {
  try {
    const workerSecret = process.env.VIDEO_WORKER_SECRET || "";
    const providedSecret = req.headers["x-worker-secret"];
    const adminUser = isAdminUser(req.user);

    if (workerSecret) {
      if (providedSecret !== workerSecret && !adminUser) {
        return res.status(403).json({ error: "Worker permission required" });
      }
    } else if (!adminUser) {
      return res.status(403).json({ error: "Admin permission required" });
    }

    const db = admin.firestore();
    const result = await processQueuedVideoJobs({
      db,
      limit: req.body?.limit,
    });

    return res.status(200).json({
      message: "Video queue processed.",
      ...result,
    });
  } catch (error) {
    console.warn("Video queue worker failed:", error);
    return res.status(500).json({
      error: error.message || "Video queue worker failed",
    });
  }
}

export async function listVideos(req, res) {
  try {
    const db = admin.firestore();
    const merchantProductMediaKeys = await loadMerchantProductMediaKeys(db);
    const snapshot = await db.collection("videos").get();
    const videos = snapshot.docs
      .map(normalizeVideoDocument)
      .filter((video) => {
        if (!isHomeFeedVideo(video)) return false;
        return !collectMediaKeys(video).some((key) => merchantProductMediaKeys.has(key));
      })
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

    return res.json(videos);
  } catch (error) {
    console.error("Video list request failed:", error);
    return res.status(500).json({
      error: error.message || "Could not load video feed",
    });
  }
}
