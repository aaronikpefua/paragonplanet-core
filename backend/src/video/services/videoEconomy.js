import admin from "../../config/firebase.js";
import { createLedgerEntry } from "../../models/ledger.model.js";

export const VIDEO_POLICY_COLLECTION = "video_pricing_versions";
export const VIDEO_TERMS_COLLECTION = "video_terms_versions";
export const VIDEO_AUTH_COLLECTION = "video_upload_authorizations";
export const VIDEO_BILLING_COLLECTION = "video_billing_obligations";
export const VIDEO_RECONCILIATION_COLLECTION = "video_reconciliation_jobs";
export const VIDEO_ANALYTICS_COLLECTION = "video_analytics_daily";

export const DEFAULT_VIDEO_PRICING_VERSION = "video-pricing-free-v1";
export const DEFAULT_VIDEO_TERMS_VERSION = "video-terms-v1";

const MB = 1024 * 1024;

export const DEFAULT_VIDEO_PRICING = Object.freeze({
  version: DEFAULT_VIDEO_PRICING_VERSION,
  enabled: true,
  videoFeesEnabled: false,
  automaticWalletDeductionEnabled: false,
  automaticDeletionEnabled: false,
  currency: "PARAG",
  maxUploadSizeBytes: 1024 * MB,
  citizenStorageAllowanceBytes: 1024 * MB,
  gracePeriodDays: 14,
  retryPolicy: { maxAttempts: 3, intervalDays: 3 },
  lifecyclePolicy: { originalRetention: "KEEP_ORIGINAL" },
  tiers: [
    { minBytes: 0, maxBytes: 100 * MB, uploadFee: 0, monthlyMaintenanceFee: 0 },
    { minBytes: 100 * MB + 1, maxBytes: 250 * MB, uploadFee: 0, monthlyMaintenanceFee: 0 },
    { minBytes: 250 * MB + 1, maxBytes: 500 * MB, uploadFee: 0, monthlyMaintenanceFee: 0 },
    { minBytes: 500 * MB + 1, maxBytes: 750 * MB, uploadFee: 0, monthlyMaintenanceFee: 0 },
    { minBytes: 750 * MB + 1, maxBytes: 1024 * MB, uploadFee: 0, monthlyMaintenanceFee: 0 },
  ],
});

export const DEFAULT_VIDEO_TERMS = Object.freeze({
  version: DEFAULT_VIDEO_TERMS_VERSION,
  title: "Paragon Planet Video Upload Terms & Conditions",
  body: "Citizen videos must comply with Paragon Planet rules, applicable laws, and the displayed upload and maintenance pricing accepted before upload.",
  requiresAcceptance: true,
  status: "published",
});

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeTier(tier = {}) {
  return {
    minBytes: Math.max(0, Math.floor(numeric(tier.minBytes))),
    maxBytes: Math.max(0, Math.floor(numeric(tier.maxBytes))),
    uploadFee: Math.max(0, numeric(tier.uploadFee)),
    monthlyMaintenanceFee: Math.max(0, numeric(tier.monthlyMaintenanceFee)),
  };
}

export function sanitizeVideoPricing(input = {}) {
  const merged = {
    ...DEFAULT_VIDEO_PRICING,
    ...input,
  };
  const tiers = Array.isArray(input.tiers) && input.tiers.length
    ? input.tiers.map(sanitizeTier)
    : DEFAULT_VIDEO_PRICING.tiers.map(sanitizeTier);
  return {
    version: String(merged.version || `video-pricing-${Date.now()}`),
    enabled: merged.enabled !== false,
    videoFeesEnabled: Boolean(merged.videoFeesEnabled),
    automaticWalletDeductionEnabled: Boolean(merged.automaticWalletDeductionEnabled),
    automaticDeletionEnabled: Boolean(merged.automaticDeletionEnabled),
    currency: "PARAG",
    maxUploadSizeBytes: Math.max(1, Math.floor(numeric(merged.maxUploadSizeBytes, DEFAULT_VIDEO_PRICING.maxUploadSizeBytes))),
    citizenStorageAllowanceBytes: Math.max(0, Math.floor(numeric(merged.citizenStorageAllowanceBytes, DEFAULT_VIDEO_PRICING.citizenStorageAllowanceBytes))),
    gracePeriodDays: Math.max(0, Math.floor(numeric(merged.gracePeriodDays, DEFAULT_VIDEO_PRICING.gracePeriodDays))),
    retryPolicy: {
      maxAttempts: Math.max(0, Math.floor(numeric(merged.retryPolicy?.maxAttempts, DEFAULT_VIDEO_PRICING.retryPolicy.maxAttempts))),
      intervalDays: Math.max(1, Math.floor(numeric(merged.retryPolicy?.intervalDays, DEFAULT_VIDEO_PRICING.retryPolicy.intervalDays))),
    },
    lifecyclePolicy: {
      originalRetention: String(merged.lifecyclePolicy?.originalRetention || DEFAULT_VIDEO_PRICING.lifecyclePolicy.originalRetention),
      retainOriginalDays: Math.max(0, Math.floor(numeric(merged.lifecyclePolicy?.retainOriginalDays, 0))),
    },
    tiers,
  };
}

