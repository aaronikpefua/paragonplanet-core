import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { API_URL, appCheckFetch } from "../lib/supportActions";
import { openLiveRoomClient } from "../lib/liveRoomClient";
import Hls from "hls.js";

const LIVE_TABS = ["Live Now", "Upcoming", "Following", "Replays"];

const LIVE_SPRAY_CHOICES = [
  { key: "p1", amount: 1, currency: "PARAG" },
  { key: "g1", amount: 1, currency: "GBAZILO" },
  { key: "p10", amount: 10, currency: "PARAG" },
  { key: "g10", amount: 10, currency: "GBAZILO" },
  { key: "p50", amount: 50, currency: "PARAG" },
  { key: "g50", amount: 50, currency: "GBAZILO" },
  { key: "p100", amount: 100, currency: "PARAG" },
  { key: "g100", amount: 100, currency: "GBAZILO" },
];

const LIVE_BOTTLE_CHOICES = [
  { key: "mineral", icon: "🥤", title: "Mineral", costLabel: "2 PARAG", parag: 2 },
  { key: "malt", icon: "🥛", title: "Malt", costLabel: "3 PARAG", parag: 3 },
  { key: "juice", icon: "🧃", title: "Juice", costLabel: "4 PARAG", parag: 4 },
  { key: "mocktail", icon: "🍹", title: "Mocktail", costLabel: "5 PARAG", parag: 5 },
  { key: "beer", icon: "🍺", title: "Beer", costLabel: "6 PARAG", parag: 6 },
  { key: "gin", icon: "🍸", title: "Gin", costLabel: "7 PARAG", parag: 7 },
  { key: "rum", icon: "🥃", title: "Rum", costLabel: "8 PARAG", parag: 8 },
  { key: "whiskey", icon: "🥃", title: "Whisky", costLabel: "1 GBAZILO", gbazilo: 1 },
  { key: "vodka", icon: "🍸", title: "Vodka", costLabel: "9 PARAG", parag: 9 },
  { key: "cocktail", icon: "🍸", title: "Cocktail", costLabel: "G1 P2", parag: 2, gbazilo: 1 },
];

const LIVE_SESSION_POLL_MS = {
  "Live Now": 6000,
  Upcoming: 30000,
  Following: 30000,
  Replays: 15000,
};
const LIVE_CHAT_POLL_MS = 4000;
const GO_LIVE_LOCAL_COOLDOWN_MS = 12000;

const LIVE_PURPOSES_BY_ROLE = {
  CITIZEN: ["Campaign for Votes", "Live Performance", "Audience Q&A", "Why I Should Qualify", "Qualification Update", "Live Together"],
  PROMOTER: ["Promote a Citizen", "Citizen Interview", "Vote Campaign", "Audience Discussion", "Live Together"],
  AMBASSADOR: ["Promote a Citizen", "Citizen Interview", "Vote Campaign", "Audience Discussion", "Live Together"],
  BACKER: ["Sector Discussion", "Q&A", "Knowledge Challenge", "Service Promotion", "Live Together"],
  SUPERNAL: ["Expert Discussion", "Public Q&A", "Knowledge Challenge", "Professional Presentation", "Live Together"],
  SUPERBOSS: ["Expert Discussion", "Public Q&A", "Knowledge Challenge", "Professional Presentation", "Live Together"],
  MERCHANT: ["Product Demonstration", "Product Launch", "Buyer Q&A", "Marketplace Promotion"],
};

