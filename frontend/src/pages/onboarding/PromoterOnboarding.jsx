import { useState } from "react";
import { auth, db } from "../../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const PROMOTER_TYPES = [
  "DJ",
  "MC",
  "Broadcaster",
  "Presenter",
  "Social Media Influencer",
  "Stars Manager / Director",
  "Band Owner",
  "Producer",
  "Other"
];

const TYPE_SUBFIELDS = {
  DJ: ["Club DJ", "Event DJ", "Radio DJ", "Wedding DJ"],
  MC: ["Event MC", "Wedding MC", "Concert MC"],
  Broadcaster: ["Radio", "TV", "Online Radio"],
  Presenter: ["TV Show", "Podcast", "YouTube Show"],
  "Social Media Influencer": ["Instagram", "TikTok", "YouTube", "Facebook"],
  "Stars Manager / Director": ["Talent Manager", "Artist Director"],
  "Band Owner": ["Live Band", "Church Band", "Concert Band"],
  Producer: ["Music Producer", "Video Producer", "Event Producer"],
  Other: ["Specify in profile"]
};

export default function PromoterOnboarding() {
  const navigate = useNavigate();

  const [brandName, setBrandName] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [capacity, setCapacity] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSubfields, setSelectedSubfields] = useState([]);

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
      alert("Select at least one promoter type.");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) return;

      await setDoc(doc(db, "promoter_profiles", user.uid), {
        uid: user.uid,
        role: "PROMOTER",
        brandName,
        realName,
        phone,
        country,
        state,
        declaredCapacity: Number(capacity),
        promoterTypes: selectedTypes,
        subFields: selectedSubfields,
        citizensCount: 0,
        status: "PENDING_REVIEW",
        createdAt: serverTimestamp()
      });

      alert("Promoter registration submitted.");
      navigate("/profile");

    } catch (error) {
      console.error(error);
      alert("Registration failed");
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h2>Promoter Registration</h2>

      <form onSubmit={handleSubmit}>

        <h3>Identity</h3>

        <input
          type="text"
          placeholder="Stage / Brand Name"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          required
        /><br /><br />

        <input
          type="text"
          placeholder="Real Name (optional)"
          value={realName}
          onChange={(e) => setRealName(e.target.value)}
        /><br /><br />

        <input
          type="text"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        /><br /><br />

        <input
          type="text"
          placeholder="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        /><br /><br />

        <input
          type="text"
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
        /><br /><br />

        <h3>Declared Capacity</h3>

        <input
          type="number"
          placeholder="Minimum 5 citizens"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
        <p style={{ fontSize: 12 }}>Minimum: 5 citizens</p>

        <h3>Type of Promoter</h3>

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

        <h3>Where Do You Practice?</h3>

        {selectedTypes.map((type) =>
          TYPE_SUBFIELDS[type]?.map((sub) => (
            <div key={sub}>
              <input
                type="checkbox"
                checked={selectedSubfields.includes(sub)}
                onChange={() => handleSubToggle(sub)}
              />
              <label> {sub}</label>
            </div>
          ))
        )}

        <br />
        <button type="submit">Submit for Review</button>

      </form>
    </div>
  );
}