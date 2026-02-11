import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

const TALENTS = [
  "Cultural Performer",
  "Special Talent",
  "Dancer",
  "Instrumentalist",
  "Model",
  "Nutritionist",
  "Stunt Performer",
  "Singer",
  "Debater",
  "Comedian",
  "Artist & Designer",
  "Actor",
];

export default function CitizenOnboarding() {
  const navigate = useNavigate();

  // Identity
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [tribe, setTribe] = useState("");

  // Platform data
  const [selectedTalents, setSelectedTalents] = useState([]);
  const [promoterName, setPromoterName] = useState("");
  const [promoterLink, setPromoterLink] = useState("");

  const toggleTalent = (talent) => {
    setSelectedTalents((prev) =>
      prev.includes(talent)
        ? prev.filter((t) => t !== talent)
        : [...prev, talent]
    );
  };

  const handleSubmit = async () => {
    if (
      !displayName ||
      !fullName ||
      !phoneNumber ||
      !country ||
      !state ||
      !tribe
    ) {
      alert("All personal information fields are required");
      return;
    }

    if (selectedTalents.length === 0) {
      alert("Please select at least one talent");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Not authenticated");
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          role: "citizen",
          profileCompleted: true,
          citizenProfile: {
            displayName,
            fullName,
            phoneNumber,
            country,
            state,
            tribe,
            talents: selectedTalents,
            promoterName,
            promoterLink,
          },
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert("Citizen profile saved successfully");
      navigate("/profile");
    } catch (error) {
      console.error(error);
      alert("Failed to save citizen profile");
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px" }}>
      <h1>Citizen Registration</h1>

      <h3>Public Identity</h3>
      <input
        placeholder="Stage / Display Name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />

      <h3>Personal Information</h3>
      <input
        placeholder="Full Legal Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />

      <input
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />

      <input
        placeholder="Country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />

      <input
        placeholder="State"
        value={state}
        onChange={(e) => setState(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />

      <input
        placeholder="Tribe"
        value={tribe}
        onChange={(e) => setTribe(e.target.value)}
        style={{ display: "block", marginBottom: "20px", width: "320px" }}
      />

      <h3>Talents</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {TALENTS.map((talent) => (
          <label
            key={talent}
            style={{
              border: "1px solid #ccc",
              borderRadius: "20px",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selectedTalents.includes(talent)}
              onChange={() => toggleTalent(talent)}
              style={{ marginRight: "6px" }}
            />
            {talent}
          </label>
        ))}
      </div>

      <h3 style={{ marginTop: "24px" }}>Promoter (Optional)</h3>
      <input
        placeholder="Promoter Name"
        value={promoterName}
        onChange={(e) => setPromoterName(e.target.value)}
        style={{ display: "block", marginBottom: "10px", width: "320px" }}
      />
      <input
        placeholder="Promoter Link (optional)"
        value={promoterLink}
        onChange={(e) => setPromoterLink(e.target.value)}
        style={{ display: "block", marginBottom: "20px", width: "320px" }}
      />

      <button onClick={handleSubmit}>Continue</button>
    </div>
  );
}
