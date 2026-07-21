import { useEffect, useState } from "react";
import { auth } from "../../config/firebase";
import { API_URL, appCheckFetch } from "../../lib/supportActions";

export default function WithdrawalsAdmin() {

  const [withdrawals, setWithdrawals] = useState([]);

  async function loadWithdrawals() {

    try {

      const user = auth.currentUser;
      const token = await user.getIdToken();

      const res = await appCheckFetch(API_URL + "/admin/withdrawals", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await res.json();

      setWithdrawals(data);

    } catch (error) {

      console.error("Failed to load withdrawals", error);

    }

  }

  useEffect(() => {
    loadWithdrawals();
  }, []);

  async function approve(id) {

    const user = auth.currentUser;
    const token = await user.getIdToken();

    await appCheckFetch(API_URL + "/admin/withdraw/approve/" + id, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    loadWithdrawals();
  }

  async function reject(id) {

    const user = auth.currentUser;
    const token = await user.getIdToken();

    await appCheckFetch(API_URL + "/admin/withdraw/reject/" + id, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    loadWithdrawals();
  }

  return (

    <div>

      <h3>Pending Withdrawals</h3>

      {withdrawals.length === 0 && <p>No pending withdrawals</p>}

      {withdrawals.map((w) => (

        <div key={w.id} style={cardStyle}>

          <p><strong>User:</strong> {w.userId}</p>
          <p><strong>Amount:</strong> {w.amount} GBAZILO</p>
          <p><strong>Status:</strong> {w.status}</p>

          <button
            style={approveBtn}
            onClick={() => approve(w.id)}
          >
            Approve
          </button>

          <button
            style={rejectBtn}
            onClick={() => reject(w.id)}
          >
            Reject
          </button>

        </div>

      ))}

    </div>
  );
}

const cardStyle = {
  border: "1px solid #ddd",
  padding: 15,
  marginBottom: 10,
  borderRadius: 6
};

const approveBtn = {
  marginRight: 10,
  padding: "6px 12px",
  background: "green",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer"
};

const rejectBtn = {
  padding: "6px 12px",
  background: "red",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer"
};
