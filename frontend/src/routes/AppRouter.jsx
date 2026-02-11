import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { auth, db } from "../config/firebase";
import Header from "../components/Header";

// Public
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";

// Role & onboarding
import RoleSelect from "../pages/profile/RoleSelect";
import CitizenOnboarding from "../pages/onboarding/CitizenOnboarding";

// App
import Upload from "../pages/Upload";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";

export default function AppRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (u) {
        const ref = doc(db, "citizen_profiles", u.uid);
        const snap = await getDoc(ref);
        setHasProfile(snap.exists());
      } else {
        setHasProfile(false);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />

        {/* Role selection */}
        <Route
          path="/roles"
          element={user ? <RoleSelect /> : <Navigate to="/login" />}
        />

        {/* Citizen onboarding */}
        <Route
          path="/onboarding/citizen"
          element={user ? <CitizenOnboarding /> : <Navigate to="/login" />}
        />

        {/* Profile (only after onboarding) */}
        <Route
          path="/profile"
          element={
            user
              ? hasProfile
                ? <Profile />
                : <Navigate to="/roles" />
              : <Navigate to="/login" />
          }
        />

        {/* Upload */}
        <Route
          path="/upload"
          element={user ? <Upload /> : <Navigate to="/login" />}
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={user ? <Admin /> : <Navigate to="/login" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
