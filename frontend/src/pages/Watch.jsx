import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import VideoPlayer from "../components/VideoPlayer";

export default function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  /* =========================
     LOAD VIDEO
  ========================= */
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "videos", id));

        if (snap.exists()) {
          const videoData = snap.data();
          if (videoData.visibility === "meet_up" || videoData.uploadPurpose === "meet_up_video") {
            setVideo(null);
          } else {
            setVideo(videoData);
          }
        }
      } catch (err) {
        console.error("Error loading video:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  /* =========================
     LOADING STATE
  ========================= */
  if (loading) {
    return (
      <div style={centerStyle}>
        <img src="/logo-v2.png" alt="Paragon Planet" style={loadingLogoStyle} />
        <strong>Loading video...</strong>
      </div>
    );
  }

  if (!video) {
    return (
      <div style={centerStyle}>
        ⚠️ Video not found
      </div>
    );
  }

  const prefersMobile =
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const playableUrl = prefersMobile
    ? video.mobileUrl || video.streamUrl || video.originalUrl
    : video.desktopUrl || video.streamUrl || video.originalUrl;

  /* =========================
     UI
  ========================= */
  return (
    <div style={pageStyle}>
      
      {/* 🎬 PLAYER CONTAINER */}
      <div style={playerWrapper}>
        <div style={playerBox}>
          <VideoPlayer streamUrl={playableUrl} />
        </div>
      </div>

      {/* 📄 VIDEO INFO */}
      <div style={infoStyle}>
        <h2 style={{ marginBottom: 8 }}>
          {video.title ?? "Untitled"}
        </h2>

        <p style={{ opacity: 0.8 }}>
          {video.description ?? ""}
        </p>
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const pageStyle = {
  background: "#000",
  color: "#fff",
  minHeight: "100vh",
  paddingTop: 70 // 👈 space for header
};

const playerWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center"
};

const playerBox = {
  width: "100%",
  maxWidth: 900, // 🎯 YouTube style centered player
  aspectRatio: "16 / 9",
  position: "relative",
  background: "#000",
  overflow: "hidden"
};

const infoStyle = {
  maxWidth: 900,
  margin: "20px auto",
  padding: "0 15px"
};

const centerStyle = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  alignItems: "center",
  justifyContent: "center",
  background: "#000",
  color: "#fff",
  fontSize: 18
};

const loadingLogoStyle = {
  width: 92,
  height: 92,
  borderRadius: 22,
  objectFit: "cover",
  boxShadow: "0 0 40px rgba(255, 205, 86, 0.55)",
};
