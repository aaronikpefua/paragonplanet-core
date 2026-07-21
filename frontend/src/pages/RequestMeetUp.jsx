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

const DINNER_AREAS = [
  { icon: "🌆", title: "Rooftop Dinner", pitch: "Dine above the city lights with your star" },
  { icon: "🍴", title: "Fine Dining Restaurant", pitch: "Enjoy a luxury dinner experience" },
  { icon: "🏡", title: "Private Dining Suite", pitch: "An exclusive, intimate dinner setting" },
  { icon: "🕯️", title: "Candlelight Dinner", pitch: "A warm, elegant evening atmosphere" },
  { icon: "🚢", title: "Waterfront Dinner", pitch: "Dine by the water with scenic views" },
  { icon: "🏨", title: "Hotel Luxury Dining", pitch: "Premium dinner in a high-end hotel" },
  { icon: "🎷", title: "Live Music Dinner", pitch: "Dinner with live band or performance" },
  { icon: "🌿", title: "Garden Dinner", pitch: "Outdoor dinner in a peaceful setting" },
  { icon: "🍷", title: "Wine & Dine Experience", pitch: "A classy dinner with wine pairing" },
  { icon: "🎉", title: "Event Dinner Experience", pitch: "Dinner during a special show or event" },
];

const LUNCH_AREAS = [
  { icon: "☕", title: "Cafe Lunch", pitch: "Relaxed and friendly lunch meet-up" },
  { icon: "🍔", title: "Casual Restaurant", pitch: "Easy-going meal with your star" },
  { icon: "🏙️", title: "Rooftop Lunch", pitch: "Light dining with a city view" },
  { icon: "🌿", title: "Outdoor Garden Lunch", pitch: "Fresh air and natural environment" },
  { icon: "🏨", title: "Hotel Lounge Lunch", pitch: "Comfortable and premium midday dining" },
  { icon: "🛍️", title: "Mall Food Court Meet-Up", pitch: "Public, lively, and accessible" },
  { icon: "🍱", title: "Buffet Lunch Experience", pitch: "Enjoy a variety of meals together" },
  { icon: "🎤", title: "Studio Lunch Break", pitch: "Lunch during a creative session" },
  { icon: "🎉", title: "Event Lunch Access", pitch: "Lunch during a live event" },
  { icon: "🚗", title: "City Spot Lunch", pitch: "Quick bite at a trendy city location" },
];

const BREAKFAST_AREAS = [
  { icon: "☕", title: "Morning Cafe Meet-Up", pitch: "Start the day with coffee and conversation" },
  { icon: "🍳", title: "Brunch Spot", pitch: "Trendy and social breakfast vibe" },
  { icon: "🌅", title: "Sunrise Breakfast View", pitch: "Beautiful morning experience with your star" },
  { icon: "🏨", title: "Hotel Breakfast Lounge", pitch: "Calm and premium morning setting" },
  { icon: "🧇", title: "Casual Breakfast Spot", pitch: "Simple and relaxed meal" },
  { icon: "🌿", title: "Garden Breakfast", pitch: "Fresh and peaceful outdoor morning" },
  { icon: "🥐", title: "Bakery Meet-Up", pitch: "Coffee and pastries with your star" },
  { icon: "🏋️", title: "Post-Workout Breakfast", pitch: "Healthy meal after training" },
  { icon: "🎬", title: "Behind-the-Scenes Breakfast", pitch: "Morning during content prep" },
  { icon: "🚗", title: "Drive-In Breakfast Meet", pitch: "Quick and flexible morning hangout" },
];

const EXPERIENCE_LEVELS = [
  { key: "standard", badge: "🟢", title: "Standard Experience", blurb: "Entry-level, easy access", notes: ["Affordable", "High availability"] },
  { key: "premium", badge: "🟡", title: "Premium Experience", blurb: "Better quality, more exclusive", notes: ["Higher engagement", "Stronger fan connection"] },
  { key: "exclusive", badge: "🔴", title: "Exclusive Experience", blurb: "Limited, high-value meet-ups", notes: ["VIP feel", "Limited slots"] },
  { key: "vip", badge: "👑", title: "VIP Experience", blurb: "Elite access to your star", notes: ["Priority booking", "Special treatment"] },
  { key: "legendary", badge: "💎", title: "Legendary Experience", blurb: "Top-tier, rare moments", notes: ["Very limited", "Maximum impact & status"] },
];

const CALL_TYPES = [
  { key: "voice", icon: "📞", title: "Voice Call", blurb: "Simple audio call request so both sides can talk before meeting." },
  { key: "video", icon: "🎥", title: "Video Call", blurb: "Face-to-face call request for a stronger first connection." },
];

