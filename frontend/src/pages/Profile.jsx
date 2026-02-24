import { useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
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
  const [promoters, setPromoters] = useState([]);
  const [showPromoters, setShowPromoters] = useState(false);
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

  /* ================= DELETE VIDEO ================= */
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

  /* ================= GENERATE INVITE LINK (PROMOTER) ================= */
  const generateInvite = async () => {
    const user = auth.currentUser;
    const code = Math.random().toString(36).substring(2, 10);

    await setDoc(doc(db, "invites", code), {
      promoterId: user.uid,
      createdAt: serverTimestamp(),
      active: true
    });

    const link = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    alert("Invite link copied:\n" + link);
  };

  /* ================= LOAD PROMOTERS (CITIZEN) ================= */
  const loadPromoters = async () => {
    const q = query(
      collection(db, "promoter_profiles"),
      where("status", "==", "APPROVED")
    );
    const snapshot = await getDocs(q);
    setPromoters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setShowPromoters(true);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!profile) return null;

  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "auto" }}>

      <div style={cardStyle}>
        <h1>{role} Profile</h1>
        <p style={{ color: "#777" }}>{profile.realName}</p>
      </div>

      <div style={cardStyle}>

        {/* ================= CITIZEN ================= */}
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
              <Button onClick={loadPromoters}>List Promoters</Button>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => window.location = `mailto:${auth.currentUser.email}`}>Email</Button>
              <Button onClick={() => window.open(`https://wa.me/${profile.phone}`)}>WhatsApp</Button>
            </ActionRow>
          </>
        )}

        {/* ================= PROMOTER ================= */}
        {role === "PROMOTER" && (
          <>
            <Info label="Brand Name" value={profile.brandName} />
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
            <Info label="Capacity" value={profile.declaredCapacity} />
            <Info label="Types" value={profile.promoterTypes?.join(", ")} />
            <Info label="Status" value={profile.status} />

            <ActionRow>
              <Button onClick={() => navigate("/edit-profile")}>Edit Profile</Button>
              <Button onClick={generateInvite}>Invite Star</Button>
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

      {/* PROMOTER LIST MODAL */}
      {showPromoters && (
        <div style={modalStyle}>
          <div style={modalCard}>
            <h3>Approved Promoters</h3>
            {promoters.map(p => (
              <div key={p.id} style={listItem}>
                {p.brandName} ({p.promoterTypes?.join(", ")})
              </div>
            ))}
            <Button onClick={() => setShowPromoters(false)}>Close</Button>
          </div>
        </div>
      )}

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

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const modalCard = {
  background: "white",
  padding: 30,
  borderRadius: 12,
  width: 400
};

const listItem = {
  padding: 10,
  borderBottom: "1px solid #eee"
};