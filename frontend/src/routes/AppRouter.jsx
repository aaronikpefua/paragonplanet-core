import { BrowserRouter, Routes, Route } from "react-router-dom";

import Header from "../components/Header";

// Public pages
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";

// Invite handler
import InviteHandler from "../pages/invite/InviteHandler";

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

/* ✅ NEW IMPORTS */
import MerchantOnboarding from "../pages/MerchantOnboarding";
import UserOnboarding from "../pages/UserOnboarding";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Invite Link Route */}
        <Route path="/invite/:code" element={<InviteHandler />} />

        {/* ================= PROTECTED ================= */}
        <Route
          path="/roles"
          element={
            <RequireAuth>
              <RoleSelect />
            </RequireAuth>
          }
        />

        {/* Citizen */}
        <Route
          path="/onboarding/citizen"
          element={
            <RequireAuth>
              <CitizenOnboarding />
            </RequireAuth>
          }
        />

        {/* Promoter */}
        <Route
          path="/onboarding/promoter"
          element={
            <RequireAuth>
              <PromoterOnboarding />
            </RequireAuth>
          }
        />

        {/* ✅ NEW MERCHANT ROUTE */}
        <Route
          path="/onboarding/merchant"
          element={
            <RequireAuth>
              <MerchantOnboarding />
            </RequireAuth>
          }
        />

        {/* ✅ NEW USER ROUTE */}
        <Route
          path="/onboarding/user"
          element={
            <RequireAuth>
              <UserOnboarding />
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

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}