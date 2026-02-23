import { BrowserRouter, Routes, Route } from "react-router-dom";

import Header from "../components/Header";

// Public pages
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";

// Auth / role flow
import RoleSelect from "../pages/profile/RoleSelect";
import RequireAuth from "./RequireAuth";

// Main app pages
import Upload from "../pages/Upload";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";

// Onboarding
import CitizenOnboarding from "../pages/onboarding/CitizenOnboarding";
import PromoterOnboarding from "../pages/onboarding/PromoterOnboarding";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected */}
        <Route
          path="/roles"
          element={
            <RequireAuth>
              <RoleSelect />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/citizen"
          element={
            <RequireAuth>
              <CitizenOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/promoter"
          element={
            <RequireAuth>
              <PromoterOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/upload"
          element={
            <RequireAuth>
              <Upload />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}