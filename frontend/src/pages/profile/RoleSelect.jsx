import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import {
  ACCOUNT_ROLES,
  getStoredActiveRole,
  loadAccountRoles,
  setStoredActiveRole,
} from "../../lib/activeRole";

export default function RoleSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const step = new URLSearchParams(location.search).get("step");
  const isEarnStep = step === "earn";
  const [accountRoles, setAccountRoles] = useState([]);
  const [activeRole, setActiveRole] = useState(getStoredActiveRole());
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    const loadRoles = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingRoles(false);
        return;
      }

      const roles = await loadAccountRoles(db, user.uid);
      setAccountRoles(roles);
      setLoadingRoles(false);
    };

    loadRoles();
  }, []);

  const chooseRole = (roleKey) => {
    setStoredActiveRole(roleKey);
    setActiveRole(roleKey);
    navigate("/profile", { replace: true });
  };

  const addRole = (path, roleKey) => {
    setStoredActiveRole(roleKey);
    navigate(path);
  };

  if (isEarnStep) {
    return (
      <main style={pageStyle}>
        <h2>Select Your Role To Earn</h2>
        <p style={{ marginTop: 8, marginBottom: 18 }}>
          On The Way To Become Paragon Star In:
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 15 }}>
          <button style={btn} onClick={() => addRole("/onboarding/citizen", "CITIZEN")}>
            Citizen
          </button>

          <button style={btn} onClick={() => addRole("/onboarding/promoter", "PROMOTER")}>
            Ambassador
          </button>

          <button style={btn} onClick={() => addRole("/onboarding/merchant", "MERCHANT")}>
            Merchant
          </button>

          <button style={btn} onClick={() => addRole("/onboarding/backer", "BACKER")}>
            Backer
          </button>

          <button style={btn} onClick={() => addRole("/onboarding/supernal", "SUPERNAL")}>
            Superboss
          </button>

          <button style={btn} onClick={() => addRole("/onboarding/sponsor-investor", "SPONSOR_INVESTOR")}>
            Sponsor / Investor
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={profileBoxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Choose Active Role</h2>
        <p style={{ marginTop: 8, marginBottom: 18 }}>
          Select the role profile you want to work in now. Other roles stay separate.
        </p>

        {loadingRoles ? (
          <p>Loading roles...</p>
        ) : accountRoles.length === 0 ? (
          <p>No role profile has been created yet.</p>
        ) : (
          <div style={buttonGridStyle}>
            {accountRoles.map((role) => {
              const isActive = activeRole === role.key;
              return (
                <button
                  key={role.key}
                  style={isActive ? activeBtn : btn}
                  onClick={() => chooseRole(role.key)}
                >
                  {isActive ? "Active: " : "Work as "}
                  {role.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <button style={{ ...btn, width: "100%", marginBottom: 18 }} onClick={() => navigate("/users-about")}>
        About Paragon User
      </button>

      <section style={profileBoxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 14 }}>User Profile</h2>
        <div style={buttonGridStyle}>
          <button style={btn} onClick={() => navigate("/wallet")}>
            Wallet
          </button>
          <button style={btn} onClick={() => navigate("/meet-up")}>
            Meet-Up
          </button>
          <button style={btn} onClick={() => navigate("/onboarding/user")}>
            Edit Profile
          </button>
        </div>
      </section>

      <section style={profileBoxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Select Your Role To Earn</h2>
        <p style={{ marginTop: 8, marginBottom: 18 }}>
          Continue as a User or pick a role to earn on the way to Paragon Planet.
        </p>
        <div style={buttonGridStyle}>
          <button style={btn} onClick={() => navigate("/", { replace: true })}>
            Continue as User
          </button>
          <button style={btn} onClick={() => navigate("/roles?step=earn")}>
            Next
          </button>
        </div>
      </section>

      <section style={profileBoxStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Add Another Role</h2>
        <div style={buttonGridStyle}>
          {ACCOUNT_ROLES.filter((role) => role.key !== "SPONSOR_INVESTOR_LEGACY").map((role) => (
            <button
              key={role.key}
              style={btn}
              onClick={() => addRole(role.onboardingPath, role.key)}
            >
              Add {role.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

/* Styles */

const btn = {
  padding: "10px 16px",
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer"
};

const activeBtn = {
  ...btn,
  background: "#176b4d",
};

const buttonGridStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const profileBoxStyle = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  marginBottom: 22,
};

const pageStyle = {
  minHeight: "100vh",
  padding: "92px 20px 40px",
  boxSizing: "border-box",
};

