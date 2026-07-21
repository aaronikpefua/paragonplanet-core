import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export default function Following() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("following");
  const [following, setFollowing] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      setLoading(true);

      try {
        const followSnap = await getDocs(
          query(
            collection(db, "creator_follows"),
            where("followerId", "==", user.uid)
          )
        );

        const savedSnap = await getDocs(
          query(
            collection(db, "saved_videos"),
            where("uid", "==", user.uid)
          )
        );

        setFollowing(
          followSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );

        setSavedVideos(
          savedSnap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  useEffect(() => {
    const q = query(
      collection(db, "videos"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((video) => isHomeFeedVideo(video));

      setVideos(data);
    });

    return () => unsubscribe();
  }, []);

  const followedCreatorIds = useMemo(
    () => new Set(following.map((item) => item.creatorId).filter(Boolean)),
    [following]
  );

  const followingFeed = useMemo(
    () => videos.filter((video) => followedCreatorIds.has(video.uid)),
    [videos, followedCreatorIds]
  );

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <p style={eyebrowStyle}>Your network</p>
        <h1 style={titleStyle}>Following & Saved</h1>
        <p style={mutedStyle}>
          Keep track of creators you follow and videos you want to come back to.
        </p>
      </div>

      <div style={tabRowStyle}>
        <button
          type="button"
          onClick={() => setActiveTab("following")}
          style={tabStyle(activeTab === "following")}
        >
          Following
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("saved")}
          style={tabStyle(activeTab === "saved")}
        >
          Save / Watch
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : activeTab === "following" ? (
        <section style={listStyle}>
          {!following.length ? (
            <p style={mutedStyle}>You are not following any creators yet.</p>
          ) : !followingFeed.length ? (
            <p style={mutedStyle}>You are following creators, but no live videos are available from them yet.</p>
          ) : (
            followingFeed.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => navigate(`/watch/${video.id}`)}
                style={savedCardButtonStyle}
              >
                <div>
                  <h3 style={cardTitleStyle}>{video.title || video.name || "Untitled video"}</h3>
                  <p style={mutedStyle}>{video.category || "General"}</p>
                  <p style={mutedStyle}>{video.description || video.about || "Open video"}</p>
                </div>
              </button>
            ))
          )}
        </section>
      ) : (
        <section style={listStyle}>
          {!savedVideos.length ? (
            <p style={mutedStyle}>You have not saved any videos yet.</p>
          ) : (
            savedVideos.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/watch/${item.videoId}`)}
                style={savedCardButtonStyle}
              >
                <div>
                  <h3 style={cardTitleStyle}>{item.title || "Saved video"}</h3>
                  <p style={mutedStyle}>Open saved video</p>
                </div>
              </button>
            ))
          )}
        </section>
      )}
    </main>
  );
}

function isHomeFeedVideo(video) {
  if (!video?.streamUrl) return false;
  if (video.uploadPurpose === "meet_up_video") return false;
  if (video.source === "admin_meetup_area_upload") return false;
  if (video.visibility === "meet_up") return false;
  return true;
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#f7f3ea",
  color: "#1f2933",
};

const headerStyle = {
  maxWidth: 960,
  margin: "0 auto 24px",
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "8px 0",
  fontSize: 36,
};

const mutedStyle = {
  color: "#52616b",
};

const tabRowStyle = {
  maxWidth: 960,
  margin: "0 auto 24px",
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const tabStyle = (active) => ({
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #d7cdbd",
  background: active ? "#1f2933" : "#fffdf8",
  color: active ? "#fff" : "#1f2933",
  fontWeight: 700,
  cursor: "pointer",
});

const listStyle = {
  maxWidth: 960,
  margin: "0 auto",
  display: "grid",
  gap: 14,
};

const cardStyle = {
  padding: 18,
  borderRadius: 10,
  border: "1px solid #e2d8c8",
  background: "#fffdf8",
};

const savedCardButtonStyle = {
  width: "100%",
  padding: 18,
  borderRadius: 10,
  border: "1px solid #e2d8c8",
  background: "#fffdf8",
  textAlign: "left",
  cursor: "pointer",
};

const cardTitleStyle = {
  margin: "0 0 6px",
};
