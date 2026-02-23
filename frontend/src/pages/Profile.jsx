import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    const loadProfile = async () => {
      try {
        // Check promoter first
        const promoterSnap = await getDoc(
          doc(db, "promoter_profiles", user.uid)
        );

        if (promoterSnap.exists()) {
          setProfile(promoterSnap.data());
          setRole("PROMOTER");
          setChecking(false);
          return;
        }

        // Check citizen
        const citizenSnap = await getDoc(
          doc(db, "citizen_profiles", user.uid)
        );

        if (citizenSnap.exists()) {
          setProfile(citizenSnap.data());
          setRole("CITIZEN");
          setChecking(false);
          return;
        }

        // No profile exists
        navigate("/roles");

      } catch (err) {
        console.error("Profile error:", err);
      } finally {
        setChecking(false);
      }
    };

    loadProfile();
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return <div style={{ padding: 30 }}>Loading profile...</div>;
  }

  if (!profile) {
    return <div style={{ padding: 30 }}>Redirecting...</div>;
  }

  return (
    <div style={{ padding: 30 }}>
      <h2>{role} Profile</h2>

      {Object.entries(profile).map(([key, value]) => (
        <div key={key}>
          <strong>{key}:</strong>{" "}
          {Array.isArray(value)
            ? value.join(", ")
            : typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value)}
        </div>
      ))}
    </div>
  );
}