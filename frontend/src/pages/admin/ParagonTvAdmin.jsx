import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../../config/firebase";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";
const CHANNEL_STATES = ["DRAFT", "ACTIVE", "INACTIVE"];
const PROGRAM_STATES = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"];
const emptyChannel = { name: "", description: "", logoUrl: "", sortOrder: 0 };
const emptyProgram = { channelId: "", title: "", synopsis: "", playbackUrl: "", mediaAssetId: "" };

async function tvFetch(path, options = {}, admin = true) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`${BACKEND}/api/tv${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

const jsonOptions = (method, body) => ({ method, body: JSON.stringify(body) });
const dateText = (value) => value ? new Date(value).toLocaleString() : "—";

export default function ParagonTvAdmin() {
  const [tab, setTab] = useState("Channels");
  const [channels, setChannels] = useState({ items: [], nextCursor: null, hasMore: false });
  const [programs, setPrograms] = useState({ items: [], nextCursor: null, hasMore: false });
  const [channelForm, setChannelForm] = useState(emptyChannel);
  const [programForm, setProgramForm] = useState(emptyProgram);
  const [editingChannelId, setEditingChannelId] = useState("");
  const [editingProgramId, setEditingProgramId] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [guideChannelId, setGuideChannelId] = useState("");
  const [guide, setGuide] = useState({ current: null, next: null, upcoming: [] });
  const [schedule, setSchedule] = useState({ startsAt: "", endsAt: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeChannels = useMemo(() => channels.items.filter((item) => item.status === "ACTIVE"), [channels.items]);

  const run = async (action, successMessage) => {
    setBusy(true); setError(""); setMessage("");
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const loadChannels = useCallback(async (cursor = "", append = false) => {
    const suffix = new URLSearchParams({ pageSize: "20", ...(cursor ? { cursor } : {}) });
    const result = await tvFetch(`/admin/channels?${suffix}`);
    setChannels((current) => ({ ...result, items: append ? [...current.items, ...result.items] : result.items }));
    return result;
  }, []);

  const loadPrograms = useCallback(async (cursor = "", append = false) => {
    const params = new URLSearchParams({ pageSize: "20" });
    if (cursor) params.set("cursor", cursor);
    if (channelFilter) params.set("channelId", channelFilter);
    if (statusFilter) params.set("status", statusFilter);
    const result = await tvFetch(`/admin/programs?${params}`);
    setPrograms((current) => ({ ...result, items: append ? [...current.items, ...result.items] : result.items }));
    return result;
  }, [channelFilter, statusFilter]);

  useEffect(() => {
    let active = true;
    Promise.all([loadChannels(), loadPrograms()])
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadChannels, loadPrograms]);

  useEffect(() => {
    if (!guideChannelId) { setGuide({ current: null, next: null, upcoming: [] }); return; }
    let active = true;
    Promise.all([
      tvFetch(`/channels/${guideChannelId}/current`, {}, false),
      tvFetch(`/channels/${guideChannelId}/next`, {}, false),
      tvFetch(`/channels/${guideChannelId}/schedule?pageSize=20`, {}, false),
    ]).then(([current, next, upcoming]) => {
      if (active) setGuide({ current: current.program, next: next.program, upcoming: upcoming.items || [] });
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [guideChannelId]);

  const saveChannel = () => run(async () => {
    if (editingChannelId) await tvFetch(`/admin/channels/${editingChannelId}`, jsonOptions("PUT", channelForm));
    else await tvFetch("/admin/channels", jsonOptions("POST", channelForm));
    setChannelForm(emptyChannel); setEditingChannelId(""); await loadChannels();
  }, editingChannelId ? "Channel updated." : "Channel created as DRAFT.");

  const editChannel = async (id) => run(async () => {
    const item = await tvFetch(`/admin/channels/${id}`);
    setEditingChannelId(id);
    setChannelForm({ name: item.name || "", description: item.description || "", logoUrl: item.logoUrl || "", sortOrder: item.sortOrder || 0 });
  });

  const setChannelStatus = (item, action) => {
    if (!window.confirm(`${action === "activate" ? "Activate" : "Deactivate"} ${item.name}?`)) return;
    run(async () => {
      await tvFetch(`/admin/channels/${item.id}/${action}`, { method: "POST" });
      await loadChannels();
    }, `Channel ${action === "activate" ? "activated" : "deactivated"}.`);
  };

  const saveProgram = () => run(async () => {
    if (editingProgramId) await tvFetch(`/admin/programs/${editingProgramId}`, jsonOptions("PUT", programForm));
    else await tvFetch("/admin/programs", jsonOptions("POST", programForm));
    setProgramForm(emptyProgram); setEditingProgramId(""); setSchedule({ startsAt: "", endsAt: "" }); await loadPrograms();
  }, editingProgramId ? "Program updated." : "Program created as DRAFT.");

  const editProgram = async (id) => run(async () => {
    const item = await tvFetch(`/admin/programs/${id}`);
    setEditingProgramId(id);
    setProgramForm({ channelId: item.channelId || "", title: item.title || "", synopsis: item.synopsis || "", playbackUrl: item.playbackUrl || "", mediaAssetId: item.mediaAssetId || "" });
    setSchedule({ startsAt: localDateValue(item.startsAt), endsAt: localDateValue(item.endsAt) });
    setTab("Programs");
  });

  const scheduleProgram = () => run(async () => {
    if (!editingProgramId) throw new Error("Save or open a program before scheduling it.");
    await tvFetch(`/admin/programs/${editingProgramId}/schedule`, jsonOptions("POST", {
      startsAt: new Date(schedule.startsAt).toISOString(), endsAt: new Date(schedule.endsAt).toISOString(),
    }));
    await loadPrograms();
  }, "Program scheduled.");

  return <section style={shellStyle}>
    <header><h2 style={{ marginBottom: 4 }}>PARAGON TV PROGRAMMING</h2><p style={mutedStyle}>Manage channels, programs, schedules, and the public program guide.</p></header>
    <div style={tabsStyle}>{["Channels", "Programs", "Guide Preview"].map((name) => <button key={name} type="button" onClick={() => setTab(name)} style={tabStyle(tab === name)}>{name}</button>)}</div>
    {message && <div style={successStyle}>{message}</div>}
    {error && <div role="alert" style={errorStyle}>{error}</div>}
    {loading ? <p>Loading Paragon TV administration…</p> : <>
      {tab === "Channels" && <div style={columnsStyle}>
        <Card title={editingChannelId ? "Edit Channel" : "Create Channel"}>
          <Field label="Name"><input required value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} /></Field>
          <Field label="Description"><textarea value={channelForm.description} onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })} /></Field>
          <Field label="Logo HTTPS URL"><input type="url" value={channelForm.logoUrl} onChange={(e) => setChannelForm({ ...channelForm, logoUrl: e.target.value })} /></Field>
          <Field label="Sort order"><input type="number" min="0" value={channelForm.sortOrder} onChange={(e) => setChannelForm({ ...channelForm, sortOrder: Number(e.target.value) })} /></Field>
          <ActionRow><Primary disabled={busy || !channelForm.name} onClick={saveChannel}>{editingChannelId ? "Save Channel" : "Create Channel"}</Primary>{editingChannelId && <Secondary onClick={() => { setEditingChannelId(""); setChannelForm(emptyChannel); }}>Cancel</Secondary>}</ActionRow>
        </Card>
        <Card title="Channels">
          {!channels.items.length ? <Empty text="No TV channels have been created." /> : channels.items.map((item) => <Item key={item.id} title={item.name} status={item.status} subtitle={item.description || "No description"}>
            <Secondary onClick={() => editChannel(item.id)}>Open / Edit</Secondary>
            {item.status !== "ACTIVE" ? <Primary onClick={() => setChannelStatus(item, "activate")}>Activate</Primary> : <Danger onClick={() => setChannelStatus(item, "deactivate")}>Deactivate</Danger>}
          </Item>)}
          {channels.hasMore && <Secondary onClick={() => run(() => loadChannels(channels.nextCursor, true))}>Load more</Secondary>}
        </Card>
      </div>}
      {tab === "Programs" && <div style={{ display: "grid", gap: 18 }}>
        <Card title={editingProgramId ? "Edit Program" : "Create Program"}>
          <div style={formGridStyle}>
            <Field label="Channel"><select value={programForm.channelId} onChange={(e) => setProgramForm({ ...programForm, channelId: e.target.value })}><option value="">Select channel</option>{channels.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.status})</option>)}</select></Field>
            <Field label="Title"><input value={programForm.title} onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })} /></Field>
            <Field label="Description"><textarea value={programForm.synopsis} onChange={(e) => setProgramForm({ ...programForm, synopsis: e.target.value })} /></Field>
            <Field label="HTTPS playback URL"><input type="url" value={programForm.playbackUrl} onChange={(e) => setProgramForm({ ...programForm, playbackUrl: e.target.value })} /></Field>
            <Field label="Existing media asset ID"><input value={programForm.mediaAssetId} onChange={(e) => setProgramForm({ ...programForm, mediaAssetId: e.target.value })} /></Field>
          </div>
          <ActionRow><Primary disabled={busy || !programForm.channelId || !programForm.title} onClick={saveProgram}>{editingProgramId ? "Save Program" : "Create Program"}</Primary>{editingProgramId && <Secondary onClick={() => { setEditingProgramId(""); setProgramForm(emptyProgram); setSchedule({ startsAt: "", endsAt: "" }); }}>Cancel</Secondary>}</ActionRow>
          {editingProgramId && <div style={scheduleStyle}><h4>Schedule Program</h4><div style={formGridStyle}><Field label="Broadcast date / start time"><input type="datetime-local" value={schedule.startsAt} onChange={(e) => setSchedule({ ...schedule, startsAt: e.target.value })} /></Field><Field label="End date / time"><input type="datetime-local" value={schedule.endsAt} onChange={(e) => setSchedule({ ...schedule, endsAt: e.target.value })} /></Field></div><Primary disabled={busy || !schedule.startsAt || !schedule.endsAt} onClick={scheduleProgram}>Schedule Program</Primary><p style={mutedStyle}>The selected channel must be ACTIVE and the program must have a playback URL or media asset.</p></div>}
        </Card>
        <Card title="Programs">
          <div style={filterStyle}><select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}><option value="">All channels</option>{channels.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option>{PROGRAM_STATES.map((state) => <option key={state}>{state}</option>)}</select><Secondary onClick={() => run(() => loadPrograms())}>Refresh</Secondary></div>
          {!programs.items.length ? <Empty text="No programs match the selected filters." /> : programs.items.map((item) => <Item key={item.id} title={item.title} status={item.status} subtitle={`${channelName(channels.items, item.channelId)} · ${dateText(item.startsAt)}`}><Secondary onClick={() => editProgram(item.id)}>Open / Edit</Secondary></Item>)}
          {programs.hasMore && <Secondary onClick={() => run(() => loadPrograms(programs.nextCursor, true))}>Load more</Secondary>}
        </Card>
      </div>}
      {tab === "Guide Preview" && <Card title="Public Program Guide Preview">
        <Field label="Active channel"><select value={guideChannelId} onChange={(e) => setGuideChannelId(e.target.value)}><option value="">Select channel</option>{activeChannels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {!guideChannelId ? <Empty text="Select an active channel to preview its guide." /> : <div style={guideGridStyle}><Guide title="NOW" program={guide.current} /><Guide title="NEXT" program={guide.next} /><div style={{ gridColumn: "1 / -1" }}><h3>UPCOMING</h3>{guide.upcoming.length ? guide.upcoming.map((item) => <Item key={item.id} title={item.title} status={item.status} subtitle={`${dateText(item.startsAt)} – ${dateText(item.endsAt)}`} />) : <Empty text="No upcoming programs." />}</div></div>}
      </Card>}
    </>}
    <p style={mutedStyle}>Channel states: {CHANNEL_STATES.join(" · ")} &nbsp; Program states: {PROGRAM_STATES.join(" · ")}</p>
  </section>;
}

function localDateValue(value) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function channelName(channels, id) { return channels.find((item) => item.id === id)?.name || id; }
function Card({ title, children }) { return <section style={cardStyle}><h3 style={{ marginTop: 0 }}>{title}</h3>{children}</section>; }
function Field({ label, children }) { return <label style={fieldStyle}><span style={{ fontWeight: 700 }}>{label}</span>{children}</label>; }
function Item({ title, status, subtitle, children }) { return <article style={itemStyle}><div style={{ flex: "1 1 240px" }}><strong>{title}</strong> <Status value={status} /><div style={mutedStyle}>{subtitle}</div></div>{children && <div style={actionsStyle}>{children}</div>}</article>; }
function Status({ value }) { return <span style={statusStyle}>{value}</span>; }
function Guide({ title, program }) { return <div style={guideCardStyle}><h3>{title}</h3>{program ? <><strong>{program.title}</strong><p>{dateText(program.startsAt)} – {dateText(program.endsAt)}</p><Status value={program.status} /></> : <Empty text={`Nothing ${title.toLowerCase()}.`} />}</div>; }
function Empty({ text }) { return <p style={mutedStyle}>{text}</p>; }
function ActionRow({ children }) { return <div style={actionsStyle}>{children}</div>; }
function Primary({ children, ...props }) { return <button type="button" {...props} style={{ ...buttonStyle, background: "#111", color: "#fff", opacity: props.disabled ? 0.55 : 1 }}>{children}</button>; }
function Secondary({ children, ...props }) { return <button type="button" {...props} style={{ ...buttonStyle, background: "#fff", color: "#111", border: "1px solid #aaa" }}>{children}</button>; }
function Danger({ children, ...props }) { return <button type="button" {...props} style={{ ...buttonStyle, background: "#9b1c1c", color: "#fff" }}>{children}</button>; }

const shellStyle = { display: "grid", gap: 18, minWidth: 0 };
const tabsStyle = { display: "flex", flexWrap: "wrap", gap: 8 };
const tabStyle = (active) => ({ ...buttonStyle, background: active ? "#000" : "#f3f3f3", color: active ? "#fff" : "#000", border: "1px solid #ccc" });
const columnsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, alignItems: "start" };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 };
const cardStyle = { border: "1px solid #ddd", borderRadius: 10, padding: 16, background: "#fff", minWidth: 0 };
const fieldStyle = { display: "grid", gap: 6, marginBottom: 12 };
const itemStyle = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" };
const actionsStyle = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 };
const buttonStyle = { border: 0, borderRadius: 6, padding: "9px 13px", cursor: "pointer", fontWeight: 700 };
const statusStyle = { display: "inline-block", borderRadius: 999, padding: "3px 8px", marginLeft: 6, background: "#eee", fontSize: 12, fontWeight: 700 };
const scheduleStyle = { marginTop: 18, padding: 14, background: "#f7f7f7", borderRadius: 8 };
const filterStyle = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 };
const guideGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12, marginTop: 14 };
const guideCardStyle = { border: "1px solid #ddd", borderRadius: 8, padding: 14, background: "#fafafa" };
const mutedStyle = { color: "#52616b", lineHeight: 1.5 };
const successStyle = { padding: 12, borderRadius: 8, background: "#ecfdf5", border: "1px solid #10b981" };
const errorStyle = { padding: 12, borderRadius: 8, background: "#fef2f2", border: "1px solid #dc2626", color: "#991b1b" };
