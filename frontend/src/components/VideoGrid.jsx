import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";

export default function VideoGrid() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const q = query(
          collection(db, "videos"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        setVideos(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      } catch (err) {
        console.error("Error loading videos:", err);
      }
    };

    loadVideos();
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 20,
      }}
    >
      {videos.map((video) => (
        <div
          key={video.id}
          style={{
            border: "1px solid #ddd",
            padding: 10,
            background: "#fff",
          }}
        >
          {/* VIDEO PLAYER */}
          {video.videoUrl ? (
            <video
              src={video.videoUrl}   // ✅ FIXED HERE
              muted
              controls              // allow play
              playsInline
              style={{
                width: "100%",
                borderRadius: 6,
                background: "#000",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 200,
                background: "#eee",
              }}
            />
          )}

          {/* TITLE */}
          <h4 style={{ marginTop: 8 }}>
            {video.title || "Untitled"}
          </h4>

          {/* CATEGORY */}
          {video.category && (
            <p style={{ fontSize: 12, color: "#666" }}>
              {video.category}
            </p>
          )}

          {/* DESCRIPTION */}
          {video.description && (
            <p style={{ fontSize: 13 }}>
              {video.description}
            </p>
          )}

          {/* ACTION BUTTONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <button>❤️ Vote</button>
            <button>👀 View</button>
            <button>💬 Comment</button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <button>🍾 Pop Bottle</button>
            <button>💸 Spray Me</button>
            <button>⭐ Keep Up</button>
          </div>
        </div>
      ))}
    </div>
  );
}
