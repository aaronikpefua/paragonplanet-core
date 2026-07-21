import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import AmbassadorAboutContent from "../components/AmbassadorAboutContent";

const TALENT_CATEGORIES = [
  { name: "Cultural Performer", emoji: "🌍" },
  { name: "Special Talent", emoji: "⭐" },
  { name: "Dancer", emoji: "💃" },
  { name: "Instrumentalist", emoji: "🎹" },
  { name: "Model", emoji: "👗" },
  { name: "Foodier", emoji: "🍔" },
  { name: "Stunt Performer", emoji: "🤸" },
  { name: "Singer", emoji: "🎤" },
  { name: "Debater", emoji: "🧠" },
  { name: "Comedian", emoji: "😂" },
  { name: "Artist & Designer", emoji: "🎨" },
  { name: "Actor", emoji: "🎭" },
];

export default function AmbassadorTalentDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedTalent = searchParams.get("talent") || "";
  const [ambassadors, setAmbassadors] = useState([]);
  const [citizenCounts, setCitizenCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const loadAmbassadors = async () => {
      if (!selectedTalent) {
        setAmbassadors([]);
        setCitizenCounts({});
        return;
      }

      setLoading(true);
      try {
        const [ambassadorSnapshot, citizenSnapshot] = await Promise.all([
          getDocs(collection(db, "promoter_profiles")),
          getDocs(collection(db, "citizen_profiles")),
        ]);

        const matchingAmbassadors = ambassadorSnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() }))
          .filter((ambassador) => hasTalentCategory(ambassador, selectedTalent));

        const citizenSets = {};
        citizenSnapshot.docs.forEach((docSnap) => {
          const citizen = docSnap.data();
          const ambassadorIds = [
            citizen.primaryPromoterId,
            citizen.invitedByPromoterId,
            citizen.promoterId,
          ].filter(Boolean);

          ambassadorIds.forEach((ambassadorId) => {
            if (!citizenSets[ambassadorId]) {
              citizenSets[ambassadorId] = new Set();
            }
            citizenSets[ambassadorId].add(docSnap.id);
          });
        });

        const counts = Object.fromEntries(
          Object.entries(citizenSets).map(([ambassadorId, citizenSet]) => [
            ambassadorId,
            citizenSet.size,
          ])
        );

        setCitizenCounts(counts);
        setAmbassadors(
          matchingAmbassadors.sort(
            (a, b) => (counts[b.uid] || 0) - (counts[a.uid] || 0)
          )
        );
      } catch (error) {
        console.error("Ambassador talent directory could not load:", error);
        setAmbassadors([]);
        setCitizenCounts({});
      } finally {
        setLoading(false);
      }
    };

    loadAmbassadors();
  }, [selectedTalent]);

  const selectedTitle = useMemo(
    () => TALENT_CATEGORIES.find((talent) => talent.name === selectedTalent)?.name || selectedTalent,
    [selectedTalent]
  );

  const openTalent = (talent) => {
    navigate(`?talent=${encodeURIComponent(talent)}`);
  };

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Paragon Ambassadors</p>
          <h1 style={titleStyle}>Paragon Ambassadors</h1>
          <p style={subtitleStyle}>The Talent Ambassadors</p>
          <p style={mutedStyle}>
            Choose a talent category to see Ambassadors on that line and how many citizens came through each Ambassador.
          </p>
        </div>
        <div style={buttonRowStyle}>
          <button type="button" onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            Go Back
          </button>
          {selectedTalent && (
            <button type="button" onClick={() => navigate(location.pathname)} style={secondaryButtonStyle}>
              Categories
            </button>
          )}
        </div>
      </section>

      <section style={aboutToggleWrapStyle}>
        <button
          type="button"
          onClick={() => setShowAbout((value) => !value)}
          style={secondaryButtonStyle}
        >
          {showAbout ? "Hide About Ambassadors" : "About Ambassadors"}
        </button>
      </section>

      {showAbout && (
        <section style={aboutPanelStyle}>
          <AmbassadorAboutContent
            theme="dark"
            footer={
              <button
                type="button"
                onClick={() => navigate("/onboarding/promoter")}
                style={joinButtonStyle}
              >
                Join The Paragon Ambassadors
              </button>
            }
          />
        </section>
      )}

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Ambassador Talent Categories</h2>
        <div style={categoryGridStyle}>
          {TALENT_CATEGORIES.map((talent) => (
            <button
              key={talent.name}
              type="button"
              onClick={() => openTalent(talent.name)}
              style={categoryButtonStyle(talent.name === selectedTalent)}
            >
              <span style={symbolStyle}>{talent.emoji}</span>
              <span style={categoryNameStyle}>{talent.name}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedTalent && (
        <section style={panelStyle}>
          <div style={resultHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{selectedTitle}</p>
              <h2 style={sectionTitleStyle}>Ambassadors in {selectedTitle}</h2>
            </div>
            <span style={countBadgeStyle}>{ambassadors.length} found</span>
          </div>

          {loading ? (
            <p style={mutedStyle}>Loading Ambassadors...</p>
          ) : ambassadors.length === 0 ? (
            <p style={mutedStyle}>No Ambassadors found in this talent category yet.</p>
          ) : (
            <div style={ambassadorGridStyle}>
              {ambassadors.map((ambassador, index) => (
                <article key={ambassador.id} style={ambassadorCardStyle}>
                  <div>
                    <span style={rankStyle}>#{index + 1}</span>
                    <h3 style={ambassadorNameStyle}>{getAmbassadorName(ambassador)}</h3>
                    <p style={mutedStyle}>{formatTalentCategories(ambassador)}</p>
                    <p style={mediumTextStyle}>{formatPromotionMediums(ambassador)}</p>
                  </div>
                  <div style={scoreBoxStyle}>
                    <span style={scoreLabelStyle}>Citizens</span>
                    <strong style={scoreValueStyle}>{citizenCounts[ambassador.uid] || 0}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function hasTalentCategory(ambassador, talent) {
  const wanted = normalize(talent);
  const categories = [
    ...(Array.isArray(ambassador.talentCategories) ? ambassador.talentCategories : []),
    ...(Array.isArray(ambassador.promoterTypes) ? ambassador.promoterTypes : []),
  ];

  return categories.some((item) => normalize(item) === wanted);
}

function getAmbassadorName(ambassador) {
  return ambassador.brandName || ambassador.stageName || ambassador.realName || ambassador.email || "Ambassador";
}

function formatTalentCategories(ambassador) {
  const categories = ambassador.talentCategories || ambassador.promoterTypes || [];
  return categories.length ? categories.join(", ") : "Talent category not listed";
}

function formatPromotionMediums(ambassador) {
  const mediums = ambassador.promotionMediums || ambassador.subFields || [];
  return mediums.length ? mediums.join(", ") : "Promotion mediums not listed";
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#000",
  color: "#fff",
};

const heroStyle = {
  maxWidth: 1120,
  margin: "0 auto 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const buttonRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const panelStyle = {
  maxWidth: 1120,
  margin: "0 auto 22px",
  padding: 22,
  background: "#080808",
  border: "1px solid #222",
  borderRadius: 12,
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
};

const aboutToggleWrapStyle = {
  maxWidth: 1120,
  margin: "0 auto 18px",
};

const aboutPanelStyle = {
  maxWidth: 1120,
  margin: "0 auto 22px",
  padding: 22,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
  background: "linear-gradient(135deg, rgba(255, 205, 86, 0.12), rgba(93, 173, 226, 0.08)), #080808",
  border: "1px solid #222",
  borderRadius: 12,
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
};

const eyebrowStyle = {
  margin: 0,
  color: "#c9b48a",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "6px 0 2px",
  fontSize: 38,
};

const subtitleStyle = {
  margin: "0 0 12px",
  fontSize: 20,
  color: "#f3efe6",
  fontWeight: 800,
};

const mutedStyle = {
  color: "#d9d4ca",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 24,
};

const categoryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const categoryButtonStyle = (active) => ({
  minHeight: 112,
  padding: "16px 14px",
  borderRadius: 12,
  border: `1px solid ${active ? "#c9b48a" : "#222"}`,
  background: active ? "#1f2933" : "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: active ? "0 0 0 1px rgba(201, 180, 138, 0.25)" : "none",
});

const symbolStyle = {
  fontSize: 30,
  lineHeight: 1,
};

const categoryNameStyle = {
  fontSize: 14,
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 18,
};

const countBadgeStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#1f2933",
  color: "#fff",
  fontWeight: 800,
};

const ambassadorGridStyle = {
  display: "grid",
  gap: 12,
};

const ambassadorCardStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  alignItems: "center",
  padding: 16,
  border: "1px solid #222",
  borderRadius: 10,
  background: "#111",
};

const rankStyle = {
  color: "#c9b48a",
  fontWeight: 800,
  fontSize: 13,
};

const ambassadorNameStyle = {
  margin: "4px 0",
  fontSize: 20,
};

const mediumTextStyle = {
  color: "#f3efe6",
  marginBottom: 0,
};

const scoreBoxStyle = {
  minWidth: 92,
  padding: 12,
  borderRadius: 10,
  background: "#f3efe6",
  color: "#101828",
  textAlign: "center",
};

const scoreLabelStyle = {
  display: "block",
  fontSize: 12,
  opacity: 0.82,
};

const scoreValueStyle = {
  fontSize: 28,
};

const secondaryButtonStyle = {
  padding: "10px 16px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const joinButtonStyle = {
  marginTop: 18,
  width: "min(420px, 100%)",
  padding: "12px 16px",
  borderRadius: 999,
  border: "none",
  background: "#f3efe6",
  color: "#101828",
  fontWeight: 900,
  cursor: "pointer",
};
