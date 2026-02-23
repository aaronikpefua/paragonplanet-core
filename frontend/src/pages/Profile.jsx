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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve

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
          setLoading(false);
          return;
        }

        // Then check citizen
        const citizenSnap = await getDoc(
          doc(db, "citizen_profiles", user.uid)
        );

        if (citizenSnap.exists()) {
          setProfile(citizenSnap.data());
          setRole("CITIZEN");
          setLoading(false);
          return;
        }

        // No profile found → send to role selector
        navigate("/roles");

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return <p style={{ padding: 20 }}>Loading profile...</p>;
  }

  if (!profile) {
    return null;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{role} Profile</h2>

      {role === "PROMOTER" && (
        <>
          <p><b>Brand Name:</b> {profile.brandName}</p>
          <p><b>Real Name:</b> {profile.realName}</p>
          <p><b>Phone:</b> {profile.phone}</p>
          <p><b>Country:</b> {profile.country}</p>
          <p><b>State:</b> {profile.state}</p>
          <p><b>Declared Capacity:</b> {profile.declaredCapacity}</p>
          <p><b>Types:</b> {profile.promoterTypes?.join(", ")}</p>
          <p><b>Practice Areas:</b> {profile.subFields?.join(", ")}</p>
          <p><b>Status:</b> {profile.status}</p>
        </>
      )}

      {role === "CITIZEN" && (
        <>
          <p><b>Stage Name:</b> {profile.stageName}</p>
          <p><b>Real Name:</b> {profile.realName}</p>
          <p><b>Email:</b> {profile.email}</p>
          <p><b>Country:</b> {profile.country}</p>
          <p><b>State:</b> {profile.state}</p>
          <p><b>Talents:</b> {profile.talents?.join(", ")}</p>
        </>
      )}
    </div>
  );
}