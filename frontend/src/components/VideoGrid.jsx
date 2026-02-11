import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";

export default function VideoGrid() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const loadVideos = async () => {
      const q = query(
        collection(db, "videos"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };

    loadVideos();
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
      {videos.map(video => (
        <div key={video.id} style={{ border: "1px solid #ddd", padding: 10 }}>
          <video
            src={video.url}
            muted
            autoPlay
            loop
            playsInline
            style={{ width: "100%" }}
          />

          <h4>{video.title || "Untitled"}</h4>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button>❤️ Vote</button>
            <button>👀 View</button>
            <button>💬 Comment</button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <button>🍾 Pop Bottle</button>
            <button>💸 Spray Me</button>
            <button>⭐ Keep Up</button>
          </div>
        </div>
      ))}
    </div>
  );
}
