import { useEffect, useState } from "react";
import { auth, db } from "../../config/firebase";
import {
  collection,
  query,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

export default function PromoterApproval() {
  const [promoters, setPromoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);

  /* =========================
     LOAD PENDING AMBASSADORS
  ========================= */
  const loadPending = async () => {
    try {
      setLoading(true);

      const q = query(collection(db, "promoter_profiles"));

      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      setPromoters(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load ambassador applications.");
    } finally {
      setLoading(false);
    }
  };

  const pendingPromoters = promoters.filter(
    (promoter) => promoter.status === "PENDING_REVIEW"
  );
  const approvedPromoters = promoters.filter(
    (promoter) => promoter.status === "APPROVED"
  );
  const rejectedPromoters = promoters.filter(
    (promoter) => promoter.status === "REJECTED"
  );

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
        updatedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.email || "ADMIN"
      });

      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Failed to approve ambassador.");
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
        updatedAt: serverTimestamp(),
        rejectedBy: auth.currentUser?.email || "ADMIN"
      });

      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Failed to reject ambassador.");
    } finally {
      setProcessingId(null);
    }
  };

  const deletePromoter = async (id) => {
    if (!window.confirm("Delete this ambassador account profile?")) return;

    try {
      setProcessingId(id);
      await deleteDoc(doc(db, "promoter_profiles", id));
      await loadPending();
    } catch (err) {
      console.error(err);
      alert("Failed to delete ambassador account. Admin Firestore delete permission may still need to be added.");
    } finally {
      setProcessingId(null);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ marginTop: 20 }}>
      <h2>Ambassador Management</h2>
      <p style={{ color: "#666" }}>
        Pending: {pendingPromoters.length} | Approved: {approvedPromoters.length} | Rejected: {rejectedPromoters.length}
      </p>

      {loading && <p>Loading applications...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && promoters.length === 0 && (
        <p>No ambassador applications yet.</p>
      )}

      {pendingPromoters.length > 0 && (
        <h3 style={{ marginTop: 24 }}>Pending Review</h3>
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

          <p><b>Applicant:</b> {promoter.realName || "N/A"}</p>
          <p><b>Email:</b> {promoter.email || "N/A"}</p>
          <p><b>Phone:</b> {promoter.phone}</p>
          <p><b>Country:</b> {promoter.country}</p>
          <p><b>State:</b> {promoter.state}</p>
          <p><b>Declared Capacity:</b> {promoter.declaredCapacity}</p>
          <p><b>Stars for Citizens:</b> {promoter.citizenStarsForCapacity ?? 0}</p>
          <p><b>Status:</b> {promoter.status || "PENDING_REVIEW"}</p>

          <p>
            <b>Ambassador Types:</b>{" "}
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

            <button
              onClick={() => deletePromoter(promoter.id)}
              disabled={processingId === promoter.id}
              style={{
                background: "#b71c1c",
                color: "white",
                padding: "8px 14px",
                border: "none",
                borderRadius: 4,
                marginLeft: 10,
                cursor: "pointer"
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      ))}

      {approvedPromoters.length > 0 && (
        <h3 style={{ marginTop: 30 }}>Approved Ambassadors</h3>
      )}
      {approvedPromoters.map((promoter) => (
        <div
          key={promoter.id}
          style={{
            border: "1px solid #d7eadf",
            padding: 20,
            marginBottom: 20,
            borderRadius: 6,
            background: "#f4fbf6"
          }}
        >
          <h3>{promoter.brandName || "No Brand Name"}</h3>
          <p><b>Applicant:</b> {promoter.realName || "N/A"}</p>
          <p><b>Email:</b> {promoter.email || "N/A"}</p>
          <p><b>Status:</b> {promoter.status}</p>
          <p><b>Approved By:</b> {promoter.approvedBy || "ADMIN"}</p>
          <button
            onClick={() => deletePromoter(promoter.id)}
            disabled={processingId === promoter.id}
            style={{
              background: "#b71c1c",
              color: "white",
              padding: "8px 14px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Delete Account
          </button>
        </div>
      ))}

      {rejectedPromoters.length > 0 && (
        <h3 style={{ marginTop: 30 }}>Rejected Ambassadors</h3>
      )}
      {rejectedPromoters.map((promoter) => (
        <div
          key={promoter.id}
          style={{
            border: "1px solid #ddd",
            padding: 20,
            marginBottom: 20,
            borderRadius: 6,
            background: "#fff6f6"
          }}
        >
          <h3>{promoter.brandName || "No Brand Name"}</h3>

          <p><b>Applicant:</b> {promoter.realName || "N/A"}</p>
          <p><b>Email:</b> {promoter.email || "N/A"}</p>
          <p><b>Status:</b> {promoter.status}</p>
          <p><b>Rejected By:</b> {promoter.rejectedBy || "ADMIN"}</p>
          <button
            onClick={() => deletePromoter(promoter.id)}
            disabled={processingId === promoter.id}
            style={{
              background: "#b71c1c",
              color: "white",
              padding: "8px 14px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Delete Account
          </button>
        </div>
      ))}
    </div>
  );
}
