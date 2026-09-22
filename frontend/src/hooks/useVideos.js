import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, appCheckFetch } from "../lib/supportActions";
import { logPerf } from "../lib/perf";

const RECENT_UPLOAD_STORAGE_KEY = "paragon_recent_home_upload";
const RECENT_UPLOAD_TTL_MS = 10 * 60 * 1000;
const PAGE_SIZE = 20;

export default function useVideos() {
  const [videos, setVideos] = useState([]);
  const loadingRef = useRef(false);
  const cursorRef = useRef("");
  const hasMoreRef = useRef(false);

  const mergeVideos = useCallback((current, incoming) => {
    const byId = new Map();
    [...current, ...incoming].forEach((video) => {
      if (video?.id) byId.set(video.id, video);
    });
    return [...byId.values()];
  }, []);

  const loadPage = useCallback(async ({ reset = false } = {}) => {
    if (loadingRef.current) return;
    if (!reset && !hasMoreRef.current) return;

    loadingRef.current = true;
    const cursor = reset ? "" : cursorRef.current;
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);
    const start = performance.now();

    try {
      const response = await appCheckFetch(`${API_URL}/api/video/list?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not load videos");

      const items = Array.isArray(payload) ? payload : payload.items || [];
      const normalizedItems = items
        .map((video) => normalizeFeedVideo(video))
        .filter((video) => isHomeFeedVideo(video));
      const recentUpload = reset ? readRecentHomeUpload() : null;
      const withRecentUpload =
        recentUpload && isHomeFeedVideo(recentUpload)
          ? [normalizeFeedVideo(recentUpload, true), ...normalizedItems]
          : normalizedItems;

      setVideos((current) => (reset ? mergeVideos([], withRecentUpload) : mergeVideos(current, withRecentUpload)));
      const next = Array.isArray(payload) ? "" : payload.nextCursor || "";
      const more = Array.isArray(payload) ? false : Boolean(payload.hasMore && next);
      cursorRef.current = next;
      hasMoreRef.current = more;

      logPerf("feed.page", {
        platform: "web",
        domain: "feed",
        operation: "load-home-videos-page",
        resultCount: items.length,
        usableItemCount: normalizedItems.length,
        hasMore: more,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (error) {
      console.warn("Could not load paginated video feed:", error);
    } finally {
      loadingRef.current = false;
    }
  }, [mergeVideos]);

  useEffect(() => {
    loadPage({ reset: true });
  }, [loadPage]);

  useEffect(() => {
    const onScroll = () => {
      if (!hasMoreRef.current || loadingRef.current) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const fullHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      if (fullHeight - (scrollTop + viewportHeight) < 900) {
        loadPage();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadPage]);

  return videos;
}

function normalizeFeedVideo(video, recentUploadOptimistic = false) {
  const displayName = resolveVideoDisplayName(video);
  return {
    ...video,
    id: video.id || video.videoId,
    recentUploadOptimistic,
    displayName,
    performerName: displayName,
    creatorName: displayName,
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

function resolveVideoDisplayName(video = {}) {
  return (
    video.displayName ||
    video.performerName ||
    video.creatorName ||
    video.stageName ||
    video.realName ||
    video.name ||
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
