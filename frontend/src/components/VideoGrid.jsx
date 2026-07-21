import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useVideos from "../hooks/useVideos";
import VideoPlayer from "./VideoPlayer";
import { auth } from "../config/firebase";
import {
  API_URL,
  SUPPORT_ACTIONS,
  SPRAY_ACTION_KEYS,
  BOTTLE_ACTION_KEYS,
  appCheckFetch,
  formatSupportCost,
} from "../lib/supportActions";

export default function Explore() {
  const videos = useVideos();
  const navigate = useNavigate();
  const [loadingVoteId, setLoadingVoteId] = useState(null);
  const [liked, setLiked] = useState({});
  const [supportModal, setSupportModal] = useState(null);
  const [processingSupportKey, setProcessingSupportKey] = useState("");
  const [customSprayAmount, setCustomSprayAmount] = useState("1");
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;

          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.7 }
    );

    const vids = containerRef.current.querySelectorAll("video");
    vids.forEach((v) => observer.observe(v));

    return () => observer.disconnect();
  }, [videos]);

  const handleDoubleTap = (id) => {
    setLiked((prev) => ({ ...prev, [id]: true }));

    setTimeout(() => {
      setLiked((prev) => ({ ...prev, [id]: false }));
    }, 700);
  };

  const handleVote = async (videoId) => {
    await handleSupport(videoId, "vote");
  };

  const handleSupport = async (videoId, actionKey, options = {}) => {
    const user = auth.currentUser;

    if (!user) {
      alert("Login first");
      return;
    }

    const action = SUPPORT_ACTIONS[actionKey];
    if (!action) return;

    if (actionKey === "vote") {
      setLoadingVoteId(videoId);
    } else {
      setProcessingSupportKey(actionKey);
    }

    try {
      const token = await user.getIdToken();
      const payload = { actionKey };

      if (action.variable) {
        payload.customParagAmount = Number(options.customParagAmount || 0);
      }

      const res = await appCheckFetch(`${API_URL}/support/${videoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Action failed");
        return;
      }

      alert(`${action.label} sent successfully`);
      setSupportModal(null);
    } catch {
      alert("Could not complete this action right now");
    } finally {
      setLoadingVoteId(null);
      setProcessingSupportKey("");
    }
  };

  const openSupportModal = (videoId, group) => {
    setSupportModal({ videoId, group });
    setCustomSprayAmount("1");
  };

  const supportActionKeys =
    supportModal?.group === "spray" ? SPRAY_ACTION_KEYS : BOTTLE_ACTION_KEYS;

  if (!videos.length) {
    return <p style={{ padding: 20 }}>Loading videos...</p>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        minHeight: 0,
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        background: "#000"
      }}
    >
      {videos.map((video) => (
        <div
          key={video.id}
          style={{
            height: "100%",
            minHeight: "100%",
            scrollSnapAlign: "start",
            position: "relative"
          }}
          onDoubleClick={() => handleDoubleTap(video.id)}
        >
          <VideoPlayer streamUrl={video.streamUrl} />

          {liked[video.id] && (
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: 80,
                color: "red",
                zIndex: 20
              }}
            >
              ❤️
            </div>
          )}

          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              zIndex: 20
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => navigate("/")} style={btnStyle}>
                📱 Feed
              </button>

              <button onClick={() => navigate("/autoplay")} style={btnStyle}>
                🔁 Autoplay
              </button>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 100,
              left: 15,
              color: "#fff",
              maxWidth: "70%",
              zIndex: 20
            }}
          >
            <h3>{video.title || video.name || "Untitled"}</h3>
            <p>{video.category || video.genre || "general"}</p>
            <p>{video.description || video.about || ""}</p>
            <p>Votes: {video.votes || 0}</p>
          </div>

          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 120,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              zIndex: 20
            }}
          >
            <button onClick={() => handleVote(video.id)}>❤️</button>
            <button>👀</button>
            <button>💬</button>
            <button onClick={() => openSupportModal(video.id, "spray")}>💸</button>
            <button onClick={() => openSupportModal(video.id, "bottle")}>🍾</button>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              width: "100%",
              display: "flex",
              justifyContent: "space-around",
              padding: "12px 0",
              background: "rgba(0,0,0,0.6)",
              zIndex: 20
            }}
          >
            <button onClick={() => handleVote(video.id)}>
              {loadingVoteId === video.id ? "Sending Vote..." : "❤️ Vote"}
            </button>
            <button>👀 View</button>
            <button>💬 Comment</button>
            <button onClick={() => openSupportModal(video.id, "spray")}>💸 Spray</button>
            <button onClick={() => openSupportModal(video.id, "bottle")}>🍾 Bottle</button>
          </div>
        </div>
      ))}

      {supportModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ marginTop: 0 }}>
              {supportModal.group === "spray" ? "Spray Support" : "Pop a Bottle 4 Me"}
            </h3>

            <div style={supportGridStyle}>
              {supportActionKeys.map((actionKey) => {
                const action = SUPPORT_ACTIONS[actionKey];

                return (
                  <div key={actionKey} style={supportCardStyle}>
                    <div style={supportMetaRowStyle}>
                      <strong>{action.label}</strong>
                      <span>{formatSupportCost(action, customSprayAmount)}</span>
                    </div>

                    {action.variable ? (
                      <>
                        <input
                          type="number"
                          min="1"
                          value={customSprayAmount}
                          onChange={(e) => setCustomSprayAmount(e.target.value)}
                          style={supportInputStyle}
                          placeholder="Enter Parag amount"
                        />
                        <button
                          onClick={() => handleSupport(supportModal.videoId, actionKey, { customParagAmount: customSprayAmount })}
                          style={btnStyle}
                        >
                          {processingSupportKey === actionKey ? "Sending..." : "Spray Money"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleSupport(supportModal.videoId, actionKey)}
                        style={btnStyle}
                      >
                        {processingSupportKey === actionKey
                          ? "Sending..."
                          : action.group === "spray"
                            ? action.label
                            : `Pop ${action.label}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setSupportModal(null)} style={btnStyle}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "6px 10px",
  borderRadius: 20,
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "1px solid #fff",
  cursor: "pointer"
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 40
};

const modalStyle = {
  width: "min(720px, 92vw)",
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  color: "#101828",
  borderRadius: 14,
  padding: 20
};

const supportGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16
};

const supportCardStyle = {
  border: "1px solid #e4e7ec",
  borderRadius: 12,
  padding: 14,
  background: "#fcfcfd"
};

const supportMetaRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10
};

const supportInputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #d0d5dd",
  marginBottom: 10
};
