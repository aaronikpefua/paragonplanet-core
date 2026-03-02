import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { useLocation } from "react-router-dom";

const API_URL =
  "https://paragonplanet-api-849823064688.us-central1.run.app";

export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [converting, setConverting] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const [showProgress, setShowProgress] = useState(false);
  const [progressStatus, setProgressStatus] = useState("waiting");

  const location = useLocation();

  /* ================= LOAD WALLET ================= */

  const loadWallet = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const walletSnap = await getDoc(doc(db, "wallet_accounts", user.uid));
    if (walletSnap.exists()) {
      setBalance(walletSnap.data());
    }

    const txQuery = query(
      collection(db, "ledger_entries"),
      where("accountId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const txSnap = await getDocs(txQuery);

    setTransactions(
      txSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadWallet();
  }, []);

  /* ========== LISTEN FOR DEPOSIT CONFIRMATION ========== */

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get("reference");
    const user = auth.currentUser;

    if (!reference || !user) return;

    setShowProgress(true);

    const q = query(
      collection(db, "ledger_entries"),
      where("accountId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, () => {
      setProgressStatus("success");

      setTimeout(async () => {
        await loadWallet();
        setShowProgress(false);
        window.history.replaceState({}, document.title, "/wallet");
      }, 1500);
    });

    return () => unsubscribe();
  }, [location.search]);

  /* ================= CONVERT ================= */

  const convertForward = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setConverting(true);
    const token = await user.getIdToken();

    await fetch(`${API_URL}/convert/parag-to-gbazilo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    await loadWallet();
    setConverting(false);
  };

  const convertReverse = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setConverting(true);
    const token = await user.getIdToken();

    await fetch(`${API_URL}/convert/gbazilo-to-parag`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    await loadWallet();
    setConverting(false);
  };

  /* ================= DEPOSIT ================= */

  const handleDeposit = async () => {
    if (!amount || amount < 100) {
      return alert("Minimum deposit is ₦100");
    }

    const user = auth.currentUser;
    const token = await user.getIdToken();

    setProcessing(true);

    const res = await fetch(`${API_URL}/deposit/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: Number(amount) }),
    });

    const data = await res.json();
    window.location.href = data.authorization_url;
  };

  if (loading) return <p>Loading wallet...</p>;

  const availableParag = balance?.balances?.parag || 0;
  const availableGbazilo = balance?.balances?.gbazilo || 0;

  return (
    <div style={{ padding: 30, maxWidth: 1000, margin: "auto" }}>

      {/* PROGRESS MODAL */}
      {showProgress && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2>
              {progressStatus === "waiting"
                ? "Waiting for confirmation..."
                : "Deposit Successful 🎉"}
            </h2>

            <div style={progressContainer}>
              <div
                style={{
                  ...progressBar,
                  width: progressStatus === "waiting" ? "70%" : "100%",
                  background:
                    progressStatus === "waiting" ? "#3498db" : "#2ecc71",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* BALANCE */}
      <div style={balanceStyle}>
        <h2>Wallet Balance</h2>
        <h1>{availableParag} PARAG</h1>
        <h3>{availableGbazilo} GBAZILO</h3>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: "flex", gap: 15, marginBottom: 20 }}>
        <button style={btnStyle} onClick={convertForward}>
          Convert PARAG → GBAZILO
        </button>

        <button style={btnStyle} onClick={convertReverse}>
          Convert GBAZILO → PARAG
        </button>

        <button style={btnStyle} onClick={() => setShowDeposit(true)}>
          Deposit
        </button>
      </div>

      {/* TRANSACTIONS */}
      <h3>Transaction History</h3>

      {transactions.map((tx) => {
        const date = tx.createdAt?.toDate?.();

        return (
          <div key={tx.id} style={txStyle}>
            <div>
              <strong>{tx.direction?.toUpperCase()}</strong>
              <p style={{ fontSize: 12 }}>{tx.currency}</p>
              <p style={{ fontSize: 11, color: "#666" }}>
                {date ? date.toLocaleString() : "Processing..."}
              </p>
            </div>

            <div>
              {tx.direction === "credit" ? "+" : "-"}
              {tx.amount}
            </div>
          </div>
        );
      })}

      {/* DEPOSIT MODAL */}
      {showDeposit && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2>Deposit Funds</h2>

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
            />

            <div style={{ marginTop: 20 }}>
              <button style={btnStyle} onClick={handleDeposit}>
                {processing ? "Processing..." : "Proceed to Paystack"}
              </button>

              <button
                style={cancelStyle}
                onClick={() => setShowDeposit(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* STYLES */
const balanceStyle = {
  background: "#111",
  color: "#fff",
  padding: 30,
  borderRadius: 12,
  marginBottom: 30,
};

const txStyle = {
  padding: 15,
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
};

const btnStyle = {
  padding: "10px 20px",
  background: "#000",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle = {
  background: "#fff",
  padding: 30,
  borderRadius: 12,
  width: 400,
};

const progressContainer = {
  width: "100%",
  height: 10,
  background: "#ddd",
  borderRadius: 20,
  overflow: "hidden",
  marginTop: 20,
};

const progressBar = {
  height: "100%",
  transition: "all 0.6s ease",
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
};

const cancelStyle = {
  marginLeft: 10,
  padding: "10px 20px",
  background: "#ccc",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};