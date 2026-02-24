import { useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      const promoterSnap = await getDoc(doc(db, "promoter_profiles", user.uid));
      if (promoterSnap.exists()) {
        setProfile(promoterSnap.data());
        setRole("PROMOTER");
        setLoading(false);
        return;
      }

      const citizenSnap = await getDoc(doc(db, "citizen_profiles", user.uid));
      if (citizenSnap.exists()) {
        setProfile(citizenSnap.data());
        setRole("CITIZEN");

        // Load citizen videos
        const q = query(
          collection(db, "videos"),
          where("uid", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        setLoading(false);
        return;
      }

      navigate("/roles");
    };

    loadProfile();
  }, [navigate]);

  /* ================= DELETE SINGLE VIDEO ================= */
  const deleteVideo = async (videoId) => {
    await deleteDoc(doc(db, "videos", videoId));
    setVideos(videos.filter(v => v.id !== videoId));
  };

  /* ================= DELETE ACCOUNT ================= */
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    const user = auth.currentUser;
    if (!user) return;

    if (role === "CITIZEN") {
      await deleteDoc(doc(db, "citizen_profiles", user.uid));
    } else {
      await deleteDoc(doc(db, "promoter_profiles", user.uid));
    }

    await deleteUser(user);
    navigate("/");
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!profile) return null;

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "auto" }}>

      {/* HEADER */}
      <div style={cardStyle}>
        <h1>{role} Profile</h1>
        <p style={{ color: "#777" }}>{profile.realName}</p>
      </div>

      {/* PROFILE DETAILS */}
      <div style={cardStyle}>

        {role === "CITIZEN" && (
          <>
            <Info label="Stage Name" value={profile.stageName} />
            <Info label="Real Name" value={profile.realName} />
            <Info label="Age" value={profile.age} />
            <Info label="Gender" value={profile.gender} />
            <Info label="Marital Status" value={profile.maritalStatus} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Tribe" value={profile.tribe} />
            <Info label="Residence" value={profile.residence} />
            <Info label="Profession" value={profile.profession} />
            <Info label="Talents" value={profile.talents?.join(", ")} />
            <Info label="Registration Type" value={profile.registrationType || "SELF"} />
            <Info label="Base Share" value={`${profile.baseCitizenShare || 50}%`} />

            <h3 style={{ marginTop: 30 }}>My Videos</h3>
            {videos.length === 0 && <p>No videos uploaded.</p>}
            {videos.map(video => (
              <div key={video.id} style={videoItem}>
                {video.title || "Untitled"}
                <button onClick={() => deleteVideo(video.id)} style={deleteBtn}>
                  Delete
                </button>
              </div>
            ))}

            <ActionRow>
              <Button onClick={() => navigate("/edit-profile")}>Edit Profile</Button>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => window.location = `mailto:${auth.currentUser.email}`}>Email</Button>
              <Button onClick={() => window.open(`https://wa.me/${profile.phone}`)}>WhatsApp</Button>
            </ActionRow>
          </>
        )}

        {role === "PROMOTER" && (
          <>
            <Info label="Brand Name" value={profile.brandName} />
            <Info label="Real Name" value={profile.realName} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Capacity" value={profile.declaredCapacity} />
            <Info label="Types" value={profile.promoterTypes?.join(", ")} />
            <Info label="Status" value={profile.status} />

            <ActionRow>
              <Button onClick={() => navigate("/edit-profile")}>Edit Profile</Button>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => window.location = `mailto:${auth.currentUser.email}`}>Email</Button>
              <Button onClick={() => window.open(`https://wa.me/${profile.phone}`)}>WhatsApp</Button>
            </ActionRow>
          </>
        )}

      </div>

      <button onClick={handleDeleteAccount} style={dangerBtn}>
        Delete Account
      </button>

    </div>
  );
}

/* COMPONENTS */

const Info = ({ label, value }) => (
  <div style={{ marginBottom: 12 }}>
    <strong>{label}:</strong> {value || "-"}
  </div>
);

const Button = ({ children, onClick }) => (
  <button onClick={onClick} style={buttonStyle}>
    {children}
  </button>
);

const ActionRow = ({ children }) => (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
    {children}
  </div>
);

/* STYLES */

const cardStyle = {
  background: "white",
  padding: 25,
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  marginBottom: 25
};

const buttonStyle = {
  padding: "10px 16px",
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer"
};

const dangerBtn = {
  background: "red",
  color: "white",
  padding: "12px 20px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer"
};

const videoItem = {
  display: "flex",
  justifyContent: "space-between",
  padding: 10,
  borderBottom: "1px solid #eee"
};

const deleteBtn = {
  background: "red",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  cursor: "pointer"
};