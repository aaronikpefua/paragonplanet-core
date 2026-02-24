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
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [promoters, setPromoters] = useState([]);
  const [showPromoterList, setShowPromoterList] = useState(false);
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
        setLoading(false);
        return;
      }

      navigate("/roles");
    };

    loadProfile();
  }, [navigate]);

  /* ================= DELETE VIDEOS ================= */
  const deleteMyVideos = async () => {
    const user = auth.currentUser;
    const q = query(collection(db, "videos"), where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    for (const video of snapshot.docs) {
      await deleteDoc(doc(db, "videos", video.id));
    }

    alert("All your videos deleted.");
  };

  /* ================= LOAD PROMOTERS ================= */
  const loadPromoters = async () => {
    const q = query(
      collection(db, "promoter_profiles"),
      where("status", "==", "APPROVED")
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setPromoters(list);
    setShowPromoterList(true);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!profile) return null;

  /* ================= UI ================= */
  return (
    <div style={{ padding: 40, maxWidth: 1000, margin: "auto" }}>
      
      {/* HEADER CARD */}
      <div style={cardStyle}>
        <h1 style={{ marginBottom: 5 }}>{role} Profile</h1>
        <p style={{ color: "#777" }}>
          {profile.realName}
        </p>
      </div>

      {/* MAIN CARD */}
      <div style={cardStyle}>

        {role === "CITIZEN" && (
          <>
            <Info label="Stage Name" value={profile.stageName} />
            <Info label="Profession" value={profile.profession} />
            <Info label="Talents" value={profile.talents?.join(", ")} />
            <Info label="Registration Type" value={profile.registrationType || "SELF"} />
            <Info label="Base Share" value={`${profile.baseCitizenShare || 50}%`} />

            <ActionRow>
              <Button onClick={deleteMyVideos}>Delete My Videos</Button>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => window.location = `mailto:${auth.currentUser.email}`}>Email</Button>
              <Button onClick={() => window.open(`https://wa.me/${profile.phone}`)}>WhatsApp</Button>
              <Button onClick={loadPromoters}>Invite Promoter</Button>
            </ActionRow>
          </>
        )}

        {role === "PROMOTER" && (
          <>
            <Info label="Brand Name" value={profile.brandName} />
            <Info label="Capacity" value={profile.declaredCapacity} />
            <Info label="Types" value={profile.promoterTypes?.join(", ")} />
            <Info label="Status" value={profile.status} />

            <ActionRow>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => window.location = `mailto:${auth.currentUser.email}`}>Email</Button>
              <Button onClick={() => window.open(`https://wa.me/${profile.phone}`)}>WhatsApp</Button>
            </ActionRow>
          </>
        )}
      </div>

      {/* PROMOTER LIST MODAL */}
      {showPromoterList && (
        <div style={modalStyle}>
          <div style={modalCard}>
            <h3>Select Promoter</h3>
            {promoters.map(p => (
              <div key={p.id} style={listItem}>
                {p.brandName} ({p.promoterTypes?.join(", ")})
              </div>
            ))}
            <Button onClick={() => setShowPromoterList(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= COMPONENTS ================= */

const Info = ({ label, value }) => (
  <div style={{ marginBottom: 15 }}>
    <strong>{label}:</strong> {value}
  </div>
);

const Button = ({ children, onClick }) => (
  <button onClick={onClick} style={{
    padding: "10px 16px",
    background: "#111",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer"
  }}>
    {children}
  </button>
);

const ActionRow = ({ children }) => (
  <div style={{
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 20
  }}>
    {children}
  </div>
);

const cardStyle = {
  background: "white",
  padding: 25,
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  marginBottom: 25
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