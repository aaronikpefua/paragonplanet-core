import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";

const PROFILE_SOURCES = [
  { collectionName: "citizen_profiles", role: "Citizen" },
  { collectionName: "promoter_profiles", role: "Ambassador" },
  { collectionName: "merchant_profiles", role: "Merchant" },
  { collectionName: "user_profiles", role: "User" },
  { collectionName: "backer_profiles", role: "Backer" },
  { collectionName: "supernal_profiles", role: "Superboss" },
  { collectionName: "sponsor_investor_profiles", role: "Sponsor / Investor" },
  { collectionName: "sponsor_profiles", role: "Sponsor / Investor" },
];

export default function MemberProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [recentVideos, setRecentVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [processingFollow, setProcessingFollow] = useState(false);

  useEffect(() => {
    const loadMember = async () => {
      if (!uid) return;

      setLoading(true);
      setError("");

      try {
        const profile = await loadMemberProfile(uid);
        if (!profile) {
          setError("This member profile is not available right now.");
          setMember(null);
          setRecentVideos([]);
          return;
        }

        setMember(profile);
      } catch (loadError) {
        console.error("Member profile load failed:", loadError);
        setError("This member profile could not load right now.");
        setMember(null);
        setRecentVideos([]);
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [uid]);

  useEffect(() => {
    const loadRecentVideos = async () => {
      if (!member?.uid) {
        setRecentVideos([]);
        return;
      }

      try {
        const videosSnap = await getDocs(
          query(
            collection(db, "videos"),
            where("uid", "==", member.uid),
            orderBy("createdAt", "desc"),
            limit(12)
          )
        );

        setRecentVideos(
          videosSnap.docs
            .map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            }))
            .filter((video) => isPublicProfileVideo(video))
        );
      } catch (videosError) {
        console.warn("Recent videos could not load for member profile:", videosError);
        setRecentVideos([]);
      }
    };

    void loadRecentVideos();
  }, [member?.uid]);

  useEffect(() => {
    const loadFollowState = async () => {
      const user = auth.currentUser;
      if (!user || !uid || user.uid === uid) {
        setIsFollowing(false);
        return;
      }

      try {
        const followSnap = await getDoc(doc(db, "creator_follows", `${user.uid}_${uid}`));
        setIsFollowing(followSnap.exists());
      } catch (followError) {
        console.warn("Follow state could not load:", followError);
      }
    };

    void loadFollowState();
  }, [uid]);

  const memberContact = useMemo(() => {
    if (!member) return null;

    return {
      uid: member.uid,
      displayName: member.displayName,
      role: member.role,
      email: member.email || "",
      subtitle: member.subtitle || "",
    };
  }, [member]);

  const handleToggleFollow = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }

    if (!member || user.uid === member.uid || processingFollow) return;

    setProcessingFollow(true);
    const followRef = doc(db, "creator_follows", `${user.uid}_${member.uid}`);

    try {
      if (isFollowing) {
        await deleteDoc(followRef);
        setIsFollowing(false);
      } else {
        await setDoc(followRef, {
          creatorId: member.uid,
          creatorName: member.displayName,
          creatorRole: member.role,
          followerId: user.uid,
          videoId: recentVideos[0]?.id || "",
          createdAt: serverTimestamp(),
        });
        setIsFollowing(true);
      }
    } finally {
      setProcessingFollow(false);
    }
  };

  const handleMessage = () => {
    if (!memberContact) return;

    if (!auth.currentUser) {
      navigate("/login");
      return;
    }

    navigate("/inbox", {
      state: {
        restrictToContact: true,
        returnTo: `/member/${member.uid}`,
        returnLabel: "Profile",
        contact: memberContact,
      },
    });
  };

  if (loading) {
    return <main style={pageStyle}>Loading member profile...</main>;
  }

  if (error || !member) {
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <p style={eyebrowStyle}>Member profile</p>
          <h1 style={titleStyle}>Profile unavailable</h1>
          <p style={mutedStyle}>{error || "This profile is not available right now."}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={heroStyle}>
          <div style={avatarStyle}>
            {(member.displayName || "M").slice(0, 1).toUpperCase()}
          </div>

          <div style={heroContentStyle}>
            <p style={eyebrowStyle}>Public member profile</p>
            <h1 style={titleStyle}>{member.displayName}</h1>
            <p style={roleStyle}>{member.role}</p>
            <p style={mutedStyle}>
              {member.subtitle || member.email || "Follow this member and stay close to their activity."}
            </p>

            <div style={metaGridStyle}>
              {member.country && <span style={metaPillStyle}>{member.country}</span>}
              {member.state && <span style={metaPillStyle}>{member.state}</span>}
              {member.category && <span style={metaPillStyle}>{member.category}</span>}
              {recentVideos.length > 0 && (
                <span style={metaPillStyle}>{recentVideos.length} recent videos</span>
              )}
            </div>

            <div style={heroActionRowStyle}>
              {auth.currentUser?.uid !== member.uid && (
                <button
                  type="button"
                  onClick={() => navigate(`/meet-up/${member.uid}`)}
                  style={primaryButtonStyle}
                >
                  Request a Meet-Up
                </button>
              )}
              <button type="button" onClick={handleMessage} style={secondaryButtonStyle}>
                Message
              </button>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>About</h2>
          <div style={detailsGridStyle}>
            {member.realName && <Detail label="Real Name" value={member.realName} />}
            {member.stageName && <Detail label="Stage Name" value={member.stageName} />}
            {member.profession && <Detail label="Profession" value={member.profession} />}
            {member.country && <Detail label="Country" value={member.country} />}
            {member.state && <Detail label="State" value={member.state} />}
            {member.tribe && <Detail label="Tribe" value={member.tribe} />}
            {member.about && <Detail label="About" value={member.about} />}
            {member.description && <Detail label="Description" value={member.description} />}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Recent videos</h2>
            {recentVideos.length > 0 && (
              <button
                type="button"
                onClick={() => navigate(`/watch/${recentVideos[0].id}`)}
                style={secondaryButtonStyle}
              >
                Watch latest
              </button>
            )}
          </div>

          {recentVideos.length === 0 ? (
            <p style={mutedStyle}>No public videos from this member yet.</p>
          ) : (
            <div style={videoGridStyle}>
              {recentVideos.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => navigate(`/watch/${video.id}`)}
                  style={videoCardStyle}
                >
                  <div
                    style={{
                      ...videoThumbStyle,
                      backgroundImage: video.thumbnailUrl ? `url(${video.thumbnailUrl})` : "none",
                    }}
                  >
                    {!video.thumbnailUrl && <span style={videoPlayStyle}>▶</span>}
                  </div>
                  <div style={videoInfoStyle}>
                    <strong>{video.title || video.name || "Untitled video"}</strong>
                    <span style={mutedSmallStyle}>{video.category || "General"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function isPublicProfileVideo(video) {
  if (video?.uploadPurpose === "meet_up_video") return false;
  if (video?.source === "admin_meetup_area_upload") return false;
  if (video?.visibility === "meet_up") return false;
  return true;
}

function Detail({ label, value }) {
  return (
    <div style={detailCardStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value}</div>
    </div>
  );
}

async function loadMemberProfile(uid) {
  for (const source of PROFILE_SOURCES) {
    try {
      const snap = await getDoc(doc(db, source.collectionName, uid));
      if (!snap.exists()) continue;

      const data = snap.data();
      const role =
        source.collectionName === "sponsor_investor_profiles"
          ? data.accountType === "Investor"
            ? "Investor"
            : "Sponsor"
          : source.role;

      return {
        uid,
        role,
        displayName:
          data.stageName ||
          data.realName ||
          data.brandName ||
          data.fullName ||
          data.companyName ||
          data.name ||
          data.email ||
          "Member",
        realName: data.realName || data.fullName || data.companyName || "",
        stageName: data.stageName || "",
        profession: data.profession || data.businessName || "",
        phone: data.phone || data.phoneNumber || "",
        email: data.email || "",
        country: data.country || "",
        state: data.state || data.city || "",
        tribe: data.tribe || "",
        about: data.about || "",
        description: data.description || "",
        subtitle:
          data.profession ||
          data.businessName ||
          data.brandName ||
          data.country ||
          "",
        category: data.category || "",
      };
    } catch (error) {
      console.warn(`Skipping member profile source ${source.collectionName}:`, error?.message || error);
    }
  }

  return null;
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#f7f3ea",
  color: "#1f2933",
};

const shellStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};

const heroStyle = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 24,
  alignItems: "start",
  padding: 24,
  borderRadius: 16,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
};

const avatarStyle = {
  width: 120,
  height: 120,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #f97316, #ec4899)",
  color: "#fff",
  fontSize: 48,
  fontWeight: 800,
};

const heroContentStyle = {
  display: "grid",
  gap: 10,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: 0,
  fontSize: 40,
};

const roleStyle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: "#d1495b",
};

const mutedStyle = {
  margin: 0,
  color: "#52616b",
  lineHeight: 1.6,
};

const mutedSmallStyle = {
  color: "#52616b",
  fontSize: 13,
};

const metaGridStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const metaPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "#f4ece1",
  color: "#2e2a24",
  fontSize: 13,
  fontWeight: 700,
};

const heroActionRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 4,
};

const primaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 999,
  border: "none",
  background: "#101828",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "12px 18px",
  borderRadius: 999,
  border: "1px solid #d7cdbd",
  background: "#fff",
  color: "#1f2933",
  fontWeight: 700,
  cursor: "pointer",
};

const panelStyle = {
  padding: 24,
  borderRadius: 16,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 28,
};

const detailsGridStyle = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const detailCardStyle = {
  padding: 16,
  borderRadius: 12,
  border: "1px solid #eee2d3",
  background: "#fff",
};

const detailLabelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b5f4b",
  textTransform: "uppercase",
  marginBottom: 6,
};

const detailValueStyle = {
  color: "#1f2933",
  lineHeight: 1.5,
};

const videoGridStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const videoCardStyle = {
  border: "1px solid #eee2d3",
  borderRadius: 14,
  background: "#fff",
  overflow: "hidden",
  padding: 0,
  textAlign: "left",
  cursor: "pointer",
};

const videoThumbStyle = {
  width: "100%",
  aspectRatio: "9 / 14",
  background: "#111827",
  backgroundSize: "cover",
  backgroundPosition: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
};

const videoPlayStyle = {
  fontSize: 36,
  opacity: 0.86,
};

const videoInfoStyle = {
  display: "grid",
  gap: 6,
  padding: 14,
};