export default function RequestMeetUp() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [featuredVideo, setFeaturedVideo] = useState(null);
  const [meetUpVideos, setMeetUpVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mealMode, setMealMode] = useState("dinner");
  const [selectedAreaTitle, setSelectedAreaTitle] = useState(DINNER_AREAS[0].title);
  const [experienceLevel, setExperienceLevel] = useState("standard");
  const [callType, setCallType] = useState("voice");
  const [requestNote, setRequestNote] = useState("");
  const [submittingCall, setSubmittingCall] = useState(false);
  const [submittingMeetUp, setSubmittingMeetUp] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const [meetUpNotice, setMeetUpNotice] = useState("");
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [incomingMeetUps, setIncomingMeetUps] = useState([]);
  const [myMeetUpRequests, setMyMeetUpRequests] = useState([]);
  const [updatingCallId, setUpdatingCallId] = useState("");
  const [updatingMeetUpId, setUpdatingMeetUpId] = useState("");
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [viewportWidth, setViewportWidth] = useState(typeof window === "undefined" ? 1200 : window.innerWidth);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = viewportWidth < 768;
  const isStarOwner = currentUser?.uid && currentUser.uid === uid;

  useEffect(() => {
    const loadPage = async () => {
      if (!uid) return;
      setLoading(true);
      setError("");
      try {
        const profile = await loadMemberProfile(uid);
        if (!profile) {
          setError("This star is not available right now.");
          setMember(null);
          setFeaturedVideo(null);
          return;
        }
        setMember(profile);
        try {
          const videoSnap = await getDocs(
            query(collection(db, "videos"), where("visibility", "==", "meet_up"), limit(60))
          );
          if (!videoSnap.empty) {
            const loadedVideos = videoSnap.docs
              .map((videoDoc) => ({
                id: videoDoc.id,
                ...videoDoc.data(),
              }))
              .sort((first, second) => timestampSortValue(second.createdAt) - timestampSortValue(first.createdAt));
            setMeetUpVideos(loadedVideos);
            setFeaturedVideo((current) => current || loadedVideos[0]);
          } else {
            setMeetUpVideos([]);
            setFeaturedVideo(null);
            setSelectedVideoId("");
          }
        } catch (videoError) {
          console.warn("Featured star preview could not load:", videoError);
          setMeetUpVideos([]);
          setFeaturedVideo(null);
          setSelectedVideoId("");
        }
      } catch (loadError) {
        console.error("Meet-up page load failed:", loadError);
        setError("This meet-up page could not load right now.");
        setMember(null);
        setMeetUpVideos([]);
        setFeaturedVideo(null);
        setSelectedVideoId("");
      } finally {
        setLoading(false);
      }
    };
    void loadPage();
  }, [uid]);

  useEffect(() => {
    if (!uid || !currentUser?.uid) {
      setIncomingCalls([]);
      setMyRequests([]);
      return undefined;
    }

    const sessionsRef = collection(db, "meetup_call_sessions");

    if (currentUser.uid === uid) {
      setMyRequests([]);
      return onSnapshot(
        query(sessionsRef, where("starId", "==", uid)),
        (incomingSnap) => {
          setIncomingCalls(
            sortCallSessions(
              incomingSnap.docs
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                .filter((session) => !isAreaMeetUpRequest(session))
            )
          );
        },
        (callError) => {
          console.warn("Incoming call session records could not load:", callError);
          setIncomingCalls([]);
        }
      );
    }

    setIncomingCalls([]);
    return onSnapshot(
      query(
        sessionsRef,
        where("requesterId", "==", currentUser.uid),
        where("starId", "==", uid)
      ),
      (requestsSnap) => {
        setMyRequests(
          sortCallSessions(
            requestsSnap.docs
              .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
              .filter((session) => !isAreaMeetUpRequest(session))
          )
        );
      },
      (callError) => {
        console.warn("Call session records could not load:", callError);
        setMyRequests([]);
      }
    );
  }, [uid, currentUser?.uid]);

  useEffect(() => {
    if (!uid || !currentUser?.uid) {
      setIncomingMeetUps([]);
      setMyMeetUpRequests([]);
      return undefined;
    }

    const requestsRef = collection(db, "meetup_call_sessions");

    if (currentUser.uid === uid) {
      setMyMeetUpRequests([]);
      return onSnapshot(
        query(requestsRef, where("starId", "==", uid)),
        (requestsSnap) => {
          setIncomingMeetUps(
            sortMeetUpRequests(
              requestsSnap.docs
                .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
                .filter(isAreaMeetUpRequest)
                .map(normalizeAreaMeetUpRequest)
            )
          );
        },
        (requestError) => {
          console.warn("Incoming meet-up requests could not load:", requestError);
          setIncomingMeetUps([]);
        }
      );
    }

    setIncomingMeetUps([]);
    return onSnapshot(
      query(
        requestsRef,
        where("requesterId", "==", currentUser.uid),
        where("starId", "==", uid)
      ),
      (requestsSnap) => {
        setMyMeetUpRequests(
          sortMeetUpRequests(
            requestsSnap.docs
              .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
              .filter(isAreaMeetUpRequest)
              .map(normalizeAreaMeetUpRequest)
          )
        );
      },
      (requestError) => {
        console.warn("Meet-up request records could not load:", requestError);
        setMyMeetUpRequests([]);
      }
    );
  }, [uid, currentUser?.uid]);

  const activeAreas = useMemo(() => {
    if (mealMode === "lunch") return LUNCH_AREAS;
    if (mealMode === "breakfast") return BREAKFAST_AREAS;
    return DINNER_AREAS;
  }, [mealMode]);

  const selectedCallType = useMemo(() => CALL_TYPES.find((item) => item.key === callType) || CALL_TYPES[0], [callType]);
  const selectedMeetUpArea = useMemo(
    () => activeAreas.find((area) => area.title === selectedAreaTitle) || activeAreas[0],
    [activeAreas, selectedAreaTitle]
  );
  const hasPendingSelectedCall = useMemo(
    () => myRequests.some((call) => call.type === callType && call.status === "pending"),
    [callType, myRequests]
  );
  const hasPendingSelectedMeetUp = useMemo(
    () => myMeetUpRequests.some((request) => request.areaTitle === selectedMeetUpArea?.title && request.status === "pending"),
    [myMeetUpRequests, selectedMeetUpArea?.title]
  );
  const previewMeetUpRequests = isStarOwner ? incomingMeetUps : myMeetUpRequests;
  const areaMeetUpVideos = useMemo(
    () =>
      meetUpVideos.filter(
        (video) =>
          video.mealMode === mealMode &&
          video.areaTitle === selectedMeetUpArea?.title
      ),
    [mealMode, meetUpVideos, selectedMeetUpArea?.title]
  );
  const selectedMeetUpVideo = useMemo(
    () =>
      areaMeetUpVideos.find((video) => video.id === selectedVideoId) ||
      areaMeetUpVideos[0] ||
      null,
    [areaMeetUpVideos, selectedVideoId]
  );
  const featuredUrl = getBestVideoUrl(selectedMeetUpVideo, isMobile);

  useEffect(() => {
    if (!areaMeetUpVideos.length) {
      setSelectedVideoId("");
      setFeaturedVideo(null);
      return;
    }

    if (!areaMeetUpVideos.some((video) => video.id === selectedVideoId)) {
      setSelectedVideoId(areaMeetUpVideos[0].id);
    }

    setFeaturedVideo(areaMeetUpVideos.find((video) => video.id === selectedVideoId) || areaMeetUpVideos[0]);
  }, [areaMeetUpVideos, selectedVideoId]);

  const handleSelectMeetUpVideo = (video) => {
    setSelectedVideoId(video.id);
    setFeaturedVideo(video);
  };

  const handleSelectMeetUpArea = (area) => {
    setSelectedAreaTitle(area.title);
    setMeetUpNotice("");
  };

  const handleMealModeChange = (nextMealMode) => {
    setMealMode(nextMealMode);
    if (nextMealMode === "lunch") setSelectedAreaTitle(LUNCH_AREAS[0].title);
    else if (nextMealMode === "breakfast") setSelectedAreaTitle(BREAKFAST_AREAS[0].title);
    else setSelectedAreaTitle(DINNER_AREAS[0].title);
    setSelectedVideoId("");
    setMeetUpNotice("");
  };

  const createCallSessionRequest = async ({ requestType, note, requestKind = "call" }) => {
    if (!member || !currentUser) return;
    const requesterProfile = await loadMemberProfile(currentUser.uid);
    const requesterName = getSafeRequesterName(
      requesterProfile?.displayName || currentUser.displayName || ""
    );

    await addDoc(collection(db, "meetup_call_sessions"), {
      starId: member.uid,
      starName: member.displayName,
      starRole: member.role,
      requesterId: currentUser.uid,
      requesterName,
      type: requestType,
      videoId: selectedMeetUpVideo?.id || "",
      videoTitle: selectedMeetUpVideo?.title || "",
      videoUrl:
        selectedMeetUpVideo?.streamUrl ||
        selectedMeetUpVideo?.fileUrl ||
        selectedMeetUpVideo?.videoUrl ||
        "",
      videoThumbnailUrl: selectedMeetUpVideo?.thumbnailUrl || "",
      requestKind,
      mealMode,
      experienceLevel,
      areaTitle: selectedMeetUpArea?.title || "",
      areaIcon: selectedMeetUpArea?.icon || "",
      areaPitch: selectedMeetUpArea?.pitch || "",
      note,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleSubmitCallRequest = async () => {
    if (!member) return;
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (currentUser.uid === uid) {
      setRequestNotice("You do not need to request a call with yourself.");
      return;
    }
    if (hasPendingSelectedCall) {
      setRequestNotice(`You already have a pending ${selectedCallType.title.toLowerCase()} request with this star.`);
      return;
    }

    setSubmittingCall(true);
    setRequestNotice("");

    try {
      await createCallSessionRequest({
        requestType: callType,
        note: requestNote.trim(),
      });

      setRequestNote("");
      setRequestNotice(`${selectedCallType.title} request sent.`);
    } catch (submitError) {
      console.error("Call request failed:", submitError);
      setRequestNotice("Could not send call request right now.");
    } finally {
      setSubmittingCall(false);
    }
  };

  const handleSubmitMeetUpRequest = async () => {
    if (!member || !selectedMeetUpArea) return;
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (currentUser.uid === uid) {
      setMeetUpNotice("You do not need to request a meet-up with yourself.");
      return;
    }
    if (hasPendingSelectedMeetUp) {
      setMeetUpNotice(`Your ${selectedMeetUpArea.title} request is already pending.`);
      return;
    }

    setSubmittingMeetUp(true);
    setMeetUpNotice("");

    try {
      await createCallSessionRequest({
        requestType: callType,
        note: buildAreaMeetUpNote(selectedMeetUpArea),
        requestKind: "area",
      });

      setMeetUpNotice(`${selectedMeetUpArea.title} meet-up request sent.`);
    } catch (submitError) {
      console.error("Meet-up request failed:", submitError);
      setMeetUpNotice(`Could not send meet-up request right now. ${submitError?.code || submitError?.message || ""}`.trim());
    } finally {
      setSubmittingMeetUp(false);
    }
  };

  const handleUpdateCallStatus = async (sessionId, nextStatus) => {
    setUpdatingCallId(sessionId);
    try {
      await updateDoc(doc(db, "meetup_call_sessions", sessionId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        decidedAt: serverTimestamp(),
      });
    } catch (updateError) {
      console.error("Call status update failed:", updateError);
    } finally {
      setUpdatingCallId("");
    }
  };

  const handleUpdateMeetUpStatus = async (requestId, nextStatus) => {
    setUpdatingMeetUpId(requestId);
    try {
      await updateDoc(doc(db, "meetup_call_sessions", requestId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        decidedAt: serverTimestamp(),
      });
    } catch (updateError) {
      console.error("Meet-up status update failed:", updateError);
    } finally {
      setUpdatingMeetUpId("");
    }
  };

  const openMeetUpSession = (requestId) => {
    navigate(`/meet-up-session/${requestId}`);
  };

  if (loading) return <main style={pageStyle}>Loading meet-up page...</main>;
  if (error || !member) {
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <p style={eyebrowStyle}>Request a meet-up</p>
          <h1 style={titleStyle}>Meet-up unavailable</h1>
          <p style={mutedStyle}>{error || "This page is not available right now."}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ ...pageStyle, padding: isMobile ? "88px 12px 32px" : pageStyle.padding }}>
      <div style={shellStyle}>
        <section style={{ ...heroStyle, gridTemplateColumns: isMobile ? "1fr" : heroStyle.gridTemplateColumns, padding: isMobile ? 16 : heroStyle.padding }}>
          <div style={heroCopyStyle}>
            <p style={eyebrowStyle}>Request a meet-up</p>
            <h1 style={{ ...titleStyle, fontSize: isMobile ? 28 : titleStyle.fontSize, lineHeight: isMobile ? 1.1 : titleStyle.lineHeight }}>{member.displayName}</h1>
            <p style={roleStyle}>{member.role}</p>
            <p style={promptStyle}>Pick the right meet-up area</p>

            <div style={{ ...mealButtonRowStyle, gap: isMobile ? 8 : mealButtonRowStyle.gap }}>
              <button type="button" onClick={() => handleMealModeChange("dinner")} style={{ ...mealButtonStyle, ...(mealMode === "dinner" ? mealButtonActiveStyle : null), padding: isMobile ? "10px 14px" : mealButtonStyle.padding }}>🍽️ Dinner</button>
              <button type="button" onClick={() => handleMealModeChange("lunch")} style={{ ...mealButtonStyle, ...(mealMode === "lunch" ? mealButtonActiveStyle : null), padding: isMobile ? "10px 14px" : mealButtonStyle.padding }}>🍽️ Lunch</button>
              <button type="button" onClick={() => handleMealModeChange("breakfast")} style={{ ...mealButtonStyle, ...(mealMode === "breakfast" ? mealButtonActiveStyle : null), padding: isMobile ? "10px 14px" : mealButtonStyle.padding }}>🍽️ Breakfast</button>
            </div>

            <div style={{ ...levelsGridStyle, gridTemplateColumns: isMobile ? "1fr" : levelsGridStyle.gridTemplateColumns }}>
              {EXPERIENCE_LEVELS.map((level) => {
                const active = experienceLevel === level.key;
                return (
                  <button key={level.key} type="button" onClick={() => setExperienceLevel(level.key)} style={{ ...levelCardStyle, ...(active ? levelCardActiveStyle : null), padding: isMobile ? 14 : levelCardStyle.padding }}>
                    <div style={levelTopStyle}>
                      <span style={levelBadgeStyle}>{level.badge}</span>
                      <span style={levelTitleStyle}>{level.title}</span>
                      <span style={{ ...tickStyle, opacity: active ? 1 : 0.26 }}>{active ? "✓" : "○"}</span>
                    </div>
                    <div style={levelBlurbStyle}>👉 {level.blurb}</div>
                    <div style={levelNotesStyle}>
                      {level.notes.map((note) => <span key={note} style={levelNotePillStyle}>{note}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside style={{ ...previewAsideStyle, order: isMobile ? -1 : 0 }}>
            <div style={{ ...avatarStyle, width: isMobile ? 88 : avatarStyle.width, height: isMobile ? 88 : avatarStyle.height, fontSize: isMobile ? 40 : avatarStyle.fontSize }}>
              {(member.displayName || "M").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ ...previewCardStyle, minHeight: isMobile ? 180 : previewCardStyle.minHeight }}>
              {featuredUrl ? (
                <video src={featuredUrl} style={{ ...previewVideoStyle, height: isMobile ? 180 : previewVideoStyle.height }} muted playsInline controls />
              ) : (
                <div style={previewEmptyStyle}>Featured star preview</div>
              )}
            </div>
            <div style={videoPickerPanelStyle}>
              <p style={eyebrowStyle}>Videos for {selectedMeetUpArea.title}</p>
              <div style={videoPickerGridStyle}>
                {areaMeetUpVideos.length ? (
                  areaMeetUpVideos.map((video) => {
                    const active = video.id === selectedVideoId;
                    const thumb = video.thumbnailUrl || video.posterUrl || "";
                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => handleSelectMeetUpVideo(video)}
                        style={{ ...videoPickButtonStyle, ...(active ? videoPickButtonActiveStyle : null) }}
                      >
                        <span
                          style={{
                            ...videoPickThumbStyle,
                            backgroundImage: thumb ? `url(${thumb})` : "none",
                          }}
                        >
                          {!thumb ? "▶" : null}
                        </span>
                        <span style={videoPickTextStyle}>{video.title || "Meet-up video"}</span>
                      </button>
                    );
                  })
                ) : (
                  <p style={mutedStyle}>No admin video has been uploaded for this area yet.</p>
                )}
              </div>
            </div>
            <div style={previewStatusPanelStyle}>
              <div style={previewStatusHeaderStyle}>
                <p style={eyebrowStyle}>Meet-up status</p>
                {previewMeetUpRequests.length ? <span style={statusCountStyle}>{previewMeetUpRequests.length}</span> : null}
              </div>
              {previewMeetUpRequests.length === 0 ? (
                <p style={mutedStyle}>{isStarOwner ? "No meet-up requests yet." : "No meet-up requests sent to this star yet."}</p>
              ) : (
                <div style={previewStatusListStyle}>
                  {previewMeetUpRequests.map((request) => (
                    <article key={request.id} style={previewStatusCardStyle}>
                      <div style={callCardHeaderStyle}>
                        <div>
                          <strong>{isStarOwner ? getSafeRequesterName(request.requesterName) : request.areaTitle || "Meet-Up Area"}</strong>
                          <div style={callMetaStyle}>{formatMeetUpLabel(request)}</div>
                        </div>
                        <span style={statusPill(request.status)}>{request.status}</span>
                      </div>
                      {request.areaPitch ? <p style={callNoteStyle}>{request.areaPitch}</p> : null}
                      {isStarOwner && request.status === "pending" ? (
                        <div style={callActionRowStyle}>
                          <button type="button" onClick={() => openMeetUpSession(request.id)} style={primaryMiniButtonStyle}>
                            Open
                          </button>
                          <button type="button" onClick={() => handleUpdateMeetUpStatus(request.id, "accepted")} style={primaryMiniButtonStyle} disabled={updatingMeetUpId === request.id}>Accept</button>
                          <button type="button" onClick={() => handleUpdateMeetUpStatus(request.id, "declined")} style={secondaryMiniButtonStyle} disabled={updatingMeetUpId === request.id}>Decline</button>
                        </div>
                      ) : null}
                      {!isStarOwner && request.status === "pending" ? (
                        <button type="button" onClick={() => openMeetUpSession(request.id)} style={secondaryMiniButtonStyle}>
                          View Pending
                        </button>
                      ) : null}
                      {request.status === "accepted" ? (
                        <button type="button" onClick={() => openMeetUpSession(request.id)} style={primaryMiniButtonStyle}>
                          Meet-Up
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </section>

        <section style={{ ...contentLayoutStyle, gridTemplateColumns: isMobile ? "1fr" : contentLayoutStyle.gridTemplateColumns }}>
          <div style={leftContentStyle}>
            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={{ ...sectionTitleStyle, fontSize: isMobile ? 24 : sectionTitleStyle.fontSize }}>Meet-Up Request</h2>
                  <p style={mutedStyle}>Choose one area below, then submit it for approval.</p>
                </div>
              </div>

              <div style={selectedRequestSummaryStyle}>
                <div style={areaIconStyle}>{selectedMeetUpArea.icon}</div>
                <div>
                  <strong>{selectedMeetUpArea.title}</strong>
                  <p style={areaPitchStyle}>{mealModeLabel(mealMode)} • {experienceLabel(experienceLevel)}</p>
                  <p style={areaPitchStyle}>{selectedMeetUpArea.pitch}</p>
                </div>
              </div>

              {!isStarOwner && (
                <div style={requestFormStyle}>
                  <button type="button" onClick={handleSubmitMeetUpRequest} style={primaryButtonStyle} disabled={submittingMeetUp}>
                    {submittingMeetUp ? "Submitting Meet-Up Request..." : hasPendingSelectedMeetUp ? "Meet-Up Request Pending" : "Submit Meet-Up Request"}
                  </button>
                  {meetUpNotice ? <p style={noticeStyle}>{meetUpNotice}</p> : null}
                </div>
              )}

            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={{ ...sectionTitleStyle, fontSize: isMobile ? 24 : sectionTitleStyle.fontSize }}>Call the Star</h2>
                  <p style={mutedStyle}>Stage 1 request flow for voice and video call meet-ups.</p>
                </div>
              </div>

              <div style={callTypeRowStyle}>
                {CALL_TYPES.map((type) => {
                  const active = callType === type.key;
                  return (
                    <button key={type.key} type="button" onClick={() => setCallType(type.key)} style={{ ...callTypeCardStyle, ...(active ? callTypeCardActiveStyle : null) }}>
                      <div style={callTypeIconStyle}>{type.icon}</div>
                      <div style={callTypeTextStyle}>
                        <strong>{type.title}</strong>
                        <span style={callTypeBlurbStyle}>{type.blurb}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isStarOwner && (
                <div style={requestFormStyle}>
                  <textarea
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                    placeholder={`Add a short note for your ${selectedCallType.title.toLowerCase()} request.`}
                    style={requestTextAreaStyle}
                    rows={4}
                  />
                  <button type="button" onClick={handleSubmitCallRequest} style={primaryButtonStyle} disabled={submittingCall}>
                    {submittingCall ? `Sending ${selectedCallType.title} Request...` : hasPendingSelectedCall ? `${selectedCallType.title} Request Pending` : `Request ${selectedCallType.title}`}
                  </button>
                  {requestNotice ? <p style={noticeStyle}>{requestNotice}</p> : null}
                </div>
              )}

              {isStarOwner ? (
                <div style={callListStyle}>
                  <h3 style={subTitleStyle}>Incoming Call Requests</h3>
                  {incomingCalls.length === 0 ? (
                    <p style={mutedStyle}>No call requests yet.</p>
                  ) : (
                    incomingCalls.map((call) => (
                      <article key={call.id} style={callCardStyle}>
                        <div style={callCardHeaderStyle}>
                          <div>
                            <strong>{getSafeRequesterName(call.requesterName)}</strong>
                            <div style={callMetaStyle}>{formatCallLabel(call)}</div>
                          </div>
                          <span style={statusPill(call.status)}>{call.status}</span>
                        </div>
                        {call.note ? <p style={callNoteStyle}>{call.note}</p> : null}
                        {call.status === "pending" ? (
                          <div style={callActionRowStyle}>
                            <button type="button" onClick={() => handleUpdateCallStatus(call.id, "accepted")} style={primaryMiniButtonStyle} disabled={updatingCallId === call.id}>Accept</button>
                            <button type="button" onClick={() => handleUpdateCallStatus(call.id, "declined")} style={secondaryMiniButtonStyle} disabled={updatingCallId === call.id}>Decline</button>
                          </div>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              ) : (
                <div style={callListStyle}>
                  <h3 style={subTitleStyle}>Your Request Records</h3>
                  {myRequests.length === 0 ? (
                    <p style={mutedStyle}>No call requests sent to this star yet.</p>
                  ) : (
                    myRequests.map((call) => (
                      <article key={call.id} style={callCardStyle}>
                        <div style={callCardHeaderStyle}>
                          <div>
                            <strong>{selectedCallTitle(call.type)}</strong>
                            <div style={callMetaStyle}>{formatCallLabel(call)}</div>
                          </div>
                          <span style={statusPill(call.status)}>{call.status}</span>
                        </div>
                        {call.note ? <p style={callNoteStyle}>{call.note}</p> : null}
                      </article>
                    ))
                  )}
                </div>
              )}
            </section>

            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ ...sectionTitleStyle, fontSize: isMobile ? 24 : sectionTitleStyle.fontSize }}>{mealModeLabel(mealMode)} Meet-Up Areas</h2>
                <p style={mutedStyle}>Choose the setting that fits this level of access and energy.</p>
              </div>
            </div>
            <div style={{ ...areasGridStyle, gridTemplateColumns: isMobile ? "1fr" : areasGridStyle.gridTemplateColumns }}>
              {activeAreas.map((area) => (
                <button key={area.title} type="button" onClick={() => handleSelectMeetUpArea(area)} style={{ ...areaCardStyle, ...(selectedMeetUpArea.title === area.title ? areaCardActiveStyle : null) }}>
                  <div style={areaIconStyle}>{area.icon}</div>
                  <div style={areaBodyStyle}>
                    <h3 style={{ ...areaTitleStyle, fontSize: isMobile ? 18 : areaTitleStyle.fontSize }}>{area.title}</h3>
                    <p style={areaPitchStyle}>👉 {area.pitch}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside style={{ ...rightRailStyle, position: isMobile ? "static" : rightRailStyle.position }}>
            <div style={panelStyle}>
              <h2 style={{ ...sectionTitleStyle, fontSize: isMobile ? 24 : sectionTitleStyle.fontSize }}>Selected Standard</h2>
              <div style={selectedLevelCardStyle}>
                {(() => {
                  const selected = EXPERIENCE_LEVELS.find((level) => level.key === experienceLevel) || EXPERIENCE_LEVELS[0];
                  return (
                    <>
                      <div style={selectedLevelHeaderStyle}>
                        <span style={selectedLevelBadgeStyle}>{selected.badge}</span>
                        <div>
                          <div style={selectedLevelTitleStyle}>{selected.title}</div>
                          <div style={selectedLevelBlurbStyle}>{selected.blurb}</div>
                        </div>
                      </div>
                      <div style={levelNotesStyle}>
                        {selected.notes.map((note) => <span key={note} style={levelNotePillStyle}>{note}</span>)}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function selectedCallTitle(type) {
  return type === "video" ? "Video Call" : "Voice Call";
}

function formatCallLabel(call) {
  return `${selectedCallTitle(call.type)} • ${mealModeLabel(call.mealMode || "dinner")} • ${experienceLabel(call.experienceLevel || "standard")}`;
}

function formatMeetUpLabel(request) {
  return `${request.areaIcon || ""} ${request.areaTitle || "Meet-Up Area"} • ${mealModeLabel(request.mealMode || "dinner")} • ${experienceLabel(request.experienceLevel || "standard")}`;
}

function buildAreaMeetUpNote(area) {
  return `MEETUP_AREA_REQUEST|${area.icon}|${area.title}|${area.pitch}`;
}

function isAreaMeetUpRequest(request) {
  return request.requestKind === "area" || String(request.note || "").startsWith("MEETUP_AREA_REQUEST|");
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

function getSafeRequesterName(name) {
  const value = String(name || "").trim();
  if (!value || value.includes("@")) return "Member";
  return value;
}

function experienceLabel(key) {
  const match = EXPERIENCE_LEVELS.find((level) => level.key === key);
  return match?.title || "Standard Experience";
}

function mealModeLabel(mode) {
  if (mode === "lunch") return "Lunch";
  if (mode === "breakfast") return "Breakfast";
  return "Dinner";
}

function statusPill(status) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: status === "accepted" ? "#e6f7ed" : status === "declined" ? "#fdecec" : "#f5eee2",
    color: status === "accepted" ? "#177245" : status === "declined" ? "#b42318" : "#5c4b33",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  };
}

function sortCallSessions(sessions) {
  return [...sessions].sort((first, second) => callSessionSortValue(second) - callSessionSortValue(first));
}

function sortMeetUpRequests(requests) {
  return [...requests].sort((first, second) => callSessionSortValue(second) - callSessionSortValue(first));
}

function callSessionSortValue(session) {
  return timestampSortValue(session.createdAt);
}

function timestampSortValue(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.seconds === "number") return timestamp.seconds * 1000;
  return 0;
}

function getBestVideoUrl(video, isMobile) {
  if (!video) return "";
  if (isMobile) {
    return video.mobileUrl || video.streamUrl || video.fileUrl || video.videoUrl || video.originalUrl || "";
  }
  return video.desktopUrl || video.streamUrl || video.fileUrl || video.videoUrl || video.originalUrl || "";
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

const pageStyle = { minHeight: "100vh", padding: "96px 24px 48px", background: "#f7f3ea", color: "#1f2933" };
const shellStyle = { maxWidth: 1280, margin: "0 auto", display: "grid", gap: 24 };
const heroStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.75fr)", gap: 28, alignItems: "start", padding: 28, borderRadius: 18, background: "#fffdf8", border: "1px solid #e2d8c8" };
const heroCopyStyle = { display: "grid", gap: 12, alignContent: "start" };
const eyebrowStyle = { margin: 0, color: "#6b5f4b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" };
const titleStyle = { margin: 0, fontSize: 46, lineHeight: 1.05 };
const roleStyle = { margin: 0, fontSize: 18, fontWeight: 700, color: "#d1495b" };
const promptStyle = { margin: "6px 0 0", color: "#2c3a44", fontSize: 20, fontWeight: 700 };
const mutedStyle = { margin: 0, color: "#52616b", lineHeight: 1.6 };
const mealButtonRowStyle = { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 };
const mealButtonStyle = { padding: "12px 18px", borderRadius: 999, border: "1px solid #d7cdbd", background: "#fff", color: "#1f2933", fontWeight: 700, cursor: "pointer" };
const mealButtonActiveStyle = { background: "#101828", color: "#fff", borderColor: "#101828" };
const levelsGridStyle = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 10 };
const levelCardStyle = { display: "grid", gap: 10, textAlign: "left", padding: 16, borderRadius: 16, border: "1px solid #e5dbcc", background: "#fff", cursor: "pointer" };
const levelCardActiveStyle = { borderColor: "#101828", boxShadow: "0 10px 30px rgba(16, 24, 40, 0.08)", background: "#fffaf1" };
const levelTopStyle = { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" };
const levelBadgeStyle = { fontSize: 20 };
const levelTitleStyle = { fontWeight: 800, color: "#1f2933" };
const tickStyle = { fontWeight: 800, color: "#101828" };
const levelBlurbStyle = { color: "#4a5964", fontSize: 14, lineHeight: 1.5 };
const levelNotesStyle = { display: "flex", gap: 8, flexWrap: "wrap" };
const levelNotePillStyle = { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "#f5eee2", color: "#3e3528", fontSize: 12, fontWeight: 700 };
const previewAsideStyle = { display: "grid", justifyItems: "center", gap: 16, alignContent: "start" };
const avatarStyle = { width: 136, height: 136, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", fontSize: 54, fontWeight: 800 };
const previewCardStyle = { width: "100%", minHeight: 420, borderRadius: 20, border: "1px dashed #dfd2bf", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
const previewVideoStyle = { width: "100%", height: 420, objectFit: "cover", display: "block" };
const previewEmptyStyle = { color: "#7b6f5c", fontWeight: 700 };
const videoPickerPanelStyle = { width: "100%", display: "grid", gap: 10, padding: 14, borderRadius: 16, border: "1px solid #e2d8c8", background: "#fffdf8" };
const videoPickerGridStyle = { display: "grid", gap: 10 };
const videoPickButtonStyle = { width: "100%", display: "grid", gridTemplateColumns: "72px 1fr", gap: 12, alignItems: "center", padding: 8, borderRadius: 12, border: "1px solid #eee2d3", background: "#fff", color: "#1f2933", textAlign: "left", cursor: "pointer", font: "inherit" };
const videoPickButtonActiveStyle = { borderColor: "#101828", background: "#fffaf1", boxShadow: "0 8px 18px rgba(16, 24, 40, 0.08)" };
const videoPickThumbStyle = { width: 72, height: 48, borderRadius: 8, background: "#101828", backgroundSize: "cover", backgroundPosition: "center", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 };
const videoPickTextStyle = { fontSize: 14, fontWeight: 800, lineHeight: 1.35 };
const previewStatusPanelStyle = { width: "100%", display: "grid", gap: 12, padding: 16, borderRadius: 16, border: "1px solid #e2d8c8", background: "#fffdf8" };
const previewStatusHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const previewStatusListStyle = { display: "grid", gap: 10 };
const previewStatusCardStyle = { display: "grid", gap: 10, padding: 14, borderRadius: 14, border: "1px solid #eee2d3", background: "#fff" };
const statusCountStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 26, padding: "5px 9px", borderRadius: 999, background: "#f5eee2", color: "#5c4b33", fontSize: 12, fontWeight: 800 };
const primaryButtonStyle = { width: "100%", padding: "12px 18px", borderRadius: 999, border: "none", background: "#101828", color: "#fff", fontWeight: 800, cursor: "pointer" };
const contentLayoutStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(280px, 0.55fr)", gap: 24, alignItems: "start" };
const leftContentStyle = { display: "grid", gap: 18 };
const rightRailStyle = { display: "grid", gap: 16, alignSelf: "start", position: "sticky", top: 96 };
const panelStyle = { padding: 24, borderRadius: 16, background: "#fffdf8", border: "1px solid #e2d8c8" };
const sectionHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const sectionTitleStyle = { margin: 0, fontSize: 30 };
const areasGridStyle = { display: "grid", gap: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" };
const selectedRequestSummaryStyle = { display: "grid", gridTemplateColumns: "56px 1fr", gap: 16, padding: 18, borderRadius: 16, border: "1px solid #101828", background: "#fffaf1", alignItems: "start", marginTop: 16 };
const areaCardStyle = { display: "grid", gridTemplateColumns: "56px 1fr", gap: 16, width: "100%", padding: 18, borderRadius: 16, border: "1px solid #eee2d3", background: "#fffdf8", alignItems: "start", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" };
const areaCardActiveStyle = { borderColor: "#101828", background: "#fffaf1", boxShadow: "0 10px 24px rgba(16, 24, 40, 0.06)" };
const areaIconStyle = { width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff4de", fontSize: 28 };
const areaBodyStyle = { display: "grid", gap: 8 };
const areaTitleStyle = { margin: 0, fontSize: 21 };
const areaPitchStyle = { margin: 0, color: "#52616b", lineHeight: 1.55 };
const selectedLevelCardStyle = { display: "grid", gap: 16, padding: 18, borderRadius: 18, border: "1px solid #eee2d3", background: "#fff" };
const selectedLevelHeaderStyle = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center" };
const selectedLevelBadgeStyle = { fontSize: 28 };
const selectedLevelTitleStyle = { fontSize: 18, fontWeight: 800, color: "#1f2933" };
const selectedLevelBlurbStyle = { color: "#52616b", marginTop: 4 };
const callTypeRowStyle = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 8 };
const callTypeCardStyle = { display: "grid", gridTemplateColumns: "52px 1fr", gap: 14, alignItems: "center", textAlign: "left", padding: 16, borderRadius: 16, border: "1px solid #e5dbcc", background: "#fff", cursor: "pointer" };
const callTypeCardActiveStyle = { borderColor: "#101828", background: "#fff7ef", boxShadow: "0 10px 24px rgba(16, 24, 40, 0.06)" };
const callTypeIconStyle = { width: 52, height: 52, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff4de", fontSize: 26 };
const callTypeTextStyle = { display: "grid", gap: 4 };
const callTypeBlurbStyle = { color: "#52616b", fontSize: 13, lineHeight: 1.5 };
const requestFormStyle = { display: "grid", gap: 12, marginTop: 18 };
const requestTextAreaStyle = { width: "100%", padding: 14, borderRadius: 14, border: "1px solid #ddd2c1", fontFamily: "inherit", fontSize: 15, resize: "vertical", background: "#fff" };
const noticeStyle = { margin: 0, color: "#52616b", fontWeight: 700 };
const callListStyle = { display: "grid", gap: 12, marginTop: 20 };
const subTitleStyle = { margin: 0, fontSize: 22 };
const callCardStyle = { display: "grid", gap: 10, padding: 16, borderRadius: 16, border: "1px solid #eee2d3", background: "#fff" };
const callCardHeaderStyle = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const callMetaStyle = { color: "#52616b", fontSize: 13, marginTop: 4 };
const callNoteStyle = { margin: 0, color: "#2e2a24", lineHeight: 1.55 };
const callActionRowStyle = { display: "flex", gap: 10, flexWrap: "wrap" };
const primaryMiniButtonStyle = { padding: "10px 14px", borderRadius: 999, border: "none", background: "#101828", color: "#fff", fontWeight: 700, cursor: "pointer" };
const secondaryMiniButtonStyle = { padding: "10px 14px", borderRadius: 999, border: "1px solid #d7cdbd", background: "#fff", color: "#1f2933", fontWeight: 700, cursor: "pointer" };
