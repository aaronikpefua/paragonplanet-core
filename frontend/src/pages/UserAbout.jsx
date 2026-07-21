import { useNavigate } from "react-router-dom";

const USER_ALLOWANCES = [
  "Create and manage personal accounts",
  "Explore activities within the Planet ecosystem",
  "Watch and engage with talent contents",
  "Follow contestants and creators",
  "Vote for Citizens and participants",
  "Support talents and projects",
  "Participate in discussions and interactions",
  "Purchase approved digital products and services",
  "Connect with communities and supporters",
  "Earn rewards and engagement opportunities within the Platform",
];

const USER_ROLE_PATHS = [
  "Citizens",
  "Superbosses",
  "Ambassadors",
  "Backers",
  "Merchants",
  "Sponsors",
  "Investors",
];

const USER_EXPECTATIONS = [
  "Maintain respectful and ethical behavior",
  "Support positive engagement within the ecosystem",
  "Avoid fraudulent, abusive, or harmful activities",
  "Respect the rules, systems, and structures of the Platform",
  "Promote creativity, fairness, and healthy interactions",
  "Contribute positively to the growth of the Planet community",
];

export default function UserAbout() {
  const navigate = useNavigate();

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>

      <section style={aboutBoxStyle}>
        <h1 style={{ marginTop: 0 }}>About Users</h1>
        <p>
          Paragon Planet Users are the general participants, viewers, supporters, followers,
          voters, buyers, explorers, and community members within the Paragon Planet ecosystem.
        </p>
        <p>
          Users represent the foundation of the Planet and may participate in different activities,
          interactions, engagements, and opportunities across the Platform before choosing to
          evolve into specialized roles such as Citizens, Superbosses, Ambassadors, Backers,
          Merchants, Sponsors, or Investors.
        </p>

        <h2>Users are allowed to:</h2>
        <ul>
          {USER_ALLOWANCES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Users may grow into higher levels by qualifying or registering as:</h2>
        <ul>
          {USER_ROLE_PATHS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p>
          Within the Planet ecosystem, Users contribute to the visibility, growth, engagement,
          popularity, and expansion of talents, competitions, digital marketplaces, leadership
          systems, and community activities.
        </p>

        <h2>Users are expected to:</h2>
        <ul>
          {USER_EXPECTATIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p>
          Through participation, interaction, support, and engagement, Users become part of the
          evolving digital civilization of Paragon Planet where talents, leadership, knowledge,
          creativity, business, entertainment, and community systems operate together within one
          ecosystem.
        </p>
        <p>
          As Users grow within the Platform, they unlock greater visibility, opportunities,
          rewards, influence, participation levels, and access to broader activities within the
          Planet ecosystem.
        </p>

        <button type="button" onClick={() => navigate("/onboarding/user")} style={joinButtonStyle}>
          Join Users
        </button>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 20px 72px",
  maxWidth: 1080,
  margin: "0 auto",
  boxSizing: "border-box",
};

const aboutBoxStyle = {
  padding: 22,
  border: "1px solid #e6ddce",
  borderRadius: 10,
  background: "#fffdf8",
  color: "#111827",
  lineHeight: 1.65,
};

const backButtonStyle = {
  padding: "10px 14px",
  marginBottom: 18,
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const joinButtonStyle = {
  marginTop: 18,
  padding: "12px 18px",
  border: "none",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};
