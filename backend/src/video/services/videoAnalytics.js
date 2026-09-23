import crypto from "node:crypto";
import admin from "../../config/firebase.js";

const QUALIFIED_SECONDS = Number(process.env.VIDEO_QUALIFIED_VIEW_SECONDS || 5);
const COMPLETION_RATIO = Number(process.env.VIDEO_COMPLETION_RATIO || 0.9);
const MAX_HEARTBEAT_SECONDS = 30;

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

export function analyticsPolicy() {
  return { qualifiedViewSeconds: QUALIFIED_SECONDS, completionRatio: COMPLETION_RATIO, heartbeatMaxSeconds: MAX_HEARTBEAT_SECONDS };
}

export async function startVideoViewSession({ db, videoId, viewerId, durationSeconds = 0 }) {
  const video = await db.collection("videos").doc(videoId).get();
  if (!video.exists || video.data()?.contentDomain !== "citizen") {
    const error = new Error("Citizen video not found"); error.status = 404; throw error;
  }
  const ref = db.collection("video_view_sessions").doc();
  await ref.set({ videoId, citizenId: video.data()?.uid || null, viewerHash: hash(viewerId), durationSeconds: Math.max(0, Number(durationSeconds) || 0), watchedSeconds: 0, qualified: false, completed: false, status: "PLAY_STARTED", createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { sessionId: ref.id, policy: analyticsPolicy() };
}

export async function heartbeatVideoViewSession({ db, sessionId, viewerId, watchedDeltaSeconds = 0, positionSeconds = 0, durationSeconds = 0, ended = false }) {
  const ref = db.collection("video_view_sessions").doc(sessionId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.viewerHash !== hash(viewerId)) { const error = new Error("View session not found"); error.status = 404; throw error; }
    const current = snap.data() || {};
    const delta = Math.max(0, Math.min(MAX_HEARTBEAT_SECONDS, Number(watchedDeltaSeconds) || 0));
    const watched = Number(current.watchedSeconds || 0) + delta;
    const duration = Math.max(Number(current.durationSeconds || 0), Number(durationSeconds || 0));
    const qualifiedNow = watched >= QUALIFIED_SECONDS;
    const completedNow = qualifiedNow && duration > 0 && watched >= duration * COMPLETION_RATIO && Number(positionSeconds || 0) >= duration * COMPLETION_RATIO;
    const firstQualified = qualifiedNow && !current.qualified;
    const firstCompleted = completedNow && !current.completed;
    const uniqueRef = db.collection("video_analytics_uniques").doc(`${dayKey()}_${current.videoId}_${current.viewerHash}`);
    const unique = firstQualified ? await tx.get(uniqueRef) : null;
    tx.set(ref, { watchedSeconds: watched, durationSeconds: duration, lastPositionSeconds: Math.max(0, Number(positionSeconds) || 0), qualified: qualifiedNow, completed: completedNow, status: ended ? "PLAY_ENDED" : "WATCHING", updatedAt: admin.firestore.FieldValue.serverTimestamp(), ...(ended ? { endedAt: admin.firestore.FieldValue.serverTimestamp() } : {}) }, { merge: true });
    const shard = parseInt(hash(sessionId).slice(0, 2), 16) % 32;
    const aggregateRef = db.collection("video_analytics_daily").doc(`${dayKey()}_${current.videoId}_${shard}`);
    tx.set(aggregateRef, { date: dayKey(), videoId: current.videoId, citizenId: current.citizenId || null, shard, views: admin.firestore.FieldValue.increment(firstQualified ? 1 : 0), watchSeconds: admin.firestore.FieldValue.increment(delta), completions: admin.firestore.FieldValue.increment(firstCompleted ? 1 : 0), sessionsEnded: admin.firestore.FieldValue.increment(ended ? 1 : 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    const platformRef = db.collection("platform_stats").doc("citizen_video");
    tx.set(platformRef, { views: admin.firestore.FieldValue.increment(firstQualified ? 1 : 0), watchSeconds: admin.firestore.FieldValue.increment(delta), completions: admin.firestore.FieldValue.increment(firstCompleted ? 1 : 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (firstQualified) {
      if (!unique.exists) {
        tx.create(uniqueRef, { date: dayKey(), videoId: current.videoId, viewerHash: current.viewerHash, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.set(aggregateRef, { uniqueViewers: admin.firestore.FieldValue.increment(1) }, { merge: true });
        tx.set(platformRef, { uniqueViewers: admin.firestore.FieldValue.increment(1) }, { merge: true });
      }
    }
    return { qualified: qualifiedNow, completed: completedNow, watchedSeconds: watched };
  });
}
