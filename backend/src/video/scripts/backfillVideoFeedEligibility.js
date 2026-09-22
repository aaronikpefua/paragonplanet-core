import admin from "../../config/firebase.js";
import { classifyVideoForFeed } from "../controllers/video.controller.js";

const BATCH_SIZE = Number(process.env.VIDEO_FEED_BACKFILL_BATCH_SIZE || 250);
const DRY_RUN = process.env.VIDEO_FEED_BACKFILL_DRY_RUN !== "false";

function sameValue(left, right) {
  return String(left ?? "") === String(right ?? "");
}

async function main() {
  const db = admin.firestore();
  const videoResult = await backfillVideos(db);
  const marketplaceResult = await backfillMerchantProducts(db);

  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    videos: videoResult,
    merchantProducts: marketplaceResult,
  }));
}

async function backfillVideos(db) {
  let lastDoc = null;
  let scanned = 0;
  let changed = 0;
  const proposedByDomain = {};
  const proposedByReason = {};
  const samples = [];

  for (;;) {
    let query = db.collection("videos").orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      scanned += 1;
      const data = doc.data() || {};
      const classification = classifyVideoForFeed(data);
      proposedByDomain[classification.contentDomain || "unknown"] = (proposedByDomain[classification.contentDomain || "unknown"] || 0) + 1;
      proposedByReason[classification.reason || "unknown"] = (proposedByReason[classification.reason || "unknown"] || 0) + 1;
      if (
        sameValue(data.feedEligible, classification.feedEligible) &&
        sameValue(data.feedKind, classification.feedKind) &&
        sameValue(data.contentDomain, classification.contentDomain || data.contentDomain || "citizen")
      ) {
        return;
      }

      changed += 1;
      if (samples.length < 25) samples.push({ id: doc.id, from: { contentDomain: data.contentDomain || null, feedKind: data.feedKind || null, feedEligible: data.feedEligible ?? null }, to: classification });
      if (!DRY_RUN) {
        batch.set(
          doc.ref,
          {
            contentDomain: classification.contentDomain || data.contentDomain || "citizen",
            ...classification,
            feedEligibilityBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    if (!DRY_RUN) await batch.commit();
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < BATCH_SIZE) break;
  }

  return { scanned, changed, proposedByDomain, proposedByReason, samples };
}

async function backfillMerchantProducts(db) {
  let lastDoc = null;
  let scanned = 0;
  let changed = 0;
  for (;;) {
    let query = db.collection("merchant_products").orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      scanned += 1;
      const data = doc.data() || {};
      const needsChange =
        data.contentDomain !== "marketplace" ||
        data.feedKind === "home" ||
        data.feedEligible === true;
      if (!needsChange) return;
      changed += 1;
      if (!DRY_RUN) {
        batch.set(doc.ref, {
          contentDomain: "marketplace",
          feedKind: "marketplace",
          feedEligible: false,
          feedEligibilityBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
    if (!DRY_RUN) await batch.commit();
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < BATCH_SIZE) break;
  }
  return { scanned, changed };
}

main().catch((error) => {
  console.error("Video feed eligibility backfill failed:", error);
  process.exitCode = 1;
});
