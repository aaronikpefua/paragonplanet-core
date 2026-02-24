import { useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function MerchantOnboarding() {
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

  const [productUrl, setProductUrl] = useState("");
  const [products, setProducts] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= SAVE PROFILE ================= */
  const handleSubmit = async () => {
    if (!user) return;

    await setDoc(doc(db, "merchant_profiles", user.uid), {
      ...form,
      role: "MERCHANT",
      createdAt: serverTimestamp()
    });

    alert("Merchant profile created");
    navigate("/profile");
  };

  /* ================= UPLOAD PRODUCT ================= */
  const uploadProduct = async () => {
    if (!productUrl) return;

    const docRef = await addDoc(collection(db, "merchant_products"), {
      merchantId: user.uid,
      url: productUrl,
      createdAt: serverTimestamp()
    });

    setProducts([...products, { id: docRef.id, url: productUrl }]);
    setProductUrl("");
  };

  /* ================= DELETE PRODUCT ================= */
  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, "merchant_products", id));
    setProducts(products.filter(p => p.id !== id));
  };

  /* ================= DELETE ACCOUNT ================= */
  const deleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "merchant_profiles", user.uid));
    await deleteUser(user);
    navigate("/");
  };

  return (
    <div style={container}>
      <h2>Merchant Registration</h2>

      {Object.keys(form).map((key) => (
        <input
          key={key}
          name={key}
          placeholder={key}
          value={form[key]}
          onChange={handleChange}
          style={input}
        />
      ))}

      <button onClick={handleSubmit} style={btn}>Save Profile</button>

      <hr />

      <h3>Upload Art Product (Image/Video URL)</h3>

      <input
        placeholder="Paste image or video URL"
        value={productUrl}
        onChange={(e) => setProductUrl(e.target.value)}
        style={input}
      />
      <button onClick={uploadProduct} style={btn}>Upload</button>

      {products.map(p => (
        <div key={p.id} style={productItem}>
          {p.url}
          <button onClick={() => deleteProduct(p.id)} style={deleteBtn}>
            Delete
          </button>
        </div>
      ))}

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
const deleteBtn = { background: "red", color: "white", border: "none", padding: "5px 10px", borderRadius: 6 };
const productItem = { display: "flex", justifyContent: "space-between", marginTop: 10 };