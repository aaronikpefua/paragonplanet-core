// src/components/Header.jsx
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { useEffect, useState } from "react";

const ADMIN_EMAIL = "natureswaypro2@gmail.com";
const ADMIN_PHONE = "+2348146626688"; // future OTP-ready

export default function Header({ onToggleMenu }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/", { replace: true });
  };

  const isAdmin =
    user &&
    (user.email === ADMIN_EMAIL ||
      user.phoneNumber === ADMIN_PHONE);

  return (
    <header style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
      {/* HOME BUTTON */}
      <Link to="/" style={{ marginRight: 12 }}>
        🏠
      </Link>

      {/* LOGO */}
      <Link to="/">🌍 Paragon Planet</Link>

      {/* NAV */}
      <nav style={{ float: "right", display: "flex", gap: 10 }}>
        {user ? (
          <>
            <Link to="/upload">Upload</Link>
            <Link to="/profile">Profile</Link>

            {isAdmin && <Link to="/admin">Admin</Link>}

            <button onClick={handleSignOut}>Sign out</button>

            {/* MENU BUTTON */}
            <button onClick={onToggleMenu}>☰</button>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
