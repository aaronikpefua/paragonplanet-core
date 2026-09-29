import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/supportActions";
import { logPerf } from "../lib/perf";

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
      // The authoritative Home feed is public. Avoid delaying first paint on
      // an App Check token that this endpoint neither requires nor validates.
      const response = await fetch(`${API_URL}/api/video/list?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Could not load videos");

      const items = Array.isArray(payload) ? payload : payload.items || [];
      const normalizedItems = items
        .map((video) => normalizeFeedVideo(video))
        .filter((video) => isHomeFeedVideo(video));
      setVideos((current) => (reset ? mergeVideos([], normalizedItems) : mergeVideos(current, normalizedItems)));
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

function normalizeFeedVideo(video) {
  const displayName = resolveVideoDisplayName(video);
  return {
    ...video,
    id: video.id || video.videoId,
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
