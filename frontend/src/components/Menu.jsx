import { useNavigate } from "react-router-dom";

export default function Menu({ open, onClose }) {
  const navigate = useNavigate();

  if (!open) return null;

  const goTo = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <aside style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={closeBtnStyle}>
          Close
        </button>

        <nav style={navStyle}>
          <button onClick={() => goTo("/marketplace")} style={itemStyle}>
            <span style={itemTitleStyle}>Marketplace</span>
            <span style={itemSubtitleStyle}>Digital products from Paragon Merchants</span>
          </button>
          <button onClick={() => goTo("/show-performers")} style={itemStyle}>
            <span style={itemTitleStyle}>The Citizen Contestants</span>
            <span style={itemSubtitleStyle}>About Citizen Contestants</span>
          </button>
          <button onClick={() => goTo("/hero-workers")} style={itemStyle}>
            <span style={itemTitleStyle}>Paragon Superbosses</span>
            <span style={itemSubtitleStyle}>The Mentors</span>
          </button>
          <button onClick={() => goTo("/service-providers")} style={itemStyle}>
            <span style={itemTitleStyle}>Paragon Backers</span>
            <span style={itemSubtitleStyle}>The Service Providers for Backer Contestants</span>
          </button>
          <button onClick={() => goTo("/promote-talents")} style={itemStyle}>
            <span style={itemTitleStyle}>Paragon Ambassadors</span>
            <span style={itemSubtitleStyle}>The Talent Ambassadors</span>
          </button>
          <button onClick={() => goTo("/users-about")} style={itemStyle}>
            <span style={itemTitleStyle}>Paragon Users</span>
            <span style={itemSubtitleStyle}>Viewers, voters, buyers, and supporters</span>
          </button>
          <button onClick={() => goTo("/sponsors-investors")} style={itemStyle}>
            <span style={itemTitleStyle}>Paragon Sponsors / Investors</span>
            <span style={itemSubtitleStyle}>Partnerships, funding, and ecosystem support</span>
          </button>
          <button onClick={() => goTo("/about")} style={itemStyle}>
            <span style={itemTitleStyle}>About Paragon Planet</span>
            <span style={itemSubtitleStyle}>The app and reality system</span>
          </button>
          <button onClick={() => goTo("/privacy-policy")} style={itemStyle}>
            <span style={itemTitleStyle}>Privacy Policy</span>
            <span style={itemSubtitleStyle}>Data, safety, payments, and user rights</span>
          </button>
        </nav>
      </aside>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  zIndex: 2000,
};

const panelStyle = {
  position: "absolute",
  top: 0,
  right: 0,
  width: "min(320px, 86vw)",
  height: "100%",
  background:
    "radial-gradient(circle at 18% 12%, rgba(255, 205, 86, 0.22), transparent 30%), radial-gradient(circle at 86% 22%, rgba(93, 173, 226, 0.18), transparent 28%), radial-gradient(circle at 34% 88%, rgba(231, 76, 60, 0.12), transparent 32%), #fffdf8",
  borderLeft: "1px solid #e2d8c8",
  padding: 20,
  boxSizing: "border-box",
  boxShadow: "-16px 0 40px rgba(0,0,0,0.18)",
  overflowY: "auto",
};

const closeBtnStyle = {
  padding: "9px 12px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const navStyle = {
  display: "grid",
  gap: 10,
  marginTop: 24,
};

const itemStyle = {
  width: "100%",
  textAlign: "left",
  padding: "12px 10px",
  background: "rgba(255, 253, 248, 0.86)",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
  color: "#1f2933",
  display: "grid",
  gap: 3,
  boxShadow: "0 8px 18px rgba(31, 41, 51, 0.06)",
  backdropFilter: "blur(8px)",
};

const itemTitleStyle = {
  fontSize: 15,
  lineHeight: 1.2,
};

const itemSubtitleStyle = {
  fontSize: 12,
  lineHeight: 1.2,
  color: "#6b7280",
  fontWeight: 600,
};