export function sanitizeVideoTerms(input = {}) {
  return {
    version: String(input.version || `video-terms-${Date.now()}`),
    title: String(input.title || DEFAULT_VIDEO_TERMS.title),
    body: String(input.body || DEFAULT_VIDEO_TERMS.body),
    requiresAcceptance: input.requiresAcceptance !== false,
    status: String(input.status || "published"),
  };
}

export function resolveVideoPricingForSize(pricing, fileSizeBytes) {
  const safePricing = sanitizeVideoPricing(pricing);
  const size = Math.max(0, Math.floor(numeric(fileSizeBytes)));
  if (size > safePricing.maxUploadSizeBytes) {
    const error = new Error(`Video is too large. Maximum size is ${Math.round(safePricing.maxUploadSizeBytes / MB)} MB.`);
    error.status = 400;
    throw error;
  }
  const tier = safePricing.tiers.find((candidate) => size >= candidate.minBytes && size <= candidate.maxBytes) || safePricing.tiers[safePricing.tiers.length - 1];
  return {
    pricing: safePricing,
    tier,
    uploadFee: safePricing.videoFeesEnabled ? Number(tier?.uploadFee || 0) : 0,
    monthlyMaintenanceFee: safePricing.videoFeesEnabled ? Number(tier?.monthlyMaintenanceFee || 0) : 0,
    currency: safePricing.currency,
  };
}

export async function getCurrentVideoPricing(db) {
  const currentRef = db.collection("platform_settings").doc("citizen_video_pricing");
  const currentSnap = await currentRef.get();
  const currentVersion = currentSnap.exists ? currentSnap.data()?.currentVersion : "";
  if (currentVersion) {
    const versionSnap = await db.collection(VIDEO_POLICY_COLLECTION).doc(currentVersion).get();
    if (versionSnap.exists) return sanitizeVideoPricing(versionSnap.data() || {});
  }
  return sanitizeVideoPricing(DEFAULT_VIDEO_PRICING);
}

export async function getCurrentVideoTerms(db) {
  const currentRef = db.collection("platform_settings").doc("citizen_video_terms");
  const currentSnap = await currentRef.get();
  const currentVersion = currentSnap.exists ? currentSnap.data()?.currentVersion : "";
  if (currentVersion) {
    const versionSnap = await db.collection(VIDEO_TERMS_COLLECTION).doc(currentVersion).get();
    if (versionSnap.exists) return sanitizeVideoTerms(versionSnap.data() || {});
  }
  return sanitizeVideoTerms(DEFAULT_VIDEO_TERMS);
}

export async function publishVideoPricingVersion({ db, user, pricing }) {
  const sanitized = sanitizeVideoPricing({
    ...pricing,
    version: pricing?.version || `video-pricing-${Date.now()}`,
  });
  await db.collection(VIDEO_POLICY_COLLECTION).doc(sanitized.version).set({
    ...sanitized,
    createdBy: user?.uid || "system",
    createdAt: nowTimestamp(),
    effectiveAt: pricing?.effectiveAt || nowTimestamp(),
  }, { merge: true });
  await db.collection("platform_settings").doc("citizen_video_pricing").set({
    currentVersion: sanitized.version,
    updatedBy: user?.uid || "system",
    updatedAt: nowTimestamp(),
  }, { merge: true });
  return sanitized;
}

