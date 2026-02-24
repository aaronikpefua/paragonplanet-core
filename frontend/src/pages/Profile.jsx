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
  const navigate = useNavigate();

  /* =========================
     LOAD PROFILE
  ========================= */
  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      const promoterSnap = await getDoc(
        doc(db, "promoter_profiles", user.uid)
      );

      if (promoterSnap.exists()) {
        setProfile(promoterSnap.data());
        setRole("PROMOTER");
        setLoading(false);
        return;
      }

      const citizenSnap = await getDoc(
        doc(db, "citizen_profiles", user.uid)
      );

      if (citizenSnap.exists()) {
        setProfile(citizenSnap.data());
        setRole("CITIZEN");
        setLoading(false);
        return;
      }

      // 🔥 NEW USER → redirect to role select
      navigate("/roles");
    };

    loadProfile();
  }, [navigate]);

  /* =========================
     GENERATE INVITE
  ========================= */
  const generateInvite = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const code = Math.random().toString(36).substring(2, 10);

    await setDoc(doc(db, "invites", code), {
      promoterId: user.uid,
      createdAt: serverTimestamp(),
      active: true
    });

    const inviteLink = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(inviteLink);
    alert("Invite link copied:\n" + inviteLink);
  };

  /* =========================
     DELETE ACCOUNT + VIDEOS
  ========================= */
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure? This will delete profile and all videos."
    );
    if (!confirmDelete) return;

    const user = auth.currentUser;
    if (!user) return;

    // Delete videos
    const q = query(
      collection(db, "videos"),
      where("uid", "==", user.uid)
    );

    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "videos", docSnap.id));
    }

    // Delete profile
    if (role === "PROMOTER") {
      await deleteDoc(doc(db, "promoter_profiles", user.uid));
    } else {
      await deleteDoc(doc(db, "citizen_profiles", user.uid));
    }

    await deleteUser(user);
    navigate("/");
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!profile) return null;

  return (
    <div style={{ padding: 30, maxWidth: 900 }}>
      <h2>{role} Profile</h2>

      <div
        style={{
          background: "#f4f4f4",
          padding: 20,
          borderRadius: 10,
          marginBottom: 20
        }}
      >
        {/* ================= PROMOTER ================= */}
        {role === "PROMOTER" && (
          <>
            <p><b>Brand Name:</b> {profile.brandName}</p>
            <p><b>Real Name:</b> {profile.realName}</p>
            <p><b>Phone:</b> {profile.phone}</p>
            <p><b>Country:</b> {profile.country}</p>
            <p><b>State:</b> {profile.state}</p>
            <p><b>Status:</b> {profile.status}</p>
            <p><b>Declared Capacity:</b> {profile.declaredCapacity}</p>
            <p><b>Types:</b> {profile.promoterTypes?.join(", ")}</p>
            <p><b>Practice Areas:</b> {profile.subFields?.join(", ")}</p>
            <p><b>Citizens Count:</b> {profile.citizensCount || 0}</p>

            {profile.status === "APPROVED" && (
              <button
                onClick={generateInvite}
                style={{
                  marginTop: 15,
                  padding: "8px 14px",
                  background: "black",
                  color: "white",
                  borderRadius: 6
                }}
              >
                Generate Invite Link
              </button>
            )}
          </>
        )}

        {/* ================= CITIZEN ================= */}
        {role === "CITIZEN" && (
          <>
            <p><b>Stage Name:</b> {profile.stageName}</p>
            <p><b>Real Name:</b> {profile.realName}</p>
            <p><b>Age:</b> {profile.age}</p>
            <p><b>Gender:</b> {profile.gender}</p>
            <p><b>Marital Status:</b> {profile.maritalStatus}</p>
            <p><b>Profession:</b> {profile.profession}</p>
            <p><b>Phone:</b> {profile.phone}</p>
            <p><b>Country:</b> {profile.country}</p>
            <p><b>State:</b> {profile.state}</p>
            <p><b>Tribe:</b> {profile.tribe}</p>
            <p><b>Residence:</b> {profile.residence}</p>
            <p><b>Talents:</b> {profile.talents?.join(", ")}</p>

            <hr />

            <p>
              <b>Registration Type:</b>{" "}
              {profile.registrationType || "SELF"}
            </p>

            <p>
              <b>Base Share:</b>{" "}
              {profile.baseCitizenShare || 50}%
            </p>

            {profile.registrationType === "INVITED" && (
              <p>
                <b>Primary Promoter ID:</b>{" "}
                {profile.primaryPromoterId}
              </p>
            )}
          </>
        )}
      </div>

      <button
        onClick={handleDeleteAccount}
        style={{
          background: "red",
          color: "white",
          padding: 10,
          borderRadius: 6
        }}
      >
        Delete Account
      </button>
    </div>
  );
}