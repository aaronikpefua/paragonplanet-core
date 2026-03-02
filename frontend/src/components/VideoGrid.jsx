import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db, auth } from "../config/firebase";

const API_URL =
  "https://paragonplanet-api-849823064688.us-central1.run.app";

export default function VideoGrid() {
  const [videos, setVideos] = useState([]);
  const [loadingVoteId, setLoadingVoteId] = useState(null);

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

  /* =========================
     HANDLE VOTE
  ========================= */

  const handleVote = async (videoId) => {
    try {
      const user = auth.currentUser;

      if (!user) {
        alert("Please login first");
        return;
      }

      setLoadingVoteId(videoId);

      const token = await user.getIdToken();

      const response = await fetch(
        `${API_URL}/vote/${videoId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Vote failed");
      }

      // Update vote count instantly in UI
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, votes: (v.votes || 0) + 1 }
            : v
        )
      );

    } catch (error) {
      console.error("Vote error:", error);
      alert(error.message);
    } finally {
      setLoadingVoteId(null);
    }
  };

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
              src={video.videoUrl}
              muted
              controls
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

          {/* VOTE COUNT */}
          <p style={{ fontSize: 13, fontWeight: "bold" }}>
            Votes: {video.votes || 0}
          </p>

          {/* ACTION BUTTONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <button
              onClick={() => handleVote(video.id)}
              disabled={loadingVoteId === video.id}
            >
              {loadingVoteId === video.id
                ? "Processing..."
                : "❤️ Vote"}
            </button>

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