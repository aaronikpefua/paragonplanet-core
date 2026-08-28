import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { API_URL, appCheckFetch } from "../lib/supportActions";

export default function PrivateVideoCall() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [calls, setCalls] = useState([]);
  const [provider, setProvider] = useState({ provider: "cloudflare-realtimekit", configured: false, recordingDefault: "OFF" });
  const [recipient, setRecipient] = useState({
    uid: params.get("recipient") || "",
    displayName: params.get("name") || "",
    username: params.get("name") || "",
    role: "",
    photoUrl: "",
  });
  const [selectedPlanId, setSelectedPlanId] = useState("quick");
  const [message, setMessage] = useState("Preparing private video calls...");
  const [loading, setLoading] = useState(false);
  const [joinResult, setJoinResult] = useState(null);
  const currentUid = auth.currentUser?.uid || "";

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || plans[0], [plans, selectedPlanId]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const uid = params.get("recipient") || "";
    if (!uid) return;
    let cancelled = false;
    loadRecipientProfile(uid, params.get("name") || "")
      .then((profile) => {
        if (!cancelled) setRecipient(profile);
      })
      .catch(() => {
        if (!cancelled) {
          setRecipient((current) => ({
            ...current,
            uid,
            displayName: params.get("name") || current.displayName || "Paragon Member",
            username: params.get("name") || current.username || "username",
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function authedFetch(path, options = {}) {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      throw new Error("Sign in first");
    }
    const token = await user.getIdToken();
    const response = await appCheckFetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
    return payload;
  }

  async function refresh() {
    setLoading(true);
    try {
      const [plansPayload, callsPayload] = await Promise.all([
        authedFetch("/api/realtime/plans"),
        authedFetch("/api/realtime/calls"),
      ]);
      setPlans(plansPayload.plans || []);
      setProvider(plansPayload.provider || provider);
      setCalls(callsPayload.calls || []);
      setSelectedPlanId((current) => current || plansPayload.plans?.[0]?.id || "quick");
      setMessage(recipient.uid ? "Choose a plan, then request the call." : "Open another user's profile before requesting a video call.");
    } catch (error) {
      setMessage(error.message || "Could not load realtime calls.");
    } finally {
      setLoading(false);
    }
  }

  async function requestCall() {
    if (!auth.currentUser) {
      navigate("/login");
      return;
    }
    if (!recipient.uid) {
      setMessage("Open another user profile before requesting a video call.");
      return;
    }
    if (recipient.uid === auth.currentUser.uid) {
      setMessage("You cannot request a video call with yourself. Open another user's profile first.");
      return;
    }
    setLoading(true);
    try {
      await authedFetch("/api/realtime/calls/request", {
        method: "POST",
        body: JSON.stringify({ recipientId: recipient.uid, planId: selectedPlanId, idempotencyKey: crypto.randomUUID() }),
      });
      await refresh();
      setMessage(`CALL REQUEST SENT\n@${recipient.username || recipient.displayName || "username"}\n${selectedPlan?.label || "Video Call"} • ${selectedPlan?.durationMinutes || 0} minutes • ${selectedPlan?.priceParag || 0} PARAG\nWaiting for response...`);
    } catch (error) {
      setMessage(error.message || "Could not request call.");
    } finally {
      setLoading(false);
    }
  }

  async function callAction(callId, action, success) {
    setLoading(true);
    try {
      const payload = await authedFetch(`/api/realtime/calls/${callId}/${action}`, { method: "POST", body: "{}" });
      if (action === "join") setJoinResult(payload);
      setMessage(success);
      await refresh();
    } catch (error) {
      const rawMessage = error.message || "Could not update call.";
      setMessage(/cloudflare|realtime|configured/i.test(rawMessage) ? "Video calling is temporarily unavailable." : rawMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Paragon Realtime</p>
        <h1 style={titleStyle}>Private Video Call</h1>
        <p style={mutedStyle}>Paid calls reserve PARAG first and only finalize the charge after both participants connect.</p>
        <p style={noticeStyle}>{message}</p>
        {message.toLowerCase().includes("insufficient") ? <button onClick={() => navigate("/wallet")} style={goldButtonStyle}>Fund Your Wallet</button> : null}
        {loading ? <p style={mutedStyle}>Working...</p> : null}
      </section>

      <section style={panelStyle}>
        <h2>Video Call With</h2>
        <RecipientIdentityCard recipient={recipient} />
        <div style={planGridStyle}>
          {plans.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} style={{ ...planStyle, ...(selectedPlanId === plan.id ? selectedPlanStyle : null) }}>
              <strong>{plan.label}</strong>
              <span>{plan.durationMinutes} minutes</span>
              <span>{plan.priceParag} PARAG</span>
            </button>
          ))}
        </div>
        <button disabled={!recipient.uid || !selectedPlan || loading} onClick={requestCall} style={goldButtonStyle}>
          Request {selectedPlan?.durationMinutes || 0}-Min Call · {selectedPlan?.priceParag || 0} PARAG
        </button>
      </section>

      <section style={panelStyle}>
        <h2>Incoming / Outgoing Calls</h2>
        <div style={callListStyle}>
          {calls.length === 0 ? <p style={mutedStyle}>No call requests yet.</p> : calls.map((call) => (
            <article key={call.id} style={callCardStyle}>
              {call.status === "RINGING" && call.recipientId === currentUid ? (
                <>
                  <strong>📹 Incoming Video Call</strong>
                  <span>{call.requesterName} wants a {call.durationMinutes}-minute video call.</span>
                </>
              ) : null}
              {call.status === "RINGING" && call.requesterId === currentUid ? (
                <>
                  <strong>CALL REQUEST SENT</strong>
                  <span>Waiting for {call.recipientName} to respond...</span>
                </>
              ) : null}
              <strong>{call.planLabel} • {call.durationMinutes} min • {call.priceParag} PARAG</strong>
              <span>{call.requesterName} → {call.recipientName}</span>
              <span>Status: {call.status}</span>
              <div style={actionRowStyle}>
                {call.status === "RINGING" && call.recipientId === currentUid ? <>
                  <button onClick={() => callAction(call.id, "accept", "Accepted. Realtime room prepared.")} style={miniButtonStyle}>Accept</button>
                  <button onClick={() => callAction(call.id, "decline", "Declined. Reserved PARAG released.")} style={miniButtonStyle}>Decline</button>
                </> : null}
                {call.status === "RINGING" && call.requesterId === currentUid ? (
                  <button onClick={() => callAction(call.id, "cancel", "Call request cancelled. Reserved PARAG released.")} style={miniButtonStyle}>Cancel Request</button>
                ) : null}
                {["ACCEPTED", "CONNECTING", "CONNECTED"].includes(call.status) ? <>
                  <button onClick={() => callAction(call.id, "join", "Secure realtime token issued.")} style={miniButtonStyle}>Join</button>
                  <button onClick={() => callAction(call.id, "connected", "Connected signal sent.")} style={miniButtonStyle}>Connected</button>
                  <button onClick={() => callAction(call.id, "end", "Call ended.")} style={miniButtonStyle}>End</button>
                </> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {joinResult ? (
        <section style={connectedStyle}>
          <h2>Secure Token Ready</h2>
          <p>Room: {joinResult.token?.roomId}</p>
          <p>Participant: {joinResult.token?.participantId}</p>
          <p>Next: mount Cloudflare RealtimeKit Web UI with the backend-issued token.</p>
        </section>
      ) : null}
    </main>
  );
}

async function loadRecipientProfile(uid, fallbackName) {
  const directSources = ["public_profiles", "user_profiles", "users", "profiles"];
  for (const source of directSources) {
    const snapshot = await getDoc(doc(db, source, uid));
    if (snapshot.exists()) return normalizeRecipient(uid, snapshot.data(), fallbackName);
  }

  const querySources = ["public_profiles", "user_profiles", "users", "profiles"];
  for (const source of querySources) {
    const snapshot = await getDocs(query(collection(db, source), where("uid", "==", uid), limit(1)));
    const first = snapshot.docs[0];
    if (first) return normalizeRecipient(uid, first.data(), fallbackName);
  }

  return normalizeRecipient(uid, {}, fallbackName);
}

function normalizeRecipient(uid, data, fallbackName) {
  const displayName = data.displayName || data.stageName || data.brandName || data.realName || data.username || fallbackName || "Paragon Member";
  return {
    uid,
    displayName,
    username: data.username || data.stageName || displayName,
    role: data.role || data.accountRole || data.category || "Paragon Member",
    photoUrl: data.photoUrl || data.profilePhotoUrl || data.avatarUrl || data.imageUrl || "",
  };
}

function RecipientIdentityCard({ recipient }) {
  if (!recipient.uid) {
    return (
      <div style={recipientCardStyle}>
        <strong>No recipient selected</strong>
        <span>Open another user profile, then tap 📹 Video Call.</span>
      </div>
    );
  }

  return (
    <div style={recipientCardStyle}>
      {recipient.photoUrl ? <img src={recipient.photoUrl} alt="" style={avatarStyle} /> : <div style={avatarFallbackStyle}>📹</div>}
      <div>
        <strong>@{recipient.username || "username"}</strong>
        <span>{recipient.displayName || "Paragon Member"}</span>
        <span>{recipient.role || "Paragon Member"}</span>
      </div>
    </div>
  );
}

const pageStyle = { minHeight: "100vh", background: "#000", color: "#fff", padding: "96px 16px 48px", display: "grid", gap: 16 };
const panelStyle = { background: "#121212", border: "1px solid #2a2a2a", borderRadius: 20, padding: 18, display: "grid", gap: 12 };
const eyebrowStyle = { color: "#e4b122", textTransform: "uppercase", fontWeight: 800, margin: 0 };
const titleStyle = { margin: 0, fontSize: 32 };
const mutedStyle = { color: "#d9cdb7", margin: 0 };
const noticeStyle = { color: "#ffe7a3", margin: 0, fontWeight: 700 };
const recipientCardStyle = { display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, border: "1px solid #2a2a2a", background: "#050505", color: "#fff" };
const avatarStyle = { width: 52, height: 52, borderRadius: "50%", objectFit: "cover", background: "#111827" };
const avatarFallbackStyle = { width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "#111827", fontSize: 24 };
const planGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const planStyle = { display: "grid", gap: 6, padding: 16, borderRadius: 16, border: "1px solid #263241", background: "#101828", color: "#fff", cursor: "pointer" };
const selectedPlanStyle = { background: "#e4b122", color: "#000", borderColor: "#e4b122" };
const goldButtonStyle = { padding: "14px 18px", borderRadius: 999, border: 0, background: "#e4b122", color: "#000", fontWeight: 900, cursor: "pointer" };
const callListStyle = { display: "grid", gap: 10 };
const callCardStyle = { display: "grid", gap: 8, padding: 14, borderRadius: 16, background: "#050505", border: "1px solid #282828" };
const actionRowStyle = { display: "flex", gap: 8, flexWrap: "wrap" };
const miniButtonStyle = { padding: "9px 12px", borderRadius: 999, border: "1px solid #e4b122", background: "transparent", color: "#fff", fontWeight: 800, cursor: "pointer" };
const connectedStyle = { ...panelStyle, background: "#102a1c" };
