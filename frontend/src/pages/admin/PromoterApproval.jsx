import { useEffect, useState } from "react";
import { auth, db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

export default function PromoterApproval() {
  const [pendingPromoters, setPendingPromoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);

  /* =========================
     LOAD PENDING PROMOTERS
  ========================= */
  const loadPending = async () => {
    try {
      setLoading(true);

      const q = query(
        collection(db, "promoter_profiles"),
        where("status", "==", "PENDING_REVIEW")
      );

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      setPendingPromoters(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load promoter applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  /* =========================
     APPROVE
  ========================= */
  const approve = async (id) => {
    try {
      setProcessingId(id);

      await updateDoc(doc(db, "promoter_profiles", id), {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.email || "ADMIN"
      });

      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Failed to approve promoter.");
    } finally {
      setProcessingId(null);
    }
  };

  /* =========================
     REJECT
  ========================= */
  const reject = async (id) => {
    try {
      setProcessingId(id);

      await updateDoc(doc(db, "promoter_profiles", id), {
        status: "REJECTED",
        rejectedAt: serverTimestamp(),
        rejectedBy: auth.currentUser?.email || "ADMIN"
      });

      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Failed to reject promoter.");
    } finally {
      setProcessingId(null);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ marginTop: 20 }}>
      <h2>Promoter Approval</h2>

      {loading && <p>Loading applications...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && pendingPromoters.length === 0 && (
        <p>No pending promoter applications.</p>
      )}

      {pendingPromoters.map((promoter) => (
        <div
          key={promoter.id}
          style={{
            border: "1px solid #ddd",
            padding: 20,
            marginBottom: 20,
            borderRadius: 6,
            background: "#fafafa"
          }}
        >
          <h3>{promoter.brandName || "No Brand Name"}</h3>

          <p><b>Email:</b> {promoter.email || "N/A"}</p>
          <p><b>Phone:</b> {promoter.phone}</p>
          <p><b>Country:</b> {promoter.country}</p>
          <p><b>State:</b> {promoter.state}</p>
          <p><b>Declared Capacity:</b> {promoter.declaredCapacity}</p>

          <p>
            <b>Promoter Types:</b>{" "}
            {promoter.promoterTypes?.length
              ? promoter.promoterTypes.join(", ")
              : "None"}
          </p>

          <p>
            <b>Practice Areas:</b>{" "}
            {promoter.subFields?.length
              ? promoter.subFields.join(", ")
              : "None"}
          </p>

          <div style={{ marginTop: 15 }}>
            <button
              onClick={() => approve(promoter.id)}
              disabled={processingId === promoter.id}
              style={{
                background: "green",
                color: "white",
                padding: "8px 14px",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              {processingId === promoter.id ? "Processing..." : "Approve"}
            </button>

            <button
              onClick={() => reject(promoter.id)}
              disabled={processingId === promoter.id}
              style={{
                background: "red",
                color: "white",
                padding: "8px 14px",
                border: "none",
                borderRadius: 4,
                marginLeft: 10,
                cursor: "pointer"
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}