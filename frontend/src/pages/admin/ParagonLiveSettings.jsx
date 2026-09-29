import { useEffect, useState } from "react";
import { auth } from "../../config/firebase";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

async function liveAdminFetch(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`${BACKEND}/api/live/admin${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export default function ParagonLiveSettings() {
  const [tariff, setTariff] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { liveAdminFetch("/settings").then((body) => setTariff(body.tariff)).catch((error) => setMessage(error.message)); }, []);
  if (!tariff) return <p>{message || "Loading Paragon Live settings…"}</p>;
  const update = (name, value) => setTariff((current) => ({ ...current, [name]: value }));
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const body = await liveAdminFetch("/settings", { method: "PUT", body: JSON.stringify(tariff) });
      setTariff(body.tariff); setMessage("Paragon Live settings saved. Financial enforcement remains OFF unless explicitly enabled.");
    } catch (error) { setMessage(error.message); } finally { setSaving(false); }
  };
  return (
    <section style={{ maxWidth: 720, display: "grid", gap: 16 }}>
      <div style={{ padding: 16, borderRadius: 10, background: "#ecfdf5", border: "1px solid #10b981" }}>
        <strong>CURRENT DEVELOPMENT STATUS: FREE</strong><br />
        Changing a price alone does not charge users. Charging also requires role charging and global financial enforcement.
      </div>
      <fieldset><legend>Broadcaster</legend>
        <label>Price / 30 minutes (PARAG) <input type="number" min="0" value={tariff.broadcasterPricePer30Min} onChange={(e) => update("broadcasterPricePer30Min", Number(e.target.value))} /></label><br />
        <label><input type="checkbox" checked={tariff.broadcasterChargingEnabled} onChange={(e) => update("broadcasterChargingEnabled", e.target.checked)} /> Enable broadcaster charging</label>
      </fieldset>
      <fieldset><legend>Viewer</legend>
        <label>Price / 30 minutes (PARAG) <input type="number" min="0" value={tariff.viewerPricePer30Min} onChange={(e) => update("viewerPricePer30Min", Number(e.target.value))} /></label><br />
        <label><input type="checkbox" checked={tariff.viewerChargingEnabled} onChange={(e) => update("viewerChargingEnabled", e.target.checked)} /> Enable viewer charging</label>
      </fieldset>
      <fieldset><legend>Global</legend>
        <label><input type="checkbox" checked={tariff.financialEnforcementEnabled} onChange={(e) => update("financialEnforcementEnabled", e.target.checked)} /> Financial enforcement</label><br />
        <label>Auto-renew policy <select value={tariff.autoRenewPolicy} onChange={(e) => update("autoRenewPolicy", e.target.value)}><option value="manual">Manual</option><option value="auto">Auto-renew</option></select></label>
        <p>Current tariff version: {tariff.tariffVersion}</p><p>Effective: {tariff.effectiveAt ? String(tariff.effectiveAt) : "Immediately after save"}</p>
      </fieldset>
      <button type="button" onClick={save} disabled={saving} style={{ padding: "10px 16px", background: "#000", color: "#fff", border: 0, borderRadius: 6, fontWeight: 700 }}>{saving ? "Saving…" : "Save Live Settings"}</button>
      {message && <p>{message}</p>}
    </section>
  );
}
