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
import {
  assertAcceptedQuote,
  chargeCitizenVideoUploadFeeIfRequired,
  createInitialVideoBillingObligation,
  createVideoUploadAuthorization,
  enqueueVideoReconciliationJob,
  getCurrentVideoPricing,
  getCurrentVideoTerms,
  markUploadComplete,
  prepareCitizenVideoUpload,
} from "../services/videoEconomy.js";
import { createCitizenStreamDirectUpload, streamPlaybackFromUid } from "../services/cloudflareStreamVod.js";

const DEFAULT_VIDEO_FEED_PAGE_SIZE = 20;
const MAX_VIDEO_FEED_PAGE_SIZE = 50;
const VIDEO_FEED_SCAN_MULTIPLIER = 5;

const HOME_FEED_KIND = "home";

export function classifyVideoForFeed(video = {}) {
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
  const status = String(video.status || "").toLowerCase();
  const processingStatus = String(video.processingStatus || "").toLowerCase();
  const lifecycleStatus = String(video.lifecycleStatus || "").toUpperCase();
  const contentDomain = String(video.contentDomain || "").toLowerCase();

  if (contentDomain && contentDomain !== "citizen") {
    const feedKind = contentDomain === "marketplace" ? "marketplace" : contentDomain === "meet_up" ? "meet_up" : "none";
    return { contentDomain, feedEligible: false, feedKind, reason: "non_citizen_domain" };
  }

  if (status === "deleted" || status === "scheduled_for_deletion") {
    return { contentDomain: contentDomain || "citizen", feedEligible: false, feedKind: "", reason: "deleted" };
  }

  if (processingStatus === "processing_failed" || processingStatus === "failed") {
    return { contentDomain: contentDomain || "citizen", feedEligible: false, feedKind: "", reason: "processing_failed" };
  }

  if (purpose === "meet_up_video") return { contentDomain: "meet_up", feedEligible: false, feedKind: "meet_up", reason: "meet_up" };
  if (purpose === "merchant_product") return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "merchant_product" };
  if (video.productId || video.merchantId) return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "merchant_product" };
  if (source === "admin_meetup_area_upload") return { contentDomain: "meet_up", feedEligible: false, feedKind: "meet_up", reason: "meet_up" };
  if (source.includes("merchant")) return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "merchant_source" };
  if (visibility === "meet_up") return { contentDomain: "meet_up", feedEligible: false, feedKind: "meet_up", reason: "meet_up" };
  if (visibility === "marketplace") return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "marketplace_visibility" };
  if (productCategories.has(category)) return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "product_category" };
  if (objectPath.includes("merchant-")) return { contentDomain: "marketplace", feedEligible: false, feedKind: "marketplace", reason: "merchant_object" };

  const readyForHome = status === "active" || processingStatus === "ready" || lifecycleStatus === "READY";
  if (!readyForHome) {
    return { contentDomain: "citizen", feedEligible: false, feedKind: "home", reason: "not_ready" };
  }

  const hasPlayableMedia = Boolean(
    video.mobileUrl ||
      video.desktopUrl ||
      video.streamUrl ||
      video.originalUrl ||
      video.fileUrl ||
      video.objectPath
  );

  return {
    contentDomain: "citizen",
    feedEligible: hasPlayableMedia,
    feedKind: hasPlayableMedia ? HOME_FEED_KIND : "",
    reason: hasPlayableMedia ? "home_feed" : "missing_media",
  };
}

function isHomeFeedVideo(video = {}) {
  return classifyVideoForFeed(video).feedEligible;
}

function normalizeVideoDocument(doc) {
  const data = doc.data() || {};
  const objectPath = data.objectPath || "";
  let inferredObjectUrl = "";
  if (objectPath) {
    try {
      inferredObjectUrl = getPublicUrlForObject(objectPath);
    } catch {
      inferredObjectUrl = "";
    }
  }
  const inferredOriginalUrl =
    data.originalUrl ||
    data.fileUrl ||
    inferredObjectUrl;
  const thumbnailUrl =
    data.thumbnailUrl ||
    data.coverImage ||
    data.posterUrl ||
    data.poster ||
    data.coverUrl ||
    data.thumbnail ||
    "";

  return {
    videoId: doc.id,
    uid: data.uid || data.userId || "",
    userId: data.uid || data.userId || "",
    displayName: data.displayName || data.stageName || data.realName || data.creatorName || data.name || "",
    performerName: data.performerName || data.displayName || data.stageName || data.realName || data.creatorName || data.name || "",
    creatorName: data.creatorName || data.displayName || data.stageName || data.realName || data.name || "",
    title: data.title || "Untitled performance",
    description: data.description || data.about || "",
    about: data.about || data.description || "",
    category: data.category || data.genre || "General",
    genre: data.genre || data.category || "General",
    votes: Number(data.votes || 0),
    supportCounts: data.supportCounts || {},
    thumbnailUrl,
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
    contentDomain: data.contentDomain || "",
    feedEligible: data.feedEligible,
    feedKind: data.feedKind || "",
  };
}

