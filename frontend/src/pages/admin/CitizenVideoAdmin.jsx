import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../../config/firebase";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";
const TABS = ["Overview", "Uploads", "Video Pricing", "Storage & Maintenance", "Viewing & Watch Time", "Video Economics", "Billing & Payment Status", "Video Lifecycle / Deletion", "Terms & Conditions", "System / Processing Status"];

async function adminFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`${BACKEND}/api/video/admin${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

const bytes = (value) => value == null ? "Pending" : `${(Number(value) / 1073741824).toFixed(2)} GB`;
const money = (value) => value == null ? "Pending reconciliation" : `₦${Number(value).toLocaleString()}`;
const dateText = (value) => value?.toDate ? value.toDate().toLocaleString() : value?._seconds ? new Date(value._seconds * 1000).toLocaleString() : value ? new Date(value).toLocaleString() : "—";

export default function CitizenVideoAdmin() {
  const [tab, setTab] = useState("Overview");
  const [settings, setSettings] = useState(null);
  const [versions, setVersions] = useState(null);
  const [queues, setQueues] = useState(null);
  const [videos, setVideos] = useState({ items: [], nextCursor: null, hasMore: false });
  const [analytics, setAnalytics] = useState({ items: [], nextCursor: null, hasMore: false });
  const [billing, setBilling] = useState({ items: [], nextCursor: null, hasMore: false });
  const [citizens, setCitizens] = useState({ items: [], nextCursor: null, hasMore: false });
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [billingFilter, setBillingFilter] = useState("");
  const [citizenSearch, setCitizenSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const base = await adminFetch("/settings");
      setSettings(base);
      const requests = await Promise.allSettled([
        adminFetch("/versions"), adminFetch("/queues"), adminFetch("/videos?limit=20"), adminFetch("/analytics?limit=20"), adminFetch("/billing?limit=20"), adminFetch("/citizens?limit=20"),
      ]);
      const setters = [setVersions, setQueues, setVideos, setAnalytics, setBilling, setCitizens];
      requests.forEach((result, index) => { if (result.status === "fulfilled") setters[index](result.value); });
      const failures = requests.filter((result) => result.status === "rejected");
      if (failures.length) setMessage(`${failures.length} dashboard data section(s) are pending backend/index availability.`);
    } catch (error) { setMessage(error.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pricing = settings?.pricing || {};
  const terms = settings?.terms || {};
  const overview = settings?.overview || {};
  const updatePricing = (name, value) => setSettings((current) => ({ ...current, pricing: { ...current.pricing, [name]: value } }));
  const updateTier = (index, field, value) => setSettings((current) => { const tiers = [...(current.pricing?.tiers || [])]; tiers[index] = { ...tiers[index], [field]: Number(value) }; return { ...current, pricing: { ...current.pricing, tiers } }; });
  const updateTerms = (name, value) => setSettings((current) => ({ ...current, terms: { ...current.terms, [name]: value } }));
  const publish = async (kind) => {
    setSaving(true); setMessage("");
    try {
      const payload = kind === "pricing" ? { ...pricing, version: `video-pricing-${Date.now()}` } : { ...terms, version: `video-terms-${Date.now()}` };
      const body = await adminFetch(`/${kind}`, { method: "PUT", body: JSON.stringify(payload) });
      setSettings((current) => ({ ...current, [kind]: body[kind] })); setMessage(`New ${kind} version published. Historical versions were retained.`); setVersions(await adminFetch("/versions"));
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  };
  const loadMore = async (kind, state, setter, suffix = "") => { if (!state.nextCursor) return; const page = await adminFetch(`/${kind}?limit=20&cursor=${encodeURIComponent(state.nextCursor)}${suffix}`); setter({ ...page, items: [...state.items, ...page.items] }); };
  const refreshBilling = async () => setBilling(await adminFetch(`/billing?limit=20${billingFilter ? `&status=${encodeURIComponent(billingFilter)}` : ""}`));
  const refreshCitizens = async () => setCitizens(await adminFetch(`/citizens?limit=20${citizenSearch ? `&search=${encodeURIComponent(citizenSearch)}` : ""}`));
  const totalViews = useMemo(() => analytics.items.reduce((n, x) => n + Number(x.views || 0), 0), [analytics.items]);
  const watchMinutes = useMemo(() => analytics.items.reduce((n, x) => n + Number(x.watchMinutes || 0), 0), [analytics.items]);

  if (!settings) return <section style={shellStyle}><h2>CITIZEN VIDEO MANAGEMENT</h2><p>{message || "Loading Citizen Video administration…"}</p></section>;
  return <section style={shellStyle} data-testid="citizen-video-admin">
    <header><h2 style={{ marginBottom: 6 }}>CITIZEN VIDEO MANAGEMENT</h2><p style={{ marginTop: 0, color: "#475569" }}>Citizen uploads only. Marketplace product media is excluded.</p></header>
    <div style={noticeStyle}><strong>LAUNCH SAFETY:</strong> Fees {pricing.videoFeesEnabled ? "ON" : "OFF"} · Wallet deduction {pricing.automaticWalletDeductionEnabled ? "ON" : "OFF"} · Automatic deletion {pricing.automaticDeletionEnabled ? "ON" : "OFF"}</div>
    <nav style={tabsStyle}>{TABS.map((name) => <button key={name} onClick={() => setTab(name)} style={tabStyle(tab === name)}>{name}</button>)}</nav>

    {tab === "Overview" && <><Card title="Citizen Video Overview"><Metrics values={[["Uploaded Today", overview.uploadedToday], ["Uploaded This Week", overview.uploadedThisWeek], ["Uploaded This Month", overview.uploadedThisMonth], ["Total Citizen Videos", overview.totalCitizenVideos], ...["READY", "PROCESSING", "FAILED", "PAYMENT_DUE", "GRACE_PERIOD", "SCHEDULED_FOR_DELETION", "DELETED"].map((s) => [s, overview.byStatus?.[s] || 0]), ["Total Storage", bytes(overview.totalStorageBytes)], ["Views", overview.totalViews], ["Unique Viewers", overview.uniqueViewers ?? "Pending"], ["Watch Minutes", overview.watchMinutes], ["Queue Depth", overview.queueDepth], ["Processing Failures", overview.processingFailures]]} /></Card><Card title="Provider Status"><p>R2 usage: {overview.r2StorageBytes == null ? "Provider data pending reconciliation" : bytes(overview.r2StorageBytes)}</p><p>Stream active assets: {overview.streamActiveAssets ?? "Provider data pending reconciliation"}</p></Card></>}
    {tab === "Uploads" && <Card title="Citizen Uploads"><VideoTable items={videos.items} onOpen={async (id) => setSelectedVideo(await adminFetch(`/videos/${id}`))} />{videos.hasMore && <More onClick={() => loadMore("videos", videos, setVideos)} />}{selectedVideo && <VideoDetail data={selectedVideo} close={() => setSelectedVideo(null)} />}</Card>}
    {tab === "Video Pricing" && <Card title="Video Upload Pricing Controls"><Toggle label="Video Fees Enabled" checked={pricing.videoFeesEnabled} set={(v) => updatePricing("videoFeesEnabled", v)} /><Toggle label="Automatic Wallet Deduction" checked={pricing.automaticWalletDeductionEnabled} set={(v) => updatePricing("automaticWalletDeductionEnabled", v)} /><Toggle label="Automatic Deletion" checked={pricing.automaticDeletionEnabled} set={(v) => updatePricing("automaticDeletionEnabled", v)} /><div style={formGridStyle}><Field label="Maximum Upload Size (MB)" value={Math.round((pricing.maxUploadSizeBytes || 0) / 1048576)} set={(v) => updatePricing("maxUploadSizeBytes", Number(v) * 1048576)} /><Field label="Citizen Storage Allowance (MB)" value={Math.round((pricing.citizenStorageAllowanceBytes || 0) / 1048576)} set={(v) => updatePricing("citizenStorageAllowanceBytes", Number(v) * 1048576)} /><Field label="Grace Period (days)" value={pricing.gracePeriodDays || 0} set={(v) => updatePricing("gracePeriodDays", Number(v))} /><Field label="Retry Attempts" value={pricing.retryPolicy?.maxAttempts || 0} set={(v) => updatePricing("retryPolicy", { ...pricing.retryPolicy, maxAttempts: Number(v) })} /><Field label="Retry Interval (days)" value={pricing.retryPolicy?.intervalDays || 1} set={(v) => updatePricing("retryPolicy", { ...pricing.retryPolicy, intervalDays: Number(v) })} /></div><p><strong>Current Pricing Version:</strong> {pricing.version} · <strong>Effective:</strong> {dateText(pricing.effectiveAt)}</p><h4>Size tiers</h4>{(pricing.tiers || []).map((tier, i) => <div key={tier.maxBytes} style={tierStyle}><strong>{Math.ceil(tier.minBytes / 1048576)}–{Math.round(tier.maxBytes / 1048576)} MB</strong><Field label="Upload Fee ₦" value={tier.uploadFee || 0} set={(v) => updateTier(i, "uploadFee", v)} /><Field label="Monthly Maintenance ₦" value={tier.monthlyMaintenanceFee || 0} set={(v) => updateTier(i, "monthlyMaintenanceFee", v)} /></div>)}<button style={primaryStyle} disabled={saving} onClick={() => publish("pricing")}>PUBLISH NEW PRICING</button></Card>}
    {tab === "Storage & Maintenance" && <><Card title="Storage"><Metrics values={[["Citizen Videos", overview.totalCitizenVideos], ["Total Storage", bytes(overview.totalStorageBytes)], ["R2 Originals", overview.r2ObjectCount ?? "Pending reconciliation"], ["Stream Assets", overview.streamActiveAssets ?? "Pending reconciliation"]]} /></Card><Card title="Maintenance Obligations"><BillingTable items={billing.items} />{billing.hasMore && <More onClick={() => loadMore("billing", billing, setBilling, billingFilter ? `&status=${billingFilter}` : "")} />}</Card></>}
    {tab === "Viewing & Watch Time" && <Card title="Viewing & Watch Time"><div style={filterStyle}><select aria-label="Time range"><option>Today</option><option>7 Days</option><option>30 Days</option><option>This Month</option><option>Custom Range</option></select></div><Metrics values={[["Total Views (loaded page)", totalViews], ["Unique Viewers", "Pending reconciliation"], ["Watch Minutes (loaded page)", watchMinutes], ["Average Watch Duration", "Pending reconciliation"]]} /><AnalyticsTable items={analytics.items} />{analytics.hasMore && <More onClick={() => loadMore("analytics", analytics, setAnalytics)} />}</Card>}
    {tab === "Video Economics" && <><Card title="Revenue"><Metrics values={[["Upload Fee Revenue", money(overview.financial?.uploadFeeRevenue || 0)], ["Maintenance Revenue", money(overview.financial?.maintenanceRevenue || 0)], ["Advertising Revenue", "Not attributed"], ["Voting Revenue", "Not attributed"], ["Total Video Revenue", money(overview.financial?.videoRelatedRevenue || 0)]]} /></Card><Card title="Cost"><Metrics values={[["R2 Storage Cost", money(overview.estimatedCosts?.r2Storage)], ["R2 Operations Cost", money(overview.estimatedCosts?.r2Operations)], ["Stream Storage Cost", money(overview.estimatedCosts?.streamStorage)], ["Stream Delivery Cost", money(overview.estimatedCosts?.streamDelivery)], ["Processing Cost", money(overview.estimatedCosts?.processing)]]} /><p><strong>Provider cost data pending reconciliation.</strong> No Cloudflare cost has been inferred or fabricated.</p></Card><Card title="Result"><Metric label="Video Contribution" value={overview.financial?.netVideoContribution ?? "Pending reconciliation"} /></Card></>}
    {tab === "Billing & Payment Status" && <Card title="Billing & Payment Status"><div style={filterStyle}><select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value)}><option value="">All statuses</option>{["ZERO_PRICE", "PAID", "PAYMENT_DUE", "PAYMENT_FAILED", "GRACE_PERIOD", "SCHEDULED_FOR_DELETION"].map((x) => <option key={x}>{x}</option>)}</select><button onClick={refreshBilling}>Apply</button></div><BillingTable items={billing.items} />{billing.hasMore && <More onClick={() => loadMore("billing", billing, setBilling, billingFilter ? `&status=${billingFilter}` : "")} />}</Card>}
    {tab === "Video Lifecycle / Deletion" && <Card title="Video Lifecycle / Deletion"><p>Automatic deletion is <strong>{pricing.automaticDeletionEnabled ? "ON" : "OFF"}</strong>. This view never triggers deletion.</p><VideoTable items={videos.items.filter((x) => ["GRACE_PERIOD", "SCHEDULED_FOR_DELETION", "DELETED"].includes(x.billingStatus || x.lifecycleStatus))} onOpen={async (id) => setSelectedVideo(await adminFetch(`/videos/${id}`))} /></Card>}
    {tab === "Terms & Conditions" && <><Card title="Current Terms"><p><strong>Version:</strong> {terms.version} · <strong>Status:</strong> {terms.status} · <strong>Effective:</strong> {dateText(terms.effectiveAt)}</p><Field label="Title" value={terms.title || ""} set={(v) => updateTerms("title", v)} /><label style={labelStyle}>Terms text<textarea value={terms.body || ""} onChange={(e) => updateTerms("body", e.target.value)} style={{ ...inputStyle, minHeight: 160 }} /></label><Toggle label="Acceptance required" checked={terms.requiresAcceptance !== false} set={(v) => updateTerms("requiresAcceptance", v)} /><button style={primaryStyle} disabled={saving} onClick={() => publish("terms")}>PUBLISH NEW VERSION</button></Card><Card title="Version History"><VersionTable pricing={versions?.pricingVersions || []} terms={versions?.termsVersions || []} /></Card></>}
    {tab === "System / Processing Status" && <><Card title="System / Processing Status"><Metrics values={[["Upload Authorizations", queues?.authorizations?.length || 0], ["Reconciliation Queue", queues?.reconciliationQueue?.length || 0], ["Billing Records", queues?.billing?.length || 0], ["Processing", overview.byStatus?.PROCESSING || 0], ["Ready", overview.byStatus?.READY || 0], ["Failed", overview.byStatus?.FAILED || 0]]} /><p>Stream and R2 credentials are never exposed.</p></Card><Card title="Citizen-Level Assessment"><div style={filterStyle}><input value={citizenSearch} onChange={(e) => setCitizenSearch(e.target.value)} placeholder="Search Citizen stage name" /><button onClick={refreshCitizens}>Search</button></div><CitizenTable items={citizens.items} />{citizens.hasMore && <More onClick={() => loadMore("citizens", citizens, setCitizens, citizenSearch ? `&search=${encodeURIComponent(citizenSearch)}` : "")} />}</Card></>}
    {message && <div style={messageStyle}>{message}</div>}
  </section>;
}

function Card({ title, children }) { return <section style={cardStyle}><h3>{title}</h3>{children}</section>; }
function Metrics({ values }) { return <div style={metricGridStyle}>{values.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>; }
function Metric({ label, value }) { return <div style={metricStyle}><strong>{value ?? 0}</strong><span>{label}</span></div>; }
function Toggle({ label, checked, set }) { return <label style={toggleStyle}><input type="checkbox" checked={Boolean(checked)} onChange={(e) => set(e.target.checked)} /> {label}: <strong>{checked ? "ON" : "OFF"}</strong></label>; }
function Field({ label, value, set }) { return <label style={labelStyle}>{label}<input value={value} type={typeof value === "number" ? "number" : "text"} min={typeof value === "number" ? 0 : undefined} onChange={(e) => set(e.target.value)} style={inputStyle} /></label>; }
function More({ onClick }) { return <button style={secondaryStyle} onClick={onClick}>Load next page</button>; }
function VideoTable({ items, onOpen }) { return <Table headers={["Video", "Citizen", "Created", "Status", "Size", ""]} rows={items.map((v) => [v.title || v.caption || v.id, v.userName || v.uid || "—", dateText(v.createdAt), v.lifecycleStatus || v.processingStatus || v.status || "—", bytes(v.fileSizeBytes || v.fileSize), <button key={v.id} onClick={() => onOpen(v.id)}>Open</button>])} />; }
function AnalyticsTable({ items }) { return <Table headers={["Video", "Citizen", "Views", "Unique", "Watch Minutes", "Avg Duration", "Completion", "Status"]} rows={items.map((v) => [v.title, v.citizenName || v.citizenId || "—", v.views, v.uniqueViewers ?? "Pending", v.watchMinutes, v.averageWatchDuration ?? "Pending", v.completionRate ?? "Pending", v.status || "—"])} />; }
function BillingTable({ items }) { return <Table headers={["Video", "Citizen", "Amount Due", "Paid", "Status", "Next Due", "Grace End"]} rows={items.map((x) => [x.videoId, x.citizenId, `${x.currency || "NGN"} ${x.amountDue || 0}`, x.amountCharged || 0, x.paymentStatus, dateText(x.dueAt), dateText(x.gracePeriodEndsAt)])} />; }
function CitizenTable({ items }) { return <Table headers={["Citizen", "Videos", "Storage", "Views", "Watch Minutes", "Upload Fees", "Maintenance Paid", "Current Due", "Next Billing", "Failed", "Grace", "Deletion", "Wallet"]} rows={items.map((x) => [x.stageName || x.realName || x.id, x.videoCount, bytes(x.storageBytes), x.views, x.watchMinutes, money(x.uploadFeesPaid || 0), money(x.maintenancePaid || 0), money(x.currentMaintenanceObligation || 0), dateText(x.nextBillingDate), x.failedPayments, x.gracePeriodVideos, x.scheduledDeletionVideos, x.walletBalance ? JSON.stringify(x.walletBalance) : "—"])} />; }
function VersionTable({ pricing, terms }) { return <Table headers={["Kind", "Version", "Status", "Effective"]} rows={[...pricing.map((x) => ["Pricing", x.version || x.id, x.videoFeesEnabled ? "Fees enabled" : "Free", dateText(x.effectiveAt)]), ...terms.map((x) => ["Terms", x.version || x.id, x.status, dateText(x.effectiveAt)])]} />; }
function VideoDetail({ data, close }) { const v = data.video || {}; return <div style={detailStyle}><button onClick={close}>Close details</button><h4>{v.title || v.caption || v.id}</h4><div style={detailGridStyle}>{[["Video ID", v.id], ["Citizen", data.citizen?.stageName || v.uid], ["File Size", bytes(v.fileSizeBytes || v.fileSize)], ["Duration", v.duration ?? "—"], ["Upload Date", dateText(v.createdAt)], ["Processing", v.processingStatus], ["Lifecycle", v.lifecycleStatus], ["R2", v.r2ObjectStatus || (v.r2Key ? "AVAILABLE" : "Pending")], ["Stream", v.streamStatus || (v.streamUid ? "AVAILABLE" : "Pending")], ["Views", v.views || v.viewCount || 0], ["Unique Viewers", v.uniqueViewers ?? "Pending"], ["Watch Minutes", v.watchMinutes || 0], ["Upload Fee Accepted", v.uploadFeeAccepted || 0], ["Maintenance Accepted", v.monthlyMaintenanceAccepted || 0], ["Pricing Version", v.pricingVersion], ["Terms Version", v.termsVersion], ["Billing", v.billingStatus], ["Grace End", dateText(v.gracePeriodEndsAt)], ["Deletion", v.deletionStatus || "—"]].map(([k, val]) => <div key={k}><small>{k}</small><br /><strong>{val ?? "—"}</strong></div>)}</div></div>; }
function Table({ headers, rows }) { return <div style={{ overflowX: "auto" }}><table style={tableStyle}><thead><tr>{headers.map((h) => <th key={h} style={cellStyle}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={cellStyle}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} style={cellStyle}>No records found.</td></tr>}</tbody></table></div>; }

const shellStyle = { display: "grid", gap: 18, minWidth: 0 };
const tabsStyle = { display: "flex", flexWrap: "wrap", gap: 8 };
const tabStyle = (active) => ({ padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", background: active ? "#0f172a" : "#fff", color: active ? "#fff" : "#0f172a" });
const noticeStyle = { padding: 14, borderRadius: 10, background: "#ecfdf5", border: "1px solid #10b981" };
const cardStyle = { padding: 18, border: "1px solid #dbe3ea", borderRadius: 12, background: "#fff", minWidth: 0 };
const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 };
const metricStyle = { display: "grid", gap: 4, padding: 12, borderRadius: 8, background: "#f8fafc" };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, margin: "16px 0" };
const tierStyle = { display: "grid", gridTemplateColumns: "minmax(130px, 1fr) repeat(2, minmax(150px, 1fr))", gap: 10, alignItems: "end", padding: 10, borderBottom: "1px solid #e2e8f0" };
const labelStyle = { display: "grid", gap: 5, margin: "8px 0" };
const inputStyle = { boxSizing: "border-box", width: "100%", padding: 9, border: "1px solid #cbd5e1", borderRadius: 6 };
const toggleStyle = { display: "block", margin: "10px 0" };
const filterStyle = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 };
const primaryStyle = { marginTop: 14, padding: "11px 16px", border: 0, borderRadius: 7, background: "#000", color: "#fff", fontWeight: 700, cursor: "pointer" };
const secondaryStyle = { marginTop: 12, padding: "9px 13px", border: "1px solid #64748b", borderRadius: 7, background: "#fff", cursor: "pointer" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const cellStyle = { padding: 9, borderBottom: "1px solid #e2e8f0", textAlign: "left", whiteSpace: "nowrap" };
const detailStyle = { marginTop: 16, padding: 14, background: "#f8fafc", borderRadius: 8 };
const detailGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };
const messageStyle = { padding: 12, borderRadius: 8, background: "#fff7ed", border: "1px solid #fb923c" };
