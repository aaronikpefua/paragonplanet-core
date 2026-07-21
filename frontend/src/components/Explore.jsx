import Categories from "./Categories";
import { useEffect, useMemo, useRef, useState } from "react";
import useVideos from "../hooks/useVideos";
import VideoPlayer from "./VideoPlayer";
import { auth, db } from "../config/firebase";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  API_URL,
  SUPPORT_ACTIONS,
  SPRAY_ACTION_KEYS,
  BOTTLE_ACTION_KEYS,
  appCheckFetch,
  formatSupportCost,
} from "../lib/supportActions";

export default function Explore() {
  const videos = useVideos();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") || "";
  const visibleVideos = useMemo(() => {
    if (!selectedCategory) return videos;
    const selectedKey = normalizeCategoryValue(selectedCategory);

    return videos.filter((video) => {
      const videoCategory = normalizeCategoryValue(video.category || video.genre || "");
      return videoCategory === selectedKey;
    });
  }, [selectedCategory, videos]);

  const [liked, setLiked] = useState({});
  const [mode, setMode] = useState("feed");
  const [activeIndex, setActiveIndex] = useState(0);
  const [supportModal, setSupportModal] = useState(null);
  const [sprayPickerVideoId, setSprayPickerVideoId] = useState("");
  const [commentModal, setCommentModal] = useState(null);
  const [processingSupportKey, setProcessingSupportKey] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [localVideoStats, setLocalVideoStats] = useState({});
  const [supportError, setSupportError] = useState("");
  const [globalSupportNotice, setGlobalSupportNotice] = useState(null);
  const [loadingVoteId, setLoadingVoteId] = useState("");
  const [videoComments, setVideoComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState("");
  const [submittingCommentFor, setSubmittingCommentFor] = useState("");
  const [followStates, setFollowStates] = useState({});
  const [saveStates, setSaveStates] = useState({});
  const [processingFollowId, setProcessingFollowId] = useState("");
  const [processingSaveId, setProcessingSaveId] = useState("");
  const [localViewStats, setLocalViewStats] = useState({});
  const [followPanelVideo, setFollowPanelVideo] = useState(null);
  const [followDirectory, setFollowDirectory] = useState([]);
  const [loadingFollowDirectory, setLoadingFollowDirectory] = useState(false);
  const [meetUpDirectory, setMeetUpDirectory] = useState([]);
  const [loadingMeetUpDirectory, setLoadingMeetUpDirectory] = useState(false);
  const [pendingMeetUpCount, setPendingMeetUpCount] = useState(0);

  const singleParagSprayAmount = 1;
  const singleGbaziloSprayAmount = 1;

  const containerRef = useRef(null);
  const videoRefs = useRef([]);
  const trackedViewKeysRef = useRef(new Set());

  useEffect(() => {
    const setFeedHeight = () => {
      const height =
        window.visualViewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight;
      document.documentElement.style.setProperty("--pp-feed-height", `${height}px`);
    };

    setFeedHeight();
    window.addEventListener("resize", setFeedHeight);
    window.addEventListener("orientationchange", setFeedHeight);
    window.visualViewport?.addEventListener("resize", setFeedHeight);
    window.visualViewport?.addEventListener("scroll", setFeedHeight);

    return () => {
      window.removeEventListener("resize", setFeedHeight);
      window.removeEventListener("orientationchange", setFeedHeight);
      window.visualViewport?.removeEventListener("resize", setFeedHeight);
      window.visualViewport?.removeEventListener("scroll", setFeedHeight);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    setSprayPickerVideoId("");
  }, [selectedCategory]);

  useEffect(() => {
    if (mode !== "feed") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.dataset.index);

          if (entry.isIntersecting) {
            setActiveIndex(index);

            const next = videoRefs.current[index + 1];
            const nextVideo = next?.querySelector("video");

            if (nextVideo) {
              nextVideo.preload = "metadata";
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.7,
      }
    );

    const items = containerRef.current?.children || [];
    Array.from(items).forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [visibleVideos, mode]);

  const handleDoubleTap = (id) => {
    setLiked((prev) => ({ ...prev, [id]: true }));

    setTimeout(() => {
      setLiked((prev) => ({ ...prev, [id]: false }));
    }, 700);
  };

  useEffect(() => {
    if (!actionFeedback) return undefined;

    const timer = window.setTimeout(() => {
      setActionFeedback(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    if (!globalSupportNotice) return undefined;

    const timer = window.setTimeout(() => {
      setGlobalSupportNotice(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [globalSupportNotice]);

  useEffect(() => {
    const activeVideo = visibleVideos[activeIndex];
    if (!activeVideo?.id || mode !== "feed") return undefined;

    const timer = window.setTimeout(() => {
      void trackVideoView(activeVideo);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [activeIndex, visibleVideos, mode]);

  useEffect(() => {
    const activeVideo = visibleVideos[activeIndex];
    if (!activeVideo?.id) return;

    setSprayPickerVideoId("");
    void ensureActionStateLoaded(activeVideo);
  }, [activeIndex, visibleVideos]);

  useEffect(() => {
    let unsubscribeRequests = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
      }

      if (!user?.uid) {
        setPendingMeetUpCount(0);
        return;
      }

      const receivedRequestsQuery = query(
        collection(db, "meetup_call_sessions"),
        where("starId", "==", user.uid)
      );

      unsubscribeRequests = onSnapshot(
        receivedRequestsQuery,
        (snapshot) => {
          const pendingCount = snapshot.docs.reduce((count, docSnap) => {
            const request = docSnap.data();
            return request.status === "pending" && isMeetUpAreaRequest(request)
              ? count + 1
              : count;
          }, 0);

          setPendingMeetUpCount(pendingCount);
        },
        () => setPendingMeetUpCount(0)
      );
    });

    return () => {
      if (unsubscribeRequests) unsubscribeRequests();
      unsubscribeAuth();
    };
  }, []);

  const handleVote = async (videoId, event) => {
    event?.stopPropagation();
    await handleSupport(videoId, "vote");
  };

  const handleSupport = async (videoId, actionKey, options = {}) => {
    const user = auth.currentUser;

    if (!user) {
      navigate("/signup");
      return;
    }

    const action = SUPPORT_ACTIONS[actionKey];
    if (!action) return;

    setSupportError("");
    if (actionKey === "vote") {
      setLoadingVoteId(videoId);
    } else {
      setProcessingSupportKey(actionKey);
    }

    const targetVideo = videos.find((item) => item.id === videoId);
    if (targetVideo?.uid && user?.uid && targetVideo.uid === user.uid) {
      setSupportError("You cannot support your own video.");
      setGlobalSupportNotice({
        type: "error",
        message: "You cannot support your own video.",
      });
      if (actionKey === "vote") {
        setLoadingVoteId("");
      } else {
        setProcessingSupportKey("");
      }
      return;
    }

    try {
      const token = await user.getIdToken();
      const payload = { actionKey };

      if (action.variable) {
        payload.customParagAmount = Number(options.customParagAmount || 0);
        payload.customGbaziloAmount = Number(options.customGbaziloAmount || 0);
      }

      const res = await appCheckFetch(`${API_URL}/support/${videoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data.error || "This support action could not be completed.";
        setSupportError(message);
        setGlobalSupportNotice({
          type: "error",
          message,
        });
        if (shouldRedirectToWallet(message)) {
          navigate("/wallet?deposit=1");
        }
        return;
      }

      setLocalVideoStats((prev) => {
        const current = prev[videoId] || {
          votesDelta: 0,
          waterDelta: 0,
          sprayDelta: 0,
          bottleDelta: 0,
        };

        const next = { ...current };

        if (actionKey === "vote") {
          next.votesDelta += 1;
        } else if (actionKey === "pour_me_water") {
          next.waterDelta += 1;
        } else if (actionKey === "spray_money") {
          next.sprayDelta += 1;
        } else if (action.group === "bottle") {
          next.bottleDelta += 1;
        }

        return {
          ...prev,
          [videoId]: next,
        };
      });

      setActionFeedback({
        videoId,
        actionKey,
        label: action.label,
        amountParag:
          action.variable
            ? Number(data.amountParag ?? options.customParagAmount ?? 0)
            : Number(data.amountParag ?? action.parag ?? 0),
        amountGbazilo:
          action.variable
            ? Number(data.amountGbazilo ?? options.customGbaziloAmount ?? 0)
            : Number(data.amountGbazilo ?? action.gbazilo ?? 0),
      });
      setGlobalSupportNotice({
        type: "success",
        message:
          actionKey === "vote"
            ? "Vote sent"
            : actionKey === "pour_me_water"
              ? "Pour Me Water sent"
              : actionKey === "spray_money"
                ? Number(data.amountGbazilo ?? options.customGbaziloAmount ?? 0) > 0
                  ? "Gbazilo spray sent"
                  : "Parag spray sent"
                : `Pop ${action.label} sent`,
      });
      setSupportModal(null);
    } catch (error) {
      const message = "Could not complete this action right now";
      setSupportError(message);
      setGlobalSupportNotice({
        type: "error",
        message,
      });
    } finally {
      if (actionKey === "vote") {
        setLoadingVoteId("");
      } else {
        setProcessingSupportKey("");
      }
    }
  };

  const openSupportModal = (videoId, group) => {
    setSupportModal({ videoId, group });
    setSupportError("");
  };

  const toggleSprayPicker = (videoId) => {
    setSupportError("");
    setSprayPickerVideoId((current) => (current === videoId ? "" : videoId));
  };

  const getViewerKey = () => {
    const user = auth.currentUser;
    if (user?.uid) return `user_${user.uid}`;

    const existing = window.localStorage.getItem("paragon_session_id");
    if (existing) return `session_${existing}`;

    const created = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem("paragon_session_id", created);
    return `session_${created}`;
  };

  const trackVideoView = async (video) => {
    if (!video?.id) return;

    const viewerKey = getViewerKey();
    const trackingKey = `${viewerKey}_${video.id}`;

    if (trackedViewKeysRef.current.has(trackingKey)) {
      return;
    }

    trackedViewKeysRef.current.add(trackingKey);

    try {
      const viewRef = doc(db, "video_views", trackingKey);
      const existingView = await getDoc(viewRef);

      if (existingView.exists()) {
        return;
      }

      await setDoc(viewRef, {
        videoId: video.id,
        viewerKey,
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "videos", video.id), {
        views: increment(1),
      });

      setLocalViewStats((prev) => ({
        ...prev,
        [video.id]: (prev[video.id] || 0) + 1,
      }));
    } catch (error) {
      trackedViewKeysRef.current.delete(trackingKey);
    }
  };

  const ensureActionStateLoaded = async (video) => {
    const user = auth.currentUser;
    if (!user || !video?.id || !video?.uid) return;

    const followKey = `${user.uid}_${video.uid}`;
    const saveKey = `${user.uid}_${video.id}`;

    try {
      if (!(followKey in followStates)) {
        const followSnap = await getDoc(doc(db, "creator_follows", followKey));
        setFollowStates((prev) => ({
          ...prev,
          [followKey]: followSnap.exists(),
        }));
      }

      if (!(saveKey in saveStates)) {
        const saveSnap = await getDoc(doc(db, "saved_videos", saveKey));
        setSaveStates((prev) => ({
          ...prev,
          [saveKey]: saveSnap.exists(),
        }));
      }
    } catch {
      // Keep feed resilient; action buttons can still try on demand.
    }
  };

  const toggleFollow = async (target) => {
    const user = auth.currentUser;
    if (!user) {
      setGlobalSupportNotice({
        type: "error",
        message: "Login first",
      });
      return;
    }

    if (!target?.uid || target.uid === user.uid) {
      setGlobalSupportNotice({
        type: "error",
        message: "You cannot follow yourself here.",
      });
      return;
    }

    const followKey = `${user.uid}_${target.uid}`;
    setProcessingFollowId(target.uid);

    try {
      const followRef = doc(db, "creator_follows", followKey);
      const isFollowing = Boolean(followStates[followKey]);

      if (isFollowing) {
        await deleteDoc(followRef);
      } else {
        await setDoc(followRef, {
          creatorId: target.uid,
          creatorName:
            target.displayName ||
            target.creatorDisplayName ||
            target.creatorName ||
            target.title ||
            target.name ||
            "Creator",
          creatorRole:
            target.role ||
            target.creatorRole ||
            target.category ||
            "Creator",
          followerId: user.uid,
          videoId: target.id || target.videoId || "",
          createdAt: serverTimestamp(),
        });
      }

      setFollowStates((prev) => ({
        ...prev,
        [followKey]: !isFollowing,
      }));

      setGlobalSupportNotice({
        type: "success",
        message: isFollowing ? "Unfollowed" : "Following creator",
      });
    } catch {
      setGlobalSupportNotice({
        type: "error",
        message: "Could not update follow right now",
      });
    } finally {
      setProcessingFollowId("");
    }
  };

  const toggleSave = async (video) => {
    const user = auth.currentUser;
    if (!user) {
      setGlobalSupportNotice({
        type: "error",
        message: "Login first",
      });
      return;
    }

    const saveKey = `${user.uid}_${video.id}`;
    setProcessingSaveId(video.id);

    try {
      const saveRef = doc(db, "saved_videos", saveKey);
      const isSaved = Boolean(saveStates[saveKey]);

      if (isSaved) {
        await deleteDoc(saveRef);
      } else {
        await setDoc(saveRef, {
          videoId: video.id,
          uid: user.uid,
          creatorId: video.uid || "",
          title: video.title || "",
          thumbnailUrl: video.thumbnailUrl || "",
          streamUrl: video.streamUrl || "",
          createdAt: serverTimestamp(),
        });
      }

      setSaveStates((prev) => ({
        ...prev,
        [saveKey]: !isSaved,
      }));

      setGlobalSupportNotice({
        type: "success",
        message: isSaved ? "Removed from Save / Watch" : "Saved to Watch Later",
      });
    } catch {
      setGlobalSupportNotice({
        type: "error",
        message: "Could not update Save / Watch right now",
      });
    } finally {
      setProcessingSaveId("");
    }
  };

  const loadComments = async (videoId) => {
    setLoadingCommentsFor(videoId);

    try {
      const commentsQuery = query(
        collection(db, "video_comments"),
        where("videoId", "==", videoId),
        orderBy("createdAt", "asc")
      );

      const snap = await getDocs(commentsQuery);
      const comments = snap.docs.map((commentDoc) => ({
        id: commentDoc.id,
        ...commentDoc.data(),
      }));

      setVideoComments((prev) => ({
        ...prev,
        [videoId]: comments,
      }));
    } catch (error) {
      setGlobalSupportNotice({
        type: "error",
        message: "Could not load comments right now",
      });
    } finally {
      setLoadingCommentsFor("");
    }
  };

  const openCommentModal = async (video) => {
    setCommentModal(video);

    if (!videoComments[video.id]) {
      await loadComments(video.id);
    }
  };

  const openFollowPanel = async (video) => {
    setFollowPanelVideo(video);
    setLoadingFollowDirectory(true);
    setLoadingMeetUpDirectory(true);
    const currentUid = auth.currentUser?.uid;

    loadFollowDirectory(currentUid)
      .then(setFollowDirectory)
      .catch(() => {
        setGlobalSupportNotice({
          type: "error",
          message: "Could not load members right now",
        });
      })
      .finally(() => setLoadingFollowDirectory(false));

    loadMeetUpDirectory(currentUid)
      .then(setMeetUpDirectory)
      .catch(() => setMeetUpDirectory([]))
      .finally(() => setLoadingMeetUpDirectory(false));
  };

  const closeFollowPanel = () => {
    setFollowPanelVideo(null);
  };

  const openMemberProfile = (member) => {
    closeFollowPanel();
    navigate(`/member/${member.uid}`);
  };

  const openMeetUpSession = (requestId) => {
    closeFollowPanel();
    navigate(`/meet-up-session/${requestId}`);
  };

  const addComment = async () => {
    const user = auth.currentUser;
    const video = commentModal;
    if (!user || !video) {
      setGlobalSupportNotice({
        type: "error",
        message: "Login first",
      });
      return;
    }

    const text = (commentDrafts[video.id] || "").trim();
    if (!text) return;

    setSubmittingCommentFor(video.id);

    try {
      const userName =
        user.displayName ||
        user.email?.split("@")[0] ||
        "Paragon User";

      const docRef = await addDoc(collection(db, "video_comments"), {
        videoId: video.id,
        uid: user.uid,
        userName,
        text,
        createdAt: serverTimestamp(),
      });

      const optimisticComment = {
        id: docRef.id,
        videoId: video.id,
        uid: user.uid,
        userName,
        text,
      };

      setVideoComments((prev) => ({
        ...prev,
        [video.id]: [...(prev[video.id] || []), optimisticComment],
      }));

      setCommentDrafts((prev) => ({
        ...prev,
        [video.id]: "",
      }));
    } catch (error) {
      setGlobalSupportNotice({
        type: "error",
        message: "Could not send comment right now",
      });
    } finally {
      setSubmittingCommentFor("");
    }
  };

  const supportActionKeys =
    supportModal?.group === "spray" ? SPRAY_ACTION_KEYS : BOTTLE_ACTION_KEYS;

  const supportModalTitle =
    supportModal?.group === "spray" ? "Spray Money" : "Pop a Bottle 4 Me";
  const meetUpRequestHeading =
    pendingMeetUpCount === 1
      ? "You Have Request for Meet-ups"
      : "You Have Requests for Meet-ups";

  const bottleColumns = [
    ["mineral", "malt", "juice", "mocktail", "beer"],
    ["gin", "rum", "vodka", "whiskey", "cocktail"],
  ];
  const bottleShowcaseMeta = {
    mineral: {
      icon: "🥤",
      note: "Clean support drop",
      creatorXp: 2,
      senderXp: 1,
      rankBoost: 1,
    },
    malt: {
      icon: "🥛",
      note: "Smooth fan energy",
      creatorXp: 4,
      senderXp: 2,
      rankBoost: 2,
    },
    juice: {
      icon: "🧃",
      note: "Fresh spotlight lift",
      creatorXp: 6,
      senderXp: 3,
      rankBoost: 3,
    },
    mocktail: {
      icon: "🍹",
      note: "Styled celebration push",
      creatorXp: 8,
      senderXp: 4,
      rankBoost: 5,
    },
    beer: {
      icon: "🍺",
      note: "Crowd mood booster",
      creatorXp: 12,
      senderXp: 6,
      rankBoost: 8,
    },
    gin: {
      icon: "🍸",
      note: "Sharper stage glow",
      creatorXp: 15,
      senderXp: 7,
      rankBoost: 10,
    },
    rum: {
      icon: "🥃",
      note: "Heavy fan respect",
      creatorXp: 18,
      senderXp: 9,
      rankBoost: 12,
    },
    vodka: {
      icon: "🍾",
      note: "Big celebration wave",
      creatorXp: 22,
      senderXp: 11,
      rankBoost: 15,
    },
    whiskey: {
      icon: "🧊",
      note: "Premium spotlight burst",
      creatorXp: 50,
      senderXp: 25,
      rankBoost: 30,
    },
    cocktail: {
      icon: "🍸",
      note: "Ultimate party trigger",
      creatorXp: 70,
      senderXp: 35,
      rankBoost: 50,
    },
  };

  const getPlayableUrl = (video) => {
    const prefersMobile =
      typeof window !== "undefined" ? window.innerWidth <= 768 : false;

    if (prefersMobile && video.mobileUrl) {
      return video.mobileUrl;
    }

    if (!prefersMobile && video.desktopUrl) {
      return video.desktopUrl;
    }

    if (video.status === "processing" && video.originalUrl) {
      return video.originalUrl;
    }

    return video.streamUrl || video.originalUrl;
  };

  const supportVideo =
    supportModal?.videoId ? videos.find((item) => item.id === supportModal.videoId) : null;
  const supportPlayableUrl = supportVideo ? getPlayableUrl(supportVideo) : "";

  const formatBottleBadge = (action) => {
    if (!action) return "";
    if (action.gbazilo && action.parag) return `G${action.gbazilo} P${action.parag}`;
    if (action.gbazilo) return `G${action.gbazilo}`;
    return `P${action.parag || 0}`;
  };

  const stopOverlayTap = (event) => {
    event.stopPropagation();
  };

  if (!videos.length) {
    return (
      <div style={appBootStyle}>
        <img src="/logo-v2.png" alt="Paragon Planet" style={appBootLogoStyle} />
        <strong>Paragon Planet</strong>
      </div>
    );
  }

  if (selectedCategory && !visibleVideos.length) {
    return (
      <div style={emptyCategoryPageStyle}>
        <button onClick={() => navigate("/show-performers")} style={emptyCategoryButtonStyle}>
          Back to Categories
        </button>
        <h1>No {selectedCategory} videos yet</h1>
        <p>Citizen posts in this category will appear here after they upload.</p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <style>{supportAnimationStyles}</style>
      {globalSupportNotice && (
        <div
          style={{
            ...globalSupportNoticeStyle,
            ...(globalSupportNotice.type === "error"
              ? globalSupportNoticeErrorStyle
              : globalSupportNoticeSuccessStyle),
          }}
        >
          {globalSupportNotice.message}
        </div>
      )}
      {mode === "feed" && (
        <div ref={containerRef} style={feedStyle}>
          {visibleVideos.map((video, index) => {
            const playableUrl = getPlayableUrl(video);
            const user = auth.currentUser;
            const followKey =
              user?.uid && video.uid ? `${user.uid}_${video.uid}` : "";
            const saveKey =
              user?.uid ? `${user.uid}_${video.id}` : "";
            const isFollowing = followKey ? Boolean(followStates[followKey]) : false;
            const isSaved = saveKey ? Boolean(saveStates[saveKey]) : false;

            return (
              <div
                key={video.id}
                data-index={index}
                ref={(el) => {
                  videoRefs.current[index] = el;
                }}
                style={feedItemStyle}
                onDoubleClick={() => handleDoubleTap(video.id)}
              >
                {playableUrl && index === activeIndex ? (
                  <VideoPlayer streamUrl={playableUrl} />
                ) : playableUrl ? (
                  <div
                    style={{
                      ...placeholderStyle,
                      backgroundImage: video.thumbnailUrl
                        ? `url(${video.thumbnailUrl})`
                        : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    ▶
                  </div>
                ) : (
                  <div style={placeholderStyle}>
                    <div style={brandLoaderStyle}>
                      <img src="/logo-v2.png" alt="Paragon Planet" style={brandLoaderLogoStyle} />
                      <span style={brandLoaderTextStyle}>Processing...</span>
                    </div>
                  </div>
                )}

                {liked[video.id] && <div style={likeStyle}>❤️</div>}
                {actionFeedback?.videoId === video.id && (
                  <ActionFeedback effect={actionFeedback} />
                )}

                <div style={leftInfoStyle}>
                  <h3>{video.title || video.name || "Untitled"}</h3>
                  <p>{video.category || video.genre || "general"}</p>
                  <p>{video.description || video.about || ""}</p>
                </div>

                <div style={rightActionsStyle}>
                  <div style={iconActionWrapStyle}>
                    <button
                      type="button"
                      onPointerDown={stopOverlayTap}
                      onClick={(event) => {
                        stopOverlayTap(event);
                        handleVote(video.id, event);
                      }}
                      disabled={loadingVoteId === video.id}
                      style={sideRailButtonStyle}
                    >
                      <span style={sideRailIconStyle}>{loadingVoteId === video.id ? "…" : "❤️"}</span>
                      <span style={sideRailCountStyle}>
                        {(video.votes || 0) + (localVideoStats[video.id]?.votesDelta || 0)}
                      </span>
                    </button>
                    {actionFeedback?.videoId === video.id &&
                      actionFeedback.actionKey === "vote" && (
                        <div style={votePulseBadgeStyle}>+1</div>
                      )}
                  </div>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      handleSupport(video.id, "pour_me_water");
                    }}
                    style={sideRailButtonStyle}
                  >
                    <span style={sideRailIconStyle}>💧</span>
                    <span style={sideRailCountStyle}>{getPourCount(video, localVideoStats[video.id]?.waterDelta || 0)}</span>
                  </button>
                  <div style={iconActionWrapStyle}>
                    {sprayPickerVideoId === video.id ? (
                      <InlineSprayNotePicker
                        processing={processingSupportKey === "spray_money"}
                        onPointerDown={stopOverlayTap}
                        onSelect={(note) =>
                          handleSupport(video.id, "spray_money", {
                            customParagAmount: note.currency === "PARAG" ? note.amount : 0,
                            customGbaziloAmount: note.currency === "GBAZILO" ? note.amount : 0,
                          })
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      onPointerDown={stopOverlayTap}
                      onClick={(event) => {
                        stopOverlayTap(event);
                        toggleSprayPicker(video.id);
                      }}
                      style={sideRailButtonStyle}
                    >
                      <span style={sideRailIconStyle}>💸</span>
                      <span style={sideRailCountStyle}>{getSprayCount(video, localVideoStats[video.id]?.sprayDelta || 0)}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      openSupportModal(video.id, "bottle");
                    }}
                    style={sideRailButtonStyle}
                  >
                    <span style={sideRailIconStyle}>🍾</span>
                    <span style={sideRailCountStyle}>{getBottleCount(video.supportCounts) + (localVideoStats[video.id]?.bottleDelta || 0)}</span>
                  </button>
                </div>

                <div style={footerSecondaryActionsStyle}>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      navigate("/");
                    }}
                    style={footerSecondaryButtonStyle}
                    title="Home"
                  >
                    🏠
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      openFollowPanel(video);
                    }}
                    style={footerSecondaryButtonStyle}
                    title={pendingMeetUpCount ? `${pendingMeetUpCount} pending meet-up request${pendingMeetUpCount === 1 ? "" : "s"}` : isFollowing ? "Following" : "Follow"}
                  >
                    <span>{isFollowing ? "👥" : "👤"}</span>
                    {pendingMeetUpCount > 0 ? (
                      <span style={meetUpIndicatorStyle}>
                        {pendingMeetUpCount > 9 ? "9+" : pendingMeetUpCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    style={footerSecondaryButtonStyle}
                    onPointerDown={stopOverlayTap}
                    disabled
                    title="Views"
                  >
                    <span>👀</span>
                    <span style={footerMetricBadgeStyle}>{(video.views || 0) + (localViewStats[video.id] || 0)}</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      openCommentModal(video);
                    }}
                    style={footerSecondaryButtonStyle}
                    title="Comments"
                  >
                    <span>💬</span>
                    <span style={footerMetricBadgeStyle}>{(videoComments[video.id] || []).length}</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      toggleSave(video);
                    }}
                    style={footerSecondaryButtonStyle}
                    disabled={processingSaveId === video.id}
                    title={isSaved ? "Saved" : "Save / Watch"}
                  >
                    <span>{processingSaveId === video.id ? "…" : isSaved ? "🔖" : "📌"}</span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={stopOverlayTap}
                    onClick={(event) => {
                      stopOverlayTap(event);
                      window.dispatchEvent(new Event("open-global-menu"));
                    }}
                    style={footerSecondaryButtonStyle}
                    title="Menu"
                  >
                    ☰
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "grid" && (
        <div style={gridPageStyle}>
          <Categories />

          <div style={gridStyle}>
            {visibleVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => navigate(`/watch/${video.id}`)}
                style={{
                  ...gridItemStyle,
                  backgroundImage: video.thumbnailUrl
                    ? `url(${video.thumbnailUrl})`
                    : "none",
                }}
              >
                <div style={playIconStyle}>▶</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {supportModal && (
        <div style={supportOverlayStyle}>
          <div style={supportCardStyle}>
            <div style={supportHeaderRowStyle}>
              <div>
                <div style={supportEyebrowStyle}>PARAGON SUPPORT</div>
                <h3 style={{ margin: "6px 0 0" }}>{supportModalTitle}</h3>
              </div>
              <button onClick={() => setSupportModal(null)} style={supportCloseStyle}>
                Close
              </button>
            </div>

            {supportModal.group === "bottle" ? (
              <div style={bottleShowcaseLayoutStyle}>
                <div style={bottleZoneStyle}>
                  <div style={bottleZoneGridStyle}>
                    {bottleColumns[0].map((actionKey) => {
                      const action = SUPPORT_ACTIONS[actionKey];
                      const meta = bottleShowcaseMeta[actionKey];

                      return (
                        <div key={actionKey} style={bottleCardStyle}>
                          <div style={bottleCardTopStyle}>
                            <div style={bottleCardVisualStyle}>
                              <span style={bottleCompactCostStyle}>
                                {formatBottleBadge(action)}
                              </span>
                              <div style={bottleCardIconStyle}>{meta?.icon || "🥤"}</div>
                              <div style={bottleCardInsideTitleStyle}>{action.label}</div>
                              <button
                                type="button"
                                onClick={() => handleSupport(supportModal.videoId, actionKey)}
                                style={bottleInlineActionButtonStyle}
                                disabled={processingSupportKey === actionKey}
                              >
                                {processingSupportKey === actionKey ? "..." : "Pop"}
                              </button>
                            </div>
                          </div>
                          <p style={bottleCardHintStyle}>{meta?.note || "Celebration support"}</p>
                          <div style={bottleStatRowStyle}>
                            <span style={bottleMiniStatStyle}>Creator +{meta?.creatorXp || 0} XP</span>
                            <span style={bottleMiniStatStyle}>Rank +{meta?.rankBoost || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={bottleStageStyle}>
                  <div style={bottleStageScreenStyle}>
                    <div style={bottleStageArcWrapStyle}>
                      <svg
                        viewBox="0 0 320 92"
                        preserveAspectRatio="xMidYMid meet"
                        style={bottleStageArcSvgStyle}
                        aria-hidden="true"
                      >
                        <path
                          id="bottle-stage-curve"
                          d="M 28 76 Q 160 6 292 76"
                          fill="none"
                        />
                        <text style={bottleStageArcTextStyle}>
                          <textPath href="#bottle-stage-curve" startOffset="50%" textAnchor="middle">
                            Celebrate your favourite star for Paragon Citizen
                          </textPath>
                        </text>
                      </svg>
                    </div>
                    <div style={bottleStageVideoShellStyle}>
                      {supportPlayableUrl ? (
                        <video
                          src={supportPlayableUrl}
                          style={bottleStageVideoStyle}
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <div
                          style={{
                            ...bottleStageVideoStyle,
                            ...bottleStageVideoFallbackStyle,
                            backgroundImage: supportVideo?.thumbnailUrl
                              ? `url(${supportVideo.thumbnailUrl})`
                              : "none",
                          }}
                        >
                          {!supportVideo?.thumbnailUrl && <span style={videoPlayStyle}>▶</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={bottleZoneStyle}>
                  <div style={bottleZoneGridStyle}>
                    {bottleColumns[1].map((actionKey) => {
                      const action = SUPPORT_ACTIONS[actionKey];
                      const meta = bottleShowcaseMeta[actionKey];

                      return (
                        <div key={actionKey} style={bottleCardStyle}>
                          <div style={bottleCardTopStyle}>
                            <div style={bottleCardVisualStyle}>
                              <span style={bottleCompactCostStyle}>
                                {formatBottleBadge(action)}
                              </span>
                              <div style={bottleCardIconStyle}>{meta?.icon || "🥃"}</div>
                              <div style={bottleCardInsideTitleStyle}>{action.label}</div>
                              <button
                                type="button"
                                onClick={() => handleSupport(supportModal.videoId, actionKey)}
                                style={bottleInlineActionButtonStyle}
                                disabled={processingSupportKey === actionKey}
                              >
                                {processingSupportKey === actionKey ? "..." : "Pop"}
                              </button>
                            </div>
                          </div>
                          <p style={bottleCardHintStyle}>{meta?.note || "Celebration support"}</p>
                          <div style={bottleStatRowStyle}>
                            <span style={bottleMiniStatStyle}>Creator +{meta?.creatorXp || 0} XP</span>
                            <span style={bottleMiniStatStyle}>Rank +{meta?.rankBoost || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : supportModal.group === "spray" ? (
              <div style={sprayShowcaseLayoutStyle}>
                <div style={bottleZoneStyle}>
                  <div style={bottleZoneGridStyle}>
                    <div style={bottleCardStyle}>
                      <div style={bottleCardTopStyle}>
                        <div style={{ ...bottleCardVisualStyle, minHeight: 190, justifyContent: "space-between" }}>
                          <span style={bottleCompactCostStyle}>P1</span>
                          <div style={sprayCardIconStyle}>💸</div>
                          <div style={bottleCardInsideTitleStyle}>Parag</div>
                          <button
                            type="button"
                            onClick={() =>
                              handleSupport(supportModal.videoId, "spray_money", {
                                customParagAmount: singleParagSprayAmount,
                                customGbaziloAmount: 0,
                              })
                            }
                            style={bottleInlineActionButtonStyle}
                            disabled={processingSupportKey === "spray_money"}
                          >
                            {processingSupportKey === "spray_money" ? "..." : "Tap"}
                          </button>
                        </div>
                      </div>
                      <p style={bottleCardHintStyle}>Tap to spray 1 Parag at a time.</p>
                      <div style={bottleStatRowStyle}>
                        <span style={bottleMiniStatStyle}>Creator +2 XP</span>
                        <span style={bottleMiniStatStyle}>Tap again to continue</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={sprayCenterStageStyle}>
                  <div style={bottleStageScreenStyle}>
                    <div style={bottleStageArcWrapStyle}>
                      <svg
                        viewBox="0 0 320 92"
                        preserveAspectRatio="xMidYMid meet"
                        style={bottleStageArcSvgStyle}
                        aria-hidden="true"
                      >
                        <path
                          id="spray-stage-curve"
                          d="M 28 76 Q 160 6 292 76"
                          fill="none"
                        />
                        <text style={bottleStageArcTextStyle}>
                          <textPath href="#spray-stage-curve" startOffset="50%" textAnchor="middle">
                            Tap Parag or Gbazilo to spray support live
                          </textPath>
                        </text>
                      </svg>
                    </div>
                    <div style={bottleStageVideoShellStyle}>
                      {supportPlayableUrl ? (
                        <video
                          src={supportPlayableUrl}
                          style={bottleStageVideoStyle}
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                      ) : (
                        <div
                          style={{
                            ...bottleStageVideoStyle,
                            ...bottleStageVideoFallbackStyle,
                            backgroundImage: supportVideo?.thumbnailUrl
                              ? `url(${supportVideo.thumbnailUrl})`
                              : "none",
                          }}
                        >
                          {!supportVideo?.thumbnailUrl && <span style={videoPlayStyle}>▶</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={bottleZoneStyle}>
                  <div style={bottleZoneGridStyle}>
                    <div style={bottleCardStyle}>
                      <div style={bottleCardTopStyle}>
                        <div style={{ ...bottleCardVisualStyle, minHeight: 190, justifyContent: "space-between" }}>
                          <span style={bottleCompactCostStyle}>G1</span>
                          <div style={sprayCardIconStyle}>💸</div>
                          <div style={bottleCardInsideTitleStyle}>Gbazilo</div>
                          <button
                            type="button"
                            onClick={() =>
                              handleSupport(supportModal.videoId, "spray_money", {
                                customParagAmount: 0,
                                customGbaziloAmount: singleGbaziloSprayAmount,
                              })
                            }
                            style={bottleInlineActionButtonStyle}
                            disabled={processingSupportKey === "spray_money"}
                          >
                            {processingSupportKey === "spray_money" ? "..." : "Tap"}
                          </button>
                        </div>
                      </div>
                      <p style={bottleCardHintStyle}>Tap to spray 1 Gbazilo at a time.</p>
                      <div style={bottleStatRowStyle}>
                        <span style={bottleMiniStatStyle}>Creator +50 XP</span>
                        <span style={bottleMiniStatStyle}>Premium spray tap</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={supportOptionGridStyle}>
                {supportActionKeys.map((actionKey) => {
                const action = SUPPORT_ACTIONS[actionKey];
                const isVariable = action.variable;

                return (
                  <div key={actionKey} style={supportOptionCardStyle}>
                    <div style={supportOptionRowStyle}>
                      <strong>{action.label}</strong>
                      <span style={supportCostPillStyle}>
                        {formatSupportCost(action)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSupport(supportModal.videoId, actionKey)}
                      style={supportActionButtonStyle}
                      disabled={processingSupportKey === actionKey}
                    >
                      {processingSupportKey === actionKey
                        ? "Sending..."
                        : action.group === "spray"
                          ? action.label
                          : `Pop ${action.label}`}
                    </button>
                  </div>
                );
              })}
              </div>
            )}

            {!!supportError && (
              <div style={supportErrorStyle}>{supportError}</div>
            )}
          </div>
        </div>
      )}

      {followPanelVideo && (
        <div style={supportOverlayStyle}>
          <div style={followPanelCardStyle}>
            <div style={followPanelHeaderStyle}>
              <div>
                <p style={followPanelEyebrowStyle}>Meet-ups</p>
                <h3 style={{ margin: "6px 0 0" }}>Meet-ups with friends</h3>
              </div>
              <button onClick={closeFollowPanel} style={supportCloseStyle}>
                Close
              </button>
            </div>

            <section style={followMeetUpSectionStyle}>
              <div style={followMeetUpHeaderStyle}>
                <div>
                  <p style={followPanelEyebrowStyle}>Meet-up requests</p>
                  <h4 style={followMeetUpTitleStyle}>{meetUpRequestHeading}</h4>
                </div>
                {meetUpDirectory.length ? (
                  <span style={followMeetUpCountStyle}>{meetUpDirectory.length}</span>
                ) : null}
              </div>

              <div style={followMeetUpListStyle}>
                {loadingMeetUpDirectory ? (
                  <p style={followMetaStyle}>Loading meet-up requests...</p>
                ) : meetUpDirectory.length ? (
                  meetUpDirectory.map((request) => (
                    <article key={request.id} style={followMeetUpRequestStyle}>
                      <div style={followMeetUpRequestHeaderStyle}>
                        <div style={followContentStyle}>
                          <strong>{request.otherUserName}</strong>
                          <span style={followMetaStyle}>{request.directionLabel}</span>
                          <span style={followMetaStyle}>{formatMeetUpDirectoryLabel(request)}</span>
                        </div>
                        <span style={followMeetUpStatusStyle(request.status)}>
                          {request.status === "accepted" ? "Approved" : request.status}
                        </span>
                      </div>
                      {request.areaPitch ? <p style={followMeetUpPitchStyle}>{request.areaPitch}</p> : null}
                      <button
                        type="button"
                        onClick={() => openMeetUpSession(request.id)}
                        style={followMeetUpButtonStyle}
                      >
                        {getMeetUpDirectoryActionLabel(request)}
                      </button>
                    </article>
                  ))
                ) : (
                  <p style={followMetaStyle}>No meet-up requests yet.</p>
                )}
              </div>
            </section>

            <div style={followPanelListStyle}>
              {loadingFollowDirectory ? (
                <p style={followMetaStyle}>Loading members...</p>
              ) : (
                followDirectory.map((member) => {
                  const followKey =
                    auth.currentUser?.uid && member.uid
                      ? `${auth.currentUser.uid}_${member.uid}`
                      : "";
                  const isFollowingMember = followKey ? Boolean(followStates[followKey]) : false;

                  return (
                    <button
                      key={member.uid}
                      type="button"
                      onClick={() => openMemberProfile(member)}
                      style={followRowButtonStyle(false)}
                    >
                      <div style={followRowStyle}>
                        <div style={followAvatarStyle}>
                          {(member.displayName || "C").slice(0, 1).toUpperCase()}
                        </div>
                        <div style={followContentStyle}>
                          <strong>{member.displayName}</strong>
                          <span style={followMetaStyle}>{member.role}</span>
                          <span style={followMetaStyle}>
                            {member.subtitle || member.email || "Open profile"}
                          </span>
                        </div>
                        <div style={followActionsStyle}>
                          <span style={followInlineStateStyle}>
                            {isFollowingMember ? "Following" : "View"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div style={followPanelFooterStyle}>
              <button
                type="button"
                onClick={() => {
                  closeFollowPanel();
                  navigate("/following");
                }}
                style={followFeedButtonStyle}
              >
                Open Following Feed
              </button>
            </div>
          </div>
        </div>
      )}

      {commentModal && (
        <div style={supportOverlayStyle}>
          <div style={supportCardStyle}>
            <div style={supportHeaderRowStyle}>
              <div>
                <div style={supportEyebrowStyle}>VIDEO DISCUSSION</div>
                <h3 style={{ margin: "6px 0 0" }}>Comments</h3>
              </div>
              <button onClick={() => setCommentModal(null)} style={supportCloseStyle}>
                Close
              </button>
            </div>

            <div style={commentListStyle}>
              {loadingCommentsFor === commentModal.id ? (
                <p style={commentStateStyle}>Loading comments...</p>
              ) : (videoComments[commentModal.id] || []).length ? (
                (videoComments[commentModal.id] || []).map((comment) => (
                  <div key={comment.id} style={commentItemStyle}>
                    <div style={commentNameStyle}>{comment.userName || "Paragon User"}</div>
                    <div style={commentTextStyle}>{comment.text}</div>
                  </div>
                ))
              ) : (
                <p style={commentStateStyle}>No comments yet. Start the conversation.</p>
              )}
            </div>

            <div style={commentComposerStyle}>
              <textarea
                value={commentDrafts[commentModal.id] || ""}
                onChange={(event) =>
                  setCommentDrafts((prev) => ({
                    ...prev,
                    [commentModal.id]: event.target.value,
                  }))
                }
                placeholder="Write a comment..."
                style={commentInputStyle}
              />
              <button
                type="button"
                onClick={addComment}
                style={supportActionButtonStyle}
                disabled={submittingCommentFor === commentModal.id}
              >
                {submittingCommentFor === commentModal.id ? "Sending..." : "Post Comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INLINE_SPRAY_NOTES = [
  { id: "p1", currency: "PARAG", amount: 1, image: "/spray-notes/p1.png" },
  { id: "g1", currency: "GBAZILO", amount: 1, image: "/spray-notes/g1.png" },
  { id: "p10", currency: "PARAG", amount: 10, image: "/spray-notes/p10.png" },
  { id: "g10", currency: "GBAZILO", amount: 10, image: "/spray-notes/g10.png" },
  { id: "p50", currency: "PARAG", amount: 50, image: "/spray-notes/p50.png" },
  { id: "g50", currency: "GBAZILO", amount: 50, image: "/spray-notes/g50.png" },
  { id: "p100", currency: "PARAG", amount: 100, image: "/spray-notes/p100.png" },
  { id: "g100", currency: "GBAZILO", amount: 100, image: "/spray-notes/g100.png" },
];

function InlineSprayNotePicker({ processing, onSelect, onPointerDown }) {
  return (
    <div style={inlineSprayPickerStyle} onPointerDown={onPointerDown}>
      {INLINE_SPRAY_NOTES.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onSelect(note)}
          disabled={processing}
          style={{
            ...inlineSprayNoteStyle,
            opacity: processing ? 0.72 : 1,
          }}
        >
          <img src={note.image} alt={`${note.amount} ${note.currency}`} style={inlineSprayNoteImageStyle} />
        </button>
      ))}
    </div>
  );
}

function ActionFeedback({ effect }) {
  if (effect.actionKey === "vote") {
    return (
      <div style={actionFeedbackWrapStyle}>
        <div style={actionFeedbackCardStyle}>
          <div style={actionFeedbackIconStyle}>❤️</div>
          <div style={actionFeedbackTextStyle}>+1 Vote</div>
        </div>
      </div>
    );
  }

  if (effect.actionKey === "spray_money") {
    return (
      <div style={actionFeedbackWrapStyle}>
        <div style={actionFeedbackCardStyle}>
          <div style={sprayFeedbackFieldStyle}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <span
                key={index}
                style={{
                  ...sprayNoteStyle,
                  left: `${12 + index * 14}%`,
                  animationDelay: `${index * 0.08}s`,
                }}
              >
                💸
              </span>
            ))}
          </div>
          <div style={actionFeedbackTextStyle}>
            {effect.amountGbazilo > 0
              ? `${effect.amountGbazilo} Gbazilo`
              : `${effect.amountParag} Parag`}
          </div>
        </div>
      </div>
    );
  }

  if (effect.actionKey === "pour_me_water") {
    return (
      <div style={actionFeedbackWrapStyle}>
        <div style={actionFeedbackCardStyle}>
          <div style={actionFeedbackIconStyle}>💧</div>
          <div style={actionFeedbackTextStyle}>Pour Me Water</div>
        </div>
      </div>
    );
  }

  return (
    <div style={actionFeedbackWrapStyle}>
      <div style={actionFeedbackCardStyle}>
        <div style={bottleBurstWrapStyle}>
          <div style={actionFeedbackIconStyle}>🍾</div>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              style={{
                ...bottleBurstParticleStyle,
                transform: `rotate(${index * 60}deg) translateY(-34px)`,
                animationDelay: `${index * 0.04}s`,
              }}
            >
              ✨
            </span>
          ))}
        </div>
        <div style={actionFeedbackTextStyle}>Pop {effect.label}</div>
      </div>
    </div>
  );
}

function getPourCount(video, localDelta = 0) {
  const supportCounts = video.supportCounts || {};
  return Number(supportCounts.pour_me_water || 0) + Number(localDelta || 0);
}

function getSprayCount(video, localDelta = 0) {
  const supportCounts = video.supportCounts || {};
  return Number(supportCounts.spray_money || 0) + Number(localDelta || 0);
}

function getBottleCount(supportCounts = {}) {
  return BOTTLE_ACTION_KEYS.reduce(
    (sum, key) => sum + Number(supportCounts?.[key] || 0),
    0
  );
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function shouldRedirectToWallet(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("insufficient") &&
    (normalized.includes("parag") || normalized.includes("gbazilo") || normalized.includes("balance"))
  );
}

async function loadFollowDirectory(currentUid) {
  const sources = [
    { collectionName: "citizen_profiles", role: "Citizen" },
    { collectionName: "promoter_profiles", role: "Ambassador" },
    { collectionName: "merchant_profiles", role: "Merchant" },
    { collectionName: "user_profiles", role: "User" },
    { collectionName: "backer_profiles", role: "Backer" },
    { collectionName: "supernal_profiles", role: "Superboss" },
    { collectionName: "sponsor_investor_profiles", role: "Sponsor / Investor" },
    { collectionName: "sponsor_profiles", role: "Sponsor / Investor" },
  ];

  const peopleMap = new Map();

  for (const source of sources) {
    try {
      const snapshot = await getDocs(collection(db, source.collectionName));
      snapshot.docs.forEach((docSnap) => {
        if (docSnap.id === currentUid) return;
        if (peopleMap.has(docSnap.id)) return;

        const data = docSnap.data();
        const displayName =
          data.stageName ||
          data.realName ||
          data.brandName ||
          data.fullName ||
          data.companyName ||
          data.name ||
          data.email ||
          "Member";

        peopleMap.set(docSnap.id, {
          id: docSnap.id,
          uid: docSnap.id,
          role:
            source.collectionName === "sponsor_investor_profiles"
              ? data.accountType === "Investor"
                ? "Investor"
                : "Sponsor"
              : source.role,
          displayName,
          email: data.email || "",
          subtitle:
            data.profession ||
            data.businessName ||
            data.brandName ||
            data.country ||
            "",
        });
      });
    } catch (error) {
      console.warn(`Skipping follow directory source ${source.collectionName}:`, error?.message || error);
    }
  }

  return Array.from(peopleMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

async function loadMeetUpDirectory(currentUid) {
  if (!currentUid) return [];

  const sessionsRef = collection(db, "meetup_call_sessions");
  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(query(sessionsRef, where("requesterId", "==", currentUid))),
    getDocs(query(sessionsRef, where("starId", "==", currentUid))),
  ]);
  const requestMap = new Map();

  [sentSnap, receivedSnap].forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      const request = { id: docSnap.id, ...docSnap.data() };
      if (!isMeetUpAreaRequest(request)) return;
      requestMap.set(docSnap.id, normalizeMeetUpAreaRequest(request));
    });
  });

  return Array.from(requestMap.values())
    .map((request) => {
      const sentByCurrentUser = request.requesterId === currentUid;
      return {
        ...request,
        otherUserId: sentByCurrentUser ? request.starId : request.requesterId,
        otherUserName: sentByCurrentUser
          ? safeMeetUpName(request.starName)
          : safeMeetUpName(request.requesterName),
        directionLabel: sentByCurrentUser ? "Sent request" : "Received request",
      };
    })
    .sort((first, second) => meetUpSortValue(second) - meetUpSortValue(first));
}

function isMeetUpAreaRequest(request) {
  return request.requestKind === "area" || String(request.note || "").startsWith("MEETUP_AREA_REQUEST|");
}

function normalizeMeetUpAreaRequest(request) {
  if (request.areaTitle) return request;

  const [, areaIcon = "", areaTitle = "Meet-Up Area", areaPitch = ""] = String(request.note || "").split("|");
  return {
    ...request,
    areaIcon,
    areaTitle,
    areaPitch,
  };
}

function formatMeetUpDirectoryLabel(request) {
  return `${request.areaIcon || ""} ${request.areaTitle || "Meet-Up Area"} • ${mealModeDirectoryLabel(request.mealMode)} • ${experienceDirectoryLabel(request.experienceLevel)}`;
}

function getMeetUpDirectoryActionLabel(request) {
  if (request.status === "accepted") return "Meet-Up";
  if (request.status === "pending" && request.directionLabel === "Received request") return "Open Request";
  if (request.status === "pending") return "View Pending";
  return "View Request";
}

function mealModeDirectoryLabel(mode = "dinner") {
  if (mode === "lunch") return "Lunch";
  if (mode === "breakfast") return "Breakfast";
  return "Dinner";
}

function experienceDirectoryLabel(level = "standard") {
  const labels = {
    standard: "Standard Experience",
    premium: "Premium Experience",
    exclusive: "Exclusive Experience",
    vip: "VIP Experience",
    legendary: "Legendary Experience",
  };
  return labels[level] || labels.standard;
}

function safeMeetUpName(name) {
  const value = String(name || "").trim();
  if (!value || value.includes("@")) return "Member";
  return value;
}

function meetUpSortValue(request) {
  if (typeof request.createdAt?.toMillis === "function") return request.createdAt.toMillis();
  if (typeof request.createdAt?.seconds === "number") return request.createdAt.seconds * 1000;
  return 0;
}

const pageStyle = {
  background: "#000",
  width: "100%",
  height: "var(--pp-feed-height, 100dvh)",
  overflowX: "hidden",
  overflowY: "auto",
};

const emptyCategoryPageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 40px",
  background: "#000",
  color: "#fff",
};

const emptyCategoryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const appBootStyle = {
  minHeight: "var(--pp-feed-height, 100dvh)",
  display: "grid",
  placeItems: "center",
  gap: 12,
  alignContent: "center",
  background: "#000",
  color: "#fff",
};

const appBootLogoStyle = {
  width: 96,
  height: 96,
  borderRadius: 22,
  objectFit: "contain",
  boxShadow: "0 0 36px rgba(255, 205, 86, 0.48)",
};

const globalSupportNoticeStyle = {
  position: "fixed",
  top: 96,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 3000,
  minWidth: 220,
  maxWidth: "min(88vw, 420px)",
  padding: "12px 16px",
  borderRadius: 14,
  textAlign: "center",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: "0 18px 48px rgba(0,0,0,0.28)",
};

const globalSupportNoticeErrorStyle = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b42318",
};

const globalSupportNoticeSuccessStyle = {
  background: "rgba(8, 15, 28, 0.9)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#fff",
};

const feedStyle = {
  height: "var(--pp-feed-height, 100dvh)",
  width: "100%",
  overflowY: "scroll",
  overflowX: "hidden",
  scrollSnapType: "y mandatory",
  scrollbarWidth: "auto",
  WebkitOverflowScrolling: "touch",
  overscrollBehaviorY: "auto",
};

const feedItemStyle = {
  height: "var(--pp-feed-height, 100dvh)",
  minHeight: "var(--pp-feed-height, 100dvh)",
  scrollSnapAlign: "start",
  scrollSnapStop: "always",
  position: "relative",
  overflow: "hidden",
  background: "#000",
};

const gridPageStyle = {
  height: "var(--pp-feed-height, 100dvh)",
  overflowY: "scroll",
  overflowX: "hidden",
  WebkitOverflowScrolling: "touch",
  background: "#000",
};

const gridStyle = {
  padding: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 10,
};

const gridItemStyle = {
  height: 250,
  borderRadius: 10,
  overflow: "hidden",
  cursor: "pointer",
  backgroundColor: "#111",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
};

const playIconStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontSize: 40,
  color: "#fff",
};

const placeholderStyle = {
  width: "100%",
  height: "100%",
  background: "#111",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 50,
};

const brandLoaderStyle = {
  display: "grid",
  justifyItems: "center",
  gap: 12,
};

const brandLoaderLogoStyle = {
  width: 76,
  height: 76,
  borderRadius: 18,
  objectFit: "cover",
  boxShadow: "0 0 30px rgba(255, 205, 86, 0.45)",
};

const brandLoaderTextStyle = {
  fontSize: 14,
  fontWeight: 800,
  color: "#f3efe6",
};

const likeStyle = {
  position: "absolute",
  top: "40%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontSize: 80,
  color: "red",
  zIndex: 5,
};

const actionFeedbackWrapStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 60,
};

const actionFeedbackCardStyle = {
  minWidth: 220,
  padding: "24px 28px",
  borderRadius: 22,
  background: "rgba(8, 15, 28, 0.82)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const actionFeedbackIconStyle = {
  fontSize: 40,
  lineHeight: 1,
};

const actionFeedbackTextStyle = {
  fontSize: 26,
  fontWeight: 700,
  textAlign: "center",
  letterSpacing: 0,
};

const leftInfoStyle = {
  position: "absolute",
  bottom: 100,
  left: 15,
  color: "#fff",
  zIndex: 30,
  maxWidth: "70%",
  pointerEvents: "none",
};

const iconActionWrapStyle = {
  position: "relative",
};

const inlineSprayPickerStyle = {
  position: "absolute",
  right: "calc(100% + 7px)",
  top: "50%",
  transform: "translateY(-50%)",
  width: 316,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  padding: 10,
  borderRadius: 16,
  background: "rgba(8, 10, 16, 0.68)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 12px 22px rgba(0,0,0,0.24)",
  backdropFilter: "blur(8px)",
  zIndex: 140,
};

const inlineSprayNoteStyle = {
  height: 96,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  padding: 0,
  overflow: "hidden",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
};

const inlineSprayNoteImageStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const sideRailButtonStyle = {
  minWidth: 74,
  minHeight: 38,
  padding: "8px 6px",
  borderRadius: 0,
  background: "transparent",
  color: "#fff",
  fontSize: 18,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  boxShadow: "none",
  cursor: "pointer",
  pointerEvents: "auto",
  textShadow: "0 2px 10px rgba(0,0,0,0.75)",
};

const sideRailIconStyle = {
  fontSize: 18,
  lineHeight: 1,
};

const sideRailCountStyle = {
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: 0,
};

const footerSecondaryActionsStyle = {
  position: "absolute",
  right: "clamp(12px, 2.4vw, 24px)",
  bottom: "max(18px, calc(env(safe-area-inset-bottom, 0px) + 18px))",
  display: "flex",
  alignItems: "center",
  gap: "clamp(10px, 2vw, 14px)",
  zIndex: 100,
  padding: "4px 0",
  pointerEvents: "auto",
};

const footerSecondaryButtonStyle = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: 34,
  height: 34,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  pointerEvents: "auto",
  textShadow: "0 2px 10px rgba(0,0,0,0.75)",
};

const footerMetricBadgeStyle = {
  position: "absolute",
  top: -3,
  right: -6,
  minWidth: 14,
  padding: "0 3px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.72)",
  color: "#fff",
  fontSize: 9,
  fontWeight: 700,
  lineHeight: "14px",
  textAlign: "center",
};

const meetUpIndicatorStyle = {
  position: "absolute",
  right: 1,
  bottom: 3,
  minWidth: 17,
  height: 17,
  padding: "0 4px",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  border: "2px solid rgba(0,0,0,0.72)",
  fontSize: 10,
  lineHeight: 1,
  fontWeight: 900,
  textShadow: "none",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.3), 0 4px 12px rgba(239,68,68,0.55)",
  pointerEvents: "none",
};

const votePulseBadgeStyle = {
  position: "absolute",
  top: -10,
  right: -10,
  minWidth: 28,
  height: 28,
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 24px rgba(239, 68, 68, 0.35)",
  animation: "votePulse 0.9s ease-out",
};

const rightActionsStyle = {
  position: "absolute",
  right: "clamp(18px, 4vw, 56px)",
  bottom: "max(92px, calc(env(safe-area-inset-bottom, 0px) + 92px))",
  display: "flex",
  flexDirection: "column",
  gap: "clamp(10px, 2vh, 14px)",
  zIndex: 100,
  pointerEvents: "auto",
};

const supportOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: 20,
};

const supportCardStyle = {
  width: "min(760px, 100%)",
  maxHeight: "85vh",
  overflowY: "auto",
  background: "#fff",
  color: "#101828",
  borderRadius: 14,
  padding: 22,
};

const supportHeaderRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 18,
};

const supportEyebrowStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#475467",
};

const supportCloseStyle = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid #d0d5dd",
  background: "#fff",
  cursor: "pointer",
};

const supportOptionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const bottleShowcaseLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(230px, 1fr) minmax(300px, 1.1fr) minmax(230px, 1fr)",
  gap: 14,
  alignItems: "start",
};

const bottleZoneStyle = {
  display: "grid",
  gap: 12,
};

const bottleZoneGridStyle = {
  display: "grid",
  gap: 12,
};

const bottleStageStyle = {
  position: "sticky",
  top: 6,
};

const bottleStageScreenStyle = {
  minHeight: 620,
  borderRadius: 22,
  padding: "14px 20px 18px",
  background: "linear-gradient(180deg, #131826 0%, #0f172a 100%)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 18px 40px rgba(15,23,42,0.28)",
};

const bottleStageArcWrapStyle = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: 64,
  marginBottom: 2,
};

const bottleStageArcSvgStyle = {
  width: "100%",
  maxWidth: 360,
  height: 70,
  overflow: "visible",
};

const bottleStageArcTextStyle = {
  fill: "rgba(255,255,255,0.96)",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 0,
};

const bottleStageTitleStyle = {
  margin: "8px 0 14px",
  fontSize: 26,
  lineHeight: 1.18,
  textAlign: "center",
};

const bottleStageTextStyle = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.8)",
  textAlign: "center",
};

const bottleStageIconsStyle = {
  display: "flex",
  justifyContent: "center",
  gap: 20,
  fontSize: 42,
  paddingTop: 28,
};

const bottleStageVideoShellStyle = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  marginTop: 2,
};

const bottleStageVideoStyle = {
  width: "100%",
  maxWidth: 300,
  height: 500,
  objectFit: "cover",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 36px rgba(0,0,0,0.28)",
  background: "#0b1020",
};

const bottleStageVideoFallbackStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundSize: "cover",
  backgroundPosition: "center",
  color: "#fff",
};

const supportOptionCardStyle = {
  border: "1px solid #e4e7ec",
  borderRadius: 12,
  padding: 16,
  background: "#fcfcfd",
};

const bottleCardHintStyle = {
  margin: "0 0 4px",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#475467",
};

const bottleCardStyle = {
  border: "1px solid #e4e7ec",
  borderRadius: 14,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
  display: "grid",
  gap: 7,
};

const bottleCardTopStyle = {
  display: "block",
};

const bottleCardVisualStyle = {
  position: "relative",
  width: 148,
  minHeight: 148,
  borderRadius: 18,
  background: "linear-gradient(135deg, #fff7ed 0%, #fde68a 100%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "18px 14px 16px",
  boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.05)",
};

const bottleCardIconStyle = {
  fontSize: 34,
  lineHeight: 1,
};

const bottleCardInsideTitleStyle = {
  maxWidth: "100%",
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.08,
  textAlign: "center",
  color: "#101828",
  wordBreak: "break-word",
};

const bottleCompactCostStyle = {
  position: "absolute",
  top: 10,
  right: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.8)",
  color: "#344054",
  fontSize: 11,
  fontWeight: 800,
  minWidth: 42,
};

const bottleInlineActionButtonStyle = {
  marginTop: 4,
  padding: "6px 16px",
  borderRadius: 999,
  border: "none",
  background: "#101828",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const bottleStatRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const bottleMiniStatStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#344054",
  fontSize: 11,
  fontWeight: 700,
};

const supportOptionRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const supportCostPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f2f4f7",
  color: "#344054",
  fontSize: 12,
  fontWeight: 700,
};

const supportInputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  marginBottom: 10,
};

const sprayShowcaseLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 1.1fr) minmax(220px, 1fr)",
  gap: 14,
  alignItems: "stretch",
};

const sprayCenterStageStyle = {
  ...bottleStageStyle,
};

const sprayCardIconStyle = {
  fontSize: 38,
  lineHeight: 1,
  filter: "drop-shadow(0 6px 12px rgba(15, 23, 42, 0.16))",
};

const sprayShowcaseInputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.92)",
  color: "#101828",
  fontSize: 14,
  fontWeight: 700,
  textAlign: "center",
  outline: "none",
};

const sprayHelperRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const sprayHelperNoteStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fff",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
};

const sprayHelperTextStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  textAlign: "right",
};

const supportActionButtonStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  background: "#101828",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const supportErrorStyle = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b42318",
  fontSize: 13,
  fontWeight: 600,
};

const followPanelCardStyle = {
  width: "min(520px, 100%)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "linear-gradient(180deg, #17111d 0%, #0c0a12 100%)",
  color: "#fff",
  borderRadius: 18,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 26px 64px rgba(0,0,0,0.45)",
};

const followPanelHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const followPanelEyebrowStyle = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.72)",
  textTransform: "uppercase",
};

const followPanelListStyle = {
  display: "grid",
  gap: 14,
};

const followMeetUpSectionStyle = {
  display: "grid",
  gap: 12,
  marginBottom: 18,
  paddingBottom: 18,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const followMeetUpHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const followMeetUpTitleStyle = {
  margin: "5px 0 0",
  color: "#fff",
  fontSize: 17,
};

const followMeetUpCountStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
};

const followMeetUpListStyle = {
  display: "grid",
  gap: 10,
};

const followMeetUpRequestStyle = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
};

const followMeetUpRequestHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "flex-start",
};

const followMeetUpPitchStyle = {
  margin: 0,
  color: "rgba(255,255,255,0.75)",
  fontSize: 13,
  lineHeight: 1.45,
};

const followMeetUpButtonStyle = {
  justifySelf: "start",
  border: "none",
  borderRadius: 999,
  padding: "9px 16px",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

const followMeetUpStatusStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: status === "accepted" ? "rgba(16, 185, 129, 0.18)" : status === "declined" ? "rgba(248, 113, 113, 0.18)" : "rgba(251, 191, 36, 0.18)",
  color: status === "accepted" ? "#7dd3a8" : status === "declined" ? "#fca5a5" : "#fde68a",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "capitalize",
});

const followRowButtonStyle = (active) => ({
  width: "100%",
  textAlign: "left",
  border: active ? "1px solid rgba(255, 47, 117, 0.4)" : "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  background: active ? "rgba(255,47,117,0.1)" : "rgba(255,255,255,0.03)",
  padding: 12,
  cursor: "pointer",
  color: "#fff",
});

const followRowStyle = {
  display: "grid",
  gridTemplateColumns: "56px 1fr auto",
  gap: 12,
  alignItems: "center",
};

const followAvatarStyle = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 20,
  boxShadow: "0 12px 28px rgba(236,72,153,0.28)",
};

const followContentStyle = {
  display: "grid",
  gap: 4,
};

const followMetaStyle = {
  fontSize: 13,
  color: "rgba(255,255,255,0.72)",
  lineHeight: 1.35,
};

const followActionsStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const followInlineStateStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.72)",
};

const followSecondaryButtonStyle = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const followPrimaryButtonStyle = (active) => ({
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: active ? "#ff5b98" : "#ff2f75",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: active
    ? "0 10px 24px rgba(255,91,152,0.24)"
    : "0 10px 24px rgba(255,47,117,0.24)",
});

const followPanelFooterStyle = {
  marginTop: 18,
  display: "flex",
  justifyContent: "flex-end",
};

const followFeedButtonStyle = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "transparent",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const followProfileCardStyle = {
  marginBottom: 18,
  padding: 18,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const followProfileHeaderStyle = {
  display: "grid",
  gridTemplateColumns: "56px 1fr",
  gap: 14,
  alignItems: "center",
};

const followProfileNameStyle = {
  fontSize: 20,
};

const followProfileRoleStyle = {
  fontSize: 13,
  color: "#ff8bb5",
  fontWeight: 700,
};

const followProfileAboutStyle = {
  fontSize: 13,
  color: "rgba(255,255,255,0.76)",
  lineHeight: 1.45,
};

const followProfileActionRowStyle = {
  marginTop: 16,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const commentListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxHeight: "48vh",
  overflowY: "auto",
  paddingRight: 4,
  marginBottom: 16,
};

const commentItemStyle = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const commentNameStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 6,
};

const commentTextStyle = {
  fontSize: 14,
  color: "#334155",
  lineHeight: 1.5,
};

const commentStateStyle = {
  margin: 0,
  color: "#475467",
  fontSize: 14,
};

const commentComposerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const commentInputStyle = {
  width: "100%",
  minHeight: 96,
  padding: "12px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: 12,
  resize: "vertical",
  font: "inherit",
};

const sprayFeedbackFieldStyle = {
  position: "relative",
  width: 220,
  height: 90,
};

const sprayNoteStyle = {
  position: "absolute",
  top: -8,
  fontSize: 30,
  animation: "moneyRain 1.6s ease-in forwards",
};

const bottleBurstWrapStyle = {
  position: "relative",
  width: 88,
  height: 54,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const bottleBurstParticleStyle = {
  position: "absolute",
  left: "50%",
  top: "50%",
  marginLeft: -8,
  marginTop: -8,
  fontSize: 16,
  transformOrigin: "center",
  animation: "bottleBurst 0.9s ease-out forwards",
};

const supportAnimationStyles = `
  @keyframes moneyRain {
    0% {
      opacity: 0;
      transform: translateY(-28px) rotate(-8deg) scale(0.72);
    }
    15% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(76px) rotate(10deg) scale(1.08);
    }
  }

  @keyframes bottleBurst {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    20% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: scale(1.2);
    }
  }

  @keyframes votePulse {
    0% {
      opacity: 0;
      transform: scale(0.4);
    }
    35% {
      opacity: 1;
      transform: scale(1.12);
    }
    100% {
      opacity: 0;
      transform: scale(1);
    }
  }
`;