function profileDisplayName(profile = {}) {
  return (
    profile.displayName ||
    profile.stageName ||
    profile.realName ||
    profile.name ||
    profile.brandName ||
    profile.email ||
    ""
  );
}

async function enrichVideosWithPublicProfiles(db, videos) {
  const userIds = [...new Set(videos.map((video) => video.uid || video.userId).filter(Boolean))];
  if (!userIds.length) return videos;

  const refs = userIds.map((uid) => db.collection("public_profiles").doc(uid));
  const snaps = await db.getAll(...refs);
  const profilesByUid = new Map(
    snaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() || {}])
  );

  return videos.map((video) => {
    const profile = profilesByUid.get(video.uid || video.userId);
    const displayName = profileDisplayName(profile) || video.displayName || video.performerName || video.creatorName;
    return {
      ...video,
      displayName: displayName || "",
      performerName: displayName || video.performerName || "",
      creatorName: displayName || video.creatorName || "",
      stageName: profile?.stageName || "",
      realName: profile?.realName || "",
    };
  });
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

function parsePageSize(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_VIDEO_FEED_PAGE_SIZE;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`pageSize must be an integer between 1 and ${MAX_VIDEO_FEED_PAGE_SIZE}`);
    error.status = 400;
    throw error;
  }
  return Math.min(parsed, MAX_VIDEO_FEED_PAGE_SIZE);
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  return 0;
}

function encodeVideoFeedCursor(video) {
  if (!video?.videoId) return "";
  const payload = {
    createdAtMillis: timestampToMillis(video.createdAt),
    videoId: video.videoId,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeVideoFeedCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!parsed?.videoId || !Number.isFinite(Number(parsed.createdAtMillis))) {
      throw new Error("Invalid cursor");
    }
    return {
      createdAtMillis: Number(parsed.createdAtMillis),
      videoId: String(parsed.videoId),
    };
  } catch {
    const error = new Error("Invalid video feed cursor");
    error.status = 400;
    throw error;
  }
}

function cursorTimestamp(db, cursor) {
  if (!cursor) return null;
  return admin.firestore.Timestamp.fromMillis(cursor.createdAtMillis);
}

function chunk(values, size = 10) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadMerchantProductMediaKeysForVideos(db, videos) {
  const candidateKeys = [...new Set(videos.flatMap((video) => collectMediaKeys(video)))];
  if (!candidateKeys.length) return new Set();

  const fields = [
    "objectPath",
    "fileName",
    "sourceFileName",
    "mediaUrl",
    "streamUrl",
    "originalUrl",
    "fileUrl",
  ];
  const keys = new Set();

  for (const field of fields) {
    for (const keyChunk of chunk(candidateKeys, 10)) {
      const snapshot = await db
        .collection("merchant_products")
        .where(field, "in", keyChunk)
        .limit(keyChunk.length)
        .get();
      snapshot.docs.forEach((doc) => {
        collectMediaKeys(doc.data() || {}).forEach((key) => keys.add(key));
      });
    }
  }

  return keys;
}

function createVideoFeedQuery(db, { pageSize, cursor }) {
  let query = db
    .collection("videos")
    .where("contentDomain", "==", "citizen")
    .where("feedKind", "==", HOME_FEED_KIND)
    .where("feedEligible", "==", true)
    .orderBy("createdAt", "desc")
    .orderBy(admin.firestore.FieldPath.documentId(), "desc");

  if (cursor) {
    query = query.startAfter(cursorTimestamp(db, cursor), cursor.videoId);
  }

  return query.limit(pageSize);
}

