import { useEffect, useRef } from "react";
import Hls from "hls.js";

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".ogg",
  ".ogv",
  ".m3u8",
];

function isVideoUrl(url) {
  const normalizedUrl = String(url || "").toLowerCase().split("?")[0];
  return VIDEO_EXTENSIONS.some((extension) => normalizedUrl.includes(extension));
}

function isHlsUrl(url) {
  return String(url || "").toLowerCase().split("?")[0].includes(".m3u8");
}

export function isVideoProduct(product) {
  return product?.mediaType === "video" || isVideoUrl(product?.streamUrl || product?.mediaUrl);
}

export default function MerchantProductMedia({ product, style }) {
  const videoRef = useRef(null);
  const sourceUrl = product?.streamUrl || product?.mediaUrl || product?.originalUrl || "";
  const posterUrl = product?.thumbnailUrl || "";
  const shouldRenderVideo = isVideoProduct(product);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldRenderVideo || !sourceUrl) return undefined;

    let hls = null;

    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";

    if (isHlsUrl(sourceUrl) && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 12,
        backBufferLength: 6,
      });

      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else {
      video.src = sourceUrl;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [sourceUrl, shouldRenderVideo]);

  if (!shouldRenderVideo) {
    return <img src={sourceUrl} alt={product?.name || "Product"} style={style} />;
  }

  return (
    <video
      ref={videoRef}
      style={style}
      controls
      muted
      loop
      playsInline
      preload="auto"
      poster={posterUrl}
    />
  );
}
