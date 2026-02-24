import { useNavigate } from "react-router-dom";

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <main style={{ padding: 20 }}>
      <h2>Select Your Role</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 15 }}>

        {/* Core Roles */}
        <button style={btn} onClick={() => navigate("/onboarding/citizen")}>
          Become a Citizen
        </button>

        <button style={btn} onClick={() => navigate("/onboarding/promoter")}>
          Become a Promoter
        </button>

        <button style={btn} onClick={() => navigate("/onboarding/merchant")}>
          Become a Merchant
        </button>

        <button style={btn} onClick={() => navigate("/onboarding/user")}>
          Become a User
        </button>

        {/* Phase 2 Roles */}
        <button style={disabledBtn} disabled>
          Become a Backer
        </button>

        <button style={disabledBtn} disabled>
          Become a Supernal
        </button>

        <button style={disabledBtn} disabled>
          Become a Sponsor / Investor
        </button>

      </div>
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

const disabledBtn = {
  padding: "10px 16px",
  background: "#ccc",
  color: "#777",
  border: "none",
  borderRadius: 8,
  cursor: "not-allowed"
};