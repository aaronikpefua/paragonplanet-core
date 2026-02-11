// src/routes/RequireAuth.jsx
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      const profileRef = doc(db, "citizen_profiles", firebaseUser.uid);
      const profileSnap = await getDoc(profileRef);

      setHasProfile(profileSnap.exists());
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user && !hasProfile) {
    return <Navigate to="/onboarding/citizen" replace />;
  }

  return children;
}