export async function listCitizenFeedPage(db, { pageSize, cursor }) {
  const items = [];
  let currentCursor = cursor;
  let scanned = 0;
  let exhausted = false;
  let lastScannedCursor = "";
  const maxScans = pageSize * VIDEO_FEED_SCAN_MULTIPLIER;

  while (items.length < pageSize + 1 && scanned < maxScans && !exhausted) {
    const remaining = pageSize + 1 - items.length;
    const batchSize = Math.min(Math.max(remaining, pageSize), maxScans - scanned);
    const snapshot = await createVideoFeedQuery(db, {
      pageSize: batchSize,
      cursor: currentCursor,
    }).get();

    if (snapshot.empty) {
      exhausted = true;
      break;
    }

    const normalized = snapshot.docs.map(normalizeVideoDocument);
    scanned += normalized.length;
    lastScannedCursor = encodeVideoFeedCursor(normalized[normalized.length - 1]);
    currentCursor = decodeVideoFeedCursor(lastScannedCursor);

    const merchantProductMediaKeys = await loadMerchantProductMediaKeysForVideos(db, normalized);
    normalized
      .filter((video) => isHomeFeedVideo(video))
      .filter((video) => !collectMediaKeys(video).some((key) => merchantProductMediaKeys.has(key)))
      .forEach((video) => {
        if (items.length < pageSize + 1) items.push(video);
      });

    exhausted = snapshot.docs.length < batchSize;
  }

  const pageItems = items.slice(0, pageSize);
  const hasMore = items.length > pageSize || (!exhausted && scanned >= maxScans);
  const nextCursor =
    hasMore && pageItems.length === pageSize
      ? encodeVideoFeedCursor(pageItems[pageItems.length - 1])
      : hasMore
        ? lastScannedCursor
        : "";

  return {
    items: await enrichVideosWithPublicProfiles(db, pageItems),
    nextCursor,
    hasMore,
    pageSize,
  };
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
      acceptedTerms = false,
      pricingVersion = "",
      termsVersion = "",
      uploadFeeAccepted,
      monthlyMaintenanceAccepted,
      uploadId: requestedUploadId = "",
    } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: "fileName and fileType are required" });
    }

    if (uploadPurpose === "meet_up_video" && !isAdminUser(req.user)) {
      return res.status(403).json({ error: "Only admin can upload meet-up videos" });
    }

    validateUploadPolicy({ contentType, fileSize, durationSeconds });
    const db = admin.firestore();
    const isCitizenHomeUpload = String(uploadPurpose || "home_video") === "home_video";
    const isMerchantUpload = uploadPurpose === "merchant_product";
    const isMeetUpUpload = uploadPurpose === "meet_up_video";
    let pricing = null;
    let terms = null;
    let quote = null;
    let uploadFeeCharge = { charged: false, amountCharged: 0, walletMutationApplied: false };

    if (String(contentType).startsWith("video/") && !isAdminUser(req.user)) {
      await reserveDailyVideoUpload({
        db,
        userId: req.user.uid,
        uploadPurpose,
      });
    }

    if (isCitizenHomeUpload) {
      [pricing, terms] = await Promise.all([
        getCurrentVideoPricing(db),
        getCurrentVideoTerms(db),
      ]);
      quote = assertAcceptedQuote({
        pricing,
        terms,
        body: {
          acceptedTerms,
          pricingVersion,
          termsVersion,
          uploadFeeAccepted,
          monthlyMaintenanceAccepted,
        },
        fileSizeBytes: fileSize,
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
    const uploadId = requestedUploadId || `upload_${video.videoId}`;
    if (isCitizenHomeUpload) {
      uploadFeeCharge = await chargeCitizenVideoUploadFeeIfRequired({
        db,
        userId: req.user.uid,
        uploadId,
        amount: quote.uploadFee,
        currency: quote.currency,
        pricing,
      });
    }
    const streamDirectUpload = isCitizenHomeUpload
      ? await createCitizenStreamDirectUpload({
          videoId: video.videoId,
          maxDurationSeconds: Number(durationSeconds || 0) || undefined,
          metadata: { citizenId: req.user.uid, uploadId },
        })
      : { enabled: false };
    const streamInfo = streamDirectUpload.streamUid ? streamPlaybackFromUid(streamDirectUpload.streamUid) : {};
    await admin.firestore().collection("videos").doc(video.videoId).set(
      {
        uid: req.user.uid,
        contentDomain: isMerchantUpload ? "marketplace" : isMeetUpUpload ? "meet_up" : "citizen",
        lifecycleStatus: "CREATED",
        billingStatus: "ACTIVE",
        uploadId,
        pricingVersion: pricing?.version || "",
        termsVersion: terms?.version || "",
        uploadFeeAccepted: quote?.uploadFee || 0,
        monthlyMaintenanceAccepted: quote?.monthlyMaintenanceFee || 0,
        currency: quote?.currency || "",
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
          isMerchantUpload
            ? "merchant_product_upload"
            : isMeetUpUpload
              ? "admin_meetup_area_upload"
              : "citizen_upload",
        streamProvider: streamDirectUpload.enabled ? "cloudflare_stream" : "r2_fallback",
        streamUid: streamDirectUpload.streamUid || "",
        streamDirectUploadUrlIssued: Boolean(streamDirectUpload.uploadUrl),
        ...streamInfo,
        votes: 0,
        supportCounts: {},
        ...classifyVideoForFeed({
          uid: req.user.uid,
          contentDomain: isMerchantUpload ? "marketplace" : isMeetUpUpload ? "meet_up" : "citizen",
          category,
          objectPath: upload.objectPath,
          fileName: upload.objectPath,
          originalUrl: upload.fileUrl,
          fileUrl: upload.fileUrl,
          streamUrl: upload.fileUrl,
          uploadPurpose,
          visibility:
            isMerchantUpload
              ? "marketplace"
              : isMeetUpUpload
                ? "meet_up"
                : "home",
          source:
            isMerchantUpload
              ? "merchant_product_upload"
              : isMeetUpUpload
                ? "admin_meetup_area_upload"
                : "citizen_upload",
          status: "processing",
          processingStatus: "queued",
          lifecycleStatus: "CREATED",
        }),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (isCitizenHomeUpload) {
      await createVideoUploadAuthorization({
        db,
        uploadId,
        videoId: video.videoId,
        citizenId: req.user.uid,
        fileSizeBytes: Number(fileSize || 0),
        fileType: contentType,
        terms,
        pricing,
        quote,
        uploadFeeCharge,
      });
      await createInitialVideoBillingObligation({
        db,
        videoId: video.videoId,
        citizenId: req.user.uid,
        pricing,
        terms,
        quote,
      });
      await enqueueVideoReconciliationJob({
        db,
        videoId: video.videoId,
        uploadId,
        reason: "upload_authorized",
      });
    }

    res.status(201).json({
      uploadUrl: upload.uploadUrl,
      fileName: upload.objectPath,
      fileUrl: upload.fileUrl,
      uploadId,
      stream: streamDirectUpload,
      video
    });
  } catch (error) {
    console.error("Upload URL request failed:", error);
    res.status(400).json({ error: error.message || "Could not create upload URL" });
  }
}

export async function getVideoUploadPolicy(req, res) {
  try {
    const db = admin.firestore();
    const fileSizeBytes = Number(req.query.fileSize || req.query.fileSizeBytes || 0);
    const result = await prepareCitizenVideoUpload({ db, fileSizeBytes });
    return res.json({
      terms: result.terms,
      pricing: result.pricing,
      quote: result.quote,
      status: result.quote.uploadFee === 0 && result.quote.monthlyMaintenanceFee === 0 ? "FREE" : "PRICED",
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not load video upload policy" });
  }
}

export async function completeVideoUpload(req, res) {
  try {
    const { videoId = "", uploadId = "" } = req.body || {};
    if (!videoId || !uploadId) {
      return res.status(400).json({ error: "videoId and uploadId are required" });
    }
    const db = admin.firestore();
    await markUploadComplete({
      db,
      userId: req.user.uid,
      videoId,
      uploadId,
    });
    return res.json({ ok: true, videoId, uploadId, status: "UPLOADED" });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not mark upload complete" });
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
    const pageSize = parsePageSize(req.query.pageSize || req.query.limit);
    const cursor = decodeVideoFeedCursor(req.query.cursor || req.query.after);
    const page = await listCitizenFeedPage(db, { pageSize, cursor });
    const legacy =
      req.query.format === "legacy" ||
      req.query.legacy === "1" ||
      req.get("x-paragon-video-feed-format") === "legacy";

    if (legacy) {
      res.set("x-paragon-next-cursor", page.nextCursor || "");
      res.set("x-paragon-has-more", page.hasMore ? "true" : "false");
      return res.json(page.items);
    }

    return res.json(page);
  } catch (error) {
    console.error("Video list request failed:", error);
    return res.status(error.status || 500).json({
      error: error.message || "Could not load video feed",
    });
  }
}