export default function ParagonLive() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const whipResourceRef = useRef("");
  const heartbeatRef = useRef(null);
  const webLiveResultRef = useRef(null);
  const startInFlightRef = useRef(false);
  const sessionsLoadRef = useRef(null);
  const lastStartAttemptRef = useRef(0);
  const [tab, setTab] = useState("Live Now");
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState("");
  const [displayName, setDisplayName] = useState("Paragon Host");
  const [showPurposes, setShowPurposes] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState("");
  const [liveTitle, setLiveTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [status, setStatus] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [liveProvider, setLiveProvider] = useState(null);
  const [webLiveResult, setWebLiveResult] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [broadcastLive, setBroadcastLive] = useState(false);
  const [startBlockedUntil, setStartBlockedUntil] = useState(0);
  const activeLiveSessionId = webLiveResult?.session?.id || "";
  const browserPublisherConfigured = Boolean(liveProvider?.browserPublishingConfigured || liveProvider?.configured);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setRole("");
        setDisplayName("Paragon Host");
        return;
      }
      setCurrentUser(user);

      const publicProfile = await getDoc(doc(db, "public_profiles", user.uid)).catch(() => null);
      const userProfile = await getDoc(doc(db, "user_profiles", user.uid)).catch(() => null);
      const data = publicProfile?.exists()
        ? publicProfile.data()
        : userProfile?.exists()
          ? userProfile.data()
          : {};
      setRole(String(data.role || data.activeRole || "").toUpperCase());
      setDisplayName(data.displayName || data.stageName || data.realName || user.displayName || "Paragon Host");
    });
  }, []);

  useEffect(() => {
    if (!currentUser || selectedSession || previewing) return undefined;
    loadLiveSessions(tab);
    const interval = window.setInterval(() => {
      loadLiveSessions(tab, { silent: true });
    }, LIVE_SESSION_POLL_MS[tab] || 15000);
    return () => window.clearInterval(interval);
  }, [tab, currentUser, selectedSession, previewing]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [previewing]);

  useEffect(() => () => stopPreview(), []);
  useEffect(() => {
    webLiveResultRef.current = webLiveResult;
  }, [webLiveResult]);

  const purposes = useMemo(() => LIVE_PURPOSES_BY_ROLE[role] || [], [role]);

  async function startPreview() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setCameraReady(Boolean(stream.getVideoTracks().length));
      setMicrophoneReady(Boolean(stream.getAudioTracks().length));
      setPreviewing(true);
      setStatus(browserPublisherConfigured ? "Preview ready. You can go Live." : "Preview ready. Live publishing service is not configured yet.");
    } catch (error) {
      setCameraReady(false);
      setMicrophoneReady(false);
      setStatus(mediaErrorMessage(error));
    }
  }

  async function loadLiveSessions(nextTab = tab, { silent = false } = {}) {
    if (!currentUser) {
      setSessions([]);
      return;
    }
    if (sessionsLoadRef.current) return sessionsLoadRef.current;
    if (!silent) setSessionsLoading(true);
    const request = (async () => {
      const token = await currentUser.getIdToken();
      const response = await appCheckFetchWithTimeout(`${API_URL}/api/live/sessions?tab=${encodeURIComponent(nextTab)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load Live sessions.");
      const nextSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
      setSessions(nextSessions);
      setSelectedSession((current) => {
        if (!current) return current;
        const fresh = nextSessions.find((session) => (session.id || session.liveSessionId) === current.id);
        if (fresh) return { ...fresh, id: fresh.id || fresh.liveSessionId };
        return nextTab === "Live Now" ? { ...current, status: "ENDED" } : current;
      });
      setLiveProvider(payload.provider || null);
    })();
    sessionsLoadRef.current = request;
    try {
      await request;
    } catch (error) {
      if (!silent) {
        setSessions([]);
        setStatus(error.message || "Could not load Live sessions.");
      }
    } finally {
      if (sessionsLoadRef.current === request) sessionsLoadRef.current = null;
      if (!silent) setSessionsLoading(false);
    }
  }

  async function scheduleLive() {
    if (!currentUser || !selectedPurpose || !liveTitle.trim() || !scheduleDate || !scheduleTime) {
      setStatus("Choose purpose, title, date and time first.");
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const response = await appCheckFetchWithTimeout(`${API_URL}/api/live/sessions/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hostRole: role,
          purpose: selectedPurpose,
          title: liveTitle,
          description,
          audience: "Public",
          scheduledAt,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not schedule Live.");
      setStatus("Live scheduled.");
      setTab("Upcoming");
      setSelectedPurpose("");
      setShowPurposes(false);
      await loadLiveSessions("Upcoming");
    } catch (error) {
      setStatus(error.message || "Could not schedule Live.");
    }
  }

  function stopPreview() {
    stopWebBroadcast();
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setPreviewing(false);
  }

  function toggleCamera() {
    const next = !cameraOn;
    streamRef.current?.getVideoTracks?.().forEach((track) => { track.enabled = next; });
    setCameraOn(next);
  }

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks?.().forEach((track) => { track.enabled = next; });
    setMicOn(next);
  }

async function startWebBroadcast() {
    if (startInFlightRef.current || publishing || broadcastLive) return;
    const now = Date.now();
    if (startBlockedUntil && now < startBlockedUntil) {
      const seconds = Math.max(1, Math.ceil((startBlockedUntil - now) / 1000));
      setStatus(`Too many Live start attempts. Please wait ${seconds} seconds and try again.`);
      return;
    }
    const localCooldownRemaining = GO_LIVE_LOCAL_COOLDOWN_MS - (now - lastStartAttemptRef.current);
    if (localCooldownRemaining > 0) {
      setStartBlockedUntil(now + localCooldownRemaining);
      setStatus(`Please wait ${Math.ceil(localCooldownRemaining / 1000)} seconds before starting another Live.`);
      return;
    }
    if (!currentUser || !selectedPurpose || !liveTitle.trim() || !streamRef.current) {
      setStatus("Preview your camera and enter a Live title first.");
      return;
    }
    startInFlightRef.current = true;
    lastStartAttemptRef.current = now;
    setPublishing(true);
    setStatus("Creating Paragon Live session...");
    const startTiming = createLiveTiming("web-go-live", "pending");
    logLiveTiming(startTiming, "T0_start_pressed");
    try {
      const token = await currentUser.getIdToken();
      const response = await appCheckFetchWithTimeout(`${API_URL}/api/live/sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hostRole: role,
          purpose: selectedPurpose,
          title: liveTitle,
          description,
          audience: "Public",
          publisherTransport: "whip",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || "Could not start Paragon Live.");
        error.status = response.status;
        error.retryAfter = Number(response.headers.get("Retry-After") || 0);
        throw error;
      }
      logLiveTiming(startTiming, "T1_session_created", {
        status: response.status,
        hasWhip: Boolean(payload.ingest?.webRtcPublishUrl || payload.ingest?.webRtcUrl),
      });
      const webRtcPublishUrl = payload.ingest?.webRtcPublishUrl || payload.ingest?.webRtcUrl;
      if (!webRtcPublishUrl) throw new Error("Browser Live publishing is not available for this session.");
      const normalizedSession = { ...payload.session, id: payload.session?.id || payload.session?.liveSessionId };
      const nextResult = { ...payload, session: normalizedSession };
      setStartBlockedUntil(0);
      setWebLiveResult(nextResult);
      webLiveResultRef.current = nextResult;
      startTiming.id = normalizedSession.id || startTiming.id;
      setStatus("Connecting browser broadcast...");
      await publishStreamWithWhip({
        stream: streamRef.current,
        whipUrl: webRtcPublishUrl,
        timing: startTiming,
        onPeerConnection: (peerConnection) => {
          peerConnectionRef.current = peerConnection;
        },
        onWhipResource: (resourceUrl) => {
          whipResourceRef.current = resourceUrl;
        },
        onConnected: async () => {
          logLiveTiming(startTiming, "T4_whip_connected");
          setBroadcastLive(true);
          setStatus("Provider connected. Preparing viewers...");
          const activeSession = await waitForWebLiveActive(normalizedSession.id, token, startTiming);
          logLiveTiming(startTiming, "T5_directory_active");
          const activeResult = {
            ...nextResult,
            session: {
              ...normalizedSession,
              ...activeSession,
              status: activeSession?.status || "ACTIVE",
            },
          };
          setStatus("You are Live.");
          setWebLiveResult(activeResult);
          webLiveResultRef.current = activeResult;
          setTab("Live Now");
          loadLiveSessions("Live Now", { silent: true });
          startWebLiveHeartbeat(normalizedSession.id, token);
        },
      });
    } catch (error) {
      setBroadcastLive(false);
      if (error?.status === 429 && Number(error.retryAfter || 0) > 0) {
        setStartBlockedUntil(Date.now() + Number(error.retryAfter) * 1000);
      }
      setStatus(startLiveErrorMessage(error));
      await stopWebBroadcast({ keepPreview: true });
    } finally {
      startInFlightRef.current = false;
      setPublishing(false);
    }
  }

  async function markWebLiveActive(sessionId, token) {
    if (!sessionId) return;
    const response = await appCheckFetchWithTimeout(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/active`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Live connected, but directory update failed.");
    }
    const payload = await response.json().catch(() => ({}));
    return payload.session;
  }

  async function waitForWebLiveActive(sessionId, token, timing) {
    let lastError = null;
    let lastSession = null;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        const session = await markWebLiveActive(sessionId, token);
        lastSession = session || lastSession;
        if (session?.viewerPlayable === true) return session;
        if (session?.providerLive === true) {
          setWebLiveResult((current) => current ? { ...current, session: { ...current.session, ...session } } : current);
          setStatus(`Provider connected. Preparing viewers... ${attempt}/10`);
        }
      } catch (error) {
        lastError = error;
        logLiveTiming(timing, "cloudflare_active_wait", { attempt, message: error?.message || "" });
        setStatusFromProviderWait(errorProviderWaitMessage(lastError, attempt));
      }
      await new Promise((resolve) => window.setTimeout(resolve, attempt <= 5 ? 1500 : 3000));
    }
    if (lastSession?.providerLive === true) return lastSession;
    throw lastError || new Error("Cloudflare has not confirmed this Live input is active yet.");
  }

  function setStatusFromProviderWait(message) {
    setStatus(message);
  }

  function errorProviderWaitMessage(error, attempt) {
    const raw = String(error?.message || "");
    if (raw.includes("Viewer playback is still preparing")) return `Provider connected. Preparing viewers... ${attempt}/10`;
    return `Waiting for Cloudflare ingest confirmation... ${attempt}/10`;
  }

  function startWebLiveHeartbeat(sessionId, token) {
    window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = window.setInterval(() => {
      appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }, 15000);
  }

  async function stopWebBroadcast({ keepPreview = false } = {}) {
    window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    const location = whipResourceRef.current;
    whipResourceRef.current = "";
    if (location) {
      fetch(location, { method: "DELETE" }).catch(() => undefined);
    }
    peerConnectionRef.current?.close?.();
    peerConnectionRef.current = null;
    const result = webLiveResultRef.current;
    if (result?.session?.id && currentUser) {
      currentUser.getIdToken()
        .then((token) => appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(result.session.id)}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }))
        .catch(() => undefined);
    }
    setBroadcastLive(false);
    setPublishing(false);
    setWebLiveResult(null);
    webLiveResultRef.current = null;
    if (keepPreview && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.enabled = track.kind === "audio" ? micOn : cameraOn;
      });
    }
  }

  if (previewing && selectedPurpose) {
    return (
      <main style={pageStyle}>
        <header style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>🔴 PARAGON LIVE PREVIEW</p>
            <h1 style={titleStyle}>{liveTitle || selectedPurpose}</h1>
          </div>
          <button type="button" onClick={stopPreview} style={ghostButtonStyle}>Back</button>
        </header>
        <section style={previewPanelStyle}>
          <video ref={videoRef} autoPlay muted playsInline style={previewVideoStyle} />
          <p style={eyebrowStyle}>@{displayName}</p>
          <h2 style={sectionTitleStyle}>{selectedPurpose}</h2>
          <p style={mutedStyle}>{description || "Public Paragon Live preview"}</p>
          <div style={actionRowStyle}>
            <button type="button" onClick={toggleMic} style={miniButtonStyle}>{micOn ? "🎤 Mute" : "🎤 Unmute"}</button>
            <button type="button" onClick={toggleCamera} style={miniButtonStyle}>{cameraOn ? "📹 Camera Off" : "📹 Camera On"}</button>
            <button type="button" onClick={() => setStatus("Flip camera will activate with the full Live provider runtime.")} style={miniButtonStyle}>🔄 Flip</button>
            <button type="button" onClick={stopPreview} style={miniButtonStyle}>Cancel</button>
          </div>
          <p style={noticeStyle}>{status || "Live streaming service is not configured yet."}</p>
          {broadcastLive ? (
            <>
              {activeLiveSessionId ? (
                <LiveChatPanel
                  sessionId={activeLiveSessionId}
                  currentUser={currentUser}
                  title="Live Chat"
                  showComposer={false}
                  showEmptyPlaceholder={false}
                />
              ) : null}
              <button type="button" onClick={() => stopPreview()} style={dangerButtonStyle}>END LIVE</button>
            </>
          ) : (
            <button
              type="button"
              disabled={!cameraReady || !microphoneReady || !browserPublisherConfigured || publishing || startInFlightRef.current || (startBlockedUntil && Date.now() < startBlockedUntil)}
              onClick={startWebBroadcast}
              style={!cameraReady || !microphoneReady || !browserPublisherConfigured || publishing || startInFlightRef.current || (startBlockedUntil && Date.now() < startBlockedUntil) ? disabledGoldButtonStyle : goldButtonStyle}
            >
              {publishing ? "STARTING..." : "GO LIVE"}
            </button>
          )}
        </section>
      </main>
    );
  }

  if (selectedSession) {
    return (
      <main style={liveViewerPageStyle}>
        <LiveViewer
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>🔴 PARAGON LIVE</p>
          <h1 style={titleStyle}>Paragon Live Home</h1>
        </div>
        <button type="button" onClick={() => selectedPurpose ? setSelectedPurpose("") : navigate("/")} style={ghostButtonStyle}>
          {selectedPurpose ? "Back" : "Home"}
        </button>
      </header>

      <nav style={tabsStyle} aria-label="Paragon Live sections">
        {LIVE_TABS.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} style={pillStyle(tab === item)}>{item}</button>
        ))}
      </nav>

      {purposes.length ? (
        <section style={goLiveSectionStyle}>
          <button type="button" onClick={() => setShowPurposes((value) => !value)} style={goldButtonStyle}>+ Go Live</button>
          {showPurposes && !selectedPurpose ? (
            <div style={purposePanelStyle}>
              <h2 style={sectionTitleStyle}>Choose Live purpose</h2>
              <div style={purposeGridStyle}>
                {purposes.map((purpose) => (
                  <button key={purpose} type="button" onClick={() => { setSelectedPurpose(purpose); setLiveTitle(purpose); setStatus("Live setup ready. Add a title and preview before going Live."); }} style={purposeButtonStyle}>
                    {purpose}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedPurpose ? (
        <section style={purposePanelStyle}>
          <p style={eyebrowStyle}>PARAGON LIVE SETUP</p>
          <h2 style={sectionTitleStyle}>Role: {displayRole(role)}</h2>
          <p style={mutedStyle}>Purpose: {selectedPurpose}</p>
          <p style={mutedStyle}>Audience: Public</p>
          <input value={liveTitle} onChange={(event) => setLiveTitle(event.target.value)} placeholder="Live Title" style={inputStyle} />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" style={textareaStyle} />
          <div style={scheduleRowStyle}>
            <input value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} type="date" style={inputStyle} />
            <input value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} type="time" style={inputStyle} />
          </div>
          <p style={mutedStyle}>Camera: {cameraReady ? "Ready" : "Permission needed"}</p>
          <p style={mutedStyle}>Microphone: {microphoneReady ? "Ready" : "Permission needed"}</p>
          {status ? <p style={noticeStyle}>{status}</p> : null}
          <div style={actionRowStyle}>
            <button type="button" disabled={!liveTitle.trim()} onClick={startPreview} style={liveTitle.trim() ? goldButtonStyle : disabledGoldButtonStyle}>Preview Live</button>
            <button type="button" disabled={!liveTitle.trim() || !scheduleDate || !scheduleTime} onClick={scheduleLive} style={liveTitle.trim() && scheduleDate && scheduleTime ? goldButtonStyle : disabledGoldButtonStyle}>Schedule Live</button>
          </div>
        </section>
      ) : null}

      <section style={emptyCardStyle}>
        <p style={eyebrowStyle}>{tab}</p>
        {sessionsLoading ? (
          <h2 style={sectionTitleStyle}>Loading Paragon Live...</h2>
        ) : sessions.length ? (
          <>
            <div style={sessionGridStyle}>
              {sessions.map((session) => (
                <LiveSessionCard
                  key={session.id || session.liveSessionId}
                  session={session}
                  tab={tab}
                  selected={selectedSession?.id === (session.id || session.liveSessionId)}
                  onSelect={() => setSelectedSession(selectedSession?.id === (session.id || session.liveSessionId) ? null : { ...session, id: session.id || session.liveSessionId })}
                />
              ))}
            </div>
          </>
        ) : selectedSession ? null : (
          <h2 style={sectionTitleStyle}>{emptyMessageForTab(tab)}</h2>
        )}
        {!purposes.length ? <p style={mutedStyle}>You can watch Paragon Live. Go Live is available to Citizens, Ambassadors, Backers, Superbosses, and Merchants.</p> : null}
      </section>
    </main>
  );
}

function LiveSessionCard({ session, tab, selected, onSelect }) {
  const preparingLive = tab === "Live Now" && session.providerLive && !session.viewerPlayable;
  return (
    <article style={liveCardStyle}>
      <p style={eyebrowStyle}>{tab === "Upcoming" ? "🗓️ UPCOMING" : tab === "Replays" ? "▶️ REPLAY" : "🔴 LIVE"}</p>
      <h3 style={{ margin: 0 }}>@{session.hostUsername || session.hostDisplayName || "host"}</h3>
      <p style={mutedStyle}>{displayRole(String(session.hostRole || ""))} · {session.purpose || "Paragon Live"}</p>
      <strong>{session.title || "Live now"}</strong>
      {session.description ? <p style={mutedStyle}>{session.description}</p> : null}
      {tab === "Upcoming" ? (
        <p style={noticeStyle}>{formatSchedule(session.scheduledAt, "Starts in")}</p>
      ) : tab === "Replays" ? (
        <>
          <p style={noticeStyle}>{formatBroadcastTime(session.endedAt || session.actualStartedAt || session.wentLiveAt || session.startedAt || session.createdAt, "Broadcast")}</p>
          <button type="button" onClick={onSelect} style={selected ? goldButtonStyle : miniButtonStyle}>
            {selected ? "Hide Stream" : "Watch Replay"}
          </button>
        </>
      ) : (
        <>
          <p style={noticeStyle}>{preparingLive ? "Preparing Live stream..." : formatBroadcastTime(session.actualStartedAt || session.wentLiveAt || session.startedAt || session.createdAt, "Started")}</p>
          <button type="button" onClick={onSelect} style={selected ? goldButtonStyle : miniButtonStyle}>
            {selected ? "Hide Stream" : preparingLive ? "Open Live" : "Watch Live"}
          </button>
        </>
      )}
    </article>
  );
}

function LiveViewer({ session, onClose }) {
  const selectedPlaybackUrl = session.playbackPolicy?.selectedPlaybackUrl || session.selectedPlaybackUrl || "";
  const selectedPlaybackTransport = String(session.playbackPolicy?.selectedPlaybackTransport || session.selectedPlaybackTransport || "").toLowerCase();
  const useWhep = selectedPlaybackTransport === "whep" && Boolean(selectedPlaybackUrl);
  const useHls = selectedPlaybackTransport === "hls" && Boolean(selectedPlaybackUrl);
  const playerRef = useRef(null);
  const whepPeerRef = useRef(null);
  const whepResourceRef = useRef("");
  const startupTimerRef = useRef(null);
  const firstFrameTimerRef = useRef(null);
  const timingRef = useRef(null);
  const [playerMessage, setPlayerMessage] = useState("Loading Live stream...");
  const [supportMode, setSupportMode] = useState("");

  useEffect(() => {
    const video = playerRef.current;
    if (!video) return undefined;
    window.clearTimeout(startupTimerRef.current);
    window.clearTimeout(firstFrameTimerRef.current);
    setPlayerMessage("Connecting Live...");
    timingRef.current = createLiveTiming("web-viewer", session.id || session.liveSessionId || "");
    logLiveTiming(timingRef.current, "T0_watch_selected", {
      transport: selectedPlaybackTransport || "none",
      requestedTransport: selectedPlaybackTransport || "none",
      primaryPlayback: session.playbackPolicy?.primaryPlayback || session.primaryPlayback || "none",
      fallbackPlayback: "none",
      policyReason: session.playbackPolicy?.reason || "",
      providerLive: Boolean(session.providerLive),
      viewerPlayable: Boolean(session.viewerPlayable),
      hasSelectedPlayback: Boolean(selectedPlaybackUrl),
    });
    video.preload = "auto";
    video.autoplay = true;
    video.playsInline = true;
    startupTimerRef.current = window.setTimeout(() => {
      setPlayerMessage("Buffering Live stream...");
    }, 1800);
    if (useWhep) {
      let cancelled = false;
      connectWhepPlayback({
        video,
        whepUrl: selectedPlaybackUrl,
        onPeerConnection: (peerConnection) => {
          whepPeerRef.current = peerConnection;
          peerConnection.addEventListener("iceconnectionstatechange", () => {
            logLiveTiming(timingRef.current, "whep_ice_connection_state", {
              state: peerConnection.iceConnectionState,
            });
          });
          peerConnection.addEventListener("connectionstatechange", () => {
            logLiveTiming(timingRef.current, "whep_peer_connection_state", {
              state: peerConnection.connectionState,
            });
          });
        },
        onRemoteTrack: () => {
          logLiveTiming(timingRef.current, "T5_first_remote_track");
          if (!cancelled) setPlayerMessage("Starting Live video...");
        },
        onWhepResource: (resourceUrl) => {
          whepResourceRef.current = resourceUrl;
        },
        timing: timingRef.current,
      }).then(() => {
        if (!cancelled) {
          window.clearTimeout(startupTimerRef.current);
          setPlayerMessage("Starting Live video...");
        }
      }).catch((error) => {
        window.clearTimeout(startupTimerRef.current);
        window.clearTimeout(firstFrameTimerRef.current);
        logLiveTiming(timingRef.current, "whep_startup_failed", {
          message: error?.message || "WHEP startup failed",
          hasHlsFallback: false,
        });
        if (!cancelled) setPlayerMessage("Live playback unavailable. Please try again.");
      });
      return () => {
        window.clearTimeout(startupTimerRef.current);
        window.clearTimeout(firstFrameTimerRef.current);
        cancelled = true;
        const resource = whepResourceRef.current;
        whepResourceRef.current = "";
        if (resource) fetch(resource, { method: "DELETE" }).catch(() => undefined);
        whepPeerRef.current?.close?.();
        whepPeerRef.current = null;
        if (video.srcObject) {
          video.srcObject.getTracks?.().forEach((track) => track.stop());
          video.srcObject = null;
        }
      };
    }
    if (!useHls) return undefined;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = selectedPlaybackUrl;
      video.load?.();
      logLiveTiming(timingRef.current, "T3_native_hls_attached");
      video.play?.().catch(() => undefined);
      return () => {
        cancelled = true;
        window.clearTimeout(startupTimerRef.current);
        window.clearTimeout(firstFrameTimerRef.current);
        video.removeAttribute("src");
        video.load?.();
      };
    }
    if (Hls.isSupported()) {
      logLiveTiming(timingRef.current, "T3_hlsjs_player_created");
      const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        startPosition: -1,
        maxBufferLength: 4,
        maxMaxBufferLength: 8,
        backBufferLength: 12,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 4,
        maxLiveSyncPlaybackRate: 1.5,
        manifestLoadingTimeOut: 8000,
        fragLoadingTimeOut: 12000,
      });
      hls.loadSource(selectedPlaybackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        logLiveTiming(timingRef.current, "T4_manifest_parsed");
        hls.startLoad(-1);
        video.play?.().catch(() => undefined);
      });
      hls.on(Hls.Events.FRAG_LOADED, () => {
        logLiveTiming(timingRef.current, "T5_first_fragment_loaded");
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          logLiveTiming(timingRef.current, "playback_network_retry", { fatal: true });
          setPlayerMessage("Reconnecting Live...");
          hls.startLoad(-1);
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          logLiveTiming(timingRef.current, "playback_media_recover", { fatal: true });
          hls.recoverMediaError();
          return;
        }
        window.clearTimeout(startupTimerRef.current);
        logLiveTiming(timingRef.current, "playback_fatal_error", { type: data.type });
        setPlayerMessage("Live playback unavailable. Please try again.");
      });
      return () => {
        cancelled = true;
        window.clearTimeout(startupTimerRef.current);
        window.clearTimeout(firstFrameTimerRef.current);
        hls.destroy();
      };
    }
    return undefined;
  }, [selectedPlaybackTransport, selectedPlaybackUrl, session.id, useHls, useWhep]);

  if (!selectedPlaybackUrl || (!useHls && !useWhep)) {
    return <p style={noticeStyle}>Preparing Live stream...</p>;
  }
  const ended = ["ENDED", "REPLAY_READY"].includes(String(session.status || "").toUpperCase());
  return (
    <section style={liveRoomStyle}>
      <video
        ref={playerRef}
        controls={ended}
        autoPlay
        playsInline
        preload="auto"
        style={liveRoomVideoStyle}
        onLoadedData={() => {
          window.clearTimeout(startupTimerRef.current);
          if (playerRef.current?.readyState >= 2) setPlayerMessage("");
        }}
        onCanPlay={() => {
          window.clearTimeout(startupTimerRef.current);
          setPlayerMessage("");
          playerRef.current?.play?.().catch(() => undefined);
        }}
        onPlaying={() => {
          window.clearTimeout(startupTimerRef.current);
          window.clearTimeout(firstFrameTimerRef.current);
          setPlayerMessage("");
          logLiveTiming(timingRef.current, "T6_first_frame_playing");
        }}
        onWaiting={() => {
          window.clearTimeout(startupTimerRef.current);
          startupTimerRef.current = window.setTimeout(() => {
            const video = playerRef.current;
            if (video?.readyState >= 2 && !video.paused && !video.ended) return;
            setPlayerMessage("Buffering Live stream...");
          }, 1400);
        }}
        onEnded={() => setPlayerMessage("This Live has ended.")}
      />
      <div style={liveBrandOverlayStyle}>
        <span style={liveLogoDotStyle}>🌐</span>
        <strong>Paragon Planet</strong>
      </div>
      <div style={liveNavOverlayStyle}>
        <button type="button" style={liveNavPillStyle}>🧭 Explore</button>
        <button type="button" style={liveNavPillStyle}>▦ Grid</button>
        <button type="button" style={liveNavPillStyle}>✦ Discover</button>
        <button type="button" style={{ ...liveNavPillStyle, color: "#fff" }}>🔴 Live</button>
        <button type="button" onClick={onClose} style={liveNavPillStyle}>Home</button>
      </div>
      <div style={liveTopOverlayStyle}>
        <p style={eyebrowStyle}>{ended ? "▶ REPLAY" : "🔴 PARAGON LIVE"}</p>
        <h2 style={liveRoomTitleStyle}>{session.title || "Paragon Live"}</h2>
        <p style={liveRoomMetaStyle}>@{session.hostUsername || session.hostDisplayName || "host"} · {displayRole(String(session.hostRole || ""))} · {session.purpose || "Paragon Live"}</p>
        {session.description ? <p style={liveRoomMetaStyle}>{session.description}</p> : null}
      </div>
      {!ended && playerMessage ? <div style={livePlayerNoticeStyle}>{playerMessage}</div> : null}
      {!ended ? (
        <LiveSupportRail onSelect={setSupportMode} />
      ) : null}
      <LiveChatPanel
        sessionId={session.id || session.liveSessionId}
        currentUser={auth.currentUser}
        title="Live Chat"
        compact
        showEmptyPlaceholder={false}
      />
      {supportMode ? (
        <LiveSupportTray
          sessionId={session.id || session.liveSessionId}
          mode={supportMode}
          currentUser={auth.currentUser}
          onClose={() => setSupportMode("")}
        />
      ) : null}
    </section>
  );
}

