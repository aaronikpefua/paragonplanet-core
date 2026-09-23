import admin from "../../config/firebase.js";
import {
  getCurrentVideoPricing,
  publishVideoPricingVersion,
  publishVideoTermsVersion,
  sanitizeVideoPricing,
  sanitizeVideoTerms,
  summarizeCitizenVideoAdmin,
  VIDEO_AUTH_COLLECTION,
  VIDEO_BILLING_COLLECTION,
  VIDEO_POLICY_COLLECTION,
  VIDEO_RECONCILIATION_COLLECTION,
  VIDEO_TERMS_COLLECTION,
} from "../services/videoEconomy.js";

function db() {
  return admin.firestore();
}

function parseLimit(value, fallback = 25, max = 100) {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function serializeDoc(doc) {
  return { id: doc.id, ...(doc.data() || {}) };
}

function encodeCursor(doc) {
  if (!doc) return null;
  return Buffer.from(JSON.stringify({ id: doc.id }), "utf8").toString("base64url");
}

async function applyCursor(query, collection, cursor) {
  if (!cursor) return query;
  try {
    const { id } = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    const snap = await collection.doc(String(id || "")).get();
    if (!snap.exists) throw new Error("missing cursor document");
    return query.startAfter(snap);
  } catch {
    const error = new Error("Invalid pagination cursor");
    error.status = 400;
    throw error;
  }
}

async function pagedQuery({ collection, query, cursor, limit }) {
  const positioned = await applyCursor(query, collection, cursor);
  const snap = await positioned.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  return {
    items: docs.map(serializeDoc),
    nextCursor: snap.docs.length > limit ? encodeCursor(docs.at(-1)) : null,
    hasMore: snap.docs.length > limit,
  };
}

export async function getCitizenVideoAdminTermsState(database) {
  const pointerSnap = await database.collection("platform_settings").doc("citizen_video_terms").get();
  const currentVersion = pointerSnap.exists ? String(pointerSnap.data()?.currentVersion || "") : "";
  let current = null;
  if (currentVersion) {
    const currentSnap = await database.collection(VIDEO_TERMS_COLLECTION).doc(currentVersion).get();
    if (currentSnap.exists) current = { id: currentSnap.id, ...(currentSnap.data() || {}) };
  }

  const historySnap = await database.collection(VIDEO_TERMS_COLLECTION).orderBy("createdAt", "desc").limit(20).get();
  const history = historySnap.docs.map(serializeDoc);
  const published = current && String(current.status || "").toLowerCase() === "published" && String(current.body || "").trim()
    ? current
    : null;
  const draft = history.find((item) => String(item.status || "").toLowerCase() === "draft") || null;
  const editable = published || draft || {
    version: "",
    title: "Paragon Planet Video Upload Terms & Conditions",
    body: "",
    status: "missing",
    requiresAcceptance: true,
  };

  return {
    terms: editable,
    publication: {
      hasPublishedTerms: Boolean(published),
      authoritativeVersion: published?.version || published?.id || "",
      currentPointerVersion: currentVersion,
      draftVersion: draft?.version || draft?.id || "",
      warning: published ? "" : "No published Citizen Video Terms & Conditions are currently active. Citizen uploads are temporarily blocked until an authorized Admin publishes a Terms version.",
    },
  };
}

export async function getCitizenVideoAdminSettings(req, res) {
  try {
    const database = db();
    const [pricing, termsState, overview] = await Promise.all([
      getCurrentVideoPricing(database),
      getCitizenVideoAdminTermsState(database),
      summarizeCitizenVideoAdmin(database),
    ]);
    return res.json({
      pricing,
      terms: termsState.terms,
      termsPublication: termsState.publication,
      overview,
      safeLaunchDefaults: {
        videoFeesEnabled: pricing.videoFeesEnabled === false,
        automaticWalletDeductionEnabled: pricing.automaticWalletDeductionEnabled,
        automaticDeletionEnabled: pricing.automaticDeletionEnabled,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load Citizen Video admin settings" });
  }
}

export async function updateCitizenVideoPricing(req, res) {
  try {
    const database = db();
    const pricing = await publishVideoPricingVersion({
      db: database,
      user: req.user,
      pricing: sanitizeVideoPricing(req.body || {}),
    });
    return res.json({ pricing });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not publish video pricing" });
  }
}

export async function updateCitizenVideoTerms(req, res) {
  try {
    const database = db();
    const terms = await publishVideoTermsVersion({
      db: database,
      user: req.user,
      terms: sanitizeVideoTerms({ ...(req.body || {}), status: "published" }),
    });
    return res.json({ terms });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not publish video terms" });
  }
}

export async function listCitizenVideoAdminRecords(req, res) {
  try {
    const database = db();
    const limit = parseLimit(req.query.limit);
    const collection = database.collection("videos");
    let query = collection.where("contentDomain", "==", "citizen");
    if (req.query.status) query = query.where("billingStatus", "==", String(req.query.status));
    query = query.orderBy("createdAt", "desc");
    return res.json(await pagedQuery({ collection, query, cursor: req.query.cursor, limit }));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not list Citizen videos" });
  }
}

export async function getCitizenVideoAdminRecord(req, res) {
  try {
    const database = db();
    const videoSnap = await database.collection("videos").doc(String(req.params.videoId)).get();
    if (!videoSnap.exists || videoSnap.data()?.contentDomain !== "citizen") {
      return res.status(404).json({ error: "Citizen video not found" });
    }
    const video = serializeDoc(videoSnap);
    const [profileSnap, billingSnap, analyticsSnap] = await Promise.all([
      database.collection("citizen_profiles").doc(String(video.uid || video.citizenId || "_")).get(),
      database.collection(VIDEO_BILLING_COLLECTION).where("videoId", "==", videoSnap.id).orderBy("dueAt", "desc").limit(10).get(),
      database.collection("video_analytics_daily").where("videoId", "==", videoSnap.id).limit(366).get(),
    ]);
    return res.json({
      video,
      citizen: profileSnap.exists ? serializeDoc(profileSnap) : null,
      billing: billingSnap.docs.map(serializeDoc),
      analytics: analyticsSnap.docs.map(serializeDoc),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load Citizen video" });
  }
}

export async function listCitizenVideoBilling(req, res) {
  try {
    const database = db();
    const limit = parseLimit(req.query.limit);
    const collection = database.collection(VIDEO_BILLING_COLLECTION);
    let query = collection;
    if (req.query.status) query = query.where("paymentStatus", "==", String(req.query.status));
    query = query.orderBy("dueAt", "asc");
    const page = await pagedQuery({ collection, query, cursor: req.query.cursor, limit });
    return res.json(page);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not list video billing" });
  }
}

export async function listCitizenVideoAnalytics(req, res) {
  try {
    const database = db();
    const limit = parseLimit(req.query.limit, 25, 100);
    const collection = database.collection("videos");
    const query = collection.where("contentDomain", "==", "citizen").orderBy("createdAt", "desc");
    const page = await pagedQuery({ collection, query, cursor: req.query.cursor, limit });
    page.items = await Promise.all(page.items.map(async (video) => {
      const aggregateSnap = await database.collection("video_analytics_daily").where("videoId", "==", video.id).limit(3200).get();
      const aggregate = aggregateSnap.docs.reduce((sum, doc) => {
        const data = doc.data() || {};
        sum.views += Number(data.views || 0); sum.uniqueViewers += Number(data.uniqueViewers || 0); sum.watchSeconds += Number(data.watchSeconds || 0); sum.completions += Number(data.completions || 0); return sum;
      }, { views: 0, uniqueViewers: 0, watchSeconds: 0, completions: 0 });
      return {
      videoId: video.id,
      title: video.title || video.caption || "Untitled video",
      citizenId: video.uid || video.citizenId || null,
      citizenName: video.userName || video.creatorName || null,
      views: aggregate.views,
      uniqueViewers: aggregate.uniqueViewers,
      watchMinutes: aggregate.watchSeconds / 60,
      averageWatchDuration: aggregate.views ? aggregate.watchSeconds / aggregate.views : 0,
      completionRate: aggregate.views ? aggregate.completions / aggregate.views : 0,
      createdAt: video.createdAt || null,
      status: video.lifecycleStatus || video.processingStatus || video.status || null,
    }; }));
    return res.json({
      ...page,
      providerCosts: { reconciled: false, message: "Provider cost data pending reconciliation" },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not list video analytics" });
  }
}

export async function listCitizenVideoCitizens(req, res) {
  try {
    const database = db();
    const limit = parseLimit(req.query.limit, 25, 50);
    const collection = database.collection("citizen_profiles");
    let query = collection.orderBy("stageName", "asc");
    if (req.query.search) {
      const search = String(req.query.search).trim();
      query = collection.orderBy("stageName", "asc").startAt(search).endAt(`${search}\uf8ff`);
    }
    const page = await pagedQuery({ collection, query, cursor: req.query.cursor, limit });
    const ids = page.items.map((item) => item.id);
    const details = await Promise.all(ids.map(async (citizenId) => {
      const [videosSnap, walletSnap, obligationsSnap] = await Promise.all([
        database.collection("videos").where("contentDomain", "==", "citizen").where("uid", "==", citizenId).limit(100).get(),
        database.collection("wallet_accounts").doc(citizenId).get(),
        database.collection(VIDEO_BILLING_COLLECTION).where("citizenId", "==", citizenId).orderBy("dueAt", "asc").limit(100).get(),
      ]);
      const videos = videosSnap.docs.map((doc) => doc.data() || {});
      const obligations = obligationsSnap.docs.map((doc) => doc.data() || {});
      const activeObligation = obligations.find((item) => !["PAID", "DELETED", "COMPLETED"].includes(item.paymentStatus)) || obligations.at(-1) || null;
      return {
        citizenId,
        videoCount: videos.length,
        storageBytes: videos.reduce((sum, video) => sum + Number(video.fileSizeBytes || video.fileSize || 0), 0),
        views: videos.reduce((sum, video) => sum + Number(video.views || video.viewCount || 0), 0),
        watchMinutes: videos.reduce((sum, video) => sum + Number(video.watchMinutes || 0), 0),
        uploadFeesPaid: videos.reduce((sum, video) => sum + Number(video.uploadFeeCharged || video.amountCharged || 0), 0),
        maintenancePaid: obligations.reduce((sum, item) => sum + Number(item.amountCharged || 0), 0),
        currentMaintenanceObligation: activeObligation?.amountDue ?? 0,
        nextBillingDate: activeObligation?.dueAt || null,
        failedPayments: videos.filter((video) => video.billingStatus === "PAYMENT_FAILED").length,
        gracePeriodVideos: videos.filter((video) => video.billingStatus === "GRACE_PERIOD").length,
        scheduledDeletionVideos: videos.filter((video) => video.billingStatus === "SCHEDULED_FOR_DELETION").length,
        walletBalance: walletSnap.exists ? walletSnap.data()?.balances || null : null,
      };
    }));
    page.items = page.items.map((profile, index) => ({ ...profile, ...details[index] }));
    return res.json(page);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Could not list Citizen video accounts" });
  }
}

export async function getCitizenVideoVersionHistory(req, res) {
  try {
    const database = db();
    const [pricingSnap, termsSnap] = await Promise.all([
      database.collection(VIDEO_POLICY_COLLECTION).orderBy("createdAt", "desc").limit(20).get(),
      database.collection(VIDEO_TERMS_COLLECTION).orderBy("createdAt", "desc").limit(20).get(),
    ]);
    return res.json({
      pricingVersions: pricingSnap.docs.map(serializeDoc),
      termsVersions: termsSnap.docs.map(serializeDoc),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load Citizen Video versions" });
  }
}

export async function getCitizenVideoOperationalQueues(req, res) {
  try {
    const database = db();
    const [authSnap, billingSnap, reconcileSnap] = await Promise.all([
      database.collection(VIDEO_AUTH_COLLECTION).orderBy("createdAt", "desc").limit(20).get(),
      database.collection(VIDEO_BILLING_COLLECTION).orderBy("dueAt", "asc").limit(20).get(),
      database.collection(VIDEO_RECONCILIATION_COLLECTION).where("status", "==", "queued").limit(50).get(),
    ]);
    return res.json({
      authorizations: authSnap.docs.map(serializeDoc),
      billing: billingSnap.docs.map(serializeDoc),
      reconciliationQueue: reconcileSnap.docs.map(serializeDoc),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load Citizen Video queues" });
  }
}
