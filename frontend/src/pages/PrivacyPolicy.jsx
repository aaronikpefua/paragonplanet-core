import { useNavigate } from "react-router-dom";

const collectedData = [
  "Account details such as name, email address, phone number, role, country, state, and profile information.",
  "Content you upload, including videos, images, product listings, comments, messages, and other activity inside the platform.",
  "Marketplace and wallet activity, including product purchases, payment status, transaction references, and reward records.",
  "Device and usage information such as pages viewed, app interactions, security logs, and approximate technical information needed to protect the platform.",
];

const dataUses = [
  "Create and manage user accounts and role profiles.",
  "Show talent videos, marketplace products, meet-up requests, messages, rankings, votes, and other platform features.",
  "Process purchases, wallet records, rewards, subscriptions, product delivery, and payment verification.",
  "Protect users, prevent fraud, enforce platform rules, investigate abuse, and improve security.",
  "Improve Paragon Planet features, performance, content discovery, and user experience.",
  "Comply with legal, payment, security, and platform review requirements.",
];

const sharingRules = [
  "We do not sell personal information.",
  "We may share required information with trusted service providers that help operate the platform, including Firebase, Google Cloud, Cloudflare, payment processors, analytics, crash reporting, and security tools.",
  "We may share information when required by law, payment verification, safety investigations, fraud prevention, or platform policy enforcement.",
  "Public profile names, roles, public videos, marketplace listings, scores, and approved public activity may be visible to other users according to the platform feature being used.",
];

const userChoices = [
  "You may update your profile information through your account pages.",
  "You may request account deletion or data review by contacting Paragon Planet support.",
  "You may choose what content to upload and what profile information to provide, subject to required account and role fields.",
  "You may manage payment methods through the relevant payment provider, such as Google Play or other authorized billing systems.",
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
          Go Back
        </button>
        <p style={eyebrowStyle}>Privacy Policy</p>
        <h1 style={titleStyle}>Paragon Planet Privacy Policy</h1>
        <p style={leadStyle}>
          This Privacy Policy explains how Paragon Planet collects, uses, protects, and shares
          information when people use our website, app, marketplace, messaging, video, meet-up,
          wallet, and role registration features.
        </p>
        <p style={metaStyle}>Effective date: May 23, 2026</p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Information We Collect</h2>
        <List items={collectedData} />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>How We Use Information</h2>
        <List items={dataUses} />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Payments And Purchases</h2>
        <p style={bodyTextStyle}>
          Paragon Planet may support payments through approved providers such as Google Billing,
          Paystack, and other authorized payment systems. Payment providers may collect and process
          information needed to complete transactions, prevent fraud, verify purchases, manage
          refunds, and comply with financial rules. Paragon Planet stores only the information needed
          to verify purchases, unlock products, record wallet activity, and maintain transaction
          history.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>How Information Is Shared</h2>
        <List items={sharingRules} />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Messages And Public Content</h2>
        <p style={bodyTextStyle}>
          Some activity on Paragon Planet is public or visible to selected users, including public
          videos, public profile names, marketplace listings, role information, scores, comments,
          meet-up request status, and other content you choose to share. Direct messages are intended
          for the selected conversation participants, but they may be reviewed when needed for safety,
          abuse reports, fraud prevention, legal compliance, or platform rule enforcement.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Security</h2>
        <p style={bodyTextStyle}>
          We use technical and administrative measures to help protect user information, including
          authentication, database rules, secure backend services, cloud storage controls, and access
          restrictions. No internet platform can guarantee perfect security, so users should keep
          login details private and report suspicious activity quickly.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Children And Young Users</h2>
        <p style={bodyTextStyle}>
          Paragon Planet is intended for users who meet the required age and consent rules in their
          country. Where parental or guardian consent is required by law, the user must obtain that
          consent before using the platform.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Your Choices</h2>
        <List items={userChoices} />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Data Retention</h2>
        <p style={bodyTextStyle}>
          We keep information for as long as needed to provide the service, maintain records, protect
          users, resolve disputes, enforce rules, verify payments, and comply with legal obligations.
          Some records may remain after account deletion when required for security, payment,
          anti-fraud, or legal reasons.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Contact</h2>
        <p style={bodyTextStyle}>
          For privacy questions, data requests, or account support, contact Paragon Planet at{" "}
          <a href="mailto:natureswaypro2@gmail.com" style={linkStyle}>
            natureswaypro2@gmail.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function List({ items }) {
  return (
    <ul style={listStyle}>
      {items.map((item) => (
        <li key={item} style={listItemStyle}>
          {item}
        </li>
      ))}
    </ul>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 56px",
  background: "#f7f3ea",
  color: "#0b1b33",
};

const heroStyle = {
  maxWidth: 1040,
  margin: "0 auto 22px",
};

const backButtonStyle = {
  border: "none",
  borderRadius: 8,
  background: "#1f2933",
  color: "#fff",
  fontWeight: 800,
  padding: "11px 16px",
  cursor: "pointer",
  marginBottom: 24,
};

const eyebrowStyle = {
  margin: "0 0 8px",
  color: "#6b5f4b",
  fontSize: 13,
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "0 0 14px",
  fontSize: "clamp(34px, 5vw, 56px)",
  lineHeight: 1.04,
};

const leadStyle = {
  maxWidth: 900,
  margin: 0,
  fontSize: 18,
  lineHeight: 1.7,
  color: "#233142",
};

const metaStyle = {
  margin: "16px 0 0",
  color: "#6b5f4b",
  fontWeight: 700,
};

const sectionStyle = {
  maxWidth: 1040,
  margin: "18px auto",
  padding: 24,
  border: "1px solid #e2d8c8",
  borderRadius: 10,
  background: "#fffdf8",
  boxShadow: "0 12px 28px rgba(31, 41, 51, 0.06)",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 26,
};

const bodyTextStyle = {
  margin: 0,
  color: "#233142",
  fontSize: 17,
  lineHeight: 1.75,
};

const listStyle = {
  margin: 0,
  paddingLeft: 22,
  display: "grid",
  gap: 10,
};

const listItemStyle = {
  color: "#233142",
  fontSize: 17,
  lineHeight: 1.65,
};

const linkStyle = {
  color: "#0b4f9c",
  fontWeight: 800,
};
