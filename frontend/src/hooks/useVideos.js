import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";

export default function useVideos() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "videos"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((video) => isHomeFeedVideo(video));

      setVideos(data);
    });

    return () => unsubscribe();
  }, []);

  return videos;
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
