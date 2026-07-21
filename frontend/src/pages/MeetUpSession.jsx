import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../config/firebase";

const PROFILE_SOURCES = [
  { collectionName: "citizen_profiles", role: "Citizen" },
  { collectionName: "promoter_profiles", role: "Ambassador" },
  { collectionName: "merchant_profiles", role: "Merchant" },
  { collectionName: "user_profiles", role: "User" },
  { collectionName: "backer_profiles", role: "Backer" },
  { collectionName: "supernal_profiles", role: "Superboss" },
  { collectionName: "sponsor_investor_profiles", role: "Sponsor / Investor" },
  { collectionName: "sponsor_profiles", role: "Sponsor / Investor" },
];

const CALL_TYPES = [
  { key: "voice", icon: "📞", title: "Voice Call", blurb: "Simple audio call request so both sides can talk before meeting." },
  { key: "video", icon: "🎥", title: "Video Call", blurb: "Face-to-face call request for a stronger first connection." },
];

export default function MeetUpSession() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [featuredVideo, setFeaturedVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callType, setCallType] = useState("voice");
  const [requestNote, setRequestNote] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [submittingCall, setSubmittingCall] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    const updateLayout = () => {
      setIsCompactLayout(window.innerWidth < 980);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      if (!requestId || !currentUser) return;
      setLoading(true);
      setError("");

      try {
        const sessionSnap = await getDoc(doc(db, "meetup_call_sessions", requestId));
        if (!sessionSnap.exists()) {
          setError("This meet-up request could not be found.");
          setSession(null);
          return;
        }

        const loadedSession = normalizeAreaMeetUpRequest({ id: sessionSnap.id, ...sessionSnap.data() });
        const isParticipant =
          loadedSession.requesterId === currentUser.uid || loadedSession.starId === currentUser.uid;

        if (!isParticipant) {
          setError("This meet-up is only available to the two members connected to it.");
          setSession(null);
          return;
        }

        setSession(loadedSession);
        const starProfile = await loadMemberProfile(loadedSession.starId);
        setMember(
          starProfile || {
            uid: loadedSession.starId,
            displayName: safeDisplayName(loadedSession.starName),
            role: loadedSession.starRole || "Star",
            subtitle: "",
          }
        );

        setFeaturedVideo(await loadSessionVideo(loadedSession));
      } catch (loadError) {
        console.error("Meet-up session could not load:", loadError);
        setError(loadError?.message || "This meet-up page could not load right now.");
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    if (!currentUser) {
      setLoading(false);
      return;
    }

    void loadSession();
  }, [currentUser, requestId]);

  const selectedCallType = useMemo(
    () => CALL_TYPES.find((type) => type.key === callType) || CALL_TYPES[0],
    [callType]
  );
  const featuredUrl = getBestVideoUrl(featuredVideo);
  const isStarOwner = Boolean(currentUser?.uid && session?.starId === currentUser.uid);
  const isPending = session?.status === "pending";
  const messageContact = isStarOwner
    ? {
        uid: session?.requesterId,
        displayName: safeDisplayName(session?.requesterName),
        role: "Member",
        subtitle: formatMeetUpLabel(session || {}),
      }
    : {
        uid: member?.uid || session?.starId,
        displayName: safeDisplayName(member?.displayName || session?.starName),
        role: member?.role || session?.starRole || "Star",
        subtitle: member?.subtitle || "",
      };

  useEffect(() => {
    if (!currentUser?.uid || !messageContact?.uid) {
      setChatMessages([]);
      return undefined;
    }

    return onSnapshot(
      query(collection(db, "direct_messages"), where("participantIds", "array-contains", currentUser.uid)),
      (messagesSnap) => {
        const messages = messagesSnap.docs
          .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }))
          .filter((message) => Array.isArray(message.participantIds) && message.participantIds.includes(messageContact.uid))
          .sort((first, second) => timestampSortValue(first.createdAt) - timestampSortValue(second.createdAt));
        setChatMessages(messages);
      },
      (chatError) => {
        console.warn("Meet-up chat could not load:", chatError);
        setChatMessages([]);
      }
    );
  }, [currentUser?.uid, messageContact?.uid]);

  const handleMessage = () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    navigate("/inbox", {
      state: {
        restrictToContact: true,
        returnTo: `/meet-up-session/${requestId}`,
        returnLabel: "Meet-Up",
        contact: messageContact,
      },
    });
  };

  const handleUpdateMeetUpStatus = async (nextStatus) => {
    if (!session?.id || !isStarOwner || session.status !== "pending") return;

    setUpdatingStatus(nextStatus);
    setRequestNotice("");

    try {
      await updateDoc(doc(db, "meetup_call_sessions", session.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        decidedAt: serverTimestamp(),
      });

      setSession((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
            }
          : current
      );
      setRequestNotice(nextStatus === "accepted" ? "Meet-up request accepted." : "Meet-up request declined.");
    } catch (updateError) {
      console.error("Meet-up status update failed:", updateError);
      setRequestNotice(`Could not update this meet-up request. ${updateError?.code || ""}`.trim());
    } finally {
      setUpdatingStatus("");
    }
  };

  const handleSendChat = async () => {
    const text = chatDraft.trim();
    if (!text || !currentUser?.uid || !messageContact?.uid) return;

    setSendingChat(true);
    try {
      const myProfile = await loadMemberProfile(currentUser.uid);
      await addDoc(collection(db, "direct_messages"), {
        senderId: currentUser.uid,
        receiverId: messageContact.uid,
        participantIds: [currentUser.uid, messageContact.uid],
        text,
        body: text,
        message: text,
        senderName: safeDisplayName(myProfile?.displayName || currentUser.displayName),
        receiverName: safeDisplayName(messageContact.displayName),
        senderRole: myProfile?.role || "Member",
        receiverRole: messageContact.role || "Member",
        readBy: [currentUser.uid],
        createdAt: serverTimestamp(),
      });
      setChatDraft("");
    } catch (chatError) {
      console.error("Meet-up chat send failed:", chatError);
      setRequestNotice("Could not send message right now.");
    } finally {
      setSendingChat(false);
    }
  };

  const handleSubmitCallRequest = async () => {
    if (!currentUser || !session || !member) {
      navigate("/login");
      return;
    }

    if (isStarOwner) {
      setRequestNotice("The requester should send the call request from their meet-up page.");
      return;
    }

    setSubmittingCall(true);
    setRequestNotice("");

    try {
      const requesterProfile = await loadMemberProfile(currentUser.uid);
      await addDoc(collection(db, "meetup_call_sessions"), {
        starId: member.uid,
        starName: member.displayName,
        starRole: member.role,
        requesterId: currentUser.uid,
        requesterName: safeDisplayName(requesterProfile?.displayName || currentUser.displayName),
        type: callType,
        mealMode: session.mealMode || "dinner",
        experienceLevel: session.experienceLevel || "standard",
        note: requestNote.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRequestNotice(`${selectedCallType.title} request sent.`);
      setRequestNote("");
    } catch (submitError) {
      console.error("Call request failed:", submitError);
      setRequestNotice(`Could not send call request right now. ${submitError?.code || ""}`.trim());
    } finally {
      setSubmittingCall(false);
    }
  };

  if (!currentUser && !loading) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={sectionTitleStyle}>Meet-Up</h1>
          <p style={mutedStyle}>Sign in to open this meet-up.</p>
          <button type="button" onClick={() => navigate("/login")} style={primaryButtonStyle}>Sign In</button>
        </section>
      </main>
    );
  }

  if (loading) return <main style={pageStyle}><section style={panelStyle}>Loading meet-up...</section></main>;

  if (error) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={sectionTitleStyle}>Meet-Up</h1>
          <p style={mutedStyle}>{error}</p>
          <button type="button" onClick={() => navigate("/")} style={primaryButtonStyle}>Back to Feed</button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={focusLayoutStyle}>
          <aside style={previewAsideStyle}>
            <div style={videoChatLayoutStyle(isCompactLayout)}>
              <div style={previewCardStyle(isCompactLayout)}>
                {featuredUrl ? (
                  <video style={previewVideoStyle(isCompactLayout)} src={featuredUrl} controls playsInline autoPlay />
                ) : (
                  <span style={previewEmptyStyle}>Featured star preview</span>
                )}
              </div>
              <div style={inlineChatStyle(isCompactLayout)}>
                <p style={eyebrowStyle}>Meet-up chat</p>
                <h3 style={chatTitleStyle}>{messageContact.displayName}</h3>
                <div style={chatListStyle(isCompactLayout)}>
                  {chatMessages.length ? (
                    chatMessages.map((message) => {
                      const mine = message.senderId === currentUser?.uid;
                      return (
                        <div key={message.id} style={{ ...chatBubbleStyle, ...(mine ? myChatBubbleStyle : null) }}>
                          <strong>{mine ? "You" : safeDisplayName(message.senderName || messageContact.displayName)}</strong>
                          <span>{message.text || message.body || message.message}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p style={mutedStyle}>Start the meet-up conversation here.</p>
                  )}
                </div>
                <div style={chatFormStyle(isCompactLayout)}>
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder={`Message ${messageContact.displayName}`}
                    style={chatInputStyle}
                  />
                  <button type="button" onClick={handleSendChat} disabled={sendingChat || !chatDraft.trim()} style={chatSendButtonStyle}>
                    Send
                  </button>
                </div>
              </div>
            </div>
            {featuredVideo?.title ? (
              <div style={acceptedPreviewStyle}>
                <p style={eyebrowStyle}>Selected video</p>
                <strong>{featuredVideo.title}</strong>
              </div>
            ) : null}
            <div style={acceptedPreviewStyle}>
              <p style={eyebrowStyle}>{isPending ? "Pending meet-up area" : "Accepted meet-up area"}</p>
              <strong>{session.areaIcon || ""} {session.areaTitle || "Meet-Up Area"}</strong>
              <span>{formatMeetUpLabel(session)}</span>
            </div>
            {isPending && isStarOwner ? (
              <div style={statusActionPanelStyle}>
                <p style={mutedStyle}>Review this request, then accept or decline it.</p>
                <div style={statusActionRowStyle}>
                  <button
                    type="button"
                    onClick={() => handleUpdateMeetUpStatus("accepted")}
                    style={primaryButtonStyle}
                    disabled={Boolean(updatingStatus)}
                  >
                    {updatingStatus === "accepted" ? "Accepting..." : "Accept Request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateMeetUpStatus("declined")}
                    style={secondaryButtonStyle}
                    disabled={Boolean(updatingStatus)}
                  >
                    {updatingStatus === "declined" ? "Declining..." : "Decline"}
                  </button>
                </div>
              </div>
            ) : null}
            {!isPending ? (
              <button type="button" onClick={handleMessage} style={primaryButtonStyle}>
                {isStarOwner ? "Message Member" : "Message Star"}
              </button>
            ) : null}
          </aside>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Call the Star</h2>
              <p style={mutedStyle}>Stage 1 request flow for voice and video call meet-ups.</p>
            </div>
          </div>

          <div style={callTypeRowStyle}>
            {CALL_TYPES.map((type) => {
              const active = callType === type.key;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setCallType(type.key)}
                  style={{ ...callTypeCardStyle, ...(active ? callTypeCardActiveStyle : null) }}
                >
                  <div style={callTypeIconStyle}>{type.icon}</div>
                  <div style={callTypeTextStyle}>
                    <strong>{type.title}</strong>
                    <span style={callTypeBlurbStyle}>{type.blurb}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {isPending ? (
            <div style={requestFormStyle}>
              <p style={noticeStyle}>
                {isStarOwner
                  ? "This meet-up is waiting for your decision."
                  : "This meet-up is still waiting for approval."}
              </p>
              {requestNotice ? <p style={noticeStyle}>{requestNotice}</p> : null}
            </div>
          ) : (
          <div style={requestFormStyle}>
            <textarea
              value={requestNote}
              onChange={(event) => setRequestNote(event.target.value)}
              placeholder={`Add a short note for your ${selectedCallType.title.toLowerCase()} request.`}
              style={requestTextAreaStyle}
              rows={4}
            />
            <button type="button" onClick={handleSubmitCallRequest} style={primaryButtonStyle} disabled={submittingCall}>
              {submittingCall ? `Sending ${selectedCallType.title} Request...` : `Request ${selectedCallType.title}`}
            </button>
            {requestNotice ? <p style={noticeStyle}>{requestNotice}</p> : null}
          </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatMeetUpLabel(request) {
  return `${request.areaIcon || ""} ${request.areaTitle || "Meet-Up Area"} • ${mealModeLabel(request.mealMode)} • ${experienceLabel(request.experienceLevel)}`;
}

function normalizeAreaMeetUpRequest(request) {
  if (request.areaTitle) return request;

  const [, areaIcon = "", areaTitle = "Meet-Up Area", areaPitch = ""] = String(request.note || "").split("|");
  return {
    ...request,
    areaIcon,
    areaTitle,
    areaPitch,
  };
}

function safeDisplayName(name) {
  const value = String(name || "").trim();
  if (!value || value.includes("@")) return "Member";
  return value;
}

function timestampSortValue(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.seconds === "number") return timestamp.seconds * 1000;
  return 0;
}

function getBestVideoUrl(video) {
  if (!video) return "";
  return video.mobileUrl || video.desktopUrl || video.streamUrl || video.fileUrl || video.videoUrl || video.originalUrl || "";
}

function experienceLabel(key = "standard") {
  const labels = {
    standard: "Standard Experience",
    premium: "Premium Experience",
    exclusive: "Exclusive Experience",
    vip: "VIP Experience",
    legendary: "Legendary Experience",
  };
  return labels[key] || labels.standard;
}

function mealModeLabel(mode = "dinner") {
  if (mode === "lunch") return "Lunch";
  if (mode === "breakfast") return "Breakfast";
  return "Dinner";
}

async function loadMemberProfile(uid) {
  for (const source of PROFILE_SOURCES) {
    try {
      const snap = await getDoc(doc(db, source.collectionName, uid));
      if (!snap.exists()) continue;
      const data = snap.data();
      const role = source.collectionName === "sponsor_investor_profiles" ? (data.accountType === "Investor" ? "Investor" : "Sponsor") : source.role;
      return {
        uid,
        role,
        displayName: data.stageName || data.realName || data.brandName || data.fullName || data.companyName || data.name || data.email || "Member",
        email: data.email || "",
        subtitle: data.profession || data.businessName || data.brandName || data.country || "",
      };
    } catch (error) {
      console.warn(`Skipping member profile source ${source.collectionName}:`, error?.message || error);
    }
  }
  return null;
}

async function loadSessionVideo(session) {
  if (session?.videoId) {
    try {
      const videoSnap = await getDoc(doc(db, "videos", session.videoId));
      if (videoSnap.exists()) {
        return { id: videoSnap.id, ...videoSnap.data() };
      }
    } catch (error) {
      console.warn("Selected meet-up video could not load:", error);
    }
  }

  if (session?.videoUrl) {
    return {
      id: session.videoId || "selected-video",
      title: session.videoTitle || "Selected meet-up video",
      streamUrl: session.videoUrl,
      thumbnailUrl: session.videoThumbnailUrl || "",
    };
  }

  try {
    const videoSnap = await getDocs(
      query(collection(db, "videos"), orderBy("createdAt", "desc"), limit(1))
    );
    return videoSnap.empty ? null : { id: videoSnap.docs[0].id, ...videoSnap.docs[0].data() };
  } catch (videoError) {
    console.warn("Meet-up preview video could not load:", videoError);
    return null;
  }
}

const pageStyle = { minHeight: "100vh", padding: "96px 24px 48px", background: "#f7f3ea", color: "#1f2933" };
const shellStyle = { maxWidth: 960, margin: "0 auto", display: "grid", gap: 24 };
const focusLayoutStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 };
const panelStyle = { padding: 24, borderRadius: 16, background: "#fffdf8", border: "1px solid #e2d8c8" };
const previewAsideStyle = { display: "grid", justifyItems: "center", gap: 16, alignContent: "start" };
const videoChatLayoutStyle = (compact) => ({
  width: "100%",
  display: "grid",
  gridTemplateColumns: compact ? "1fr" : "minmax(0, 1.45fr) minmax(320px, 0.75fr)",
  gap: 16,
  alignItems: "stretch",
});
const previewCardStyle = (compact) => ({
  width: "100%",
  minHeight: compact ? 300 : 420,
  borderRadius: 20,
  border: "1px dashed #dfd2bf",
  background: "#fff",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
const previewVideoStyle = (compact) => ({
  width: "100%",
  height: compact ? 300 : 420,
  objectFit: "cover",
  display: "block",
});
const previewEmptyStyle = { color: "#7b6f5c", fontWeight: 700 };
const acceptedPreviewStyle = { width: "100%", display: "grid", gap: 6, padding: 16, borderRadius: 16, border: "1px solid #bde5cf", background: "#effaf3", color: "#123b25" };
const primaryButtonStyle = { width: "100%", padding: "12px 18px", borderRadius: 999, border: "none", background: "#101828", color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle = { width: "100%", padding: "12px 18px", borderRadius: 999, border: "1px solid #d7cdbd", background: "#fff", color: "#101828", fontWeight: 800, cursor: "pointer" };
const statusActionPanelStyle = { width: "100%", display: "grid", gap: 12, padding: 16, borderRadius: 16, border: "1px solid #e2d8c8", background: "#fffdf8" };
const statusActionRowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const inlineChatStyle = (compact) => ({
  width: "100%",
  minHeight: compact ? "auto" : 420,
  display: "grid",
  gridTemplateRows: "auto auto minmax(0, 1fr) auto",
  gap: 12,
  padding: 16,
  boxSizing: "border-box",
  borderRadius: 20,
  border: "1px solid #e2d8c8",
  background: "#fffdf8",
});
const chatTitleStyle = { margin: 0, fontSize: 20 };
const chatListStyle = (compact) => ({
  minHeight: compact ? 170 : 0,
  maxHeight: compact ? 260 : "none",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 12,
  borderRadius: 14,
  background: "#f7f3ea",
  border: "1px solid #e8dccb",
});
const chatBubbleStyle = { maxWidth: "78%", display: "grid", gap: 4, alignSelf: "flex-start", padding: "10px 12px", borderRadius: 14, background: "#fff", border: "1px solid #e2d8c8", lineHeight: 1.45 };
const myChatBubbleStyle = { alignSelf: "flex-end", background: "#101828", color: "#fff", borderColor: "#101828" };
const chatFormStyle = (compact) => ({ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr auto", gap: 10 });
const chatInputStyle = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d7cdbd", font: "inherit" };
const chatSendButtonStyle = { padding: "10px 16px", borderRadius: 12, border: "none", background: "#166534", color: "#fff", fontWeight: 800, cursor: "pointer" };
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const sectionTitleStyle = { margin: 0, fontSize: 30 };
const eyebrowStyle = { margin: 0, color: "#6b5f4b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" };
const mutedStyle = { margin: 0, color: "#52616b", lineHeight: 1.6 };
const callTypeRowStyle = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 };
const callTypeCardStyle = { display: "grid", gridTemplateColumns: "52px 1fr", gap: 14, alignItems: "center", textAlign: "left", padding: 16, borderRadius: 16, border: "1px solid #e5dbcc", background: "#fff", cursor: "pointer", font: "inherit", color: "inherit" };
const callTypeCardActiveStyle = { borderColor: "#101828", background: "#fff7ef", boxShadow: "0 10px 24px rgba(16, 24, 40, 0.06)" };
const callTypeIconStyle = { width: 52, height: 52, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff4de", fontSize: 26 };
const callTypeTextStyle = { display: "grid", gap: 4 };
const callTypeBlurbStyle = { color: "#52616b", fontSize: 13, lineHeight: 1.5 };
const requestFormStyle = { display: "grid", gap: 12, marginTop: 18 };
const requestTextAreaStyle = { width: "100%", padding: 14, borderRadius: 14, border: "1px solid #ddd2c1", fontFamily: "inherit", fontSize: 15, resize: "vertical", background: "#fff" };
const noticeStyle = { margin: 0, color: "#52616b", fontWeight: 700 };