export async function publishVideoTermsVersion({ db, user, terms }) {
  const sanitized = sanitizeVideoTerms({
    ...terms,
    version: terms?.version || `video-terms-${Date.now()}`,
  });
  await db.collection(VIDEO_TERMS_COLLECTION).doc(sanitized.version).set({
    ...sanitized,
    createdBy: user?.uid || "system",
    createdAt: nowTimestamp(),
    effectiveAt: terms?.effectiveAt || nowTimestamp(),
  }, { merge: true });
  await db.collection("platform_settings").doc("citizen_video_terms").set({
    currentVersion: sanitized.version,
    updatedBy: user?.uid || "system",
    updatedAt: nowTimestamp(),
  }, { merge: true });
  return sanitized;
}

export async function prepareCitizenVideoUpload({ db, fileSizeBytes = 0 }) {
  const [pricing, terms] = await Promise.all([
    getCurrentVideoPricing(db),
    getCurrentVideoTerms(db),
  ]);
  const resolved = resolveVideoPricingForSize(pricing, fileSizeBytes);
  return {
    pricing,
    terms,
    quote: {
      pricingVersion: pricing.version,
      termsVersion: terms.version,
      fileSizeBytes: Math.max(0, Math.floor(numeric(fileSizeBytes))),
      uploadFee: resolved.uploadFee,
      monthlyMaintenanceFee: resolved.monthlyMaintenanceFee,
      currency: resolved.currency,
      maxUploadSizeBytes: pricing.maxUploadSizeBytes,
      tier: resolved.tier,
    },
  };
}

export function assertAcceptedQuote({ pricing, terms, body = {}, fileSizeBytes }) {
  if (terms.requiresAcceptance && body.acceptedTerms !== true) {
    const error = new Error("Video Upload Terms & Conditions must be accepted before upload authorization.");
    error.status = 400;
    throw error;
  }
  const resolved = resolveVideoPricingForSize(pricing, fileSizeBytes);
  if (String(body.pricingVersion || "") !== pricing.version || String(body.termsVersion || "") !== terms.version) {
    const error = new Error("Video pricing or terms changed. Please review and accept the current upload terms again.");
    error.status = 409;
    throw error;
  }
  if (Number(body.uploadFeeAccepted ?? resolved.uploadFee) !== resolved.uploadFee ||
      Number(body.monthlyMaintenanceAccepted ?? resolved.monthlyMaintenanceFee) !== resolved.monthlyMaintenanceFee) {
    const error = new Error("Accepted video pricing does not match the current quote.");
    error.status = 409;
    throw error;
  }
  return resolved;
}

export async function chargeCitizenVideoUploadFeeIfRequired({ db, userId, uploadId, amount, currency, pricing }) {
  const shouldCharge = Boolean(pricing.videoFeesEnabled && pricing.automaticWalletDeductionEnabled && Number(amount) > 0);
  if (!shouldCharge) {
    return { charged: false, amountCharged: 0, walletMutationApplied: false };
  }

  if (currency !== "PARAG") {
    const error = new Error("Paid video upload wallet charging currently requires PARAG currency.");
    error.status = 400;
    throw error;
  }

  const walletRef = db.collection("wallet_accounts").doc(userId);
  const ledgerRef = db.collection("ledger_entries").doc(`video_upload_${uploadId}`);
  await db.runTransaction(async (transaction) => {
    const existingLedger = await transaction.get(ledgerRef);
    if (existingLedger.exists) return;
    const walletSnap = await transaction.get(walletRef);
    const balances = walletSnap.exists ? walletSnap.data()?.balances || {} : {};
    const availableParag = Number(balances.parag || 0);
    if (availableParag < amount) {
      const error = new Error("Insufficient PARAG balance for video upload fee.");
      error.status = 402;
      throw error;
    }
    const entry = createLedgerEntry({
      walletId: walletSnap.data()?.walletId || userId,
      type: "DEBIT",
      amount,
      currency,
      reason: "Citizen video upload fee",
      reference: uploadId,
    });
    transaction.set(walletRef, {
      balances: { parag: admin.firestore.FieldValue.increment(-amount) },
      updatedAt: nowTimestamp(),
    }, { merge: true });
    transaction.set(ledgerRef, {
      ...entry,
      ledgerId: ledgerRef.id,
      accountId: userId,
      referenceType: "citizen_video_upload",
      createdAt: nowTimestamp(),
    });
  });

  return { charged: true, amountCharged: amount, walletMutationApplied: true };
}

