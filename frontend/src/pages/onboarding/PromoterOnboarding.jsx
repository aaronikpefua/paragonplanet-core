import { useState } from "react";
import { auth, db } from "../../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { savePublicProfile } from "../../lib/publicProfile";
import AmbassadorAboutContent from "../../components/AmbassadorAboutContent";

const PROMOTER_TYPES = [
  "Cultural Performer",
  "Special Talent",
  "Dancer",
  "Instrumentalist",
  "Model",
  "Foodier",
  "Stunt Performer",
  "Singer",
  "Debater",
  "Comedian",
  "Artist & Designer",
  "Actor",
];

const PROMOTION_MEDIUMS = [
  {
    name: "Social Media Promotion",
    description: "Using platforms like TikTok, Instagram, Facebook, X, Snapchat, and YouTube.",
  },
  {
    name: "Live Events & Concerts",
    description: "Promoting stars through concerts, festivals, shows, and stage appearances.",
  },
  {
    name: "Radio Promotion",
    description: "Using FM stations, interviews, jingles, and radio shout-outs.",
  },
  {
    name: "Television Promotion",
    description: "Featuring stars on TV programs, entertainment shows, and advertisements.",
  },
  {
    name: "Campus Tours",
    description: "Promoting stars in universities, polytechnics, and secondary school events.",
  },
  {
    name: "Street Campaigns",
    description: "Using banners, flyers, posters, branded vehicles, and hype teams.",
  },
  {
    name: "Digital Advertising",
    description: "Running online ads through Google, Meta, YouTube, and entertainment websites.",
  },
  {
    name: "Livestream & Virtual Shows",
    description: "Using live streaming, webinars, online concerts, and virtual fan interactions.",
  },
  {
    name: "Influencer Collaborations",
    description: "Partnering with influencers, bloggers, and creators to push visibility.",
  },
  {
    name: "Press, Media & Streaming Coverage",
    description: "Using blogs, magazines, newspapers, interviews, entertainment news platforms, Spotify, Audiomack, Apple Music, Boomplay, Twitch, and streaming platforms to increase visibility and audience reach.",
  },
  {
    name: "Fanbase & Community Promotion",
    description: "Building fan clubs, WhatsApp groups, Telegram channels, Discord servers, churches, mosques, community programs, and social gatherings to grow loyal supporters and audience engagement.",
  },
  {
    name: "Brand Partnership Campaigns",
    description: "Promoting stars through company sponsorships, ambassador deals, endorsements, and co-branding campaigns.",
  },
];

export default function PromoterOnboarding() {
  const navigate = useNavigate();

  const [brandName, setBrandName] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [capacity, setCapacity] = useState("");
  const [citizenStars, setCitizenStars] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSubfields, setSelectedSubfields] = useState([]);
  const [showAbout, setShowAbout] = useState(false);

  const handleTypeToggle = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleSubToggle = (sub) => {
    if (selectedSubfields.includes(sub)) {
      setSelectedSubfields(selectedSubfields.filter((s) => s !== sub));
    } else {
      setSelectedSubfields([...selectedSubfields, sub]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!brandName || !phone || capacity < 5) {
      alert("Complete required fields. Minimum capacity is 5.");
      return;
    }

    if (selectedTypes.length === 0) {
      alert("Select at least one talent category.");
      return;
    }

    if (selectedSubfields.length === 0) {
      alert("Select at least one promotion medium.");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Login first");
        navigate("/login");
        return;
      }

      const promoterData = {
        uid: user.uid,
        role: "PROMOTER",
        email: user.email || "",
        brandName,
        realName,
        phone,
        country,
        state,
        declaredCapacity: Number(capacity),
        citizenStarsForCapacity: citizenStars ? Number(citizenStars) : 0,
        promoterTypes: selectedTypes,
        subFields: selectedSubfields,
        talentCategories: selectedTypes,
        promotionMediums: selectedSubfields,
        citizensCount: 0,
        status: "PENDING_REVIEW",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "promoter_profiles", user.uid), promoterData);
      await savePublicProfile(user.uid, "Ambassador", promoterData);

      alert("Ambassador registration submitted.");
      navigate("/profile");

    } catch (error) {
      console.error(error);
      alert("Registration failed");
    }
  };

  return (
    <main style={pageStyle}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>
      <h2 style={titleStyle}>Ambassador Registration</h2>

      <div style={aboutToggleWrapStyle}>
        <button
          type="button"
          onClick={() => setShowAbout((value) => !value)}
          style={backButtonStyle}
        >
          {showAbout ? "Hide About Ambassadors" : "About Ambassadors"}
        </button>
      </div>

      {showAbout && (
        <section style={aboutBoxStyle}>
          <AmbassadorAboutContent />
        </section>
      )}

      <form onSubmit={handleSubmit}>

        <h3>Identity</h3>
        <div style={inputGridStyle}>
          <input
            type="text"
            placeholder="Stage / Brand Name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Real Name (optional)"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={inputStyle}
          />
        </div>

        <h3>How many stars do have to start for Citizen</h3>

        <input
          type="number"
          placeholder="Minimum 5 citizens"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
          style={inputStyle}
        />
        <p style={{ fontSize: 12 }}>Minimum: 5 citizens</p>

        <h3>Select the Talent Categories You Promote</h3>

        <div style={checkboxGridStyle}>
        {PROMOTER_TYPES.map((type) => (
          <div key={type}>
            <input
              type="checkbox"
              checked={selectedTypes.includes(type)}
              onChange={() => handleTypeToggle(type)}
            />
            <label> {type}</label>
          </div>
        ))}
        </div>

        <h3>Select the mediums you use to promote your stars.</h3>

        {PROMOTION_MEDIUMS.map((medium) => (
          <label key={medium.name} style={mediumOptionStyle}>
            <input
              type="checkbox"
              checked={selectedSubfields.includes(medium.name)}
              onChange={() => handleSubToggle(medium.name)}
            />
            <span>
              <strong>{medium.name}</strong>
              <small style={mediumDescriptionStyle}>{medium.description}</small>
            </span>
          </label>
        ))}

        <br />
        <button type="submit">Submit for Review</button>

      </form>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  maxWidth: 940,
  margin: "0 auto",
  padding: "96px 24px 56px",
  boxSizing: "border-box",
};

const titleStyle = {
  marginTop: 0,
};

const aboutBoxStyle = {
  maxWidth: 900,
  marginBottom: 24,
  padding: 20,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(31, 41, 51, 0.06)",
};

const backButtonStyle = {
  padding: "10px 14px",
  marginBottom: 16,
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const aboutToggleWrapStyle = {
  marginBottom: 16,
};

const inputGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  maxWidth: 760,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
};

const checkboxGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
  maxWidth: 820,
};

const mediumOptionStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  maxWidth: 760,
  marginBottom: 12,
  lineHeight: 1.35,
};

const mediumDescriptionStyle = {
  display: "block",
  marginTop: 3,
  color: "#52616b",
};