function LiveSupportRail({ onSelect }) {
  return (
    <div style={liveSupportRailStyle}>
      <button type="button" onClick={() => onSelect("vote")} style={liveRailButtonStyle}><span>🗳️</span><small>Vote</small></button>
      <button type="button" onClick={() => onSelect("water")} style={liveRailButtonStyle}><span>🚿</span><small>Pour</small></button>
      <button type="button" onClick={() => onSelect("spray")} style={liveRailButtonStyle}><span>💵</span><small>Spray</small></button>
      <button type="button" onClick={() => onSelect("bottle")} style={liveRailButtonStyle}><span>🍾</span><small>Pop</small></button>
      <button type="button" onClick={() => navigator.share?.({ title: "Paragon Live", url: window.location.href }).catch(() => undefined)} style={liveRailButtonStyle}><span>↗</span><small>Share</small></button>
    </div>
  );
}

function LiveSupportTray({ sessionId, mode, currentUser, onClose }) {
  const [selectedSpray, setSelectedSpray] = useState(LIVE_SPRAY_CHOICES[0]);
  const [selectedBottle, setSelectedBottle] = useState(LIVE_BOTTLE_CHOICES[0]);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const title = mode === "vote" ? "Vote For Me" : mode === "water" ? "Pour Me Water" : mode === "spray" ? "Spray Me Money" : "Pop Me a Bottle";
  const confirmLabel = mode === "vote"
    ? "Vote 1 PARAG"
    : mode === "water"
      ? "Pour • 5 PARAG"
      : mode === "spray"
        ? `Spray • ${selectedSpray.amount} ${selectedSpray.currency}`
        : `Pop • ${selectedBottle.costLabel}`;

  async function sendSupport() {
    if (!sessionId || !currentUser || sending) return;
    setSending(true);
    setNotice("");
    const payload = mode === "vote"
      ? { actionKey: "vote" }
      : mode === "water"
        ? { actionKey: "pour_me_water" }
        : mode === "spray"
          ? {
              actionKey: "spray_money",
              customParagAmount: selectedSpray.currency === "PARAG" ? selectedSpray.amount : 0,
              customGbaziloAmount: selectedSpray.currency === "GBAZILO" ? selectedSpray.amount : 0,
            }
          : {
              actionKey: selectedBottle.key,
              customParagAmount: selectedBottle.parag || 0,
              customGbaziloAmount: selectedBottle.gbazilo || 0,
            };
    try {
      const token = await currentUser.getIdToken();
      const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Support action failed.");
      setNotice(`${title} sent`);
      window.setTimeout(onClose, 650);
    } catch (error) {
      setNotice(friendlySupportError(error.message));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={liveSupportTrayStyle}>
      <div style={supportTrayHeaderStyle}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button type="button" onClick={onClose} style={miniButtonStyle}>×</button>
      </div>
      {mode === "vote" ? <div style={simpleSupportStyle}>🗳️<strong>Vote 1 PARAG</strong></div> : null}
      {mode === "water" ? <div style={simpleSupportStyle}>🚿<strong>Pour 5 PARAG</strong></div> : null}
      {mode === "spray" ? (
        <div style={choiceScrollerStyle}>
          {LIVE_SPRAY_CHOICES.map((choice) => (
            <button key={choice.key} type="button" onClick={() => setSelectedSpray(choice)} style={supportChoiceStyle(choice === selectedSpray)}>
              <span>💵</span><strong>{choice.amount}</strong><small>{choice.currency}</small>
            </button>
          ))}
        </div>
      ) : null}
      {mode === "bottle" ? (
        <div style={choiceScrollerStyle}>
          {LIVE_BOTTLE_CHOICES.map((choice) => (
            <button key={choice.key} type="button" onClick={() => setSelectedBottle(choice)} style={supportChoiceStyle(choice === selectedBottle)}>
              <span>{choice.icon}</span><strong>{choice.title}</strong><small>{choice.costLabel}</small>
            </button>
          ))}
        </div>
      ) : null}
      {notice ? <p style={noticeStyle}>{notice}</p> : null}
      <button type="button" disabled={sending} onClick={sendSupport} style={sending ? disabledGoldButtonStyle : goldButtonStyle}>
        {sending ? "Sending..." : confirmLabel}
      </button>
    </div>
  );
}

function LiveChatPanel({
  sessionId,
  currentUser,
  title,
  compact = false,
  showComposer = true,
  showEmptyPlaceholder = true,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const realtimeActiveRef = useRef(false);

  function appendMessage(message) {
    if (!message) return;
    setMessages((items) => {
      if (message.id && items.some((item) => item.id === message.id)) return items;
      return [...items, message].filter(Boolean).slice(-40);
    });
  }

  useEffect(() => {
    if (!sessionId || !currentUser) return undefined;
    let cancelled = false;
    let requestInFlight = false;
    let roomClient = null;
    async function loadChat() {
      if (realtimeActiveRef.current) return;
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const token = await currentUser.getIdToken();
        const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load Live chat.");
        if (!cancelled) setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      } catch {
        if (!cancelled) setNotice("Live chat is reconnecting...");
      } finally {
        requestInFlight = false;
      }
    }
    loadChat();
    openLiveRoomClient({
      sessionId,
      currentUser,
      onState: (state) => {
        if (cancelled) return;
        realtimeActiveRef.current = state === "connected";
      },
      onEvent: (event) => {
        if (cancelled) return;
        if (event.type === "chat.message") appendMessage(event.message);
      },
    }).then((client) => {
      if (cancelled) {
        client?.close();
        return;
      }
      roomClient = client;
    }).catch(() => undefined);
    const interval = window.setInterval(loadChat, LIVE_CHAT_POLL_MS);
    return () => {
      cancelled = true;
      realtimeActiveRef.current = false;
      roomClient?.close();
      window.clearInterval(interval);
    };
  }, [sessionId, currentUser]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !sessionId || !currentUser) return;
    try {
      setNotice("");
      const token = await currentUser.getIdToken();
      const response = await appCheckFetch(`${API_URL}/api/live/sessions/${encodeURIComponent(sessionId)}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send message.");
      appendMessage(payload.message);
      setDraft("");
    } catch (error) {
      setNotice(error.message || "Could not send message.");
    }
  }

  return (
    <section style={compact ? liveRoomChatStyle : chatPanelStyle}>
      <p style={eyebrowStyle}>{title}</p>
      <div style={compact ? liveRoomChatListStyle : chatListStyle}>
        {(messages.length ? messages.slice(-8) : showEmptyPlaceholder ? [{ userName: "Paragon", text: "Audience messages will appear here." }] : []).map((message, index) => (
          <p key={message.id || index} style={chatBubbleStyle}>
            <strong>{message.userName || "Viewer"}:</strong> {message.text}
          </p>
        ))}
      </div>
      {notice ? <p style={noticeStyle}>{notice}</p> : null}
      {showComposer ? (
        <div style={compact ? liveRoomComposerStyle : chatComposerStyle}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
            placeholder="Reply to audience..."
            style={compact ? liveRoomChatInputStyle : chatInputStyle}
          />
          <button type="button" onClick={sendMessage} style={goldButtonStyle}>Send</button>
        </div>
      ) : null}
    </section>
  );
}

async function connectWhepPlayback({ video, whepUrl, onPeerConnection, onWhepResource, onRemoteTrack, timing }) {
  const peerConnection = new RTCPeerConnection();
  peerConnection.addTransceiver("video", { direction: "recvonly" });
  peerConnection.addTransceiver("audio", { direction: "recvonly" });
  peerConnection.ontrack = (event) => {
    const [stream] = event.streams?.length ? event.streams : [new MediaStream([event.track])];
    if (stream && video.srcObject !== stream) {
      onRemoteTrack?.();
      video.srcObject = stream;
      video.play?.().catch(() => undefined);
    }
  };
  onPeerConnection?.(peerConnection);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  logLiveTiming(timing, "T2_whep_offer_created");
  await waitForInitialIceCandidate(peerConnection);
  logLiveTiming(timing, "T3_whep_offer_posting", {
    iceGatheringState: peerConnection.iceGatheringState,
  });
  const requestStartedAt = performance.now();
  const response = await fetchWithTimeout(whepUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Accept: "application/sdp",
    },
    body: peerConnection.localDescription?.sdp || offer.sdp,
  }, 30000, "Cloudflare Live playback timed out.");
  logLiveTiming(timing, "T4_whep_response", {
    status: response.status,
    durationMs: Math.round(performance.now() - requestStartedAt),
  });
  const answer = await response.text();
  if (!response.ok) throw new Error("Cloudflare Live playback connection failed.");
  const location = response.headers.get("Location") || response.headers.get("location") || "";
  onWhepResource?.(location ? new URL(location, whepUrl).toString() : "");
  await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
}

async function publishStreamWithWhip({ stream, whipUrl, onPeerConnection, onWhipResource, onConnected, timing }) {
  const peerConnection = new RTCPeerConnection();
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
  onPeerConnection?.(peerConnection);
  logLiveTiming(timing, "T2_peer_created", {
    videoTracks: stream.getVideoTracks().length,
    audioTracks: stream.getAudioTracks().length,
  });
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGatheringComplete(peerConnection);
  logLiveTiming(timing, "T3_ice_gathered");
  const response = await fetchWithTimeout(whipUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Accept: "application/sdp",
    },
    body: peerConnection.localDescription?.sdp || offer.sdp,
  }, 30000, "Cloudflare browser publishing timed out.");
  logLiveTiming(timing, "T4_whip_response", {
    status: response.status,
    iceConnectionState: peerConnection.iceConnectionState,
    connectionState: peerConnection.connectionState,
  });
  const answer = await response.text();
  if (!response.ok) throw new Error("Cloudflare browser publishing connection failed.");
  const location = response.headers.get("Location") || response.headers.get("location") || "";
  onWhipResource?.(location ? new URL(location, whipUrl).toString() : "");
  await peerConnection.setRemoteDescription({ type: "answer", sdp: answer });
  await waitForPeerConnection(peerConnection, 4000).catch(() => undefined);
  await onConnected?.();
}

async function appCheckFetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const timeoutMessage = "Live request timed out. Please check your connection and try again.";
  const { signal, clear } = timeoutSignal(timeoutMs, timeoutMessage);
  try {
    return await appCheckFetch(url, {
      ...options,
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clear();
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000, timeoutMessage = "Request timed out.") {
  const { signal, clear } = timeoutSignal(timeoutMs, timeoutMessage);
  try {
    return await fetch(url, {
      ...options,
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(timeoutMessage);
    throw error;
  } finally {
    clear();
  }
}

function timeoutSignal(timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(timeoutMessage), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}

function waitForIceGatheringComplete(peerConnection) {
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 2500);
    peerConnection.addEventListener("icegatheringstatechange", () => {
      if (peerConnection.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        resolve();
      }
    });
  });
}

function waitForInitialIceCandidate(peerConnection, timeoutMs = 350) {
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      peerConnection.removeEventListener("icecandidate", onCandidate);
      peerConnection.removeEventListener("icegatheringstatechange", onGatheringChange);
      resolve();
    };
    const onCandidate = (event) => {
      if (event.candidate || peerConnection.iceGatheringState === "complete") finish();
    };
    const onGatheringChange = () => {
      if (peerConnection.iceGatheringState === "complete") finish();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    peerConnection.addEventListener("icecandidate", onCandidate);
    peerConnection.addEventListener("icegatheringstatechange", onGatheringChange);
  });
}

function waitForPeerConnection(peerConnection, timeoutMs = 15000) {
  if (["connected", "completed"].includes(peerConnection.iceConnectionState)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Browser Live connection timed out.")), timeoutMs);
    peerConnection.addEventListener("iceconnectionstatechange", () => {
      if (["connected", "completed"].includes(peerConnection.iceConnectionState)) {
        window.clearTimeout(timeout);
        resolve();
      }
      if (["failed", "disconnected", "closed"].includes(peerConnection.iceConnectionState)) {
        window.clearTimeout(timeout);
        reject(new Error("Browser Live connection failed."));
      }
    });
  });
}

function emptyMessageForTab(tab) {
  if (tab === "Live Now") return "No broadcaster at the moment. Check Upcoming for scheduled Lives.";
  if (tab === "Upcoming") return "No upcoming Lives scheduled.";
  if (tab === "Following") return "Lives from people you follow will appear here.";
  return "No replays available yet.";
}

function formatSchedule(value, prefix = "Starts in") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  const countdown = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${diffMs > 0 ? ` · ${prefix} ${countdown}` : ""}`;
}

function formatBroadcastTime(value, label) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${label}: ${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function displayRole(role) {
  if (role === "PROMOTER" || role === "AMBASSADOR") return "Ambassador";
  if (role === "SUPERNAL" || role === "SUPERBOSS") return "Superboss";
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : "Host";
}

function mediaErrorMessage(error) {
  const name = error?.name || "MediaError";
  if (name === "NotAllowedError") return "Camera or microphone permission was denied.";
  if (name === "NotFoundError") return "No camera or microphone was found on this device.";
  if (name === "NotReadableError") return "Camera or microphone is already in use by another app.";
  if (name === "OverconstrainedError") return "The selected camera settings are not supported.";
  if (name === "SecurityError") return "Camera preview requires a secure HTTPS page.";
  return `Camera preview could not start. ${name}`;
}

function startLiveErrorMessage(error) {
  const message = error?.message || "Could not start browser Live.";
  if (error?.status === 429 && Number(error.retryAfter || 0) > 0) {
    return `Too many Live start attempts. Please wait ${Number(error.retryAfter)} seconds and try again.`;
  }
  if (message.toLowerCase().includes("too many requests")) {
    return "Too many Go Live attempts. Please wait about one minute, then tap GO LIVE once.";
  }
  return message;
}

function createLiveTiming(scope, id) {
  return { scope, id, startedAt: performance.now(), marks: new Set() };
}

function liveDebugEnabled() {
  try {
    return Boolean(import.meta.env.DEV || window.localStorage?.getItem("paragonLiveDebug") === "1");
  } catch {
    return Boolean(import.meta.env.DEV);
  }
}

function logLiveTiming(timing, event, extra = {}) {
  if (!timing || !liveDebugEnabled()) return;
  const dedupeKey = `${timing.scope}:${timing.id}:${event}`;
  if (timing.marks?.has(dedupeKey)) return;
  timing.marks?.add(dedupeKey);
  const elapsedMs = Math.round(performance.now() - timing.startedAt);
  console.info("[ParagonLiveTiming]", {
    scope: timing.scope,
    id: timing.id,
    event,
    elapsedMs,
    ...extra,
  });
}

function friendlySupportError(message = "") {
  if (message.toLowerCase().includes("own live")) return "You cannot support your own Live.";
  if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("wallet")) return "Fund Your Wallet";
  return message || "This support action could not be completed.";
}

const pageStyle = { minHeight: "100vh", background: "#000", color: "#fff", padding: "28px clamp(16px, 5vw, 56px)", display: "grid", gap: 20 };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 4 };
const eyebrowStyle = { margin: 0, color: "#d8a928", fontSize: 13, fontWeight: 900, letterSpacing: "0.04em" };
const titleStyle = { margin: "8px 0 0", fontSize: "clamp(32px, 5vw, 54px)", lineHeight: 1 };
const tabsStyle = { display: "flex", gap: 10, overflowX: "auto", flexWrap: "wrap", marginBottom: 4 };
const pillStyle = (active) => ({ border: "none", borderRadius: 999, padding: "12px 18px", background: active ? "#d8a928" : "#132033", color: active ? "#050505" : "#fff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" });
const goldButtonStyle = { ...pillStyle(true), fontSize: 16 };
const disabledGoldButtonStyle = { ...goldButtonStyle, opacity: 0.45, cursor: "not-allowed" };
const ghostButtonStyle = { ...pillStyle(false), border: "1px solid rgba(255,255,255,0.15)" };
const dangerButtonStyle = { ...pillStyle(false), background: "#b91c1c", border: "1px solid rgba(255,255,255,0.15)", fontSize: 16 };
const goLiveSectionStyle = { display: "grid", gap: 14, justifyItems: "start" };
const purposePanelStyle = { width: "100%", boxSizing: "border-box", padding: 18, borderRadius: 24, background: "#101820", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 12 };
const purposeGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 };
const purposeButtonStyle = { padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "#050505", color: "#fff", fontWeight: 800, textAlign: "left", cursor: "pointer" };
const emptyCardStyle = { minHeight: 260, display: "grid", alignContent: "center", justifyItems: "center", gap: 12, padding: 24, borderRadius: 28, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" };
const sessionGridStyle = { width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, textAlign: "left" };
const liveCardStyle = { padding: 16, borderRadius: 20, background: "#101820", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8 };
const viewerPanelStyle = { width: "100%", display: "grid", gap: 8, textAlign: "left" };
const sectionTitleStyle = { margin: 0, fontSize: "clamp(22px, 4vw, 34px)" };
const mutedStyle = { margin: 0, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 };
const noticeStyle = { margin: 0, color: "#ffd166", fontWeight: 800 };
const inputStyle = { padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,0.25)", background: "#050505", color: "#fff", fontSize: 16 };
const textareaStyle = { ...inputStyle, minHeight: 96, resize: "vertical" };
const scheduleRowStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 };
const previewPanelStyle = { ...purposePanelStyle, maxWidth: 860, margin: "0 auto" };
const previewVideoStyle = { width: "100%", maxHeight: "58vh", objectFit: "cover", borderRadius: 22, background: "#050505" };
const viewerVideoStyle = { width: "min(100%, 900px)", maxHeight: "62vh", borderRadius: 22, background: "#050505" };
const actionRowStyle = { display: "flex", gap: 10, flexWrap: "wrap" };
const miniButtonStyle = { padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "#050505", color: "#fff", fontWeight: 800, cursor: "pointer" };
const chatPanelStyle = { display: "grid", gap: 10, padding: 14, borderRadius: 18, background: "rgba(0,0,0,0.42)", border: "1px solid rgba(255,255,255,0.1)" };
const chatListStyle = { display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" };
const chatBubbleStyle = { margin: 0, padding: "8px 10px", borderRadius: 14, background: "rgba(255,255,255,0.08)", color: "#fff" };
const chatComposerStyle = { display: "flex", gap: 8, alignItems: "center" };
const chatInputStyle = { ...inputStyle, flex: 1, minWidth: 0 };
const liveViewerPageStyle = { position: "fixed", inset: 0, zIndex: 50, background: "#000", color: "#fff", overflow: "hidden" };
const liveRoomStyle = { position: "relative", width: "100vw", height: "100vh", overflow: "hidden", borderRadius: 0, background: "#000", display: "grid", placeItems: "center", textAlign: "left" };
const liveRoomVideoStyle = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" };
const liveBrandOverlayStyle = { position: "absolute", top: 22, left: 18, display: "flex", alignItems: "center", gap: 10, fontSize: 22, textShadow: "0 2px 14px rgba(0,0,0,0.9)" };
const liveLogoDotStyle = { display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: "rgba(0,0,0,0.35)" };
const liveNavOverlayStyle = { position: "absolute", top: 118, right: 28, display: "flex", gap: 24, alignItems: "center", textShadow: "0 2px 14px rgba(0,0,0,0.9)" };
const liveNavPillStyle = { border: 0, background: "transparent", color: "#fff", fontSize: 20, fontWeight: 900, cursor: "pointer" };
const liveTopOverlayStyle = { position: "absolute", left: 18, bottom: 150, maxWidth: "min(520px, 42vw)", display: "grid", gap: 8, textShadow: "0 2px 14px rgba(0,0,0,0.9)" };
const liveRoomTitleStyle = { margin: 0, fontSize: "clamp(28px, 4vw, 46px)", lineHeight: 1, color: "#fff" };
const liveRoomMetaStyle = { margin: 0, color: "rgba(255,255,255,0.9)", fontWeight: 700 };
const livePlayerNoticeStyle = { position: "absolute", left: "50%", top: "48%", transform: "translate(-50%, -50%)", padding: "10px 14px", borderRadius: 999, background: "rgba(0,0,0,0.56)", color: "#ffd166", fontWeight: 900 };
const liveSupportRailStyle = { position: "absolute", right: 28, top: "56%", transform: "translateY(-50%)", display: "grid", gap: 18 };
const liveRailButtonStyle = { display: "grid", justifyItems: "center", gap: 2, minWidth: 58, padding: "10px 8px", border: 0, borderRadius: 999, background: "rgba(8,12,18,0.45)", color: "#fff", fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 28px rgba(0,0,0,0.26)" };
const liveRoomChatStyle = { position: "absolute", left: 24, bottom: 22, width: "min(560px, calc(100% - 132px))", display: "grid", gap: 8, padding: 0, background: "transparent" };
const liveRoomChatListStyle = { display: "grid", gap: 6, maxHeight: 170, overflow: "hidden", alignContent: "end" };
const liveRoomComposerStyle = { display: "flex", gap: 8, alignItems: "center" };
const liveRoomChatInputStyle = { ...inputStyle, flex: 1, minWidth: 0, background: "rgba(0,0,0,0.5)", borderColor: "#d8a928" };
const liveSupportTrayStyle = { position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)", width: "min(760px, calc(100% - 120px))", display: "grid", gap: 12, padding: 16, borderRadius: 24, background: "rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" };
const supportTrayHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };
const simpleSupportStyle = { display: "grid", justifyItems: "center", gap: 8, color: "#fff", fontSize: 24 };
const choiceScrollerStyle = { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 };
const supportChoiceStyle = (selected) => ({ minWidth: 112, display: "grid", justifyItems: "center", gap: 4, padding: "12px 14px", border: 0, borderRadius: 18, background: selected ? "#d8a928" : "rgba(0,0,0,0.5)", color: selected ? "#050505" : "#fff", fontWeight: 900, cursor: "pointer" });
