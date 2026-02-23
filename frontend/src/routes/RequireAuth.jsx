// src/routes/RequireAuth.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 30 }}>Checking authentication...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}