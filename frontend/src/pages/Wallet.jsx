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

  /* =========================
     LOAD WALLET + TRANSACTIONS
  ========================= */

  const loadWallet = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const walletRef = doc(db, "wallet_accounts", user.uid);
      const walletSnap = await getDoc(walletRef);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  /* =========================
     LISTEN FOR DEPOSIT CONFIRMATION
     (Using ledger_entries instead of transactions)
  ========================= */

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get("reference");
    const user = auth.currentUser;

    if (!reference || !user) return;

    setShowProgress(true);

    const q = query(
      collection(db, "ledger_entries"),
      where("accountId", "==", user.uid),
      where("direction", "==", "credit"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setProgressStatus("success");

        setTimeout(async () => {
          await loadWallet();
          setShowProgress(false);
          window.history.replaceState({}, document.title, "/wallet");
        }, 1500);
      }
    });

    return () => unsubscribe();
  }, [location.search]);

  /* =========================
     CONVERSION
  ========================= */

  const convertForward = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setConverting(true);
      const token = await user.getIdToken();

      const res = await fetch(`${API_URL}/convert/parag-to-gbazilo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadWallet();
    } catch (error) {
      alert(error.message);
    } finally {
      setConverting(false);
    }
  };

  const convertReverse = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      setConverting(true);
      const token = await user.getIdToken();

      const res = await fetch(`${API_URL}/convert/gbazilo-to-parag`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadWallet();
    } catch (error) {
      alert(error.message);
    } finally {
      setConverting(false);
    }
  };

  /* =========================
     DEPOSIT
  ========================= */

  const handleDeposit = async () => {
    if (!amount || amount < 100) {
      return alert("Minimum deposit is ₦100");
    }

    try {
      setProcessing(true);

      const user = auth.currentUser;
      const token = await user.getIdToken();

      const res = await fetch(`${API_URL}/deposit/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.location.href = data.authorization_url;
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <p>Loading wallet...</p>;

  const availableParag = balance?.balances?.parag || 0;
  const availableGbazilo = balance?.balances?.gbazilo || 0;

  return (
    <div style={{ padding: 30, maxWidth: 1000, margin: "auto" }}>

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
                  width:
                    progressStatus === "waiting" ? "70%" : "100%",
                  background:
                    progressStatus === "waiting"
                      ? "#3498db"
                      : "#2ecc71",
                }}
              />
            </div>

            <p style={{ marginTop: 15 }}>
              {progressStatus === "waiting"
                ? "We are confirming your transfer..."
                : "Your wallet has been credited."}
            </p>
          </div>
        </div>
      )}

      <div style={balanceStyle}>
        <h2>Wallet Balance</h2>
        <h1>{availableParag} PARAG</h1>
        <h3>{availableGbazilo} GBAZILO</h3>
      </div>

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
    </div>
  );
}

/* =========================
   STYLES
========================= */

const balanceStyle = {
  background: "#111",
  color: "#fff",
  padding: 30,
  borderRadius: 12,
  marginBottom: 30,
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

const txStyle = {
  padding: 15,
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
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