export async function createVideoUploadAuthorization({
  db,
  uploadId,
  videoId,
  citizenId,
  fileSizeBytes,
  fileType,
  terms,
  pricing,
  quote,
  uploadFeeCharge,
}) {
  const expiresAt = addDays(new Date(), 1);
  await db.collection(VIDEO_AUTH_COLLECTION).doc(uploadId).set({
    uploadId,
    videoId,
    citizenId,
    contentDomain: "citizen",
    fileSizeBytes,
    fileType,
    termsVersion: terms.version,
    pricingVersion: pricing.version,
    uploadFeeAccepted: quote.uploadFee,
    monthlyMaintenanceAccepted: quote.monthlyMaintenanceFee,
    acceptedUploadFeeParag: quote.uploadFee,
    acceptedMonthlyMaintenanceParag: quote.monthlyMaintenanceFee,
    pricingTier: quote.tier || null,
    currency: quote.currency,
    acceptedAt: nowTimestamp(),
    expiresAt,
    status: "AUTHORIZED",
    uploadFeeCharged: Boolean(uploadFeeCharge?.charged),
    amountCharged: Number(uploadFeeCharge?.amountCharged || 0),
    walletMutationApplied: Boolean(uploadFeeCharge?.walletMutationApplied),
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  }, { merge: true });
}

export async function createInitialVideoBillingObligation({
  db,
  videoId,
  citizenId,
  pricing,
  terms,
  quote,
}) {
  const periodStart = new Date();
  const periodEnd = addDays(periodStart, 30);
  const obligationId = `${videoId}_maintenance_1`;
  await db.collection(VIDEO_BILLING_COLLECTION).doc(obligationId).set({
    obligationId,
    videoId,
    citizenId,
    pricingVersion: pricing.version,
    termsVersion: terms.version,
    amountDue: quote.monthlyMaintenanceFee,
    amountCharged: 0,
    currency: quote.currency,
    periodStart,
    periodEnd,
    dueAt: periodEnd,
    paymentStatus: quote.monthlyMaintenanceFee > 0 ? "ACTIVE" : "ZERO_PRICE",
    attempts: 0,
    nextRetryAt: null,
    gracePeriodEndsAt: null,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  }, { merge: false }).catch((error) => {
    if (error?.code === 6 || String(error?.message || "").includes("ALREADY_EXISTS")) return null;
    throw error;
  });
  return obligationId;
}

export async function enqueueVideoReconciliationJob({ db, videoId, uploadId, reason = "upload_authorized" }) {
  const jobId = `${videoId}_${reason}`;
  await db.collection(VIDEO_RECONCILIATION_COLLECTION).doc(jobId).set({
    jobId,
    videoId,
    uploadId,
    status: "queued",
    reason,
    attempts: 0,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  }, { merge: true });
  return jobId;
}

export async function markUploadComplete({ db, userId, videoId, uploadId }) {
  const videoRef = db.collection("videos").doc(videoId);
  const authRef = db.collection(VIDEO_AUTH_COLLECTION).doc(uploadId);
  await db.runTransaction(async (transaction) => {
    const [videoSnap, authSnap] = await Promise.all([
      transaction.get(videoRef),
      transaction.get(authRef),
    ]);
    if (!videoSnap.exists || !authSnap.exists) {
      const error = new Error("Upload authorization was not found.");
      error.status = 404;
      throw error;
    }
    const video = videoSnap.data() || {};
    const authorization = authSnap.data() || {};
    if (authorization.citizenId !== userId || video.uid !== userId) {
      const error = new Error("You can only complete your own video upload.");
      error.status = 403;
      throw error;
    }
    transaction.set(videoRef, {
      lifecycleStatus: "UPLOADED",
      processingStatus: video.processingStatus === "ready" ? "ready" : "queued",
      uploadCompletedAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    }, { merge: true });
    transaction.set(authRef, {
      status: "UPLOADED",
      uploadCompletedAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    }, { merge: true });
  });
  await enqueueVideoReconciliationJob({ db, videoId, uploadId, reason: "upload_completed" });
}

