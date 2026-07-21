import { Suspense, useEffect, useState } from "react";
import { AuthProvider } from "../auth/AuthContext";

import AppRoutes from "../routes/AppRouter";
import Header from "../components/Header";
import Menu from "../components/Menu";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenMenu = () => setMenuOpen(true);
    window.addEventListener("open-global-menu", handleOpenMenu);
    return () => window.removeEventListener("open-global-menu", handleOpenMenu);
  }, []);

  return (
    <AuthProvider>
      <Header onToggleMenu={() => setMenuOpen(true)} />
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div
        style={{
          minHeight: "100vh",
          height: "auto",
          overflowX: "hidden",
          overflowY: "visible",
          background: "#f7f3ea",
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              ⏳ Loading...
            </div>
          }
        >
          <AppRoutes />
        </Suspense>
      </div>
    </AuthProvider>
  );
}
