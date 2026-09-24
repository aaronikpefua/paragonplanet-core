import admin from "../src/config/firebase.js";
import {
  CITIZEN_VIDEO_TERMS_DRAFT_BODY,
  CITIZEN_VIDEO_TERMS_DRAFT_TITLE,
} from "../src/video/content/citizenVideoTermsDraft.js";

const DRAFT_ID = "video-terms-parag-production-draft-20260923";
const db = admin.firestore();
const ref = db.collection("video_terms_versions").doc(DRAFT_ID);
const snap = await ref.get();
if (!snap.exists) throw new Error(`Draft ${DRAFT_ID} does not exist.`);
if (String(snap.data()?.status || "").toLowerCase() !== "draft") {
  throw new Error(`Refusing to update ${DRAFT_ID}: status is not draft.`);
}
await ref.set({
  title: CITIZEN_VIDEO_TERMS_DRAFT_TITLE,
  body: CITIZEN_VIDEO_TERMS_DRAFT_BODY,
  requiresAcceptance: true,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: "citizen-video-terms-flow",
}, { merge: true });
console.log(JSON.stringify({ updated: true, draftId: DRAFT_ID, status: "draft", published: false }));
