import { useNavigate } from "react-router-dom";

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <main style={{ padding: 20 }}>
      <h2>Select Your Role</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        
        <button onClick={() => navigate("/onboarding/citizen")}>
          Become a Citizen
        </button>

        <button onClick={() => navigate("/onboarding/promoter")}>
          Become a Promoter
        </button>

        {/* Phase 2 Roles */}
        <button disabled>Become a Backer</button>
        <button disabled>Become a Supernal</button>
        <button disabled>Become a Sponsor / Investor</button>

      </div>
    </main>
  );
}