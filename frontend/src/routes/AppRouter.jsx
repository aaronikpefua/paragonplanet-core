import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

/* ================= VIDEO MODES ================= */
import Explore from "../components/Explore";
import Categories from "../components/Categories";
import Watch from "../pages/Watch";
import Autoplay from "../pages/Autoplay";

/* ================= PUBLIC ================= */
import Home from "../pages/Home";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import InviteHandler from "../pages/invite/InviteHandler";

/* ================= AUTH ================= */
import RoleSelect from "../pages/profile/RoleSelect";
import RequireAuth from "./RequireAuth";

/* ================= MAIN ================= */
import Upload from "../pages/Upload";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";
import Wallet from "../pages/Wallet";
import MerchantMarketplace from "../pages/MerchantMarketplace";
import BuyerInbox from "../pages/BuyerInbox";
import SharedInbox from "../pages/SharedInbox";
import Following from "../pages/Following";
import MemberProfile from "../pages/MemberProfile";
import RequestMeetUp from "../pages/RequestMeetUp";
import MeetUpSession from "../pages/MeetUpSession";
import MeetUpDirectory from "../pages/MeetUpDirectory";
import ServiceFieldDirectory from "../pages/ServiceFieldDirectory";
import AmbassadorTalentDirectory from "../pages/AmbassadorTalentDirectory";
import AboutParagonPlanet from "../pages/AboutParagonPlanet";
import SponsorInvestorAbout from "../pages/SponsorInvestorAbout";
import UserAbout from "../pages/UserAbout";
import PrivacyPolicy from "../pages/PrivacyPolicy";

/* ================= ONBOARDING ================= */
import CitizenOnboarding from "../pages/onboarding/CitizenOnboarding";
import PromoterOnboarding from "../pages/onboarding/PromoterOnboarding";
import BackerOnboarding from "../pages/onboarding/BackerOnboarding";
import SupernalOnboarding from "../pages/onboarding/SupernalOnboarding";
import SponsorInvestorOnboarding from "../pages/onboarding/SponsorInvestorOnboarding";
import MerchantOnboarding from "../pages/MerchantOnboarding";
import UserOnboarding from "../pages/UserOnboarding";

export default function AppRouter() {
  const location = useLocation();

  const isVideoRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/watch") ||
    location.pathname.startsWith("/autoplay");

  useEffect(() => {
    if (!isVideoRoute) {
      document.documentElement.style.overflowY = "auto";
      document.body.style.overflowY = "auto";
      document.body.style.height = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } else {
      document.documentElement.style.overflowY = "hidden";
      document.body.style.overflowY = "hidden";
      document.body.style.height = "100dvh";
    }

    return () => {
      document.documentElement.style.overflowY = "auto";
      document.body.style.overflowY = "auto";
      document.body.style.height = "auto";
    };
  }, [location.pathname, isVideoRoute]);

  return (
    <div style={isVideoRoute ? videoRouteStyle : normalRouteStyle}>
      <Routes>
        <Route path="/" element={<Explore />} />
        <Route path="/show-performers" element={<Categories />} />
        <Route path="/hero-workers" element={<ServiceFieldDirectory type="supernal" />} />
        <Route path="/service-providers" element={<ServiceFieldDirectory type="backer" />} />
        <Route path="/promote-talents" element={<AmbassadorTalentDirectory />} />
        <Route path="/about" element={<AboutParagonPlanet />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/sponsors-investors" element={<SponsorInvestorAbout />} />
        <Route path="/users-about" element={<UserAbout />} />

        <Route path="/watch/:id" element={<Watch />} />
        <Route path="/autoplay" element={<Autoplay />} />

        <Route path="/home" element={<Home />} />
        <Route path="/marketplace" element={<MerchantMarketplace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/invite/:code" element={<InviteHandler />} />

        <Route
          path="/inbox"
          element={
            <RequireAuth>
              <SharedInbox />
            </RequireAuth>
          }
        />

        <Route
          path="/buyer-inbox"
          element={
            <RequireAuth>
              <BuyerInbox />
            </RequireAuth>
          }
        />

        <Route
          path="/following"
          element={
            <RequireAuth>
              <Following />
            </RequireAuth>
          }
        />

        <Route path="/member/:uid" element={<MemberProfile />} />
        <Route
          path="/meet-up"
          element={
            <RequireAuth>
              <MeetUpDirectory />
            </RequireAuth>
          }
        />
        <Route path="/meet-up/:uid" element={<RequestMeetUp />} />
        <Route
          path="/meet-up-session/:requestId"
          element={
            <RequireAuth>
              <MeetUpSession />
            </RequireAuth>
          }
        />

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
          path="/onboarding/merchant"
          element={
            <RequireAuth>
              <MerchantOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/user"
          element={
            <RequireAuth>
              <UserOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/backer"
          element={
            <RequireAuth>
              <BackerOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/supernal"
          element={
            <RequireAuth>
              <SupernalOnboarding />
            </RequireAuth>
          }
        />

        <Route
          path="/onboarding/sponsor-investor"
          element={
            <RequireAuth>
              <SponsorInvestorOnboarding />
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

        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <Wallet />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Explore />} />
      </Routes>
    </div>
  );
}

const videoRouteStyle = {
  width: "100%",
  height: "var(--pp-feed-height, 100dvh)",
  overflow: "hidden",
  background: "#000",
};

const normalRouteStyle = {
  width: "100%",
  minHeight: "100vh",
  height: "auto",
  overflowX: "hidden",
  overflowY: "visible",
  background: "#f7f3ea",
};
