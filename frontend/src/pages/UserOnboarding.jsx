import { useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { savePublicProfile } from "../lib/publicProfile";

export default function UserOnboarding() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [form, setForm] = useState({
    realName: "",
    gender: "",
    phone: "",
    email: "",
    country: "",
    state: ""
  });
  const [showAboutUsers, setShowAboutUsers] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= SAVE PROFILE ================= */
  const handleSubmit = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Login first");
      navigate("/login");
      return;
    }

    if (!form.realName || !form.gender || !form.email || !form.country || !form.state) {
      alert("Real name, gender, email, country, and state are required");
      return;
    }

    try {
      const profileRef = doc(db, "user_profiles", currentUser.uid);
      const profileSnap = await getDoc(profileRef);

      const profileData = {
        ...form,
        uid: currentUser.uid,
        role: "USER",
        status: "active",
        updatedAt: serverTimestamp()
      };

      if (!profileSnap.exists()) {
        profileData.createdAt = serverTimestamp();
      }

      await setDoc(profileRef, profileData, { merge: true });
      await savePublicProfile(currentUser.uid, "User", profileData);

      alert("User profile saved successfully");
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error("User profile save failed:", err);
      alert(err.message);
    }
  };

  /* ================= DELETE ACCOUNT ================= */
  const deleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "user_profiles", user.uid));
    await deleteDoc(doc(db, "public_profiles", user.uid));
    await deleteUser(user);
    navigate("/");
  };

  return (
    <div style={container}>
      <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
        Go Back
      </button>
      <h2>User Registration</h2>

      <div style={cardStyle}>
        <button
          type="button"
          onClick={() => setShowAboutUsers((value) => !value)}
          style={btn}
        >
          {showAboutUsers ? "Hide About Users" : "About Users"}
        </button>

        {showAboutUsers && <AboutUsers />}
      </div>

      {Object.keys(form).map((key) => (
        <input
          key={key}
          name={key}
          placeholder={key + (key === "phone" ? " (optional)" : "")}
          value={form[key]}
          onChange={handleChange}
          style={input}
        />
      ))}

      <button onClick={handleSubmit} style={btn}>
        Save Profile
      </button>

      <button onClick={() => navigate("/wallet")} style={btn}>
        Wallet
      </button>

      <button onClick={deleteAccount} style={dangerBtn}>
        Delete Account
      </button>
    </div>
  );
}

function AboutUsers() {
  return (
    <div style={aboutBoxStyle}>
      <h2 style={{ marginTop: 0 }}>About Users</h2>
      <p>
        Paragon Planet Users are the general participants, viewers, supporters,
        followers, voters, buyers, explorers, and community members within the
        Paragon Planet ecosystem.
      </p>
      <p>
        Users represent the foundation of the Planet and may participate in different
        activities, interactions, engagements, and opportunities across the Platform
        before choosing to evolve into specialized roles such as Citizens, Superbosses,
        Ambassadors, Backers, Merchants, Sponsors, or Investors.
      </p>
      <p>Users are allowed to:</p>
      <ul>
        {USER_ALLOWANCES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Users may also choose to grow into higher levels of participation within the
        ecosystem by qualifying or registering as Citizens, Superbosses, Ambassadors,
        Backers, Merchants, Sponsors, or Investors.
      </p>
      <p>
        Within the Planet ecosystem, Users contribute to the visibility, growth,
        engagement, popularity, and expansion of talents, competitions, digital
        marketplaces, leadership systems, and community activities.
      </p>
      <p>Users are expected to:</p>
      <ul>
        {USER_EXPECTATIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Through participation, interaction, support, and engagement, Users become part
        of the evolving digital civilization of Paragon Planet where talents,
        leadership, knowledge, creativity, business, entertainment, and community
        systems operate together within one ecosystem.
      </p>
      <p>
        As Users grow within the Platform, they unlock greater visibility,
        opportunities, rewards, influence, participation levels, and access to broader
        activities within the Planet ecosystem.
      </p>
    </div>
  );
}

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
  "Earn rewards and engagement opportunities within the Platform"
];

const USER_EXPECTATIONS = [
  "Maintain respectful and ethical behavior",
  "Support positive engagement within the ecosystem",
  "Avoid fraudulent, abusive, or harmful activities",
  "Respect the rules, systems, and structures of the Platform",
  "Promote creativity, fairness, and healthy interactions",
  "Contribute positively to the growth of the Planet community"
];

const container = {
  minHeight: "100vh",
  padding: "96px 40px 56px",
  maxWidth: 600,
  margin: "auto",
  boxSizing: "border-box",
};
const cardStyle = {
  marginBottom: 18,
  padding: 18,
  border: "1px solid #e6ddce",
  borderRadius: 10,
  background: "#fffdf8",
};
const aboutBoxStyle = {
  marginTop: 16,
  color: "#1f2933",
  lineHeight: 1.6,
};
const input = { display: "block", marginBottom: 10, padding: 8, width: "100%" };
const btn = { padding: 10, marginTop: 10, background: "#111", color: "white", border: "none", borderRadius: 6 };
const dangerBtn = { ...btn, background: "red" };
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