export async function summarizeCitizenVideoAdmin(db) {
  const statuses = ["READY", "PROCESSING", "FAILED", "PAYMENT_DUE", "GRACE_PERIOD", "SCHEDULED_FOR_DELETION", "DELETED"];
  const summary = {
    uploadedToday: 0,
    uploadedThisWeek: 0,
    uploadedThisMonth: 0,
    totalCitizenVideos: 0,
    byStatus: Object.fromEntries(statuses.map((status) => [status, 0])),
    queueDepth: 0,
    processingFailures: 0,
    totalStorageBytes: null,
    r2StorageBytes: null,
    r2ObjectCount: null,
    streamActiveAssets: null,
    totalViews: 0,
    uniqueViewers: null,
    watchMinutes: 0,
    estimatedCosts: {
      r2Storage: null,
      r2Operations: null,
      streamStorage: null,
      streamDelivery: null,
      processing: null,
      total: null,
    },
    financial: {
      uploadFeeRevenue: 0,
      maintenanceRevenue: 0,
      videoRelatedRevenue: 0,
      netVideoContribution: null,
    },
  };

  const citizenQuery = db.collection("videos").where("contentDomain", "==", "citizen");
  const count = async (query) => Number((await query.count().get()).data().count || 0);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday); startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [total, today, week, month, ...statusCounts] = await Promise.all([
    count(citizenQuery),
    count(citizenQuery.where("createdAt", ">=", startToday)),
    count(citizenQuery.where("createdAt", ">=", startWeek)),
    count(citizenQuery.where("createdAt", ">=", startMonth)),
    ...statuses.map((status) => count(citizenQuery.where(
      ["PAYMENT_DUE", "GRACE_PERIOD", "SCHEDULED_FOR_DELETION", "DELETED"].includes(status) ? "billingStatus" : "lifecycleStatus",
      "==",
      status,
    ))),
  ]);
  summary.totalCitizenVideos = total;
  summary.uploadedToday = today;
  summary.uploadedThisWeek = week;
  summary.uploadedThisMonth = month;
  statuses.forEach((status, index) => { summary.byStatus[status] = statusCounts[index]; });
  summary.processingFailures = summary.byStatus.FAILED;

  const statsSnap = await db.collection("platform_stats").doc("citizen_video").get();
  if (statsSnap.exists) {
    const stats = statsSnap.data() || {};
    summary.totalStorageBytes = Number(stats.logicalStorageBytes || 0);
    summary.totalViews = Number(stats.views || 0);
    summary.uniqueViewers = Number(stats.uniqueViewers || 0);
    summary.watchMinutes = Number(stats.watchSeconds || 0) / 60;
  }
  const [r2ProviderSnap, streamProviderSnap] = await Promise.all([
    db.collection("provider_reconciliation").doc("citizen_video_r2").get(),
    db.collection("provider_reconciliation").doc("citizen_video_stream").get(),
  ]);
  if (r2ProviderSnap.exists) {
    const provider = r2ProviderSnap.data() || {};
    summary.r2StorageBytes = provider.storageBytes ?? null;
    summary.r2ObjectCount = provider.objectCount ?? null;
    summary.r2ProviderStatus = provider.status || "PENDING_RECONCILIATION";
    summary.r2LastReconciledAt = provider.lastReconciledAt || null;
  }
  if (streamProviderSnap.exists) {
    const provider = streamProviderSnap.data() || {};
    summary.streamActiveAssets = provider.activeAssets ?? null;
    summary.streamStorageMinutes = provider.storageMinutes ?? null;
    summary.streamProviderStatus = provider.status || "PENDING_RECONCILIATION";
    summary.streamLastReconciledAt = provider.lastReconciledAt || null;
  }

  const queueSnap = await db.collection(VIDEO_RECONCILIATION_COLLECTION).where("status", "==", "queued").limit(1000).get();
  summary.queueDepth = queueSnap.size;
  return summary;
}
