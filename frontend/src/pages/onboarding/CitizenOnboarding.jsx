import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { savePublicProfile } from "../../lib/publicProfile";
import CitizenAboutContent from "../../components/CitizenAboutContent";

const TALENTS = [
  "Cultural Performer",
  "Special Body Styles",
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

export default function CitizenOnboarding() {

  const navigate = useNavigate();
  const [invitePromoterId] = useState(() =>
    typeof window === "undefined" ? null : localStorage.getItem("invitePromoterId")
  );
  const [inviteCode] = useState(() =>
    typeof window === "undefined" ? null : localStorage.getItem("inviteCode")
  );

  const [form, setForm] = useState({
    stageName: "",
    realName: "",
    age: "",
    gender: "",
    maritalStatus: "",
    profession: "",
    phone: "",
    country: "",
    state: "",
    tribe: "",
    residence: "",
    talents: [],
  });
  const [showAbout, setShowAbout] = useState(false);

  const toggleTalent = (talent) => {
    setForm((prev) => ({
      ...prev,
      talents: prev.talents.includes(talent)
        ? prev.talents.filter((t) => t !== talent)
        : [...prev.talents, talent],
    }));
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      alert("User not authenticated");
      return;
    }

    if (Number(form.age) < 18) {
      alert("Citizen must be 18 years or older");
      return;
    }

    try {
      const promoterSnap = invitePromoterId
        ? await getDoc(doc(db, "promoter_profiles", invitePromoterId))
        : null;
      const promoterData = promoterSnap?.exists() ? promoterSnap.data() : null;

      const citizenData = {

        uid: user.uid,
        email: user.email,

        role: "CITIZEN",

        // instantly active
        status: "active",

        warnings: 0,
        isBanned: false,

        ...form,

        registrationType: invitePromoterId ? "INVITED" : "SELF",
        baseCitizenShare: invitePromoterId ? 40 : 50,
        primaryPromoterId: invitePromoterId || null,
        primaryPromoterName: promoterData?.brandName || promoterData?.realName || "",
        inviteCode: inviteCode || null,
        invitedByPromoterId: invitePromoterId || null,
        invitedByPromoterName: promoterData?.brandName || promoterData?.realName || "",
        invitedAt: invitePromoterId ? serverTimestamp() : null,

        createdAt: serverTimestamp(),

      };

      /* =========================
         SAVE CITIZEN PROFILE
      ========================= */

      await setDoc(
        doc(db, "citizen_profiles", user.uid),
        citizenData
      );
      await savePublicProfile(user.uid, "Citizen", citizenData);

      /* =========================
         ENSURE WALLET EXISTS
      ========================= */

      await setDoc(
        doc(db, "wallet_accounts", user.uid),
        {
          role: "citizen",
          balances: {
            parag: 0,
            gbazilo: 0
          },
          lockedBalances: {
            parag: 0,
            gbazilo: 0
          },
          createdAt: serverTimestamp()
        },
        { merge: true }
      );

      /* =========================
         CLEAN INVITE
      ========================= */

      localStorage.removeItem("invitePromoterId");
      localStorage.removeItem("inviteCode");

      /* =========================
         SUCCESS REDIRECT
      ========================= */

      navigate("/profile");

    } catch (err) {

      console.error("Citizen registration error:", err);

      alert(err.message || "Failed to save profile");

    }
  };

  return (

    <form onSubmit={handleSubmit} style={pageStyle}>

      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>

      <h1 style={titleStyle}>Citizen Registration</h1>

      <div style={aboutToggleWrapStyle}>
        <button
          type="button"
          onClick={() => setShowAbout((value) => !value)}
          style={backButtonStyle}
        >
          {showAbout ? "Hide About Citizen Contestants" : "About Citizen Contestants"}
        </button>
      </div>

      {showAbout && (
        <section style={aboutBoxStyle}>
          <CitizenAboutContent />
          <p style={aboutTextStyle}>
            Paragon Planet transforms talented individuals into recognized Stars through
            visibility, growth, competition, creativity, promotion, audience support, discipline,
            and recognition.
          </p>
          <p style={aboutTextStyle}>
            As contestants gain votes, recognition, performance scores, and public support, they
            unlock greater visibility, stronger rankings, unique identity colors, rewards, higher
            influence, and greater positions within the Planet.
          </p>
        </section>
      )}

      {invitePromoterId && (
        <p style={{ color: "green" }}>
          You are registering via ambassador invite.
        </p>
      )}

      <h3>Basic Information</h3>

      <div style={inputGridStyle}>
      <input
        required
        placeholder="Stage / Display Name"
        onChange={(e) => setForm({ ...form, stageName: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="Real Full Name"
        onChange={(e) => setForm({ ...form, realName: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        type="number"
        placeholder="Age (18+)"
        onChange={(e) => setForm({ ...form, age: e.target.value })}
        style={inputStyle}
      />

      <select
        required
        onChange={(e) => setForm({ ...form, gender: e.target.value })}
        style={inputStyle}
      >
        <option value="">Select Gender</option>
        <option>Male</option>
        <option>Female</option>
        <option>Other</option>
      </select>

      <select
        required
        onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
        style={inputStyle}
      >
        <option value="">Marital Status</option>
        <option>Single</option>
        <option>Married</option>
        <option>Divorced</option>
      </select>

      <input
        required
        placeholder="Profession"
        onChange={(e) => setForm({ ...form, profession: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="Phone Number"
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="Country"
        onChange={(e) => setForm({ ...form, country: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="State"
        onChange={(e) => setForm({ ...form, state: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="Tribe"
        onChange={(e) => setForm({ ...form, tribe: e.target.value })}
        style={inputStyle}
      />

      <input
        required
        placeholder="Present Residence"
        onChange={(e) => setForm({ ...form, residence: e.target.value })}
        style={inputStyle}
      />
      </div>

      <h3>Talents</h3>

      <div style={checkboxGridStyle}>
        {TALENTS.map((t) => (
          <label key={t} style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.talents.includes(t)}
              onChange={() => toggleTalent(t)}
            />{" "}
            {t}
          </label>
        ))}
      </div>

      <br />
      <br />

      <button type="submit">Continue</button>

    </form>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 56px",
  boxSizing: "border-box",
};

const titleStyle = {
  marginTop: 0,
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

const aboutBoxStyle = {
  maxWidth: 1080,
  marginBottom: 22,
  padding: 20,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(31, 41, 51, 0.06)",
};

const aboutTextStyle = {
  lineHeight: 1.65,
  color: "#26384d",
};

const inputGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  maxWidth: 1180,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
};

const checkboxGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  maxWidth: 1180,
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};
