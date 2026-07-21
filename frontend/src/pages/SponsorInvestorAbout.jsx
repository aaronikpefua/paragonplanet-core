import { useNavigate } from "react-router-dom";

const SPONSOR_INVESTOR_PURPOSES = [
  "Talent Sponsorship",
  "Contest Sponsorship",
  "Brand Promotion",
  "Event Partnerships",
  "Product Advertising",
  "Marketplace Promotion",
  "Creator Development",
  "Platform Expansion",
  "Sector-Based Investments",
  "Revenue Sharing Partnerships",
  "Strategic Collaborations",
  "Audience Engagement Campaigns",
];

const SPONSOR_EXCHANGE_BENEFITS = [
  "Brand visibility",
  "Promotional opportunities",
  "Advertisement placements",
  "Audience engagement",
  "Product awareness",
  "Partnership recognition",
  "Event branding rights",
  "Campaign exposure within the Planet ecosystem",
];

const INVESTOR_FUNDING_AREAS = [
  "Talent growth and development",
  "Digital products and businesses",
  "Entertainment activities",
  "Technology systems",
  "Educational projects",
  "Media productions",
  "Marketplace systems",
  "Infrastructure expansion",
  "Ecosystem innovations",
  "Revenue-generating activities within the Platform",
];

const SPONSOR_INVESTOR_COLLABORATORS = [
  "Citizens",
  "Superbosses",
  "Ambassadors",
  "Backers",
  "Merchants",
  "Contest organizers",
  "Platform administrators",
  "Creative teams and project developers",
];

const SPONSOR_INVESTOR_EXPECTATIONS = [
  "Maintain ethical and professional relationships",
  "Respect the rules and standards of the Platform",
  "Support legitimate talents, projects, and opportunities",
  "Avoid fraudulent or exploitative activities",
  "Promote positive development within the ecosystem",
  "Encourage creativity, innovation, and healthy competition",
];

export default function SponsorInvestorAbout() {
  const navigate = useNavigate();

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>

      <section style={aboutBoxStyle}>
        <h1 style={{ marginTop: 0 }}>About Sponsors / Investors</h1>
        <p>
          Paragon Planet Sponsors and Investors are individuals, organizations, companies,
          institutions, brands, and strategic partners who support, finance, promote, invest in, or
          collaborate with activities, talents, contests, projects, and opportunities within the
          Paragon Planet ecosystem.
        </p>
        <p>
          Sponsors and Investors play a major role in the growth, visibility, development,
          empowerment, and expansion of the Planet by supporting Citizens, Superbosses, Ambassadors,
          Backers, Merchants, events, competitions, digital products, and ecosystem activities.
        </p>

        <h2>Sponsors and Investors may operate within the Platform for purposes such as:</h2>
        <ul>
          {SPONSOR_INVESTOR_PURPOSES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Sponsors may support talents, contests, or ecosystem activities in exchange for:</h2>
        <ul>
          {SPONSOR_EXCHANGE_BENEFITS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Investors may participate in funding opportunities connected to:</h2>
        <ul>
          {INVESTOR_FUNDING_AREAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Sponsors and Investors may collaborate directly with:</h2>
        <ul>
          {SPONSOR_INVESTOR_COLLABORATORS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p>
          The Sponsor and Investor system is designed to create opportunities for financial
          empowerment, strategic partnerships, business visibility, ecosystem expansion, and
          sustainable growth within Paragon Planet.
        </p>

        <h2>Sponsors and Investors are expected to:</h2>
        <ul>
          {SPONSOR_INVESTOR_EXPECTATIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p>
          As Sponsors and Investors participate within the ecosystem, they gain access to broader
          visibility, strategic influence, partnership opportunities, audience reach, marketplace
          exposure, promotional advantages, and long-term collaborative benefits within Paragon
          Planet.
        </p>

        <button
          type="button"
          onClick={() => navigate("/onboarding/sponsor-investor")}
          style={joinButtonStyle}
        >
          Join as Sponsor / Investor
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
