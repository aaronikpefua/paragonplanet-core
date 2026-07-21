import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CitizenAboutContent from "./CitizenAboutContent";

const categories = [
  { name: "Dancers", category: "Dancer", emoji: "💃" },
  { name: "Instrumentalists", category: "Instrumentalist", emoji: "🎹" },
  { name: "Models", category: "Model", emoji: "👗" },
  { name: "Foodies", category: "Nutritionist", emoji: "🍔" },
  { name: "Stuntpersons", category: "Stunt Performer", emoji: "🤸" },
  { name: "Singers", category: "Singer", emoji: "🎤" },
  { name: "Debaters", category: "Debater", emoji: "🧠" },
  { name: "Comedians", category: "Comedian", emoji: "😂" },
  { name: "Artists", category: "Artist & Designer", emoji: "🎨" },
  { name: "Dramatizers", category: "Actor", emoji: "🎭" },
  { name: "Abilities (Disability)", category: "Special Ability", emoji: "♿" },
  { name: "Cultural Performers", category: "Cultural Performer", emoji: "🌍" }
];

export default function Categories() {
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  const handleClick = (category) => {
    navigate(`/?category=${encodeURIComponent(category)}`);
  };

  return (
    <div style={wrapperStyle}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>
      <h2 style={titleStyle}>The Citizen Contestants</h2>

      <button
        type="button"
        onClick={() => setShowAbout((value) => !value)}
        style={aboutButtonStyle}
      >
        {showAbout ? "Hide About Citizen Contestants" : "About Citizen Contestants"}
      </button>

      {showAbout && (
        <section style={aboutPanelStyle}>
          <CitizenAboutContent theme="dark" />
          <div style={expectationCardStyle}>
            <p style={aboutHighlightStyle}>
              Paragon Planet transforms talented individuals into recognized Stars through
              visibility, growth, competition, creativity, promotion, audience support, discipline,
              and recognition.
            </p>
            <p style={aboutTextStyle}>
              As contestants gain votes, recognition, performance scores, and public support, they
              unlock greater visibility, stronger rankings, unique identity colors, rewards, higher
              influence, and greater positions within the Planet.
            </p>
            <button
              type="button"
              onClick={() => navigate("/onboarding/citizen")}
              style={joinButtonStyle}
            >
              Join The Citizen Contestants
            </button>
          </div>
        </section>
      )}

      <h2 style={fieldPromptStyle}>
        Select a field of Talent to see Citizen Contestants in that field and watch their Performs.
      </h2>

      <div style={containerStyle}>
        {categories.map((cat, index) => (
          <div
            key={index}
            style={cardStyle}
            onClick={() => handleClick(cat.category)}
          >
            <div style={emojiStyle}>{cat.emoji}</div>
            <p style={textStyle}>{cat.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const wrapperStyle = {
  minHeight: "100vh",
  paddingTop: 80,
  background: "#000",
  color: "#fff"
};

const titleStyle = {
  paddingLeft: 12,
  margin: "18px 0 10px",
  fontSize: 28,
};

const fieldPromptStyle = {
  paddingLeft: 12,
  paddingRight: 12,
  margin: "8px 0 4px",
  fontSize: 24,
  lineHeight: 1.25,
};

const backButtonStyle = {
  margin: "12px 0 0 12px",
  padding: "10px 14px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700
};

const aboutButtonStyle = {
  margin: "0 0 14px 12px",
  padding: "10px 14px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const aboutPanelStyle = {
  margin: "0 12px 16px",
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  background: "linear-gradient(135deg, rgba(255, 205, 86, 0.12), rgba(93, 173, 226, 0.08)), #080808",
  border: "1px solid #222",
  borderRadius: 12,
};

const aboutTextStyle = {
  color: "#d9d4ca",
  lineHeight: 1.65,
};

const expectationCardStyle = {
  padding: 16,
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const aboutHighlightStyle = {
  margin: 0,
  padding: 12,
  borderRadius: 10,
  background: "#f3efe6",
  color: "#101828",
  fontWeight: 800,
  lineHeight: 1.45,
};

const joinButtonStyle = {
  marginTop: 14,
  width: "100%",
  padding: "12px 16px",
  borderRadius: 999,
  border: "none",
  background: "#f3efe6",
  color: "#101828",
  fontWeight: 900,
  cursor: "pointer",
};

const containerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 12,
  padding: 12
};

const cardStyle = {
  background: "#111",
  borderRadius: 12,
  height: 100,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#fff",
  transition: "0.2s",
  border: "1px solid #222"
};

const emojiStyle = {
  fontSize: 28,
  marginBottom: 6
};

const textStyle = {
  fontSize: 13,
  textAlign: "center"
};
