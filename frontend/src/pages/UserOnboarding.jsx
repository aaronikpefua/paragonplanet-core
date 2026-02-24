import { useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function UserOnboarding() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [form, setForm] = useState({
    realName: "",
    age: "",
    gender: "",
    maritalStatus: "",
    profession: "",
    phone: "",
    email: "",
    country: "",
    state: "",
    tribe: "",
    residence: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= SAVE PROFILE ================= */
  const handleSubmit = async () => {
    if (!user) return;

    await setDoc(doc(db, "user_profiles", user.uid), {
      ...form,
      role: "USER",
      createdAt: serverTimestamp()
    });

    alert("User profile created");
    navigate("/profile");
  };

  /* ================= DELETE ACCOUNT ================= */
  const deleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "user_profiles", user.uid));
    await deleteUser(user);
    navigate("/");
  };

  return (
    <div style={container}>
      <h2>User Registration</h2>

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

const container = { padding: 40, maxWidth: 600, margin: "auto" };
const input = { display: "block", marginBottom: 10, padding: 8, width: "100%" };
const btn = { padding: 10, marginTop: 10, background: "#111", color: "white", border: "none", borderRadius: 6 };
const dangerBtn = { ...btn, background: "red" };