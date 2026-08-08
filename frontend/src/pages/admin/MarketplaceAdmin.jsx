import { useEffect, useState } from "react";
import { auth } from "../../config/firebase";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

async function apiFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken();
  const res = await fetch(`${BACKEND}/api/marketplace${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  return res.json();
}

const STATUS_COLORS = {
  completed: "#176b4d",
  final_offer_sent: "#b45309",
  buyer_accepted: "#b45309",
  escrow_funded: "#1d4ed8",
  paid: "#1d4ed8",
  delivering: "#6d28d9",
  buyer_review: "#6d28d9",
  disputed: "#dc2626",
  admin_review: "#dc2626",
  cancelled: "#6b7280",
  expired: "#6b7280",
  refunded: "#6d28d9",
  closed: "#6b7280",
};

function StatusBadge({ status }) {
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 700,
      background: "#f1f5f9",
      color: STATUS_COLORS[status] || "#52616b",
    }}>
      {status || "—"}
    </span>
  );
}

function ts(serverTs) {
  if (!serverTs) return "—";
  const d = serverTs?.toDate ? serverTs.toDate() : new Date(serverTs._seconds * 1000);
  return d.toLocaleString();
}

export default function MarketplaceAdmin() {
  const [tab, setTab] = useState("overview");

  // Overview data
  const [escrow, setEscrow] = useState(null);
  const [adminWallet, setAdminWallet] = useState(null);
  const [settings, setSettings] = useState(null);
  const [commissionRate, setCommissionRate] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");

  // Orders
  const [orders, setOrders] = useState([]);
  const [orderStatus, setOrderStatus] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Disputes
  const [disputes, setDisputes] = useState([]);
  const [disputesLoading, setDisputesLoading] = useState(false);

  // Commission
  const [commission, setCommission] = useState(null);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditOrderId, setAuditOrderId] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  // Override
  const [overrideOrderId, setOverrideOrderId] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("completed");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideMsg, setOverrideMsg] = useState("");

  // Dispute resolution
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolveDecision, setResolveDecision] = useState("buyer_wins");
  const [resolveNotes, setResolveNotes] = useState("");
  const [partialPct, setPartialPct] = useState("50");
  const [resolveMsg, setResolveMsg] = useState("");

  useEffect(() => {
    if (tab === "overview") loadOverview();
    if (tab === "orders") loadOrders();
    if (tab === "disputes") loadDisputes();
    if (tab === "commission") loadCommission();
    if (tab === "audit") loadAudit();
  }, [tab]);

  async function loadOverview() {
    try {
      const [e, w, s] = await Promise.all([
        apiFetch("/admin/escrow"),
        apiFetch("/admin/admin-wallet"),
        apiFetch("/settings"),
      ]);
      setEscrow(e);
      setAdminWallet(w);
      setSettings(s);
      setCommissionRate(String(s.commissionPct ?? "5"));
    } catch (err) {
      console.error(err);
    }
  }

  async function saveCommission() {
    setSettingsMsg("");
    try {
      await apiFetch("/admin/settings", { method: "POST", body: JSON.stringify({ commissionPct: Number(commissionRate) }) });
      setSettingsMsg("✅ Commission rate saved.");
    } catch (err) {
      setSettingsMsg("❌ " + err.message);
    }
  }

  async function loadOrders() {
    setOrdersLoading(true);
    try {
      const data = await apiFetch(`/admin/orders${orderStatus ? "?status=" + orderStatus : ""}`);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadDisputes() {
    setDisputesLoading(true);
    try {
      const data = await apiFetch("/admin/disputes");
      setDisputes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDisputesLoading(false);
    }
  }

  async function loadCommission() {
    try {
      const data = await apiFetch("/admin/commission-report");
      setCommission(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAudit() {
    setAuditLoading(true);
    try {
      const data = await apiFetch(`/admin/audit-log${auditOrderId.trim() ? "?orderId=" + auditOrderId.trim() : ""}`);
      setAuditLog(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }

  async function performOverride() {
    setOverrideMsg("");
    try {
      await apiFetch("/admin/override", {
        method: "POST",
        body: JSON.stringify({ orderId: overrideOrderId.trim(), newStatus: overrideStatus, notes: overrideNotes.trim() }),
      });
      setOverrideMsg("✅ Override applied.");
    } catch (err) {
      setOverrideMsg("❌ " + err.message);
    }
  }

  async function performResolve() {
    if (!selectedDispute) return;
    setResolveMsg("");
    try {
      await apiFetch(`/admin/dispute/${selectedDispute.orderId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          decision: resolveDecision,
          notes: resolveNotes.trim(),
          partialBuyerPct: resolveDecision === "partial_refund" ? Number(partialPct) : undefined,
        }),
      });
      setResolveMsg("✅ Dispute resolved.");
      loadDisputes();
    } catch (err) {
      setResolveMsg("❌ " + err.message);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {["overview", "orders", "disputes", "commission", "audit", "override"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tab === t ? activeTabStyle : tabStyle}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────── */}
      {tab === "overview" && (
        <div>
          <h3 style={sectionTitle}>Platform Balances</h3>
          <div style={cardRow}>
            <div style={card}>
              <p style={cardLabel}>Escrow Balance</p>
              <p style={cardValue}>{escrow ? `${escrow.balances?.parag ?? 0} PARAG` : "—"}</p>
              {escrow && <p style={cardSub}>{escrow.balances?.gbazilo ?? 0} GBAZILO</p>}
            </div>
            <div style={card}>
              <p style={cardLabel}>Admin Wallet (Commission)</p>
              <p style={cardValue}>{adminWallet ? `${adminWallet.balances?.parag ?? 0} PARAG` : "—"}</p>
              {adminWallet && <p style={cardSub}>{adminWallet.balances?.gbazilo ?? 0} GBAZILO</p>}
            </div>
            <div style={card}>
              <p style={cardLabel}>Commission Rate</p>
              <p style={cardValue}>{settings ? `${settings.commissionPct}%` : "—"}</p>
            </div>
          </div>

          <h3 style={{ ...sectionTitle, marginTop: 24 }}>Update Commission Rate</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              min="0"
              max="50"
              step="0.5"
              style={inputStyle}
            />
            <span>%</span>
            <button onClick={saveCommission} style={primaryBtn}>Save</button>
          </div>
          {settingsMsg && <p style={{ marginTop: 8 }}>{settingsMsg}</p>}
        </div>
      )}

      {/* ── ORDERS ───────────────────────────────────────────── */}
      {tab === "orders" && (
        <div>
          <h3 style={sectionTitle}>Marketplace Transactions</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} style={inputStyle}>
              <option value="">All statuses</option>
              {["request_submitted","negotiating","final_offer_sent","buyer_accepted","escrow_funded","delivering","buyer_review","completed","cancelled","expired","disputed","admin_review","refunded","closed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={loadOrders} style={primaryBtn}>Load</button>
          </div>
          {ordersLoading ? <p>Loading…</p> : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Order ID</th>
                  <th style={th}>Product</th>
                  <th style={th}>Buyer</th>
                  <th style={th}>Merchant</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={td}><code style={{ fontSize: 11 }}>{o.id.slice(0, 10)}…</code></td>
                    <td style={td}>{o.productName || "—"}</td>
                    <td style={td}><code style={{ fontSize: 11 }}>{String(o.buyerId || "").slice(0, 8)}…</code></td>
                    <td style={td}><code style={{ fontSize: 11 }}>{String(o.merchantId || "").slice(0, 8)}…</code></td>
                    <td style={td}>{o.escrowAmount ?? o.amount ?? "—"} {o.escrowCurrency ?? o.currency ?? ""}</td>
                    <td style={td}><StatusBadge status={o.status} /></td>
                    <td style={td} title={ts(o.updatedAt)}>{ts(o.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!ordersLoading && orders.length === 0 && <p style={{ color: "#52616b" }}>No orders found.</p>}
        </div>
      )}

      {/* ── DISPUTES ─────────────────────────────────────────── */}
      {tab === "disputes" && (
        <div>
          <h3 style={sectionTitle}>Disputes</h3>
          {disputesLoading ? <p>Loading…</p> : (
            <div>
              {disputes.map((d) => (
                <div key={d.id} style={{ ...card, marginBottom: 12, cursor: "pointer", border: selectedDispute?.id === d.id ? "2px solid #176b4d" : "1px solid #e2d8c8" }} onClick={() => { setSelectedDispute(d); setResolveMsg(""); }}>
                  <p style={{ margin: 0 }}><strong>Order:</strong> <code>{d.orderId}</code> · <StatusBadge status={d.status} /></p>
                  <p style={{ margin: "4px 0 0", fontSize: 13 }}><strong>Reason:</strong> {d.reason}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#52616b" }}>{d.description}</p>
                  {d.merchantResponse && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#176b4d" }}><strong>Merchant:</strong> {d.merchantResponse}</p>}
                </div>
              ))}
              {disputes.length === 0 && <p style={{ color: "#52616b" }}>No disputes found.</p>}
            </div>
          )}

          {selectedDispute && selectedDispute.status !== "resolved" && (
            <div style={{ ...card, marginTop: 16, borderColor: "#f59e0b" }}>
              <h4 style={{ margin: "0 0 12px" }}>Resolve Dispute — Order: <code>{selectedDispute.orderId}</code></h4>
              <label style={labelStyle}>Decision</label>
              <select value={resolveDecision} onChange={(e) => setResolveDecision(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
                <option value="buyer_wins">Buyer Wins (full refund)</option>
                <option value="merchant_wins">Merchant Wins (release to merchant)</option>
                <option value="partial_refund">Partial Refund (split)</option>
              </select>
              {resolveDecision === "partial_refund" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>Buyer refund %</label>
                  <input type="number" value={partialPct} onChange={(e) => setPartialPct(e.target.value)} min="1" max="99" style={inputStyle} />
                </div>
              )}
              <label style={labelStyle}>Notes</label>
              <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={2} style={{ ...inputStyle, display: "block", width: "100%", resize: "vertical", marginBottom: 8, boxSizing: "border-box" }} />
              <button onClick={performResolve} style={primaryBtn}>Resolve Dispute</button>
              {resolveMsg && <p style={{ marginTop: 8 }}>{resolveMsg}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── COMMISSION ───────────────────────────────────────── */}
      {tab === "commission" && (
        <div>
          <h3 style={sectionTitle}>Commission Report</h3>
          {commission ? (
            <>
              <div style={cardRow}>
                <div style={card}>
                  <p style={cardLabel}>Total PARAG Earned</p>
                  <p style={cardValue}>{commission.totalParag}</p>
                </div>
                <div style={card}>
                  <p style={cardLabel}>Total GBAZILO Earned</p>
                  <p style={cardValue}>{commission.totalGbazilo}</p>
                </div>
                <div style={card}>
                  <p style={cardLabel}>Entries</p>
                  <p style={cardValue}>{commission.entries?.length ?? 0}</p>
                </div>
              </div>
              <table style={{ ...tableStyle, marginTop: 16 }}>
                <thead>
                  <tr>
                    <th style={th}>Amount</th>
                    <th style={th}>Currency</th>
                    <th style={th}>Reason</th>
                    <th style={th}>Reference</th>
                    <th style={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commission.entries.map((e) => (
                    <tr key={e.id}>
                      <td style={td}>{e.amount}</td>
                      <td style={td}>{e.currency}</td>
                      <td style={td}>{e.reason}</td>
                      <td style={td}><code style={{ fontSize: 11 }}>{String(e.reference || "").slice(0, 12)}…</code></td>
                      <td style={td}>{ts(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <p>Loading commission data…</p>}
        </div>
      )}

      {/* ── AUDIT LOG ────────────────────────────────────────── */}
      {tab === "audit" && (
        <div>
          <h3 style={sectionTitle}>Audit Trail</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={auditOrderId}
              onChange={(e) => setAuditOrderId(e.target.value)}
              placeholder="Filter by Order ID (optional)"
              style={inputStyle}
            />
            <button onClick={loadAudit} style={primaryBtn}>Load</button>
          </div>
          {auditLoading ? <p>Loading…</p> : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Action</th>
                  <th style={th}>Order ID</th>
                  <th style={th}>User</th>
                  <th style={th}>Extra</th>
                  <th style={th}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((e) => (
                  <tr key={e.id}>
                    <td style={td}><strong>{e.action}</strong></td>
                    <td style={td}><code style={{ fontSize: 11 }}>{String(e.orderId || "").slice(0, 12)}…</code></td>
                    <td style={td}><code style={{ fontSize: 11 }}>{String(e.userId || "").slice(0, 10)}…</code></td>
                    <td style={td} title={JSON.stringify(e.extra)}>{e.extra ? Object.keys(e.extra).join(", ") : "—"}</td>
                    <td style={td}>{ts(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!auditLoading && auditLog.length === 0 && <p style={{ color: "#52616b" }}>No audit entries.</p>}
        </div>
      )}

      {/* ── OVERRIDE ─────────────────────────────────────────── */}
      {tab === "override" && (
        <div>
          <h3 style={sectionTitle}>Manual Override</h3>
          <p style={{ color: "#52616b", marginTop: 0 }}>Force an order into any status. Use with caution.</p>
          <label style={labelStyle}>Order ID</label>
          <input value={overrideOrderId} onChange={(e) => setOverrideOrderId(e.target.value)} placeholder="Order document ID" style={{ ...inputStyle, display: "block", marginBottom: 8, width: 300 }} />
          <label style={labelStyle}>New Status</label>
          <select value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)} style={{ ...inputStyle, display: "block", marginBottom: 8 }}>
            {["request_submitted","negotiating","final_offer_sent","buyer_accepted","escrow_funded","delivering","buyer_review","completed","cancelled","expired","disputed","admin_review","refunded","merchant_paid","closed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label style={labelStyle}>Notes</label>
          <textarea value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} rows={2} style={{ ...inputStyle, display: "block", width: "100%", maxWidth: 500, marginBottom: 8, resize: "vertical", boxSizing: "border-box" }} />
          <button onClick={performOverride} style={primaryBtn}>Apply Override</button>
          {overrideMsg && <p style={{ marginTop: 8 }}>{overrideMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tabStyle = {
  padding: "8px 14px",
  background: "#f1f5f9",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};

const activeTabStyle = {
  ...tabStyle,
  background: "#176b4d",
  color: "#fff",
  borderColor: "#176b4d",
};

const primaryBtn = {
  padding: "9px 16px",
  background: "#176b4d",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const inputStyle = {
  padding: "8px 10px",
  border: "1px solid #c9c0b2",
  borderRadius: 6,
  fontSize: 13,
};

const sectionTitle = { fontSize: 18, fontWeight: 700, margin: "0 0 16px" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#52616b" };

const cardRow = { display: "flex", gap: 12, flexWrap: "wrap" };
const card = {
  padding: "16px 20px",
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  minWidth: 180,
};
const cardLabel = { margin: 0, fontSize: 12, color: "#52616b", fontWeight: 700 };
const cardValue = { margin: "6px 0 0", fontSize: 24, fontWeight: 700 };
const cardSub = { margin: "2px 0 0", fontSize: 12, color: "#52616b" };

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
const th = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "2px solid #e2d8c8",
  color: "#52616b",
  fontWeight: 700,
};
const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #f0ece4",
  verticalAlign: "top",
};
