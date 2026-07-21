import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { API_URL, appCheckFetch } from "../lib/supportActions";

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openDepositParam = searchParams.get("deposit");
  const paymentReference = searchParams.get("reference");

  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const [amount, setAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");

  async function walletRequest(url, options = {}) {
    const firstResponse = await appCheckFetch(url, options);

    if (firstResponse.ok) {
      return firstResponse;
    }

    const firstPayload = await safeJson(firstResponse.clone());
    const firstError = String(firstPayload?.error || "").toLowerCase();
    const shouldRetryWithoutAppCheck =
      firstResponse.status === 401 &&
      (firstError.includes("app check") || firstError.includes("invalid app check"));

    if (!shouldRetryWithoutAppCheck) {
      return firstResponse;
    }

    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });
  }

  async function loadWallet() {

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
        ...doc.data()
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadWallet();
  }, []);

  useEffect(() => {
    if (!paymentReference) return;
    verifyDeposit(paymentReference);
  }, [paymentReference]);

  useEffect(() => {
    const shouldOpenDeposit =
      openDepositParam === "1" || openDepositParam === "true";

    if (shouldOpenDeposit) {
      setShowDeposit(true);
    }
  }, [openDepositParam]);

  async function loadBanks() {

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/signup");
        return;
      }

      const token = await user.getIdToken();

      const res = await walletRequest(API_URL + "/bank/list", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || "Could not load bank list");
      }

      setBanks(Array.isArray(data) ? data : []);
    } catch (error) {
      setBanks([]);
      alert(error.message || "Could not load bank list");
    }
  }

  async function verifyAccount() {

    if (!accountNumber || !selectedBank) {
      alert("Enter account number and select bank");
      return;
    }

    setVerifying(true);

    const user = auth.currentUser;
    const token = await user.getIdToken();

    const res = await walletRequest(API_URL + "/bank/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        accountNumber,
        bankCode: selectedBank
      })
    });

    const data = await safeJson(res);

    if (!res.ok) {
      alert(data.error);
      setVerifying(false);
      return;
    }

    setAccountName(data.accountName);
    setVerifying(false);
  }

  async function convertParagToGbazilo() {

    try {

      const user = auth.currentUser;
      const token = await user.getIdToken();

      setConverting(true);

      const res = await walletRequest(API_URL + "/convert/parag-to-gbazilo", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);

      if (!res.ok) {
        alert(data.error);
        setConverting(false);
        return;
      }

      await loadWallet();

    } catch {
      alert("Conversion failed");
    } finally {
      setConverting(false);
    }
  }

  async function convertGbaziloToParag() {

    try {

      const user = auth.currentUser;
      const token = await user.getIdToken();

      setConverting(true);

      const res = await walletRequest(API_URL + "/convert/gbazilo-to-parag", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);

      if (!res.ok) {
        alert(data.error);
        setConverting(false);
        return;
      }

      await loadWallet();

    } catch {
      alert("Conversion failed");
    } finally {
      setConverting(false);
    }
  }

  async function handleDeposit() {

    if (!amount || amount < 100) {
      alert("Minimum deposit is ₦100");
      return;
    }

    setProcessing(true);
    setDepositMessage("");

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/signup");
        return;
      }

      const token = await user.getIdToken();
      const res = await walletRequest(API_URL + "/deposit/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          amount: Number(amount)
        })
      });

      const data = await safeJson(res);

      if (!res.ok || !data.authorization_url) {
        throw new Error(data.error || "Deposit could not be initialized. Please try again.");
      }

      window.location.href = data.authorization_url;
    } catch (error) {
      setDepositMessage(error.message || "Deposit could not be initialized. Please try again.");
      setProcessing(false);
    }
  }

  async function verifyDeposit(reference) {
    setProcessing(true);
    setDepositMessage("Confirming your deposit...");

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate("/signup");
        return;
      }

      const token = await user.getIdToken();
      const res = await walletRequest(`${API_URL}/deposit/verify?reference=${encodeURIComponent(reference)}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });
      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data.error || "Deposit could not be confirmed yet.");
      }

      await loadWallet();
      setDepositMessage(
        data.alreadyProcessed
          ? "This deposit was already credited."
          : `${data.creditedParag} PARAG credited to your wallet.`
      );
      navigate("/wallet", { replace: true });
    } catch (error) {
      setDepositMessage(error.message || "Deposit could not be confirmed yet.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleWithdraw() {

    if (!withdrawAmount) {
      alert("Enter withdrawal amount");
      return;
    }

    const user = auth.currentUser;
    const token = await user.getIdToken();

    const res = await walletRequest(API_URL + "/withdraw/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        amount: Number(withdrawAmount),
        bankCode: selectedBank,
        accountNumber: accountNumber
      })
    });

    const data = await safeJson(res);

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Withdrawal request submitted");

    setShowWithdraw(false);
    setWithdrawAmount("");
    setAccountName("");
    setAccountNumber("");
    setSelectedBank("");

    loadWallet();
  }

  if (loading) {
    return <p>Loading wallet...</p>;
  }

  const parag = balance?.balances?.parag || 0;
  const gbazilo = balance?.balances?.gbazilo || 0;

  return (

    <div style={{ padding: 30, maxWidth: 900, margin: "auto" }}>

      <div style={balanceStyle}>
        <h2>Wallet Balance</h2>
        <h1>{parag} PARAG</h1>
        <h3>{gbazilo} GBAZILO</h3>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>

        <button style={btnStyle} onClick={convertParagToGbazilo} disabled={converting}>
          Convert PARAG → GBAZILO
        </button>

        <button style={btnStyle} onClick={convertGbaziloToParag} disabled={converting}>
          Convert GBAZILO → PARAG
        </button>

        <button
          style={btnStyle}
          onClick={() => {
            setShowDeposit(true);
          }}
        >
          Deposit
        </button>

        <button
          style={btnStyle}
          onClick={() => {
            setShowWithdraw(true);
            loadBanks();
          }}
        >
          Withdraw
        </button>

      </div>

      <h3 style={{ marginTop: 30 }}>Transaction History</h3>

      {transactions.map((tx) => {

        const date = tx.createdAt?.toDate?.();

        return (
          <div key={tx.id} style={txStyle}>
            <div>
              <strong>{tx.direction}</strong>
              <p>{tx.currency}</p>
              <p>{date ? date.toLocaleString() : ""}</p>
            </div>

            <div>
              {tx.direction === "credit" ? "+" : "-"}
              {tx.amount}
            </div>
          </div>
        );
      })}

      {showWithdraw && (

        <div style={overlayStyle}>
          <div style={modalStyle}>

            <h2>Withdraw Funds</h2>

            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select Bank</option>

              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}

            </select>

            <input
              type="text"
              placeholder="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              style={inputStyle}
            />

            <button style={btnStyle} onClick={verifyAccount}>
              {verifying ? "Verifying..." : "Verify Account"}
            </button>

            {accountName && (
              <div style={nameBox}>
                Account Name: {accountName}
              </div>
            )}

            {accountName && (
              <>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={inputStyle}
                />

                <button style={btnStyle} onClick={handleWithdraw}>
                  Submit Withdrawal
                </button>
              </>
            )}

            <button
              style={cancelStyle}
              onClick={() => setShowWithdraw(false)}
            >
              Cancel
            </button>

          </div>
        </div>

      )}

      {showDeposit && (

        <div style={overlayStyle}>
          <div style={modalStyle}>

            <h2>Deposit Funds</h2>

            {depositMessage && (
              <p style={helperTextStyle}>{depositMessage}</p>
            )}

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
            />

            <button style={btnStyle} onClick={handleDeposit} disabled={processing}>
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

      )}

    </div>
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

const balanceStyle = {
  background: "#111",
  color: "#fff",
  padding: 30,
  borderRadius: 12,
  marginBottom: 30
};

const txStyle = {
  padding: 15,
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between"
};

const btnStyle = {
  padding: "10px 20px",
  background: "#000",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  marginTop: 10
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
  alignItems: "center"
};

const modalStyle = {
  background: "#fff",
  padding: 30,
  borderRadius: 12,
  width: 400
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
  marginTop: 10
};

const nameBox = {
  marginTop: 10,
  padding: 10,
  background: "#f4f4f4",
  borderRadius: 6,
  fontWeight: "bold"
};

const cancelStyle = {
  marginTop: 10,
  padding: "10px 20px",
  background: "#ccc",
  border: "none",
  borderRadius: 8
};

const helperTextStyle = {
  color: "#52616b",
  lineHeight: 1.5
};



