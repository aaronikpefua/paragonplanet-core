import { useNavigate } from "react-router-dom";

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <main>
      <h2>Select Your Role</h2>

      <button onClick={() => navigate("/onboarding/citizen")}>
        Become a Citizen
      </button>

      <button disabled>Become a Backer</button>
      <button disabled>Become a Supernal</button>
      <button disabled>Become a Promoter</button>
      <button disabled>Become a Sponsor / Investor</button>
    </main>
  );
}
