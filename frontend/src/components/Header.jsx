import { Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebase";
import { useEffect, useState } from "react";

export default function Header({ onToggleMenu }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(false);

      if (u) {
        u.getIdTokenResult()
          .then((token) => {
            setIsAdmin(token.claims?.admin === true || token.claims?.role === "admin");
          })
          .catch(() => setIsAdmin(false));
      }
    });
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/", { replace: true });
  };

  const isVideoRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/watch") ||
    location.pathname.startsWith("/autoplay");

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: isVideoRoute ? 58 : 60,
        boxSizing: "border-box",

        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px 0 8px",

        background: isVideoRoute
          ? "linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0))"
          : "rgba(0,0,0,0.3)",
        backdropFilter: isVideoRoute ? "none" : "blur(10px)",
        WebkitBackdropFilter: isVideoRoute ? "none" : "blur(10px)",

        zIndex: 1000,
      }}
    >

      {/* LEFT */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!isVideoRoute && (
          <Link to="/" style={{ fontSize: 20, color: "#fff" }}>
            🏠
          </Link>
        )}

        <Link
          to="/"
          style={brandLinkStyle}
          aria-label="Paragon Planet home"
        >
          <img src="/logo-v2.png" alt="Paragon Planet" style={brandLogoStyle} />
          <span style={brandTextStyle}>Paragon Planet</span>
        </Link>
      </div>

      {/* RIGHT */}
      <nav style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>

        {user ? (
          <>
            {/* ⬆️ Upload */}
            <Link to="/upload" title="Upload">
              <span style={{ fontSize: 20, color: "#fff" }}>⬆️</span>
            </Link>

            {/* 👤 Profile */}
            <Link to="/profile" title="Profile">
              <span style={{ fontSize: 20, color: "#fff" }}>👤</span>
            </Link>

            {/* 🛠 Admin */}
            {isAdmin && (
              <Link to="/admin" title="Admin">
                <span style={{ fontSize: 20, color: "#fff" }}>🛠</span>
              </Link>
            )}

            {/* 🚪 Logout */}
            <button
              onClick={handleSignOut}
              title="Sign out"
              style={{
                fontSize: 18,
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              🚪
            </button>

          </>
        ) : (
          <>
            <Link
              to="/login"
              style={{
                fontSize: 16,
                color: "#fff",
                textDecoration: "none"
              }}
            >
              🔑 Sign in
            </Link>
          </>
        )}

        {/* ☰ Menu - visible to everyone */}
        {!isVideoRoute && (
          <button
            onClick={onToggleMenu}
            title="Menu"
            style={{
              fontSize: 18,
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            ☰
          </button>
        )}
      </nav>
    </header>
  );
}

const brandLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#fff",
  textDecoration: "none",
  minWidth: 0,
};

const brandLogoStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  objectFit: "cover",
  objectPosition: "center",
  display: "block",
  boxShadow: "0 0 14px rgba(255, 205, 86, 0.45)",
};

const brandTextStyle = {
  fontWeight: "bold",
  color: "#fff",
  textShadow: "0 1px 8px rgba(0,0,0,0.45)",
};
