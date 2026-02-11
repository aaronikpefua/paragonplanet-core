import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
    promoterName: "",
    promoterLink: "",
  });

  const toggleTalent = (talent) => {
    setForm((prev) => ({
      ...prev,
      talents: prev.talents.includes(talent)
        ? prev.talents.filter((t) => t !== talent)
        : [...prev.talents, talent],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // 🚨 THIS WAS MISSING

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
      await setDoc(doc(db, "citizen_profiles", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "Citizen",
        ...form,
        createdAt: serverTimestamp(),
      });

      // ✅ THIS WILL NOW WORK
      navigate("/profile");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20 }}>
      <h1>Citizen Registration</h1>

      <h3>Basic Information</h3>

      <input required placeholder="Stage / Display Name"
        onChange={(e) => setForm({ ...form, stageName: e.target.value })} />

      <input required placeholder="Real Full Name"
        onChange={(e) => setForm({ ...form, realName: e.target.value })} />

      <input required type="number" placeholder="Age (18+)"
        onChange={(e) => setForm({ ...form, age: e.target.value })} />

      <select required onChange={(e) => setForm({ ...form, gender: e.target.value })}>
        <option value="">Select Gender</option>
        <option>Male</option>
        <option>Female</option>
        <option>Other</option>
      </select>

      <select required onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
        <option value="">Marital Status</option>
        <option>Single</option>
        <option>Married</option>
        <option>Divorced</option>
      </select>

      <input required placeholder="Profession"
        onChange={(e) => setForm({ ...form, profession: e.target.value })} />

      <input required placeholder="Phone Number"
        onChange={(e) => setForm({ ...form, phone: e.target.value })} />

      <input required placeholder="Country"
        onChange={(e) => setForm({ ...form, country: e.target.value })} />

      <input required placeholder="State"
        onChange={(e) => setForm({ ...form, state: e.target.value })} />

      <input required placeholder="Tribe"
        onChange={(e) => setForm({ ...form, tribe: e.target.value })} />

      <input required placeholder="Present Residence"
        onChange={(e) => setForm({ ...form, residence: e.target.value })} />

      <h3>Talents</h3>
      {TALENTS.map((t) => (
        <label key={t} style={{ marginRight: 10 }}>
          <input type="checkbox" onChange={() => toggleTalent(t)} /> {t}
        </label>
      ))}

      <h3>Promoter (Optional)</h3>
      <input placeholder="Promoter Name"
        onChange={(e) => setForm({ ...form, promoterName: e.target.value })} />

      <input placeholder="Promoter Link"
        onChange={(e) => setForm({ ...form, promoterLink: e.target.value })} />

      <br /><br />
      <button type="submit">Continue</button>
    </form>
  );
}
