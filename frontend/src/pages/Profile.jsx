import { useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

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
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  /* =========================
     GENERATE INVITE LINK
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
     DELETE PROFILE (SOFT)
  ========================= */
  const handleDeleteAccount = async () => {
    alert(
      "Account deletion will go through admin process in next phase."
    );
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!profile) return <p style={{ padding: 20 }}>No profile found.</p>;

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

            {profile.status === "APPROVED" && (
              <button
                onClick={generateInvite}
                style={{
                  marginTop: 15,
                  padding: "8px 14px",
                  background: "black",
                  color: "white",
                  border: "none",
                  borderRadius: 6
                }}
              >
                Generate Invite Link
              </button>
            )}
          </>
        )}

        {role === "CITIZEN" && (
          <>
            <p><b>Stage Name:</b> {profile.stageName}</p>
            <p><b>Real Name:</b> {profile.realName}</p>
            <p><b>Country:</b> {profile.country}</p>
            <p><b>State:</b> {profile.state}</p>
            <p><b>Talents:</b> {profile.talents?.join(", ")}</p>
            <p><b>Profession:</b> {profile.profession}</p>

            <hr />

            <p><b>Registration Type:</b> {profile.registrationType}</p>
            <p><b>Base Share:</b> {profile.baseCitizenShare}%</p>

            {profile.registrationType === "INVITED" && (
              <p><b>Primary Promoter ID:</b> {profile.primaryPromoterId}</p>
            )}
          </>
        )}
      </div>

      <button
        onClick={handleDeleteAccount}
        style={{ background: "red", color: "white", padding: 8 }}
      >
        Delete Account
      </button>
    </div>
  );
}