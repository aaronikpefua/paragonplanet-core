import { useEffect, useState } from "react";
import VideoPlayer from "../components/VideoPlayer";
import useVideos from "../hooks/useVideos";

export default function Autoplay() {
  const videos = useVideos();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!videos.length) {
      setIndex(0);
      return;
    }

    if (index >= videos.length) {
      setIndex(0);
    }
  }, [index, videos.length]);

  const next = () => {
    if (!videos.length) return;
    setIndex((current) => (current + 1) % videos.length);
  };

  if (!videos.length) {
    return <p>Loading...</p>;
  }

  const currentVideo = videos[index];

  return (
    <div className="autoplay">
      <VideoPlayer
        key={currentVideo.id}
        streamUrl={currentVideo.streamUrl}
      />

      <button className="next-btn" onClick={next}>
        Next ▶
      </button>
    </div>
  );
}
