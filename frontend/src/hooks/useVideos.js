import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";
import { logPerf } from "../lib/perf";

const RECENT_UPLOAD_STORAGE_KEY = "paragon_recent_home_upload";
const RECENT_UPLOAD_TTL_MS = 10 * 60 * 1000;

export default function useVideos() {
  const [videos, setVideos] = useState([]);
  const [profilesByUid, setProfilesByUid] = useState({});

  useEffect(() => {
    const start = performance.now();
    const unsubscribeProfiles = onSnapshot(collection(db, "public_profiles"), (snap) => {
      logPerf("firestore.operation", {
        platform: "web",
        domain: "feed",
        operation: "listen-public-profiles",
        collection: "public_profiles",
        operationType: "listen",
        resultCount: snap.docs.length,
        durationMs: Math.round(performance.now() - start),
      });
      const profiles = {};
      snap.docs.forEach((profileDoc) => {
        profiles[profileDoc.id] = profileDoc.data() || {};
      });
      setProfilesByUid(profiles);
    });

    return () => unsubscribeProfiles();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "videos"),
      orderBy("createdAt", "desc"),
      limit(40)
    );

    const start = performance.now();
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .map((video) => normalizeFeedVideo(video, profilesByUid))
        .filter((video) => isHomeFeedVideo(video));

      const recentUpload = readRecentHomeUpload();
      const snapshotHasRecentUpload = Boolean(
        recentUpload?.id && data.some((video) => video.id === recentUpload.id)
      );
      const mergedData =
        recentUpload && !snapshotHasRecentUpload && isHomeFeedVideo(recentUpload)
          ? [normalizeFeedVideo(recentUpload, profilesByUid, true), ...data]
          : data;

      setVideos(mergedData);
      logPerf("feed.snapshot", {
        platform: "web",
        domain: "feed",
        operation: "listen-home-videos",
        collection: "videos",
        resultCount: snap.docs.length,
        usableItemCount: mergedData.length,
        durationMs: Math.round(performance.now() - start),
      });
      if (recentUpload?.id && snapshotHasRecentUpload) {
        logPerf("upload.web.T6_feed_api_visible", {
          platform: "web",
          domain: "upload",
          videoId: recentUpload.id,
          durationMs: Date.now() - recentUpload.createdAtMs,
        });
      }
      if (recentUpload?.id && mergedData.some((video) => video.id === recentUpload.id)) {
        logPerf("upload.web.T7_home_feed_received", {
          platform: "web",
          domain: "upload",
          videoId: recentUpload.id,
          source: snapshotHasRecentUpload ? "firestore-snapshot" : "recent-upload-handoff",
          durationMs: Date.now() - recentUpload.createdAtMs,
        });
      }
    });

    return () => unsubscribe();
  }, [profilesByUid]);

  return videos;
}

function normalizeFeedVideo(video, profilesByUid, recentUploadOptimistic = false) {
  return {
    ...video,
    recentUploadOptimistic,
    displayName: resolveVideoDisplayName(video, profilesByUid),
    performerName: resolveVideoDisplayName(video, profilesByUid),
    creatorName: resolveVideoDisplayName(video, profilesByUid),
    thumbnailUrl:
      video.thumbnailUrl ||
      video.coverImage ||
      video.posterUrl ||
      video.poster ||
      video.coverUrl ||
      video.thumbnail ||
      "",
  };
}

function readRecentHomeUpload() {
  try {
    const raw = window.sessionStorage?.getItem(RECENT_UPLOAD_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const createdAtMs = Number(parsed?.createdAtMs || 0);
    if (!parsed?.id || !createdAtMs || Date.now() - createdAtMs > RECENT_UPLOAD_TTL_MS) {
      window.sessionStorage?.removeItem(RECENT_UPLOAD_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function resolveVideoDisplayName(video, profilesByUid) {
  const uid = video.uid || video.userId || "";
  const profile = profilesByUid[uid] || {};
  return (
    profile.displayName ||
    profile.stageName ||
    profile.realName ||
    profile.name ||
    video.displayName ||
    video.performerName ||
    video.creatorName ||
    video.stageName ||
    video.realName ||
    "Paragon Creator"
  );
}

function isHomeFeedVideo(video) {
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

  if (!video?.streamUrl) return false;
  if (purpose === "meet_up_video") return false;
  if (purpose === "merchant_product") return false;
  if (video.productId || video.merchantId) return false;
  if (source === "admin_meetup_area_upload") return false;
  if (source.includes("merchant")) return false;
  if (visibility === "meet_up") return false;
  if (visibility === "marketplace") return false;
  if (productCategories.has(category)) return false;
  if (objectPath.includes("merchant-")) return false;
  return true;
}
