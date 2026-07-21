import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function VideoPlayer({ streamUrl }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hasStartedRef = useRef(false);
  const playPromiseRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const lastTapRef = useRef({ time: 0, side: null });
  const isScrubbingRef = useRef(false);

  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(Boolean(streamUrl));
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  const isLandscape = !isVertical;
  const isHlsStream = streamUrl?.includes(".m3u8");
  const shouldShowMobileBackdrop = isMobile && isLandscape && !isHlsStream;

  const objectFit =
    (isVertical && !isMobile) || (isLandscape && isMobile)
      ? "contain"
      : "cover";

  const clearControlsTimer = () => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  };

  const scheduleControlsHide = () => {
    clearControlsTimer();

    if (loading || error || isScrubbing) return;

    controlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 1800);
  };

  const revealControls = () => {
    setShowControls(true);
    scheduleControlsHide();
  };

  const skipBySeconds = (seconds) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const nextTime = Math.min(
      Math.max(0, video.currentTime + seconds),
      video.duration || 0
    );

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    revealControls();
  };

  const safePlay = async () => {
    const video = videoRef.current;
    if (!video || error) return;

    if (playPromiseRef.current) return playPromiseRef.current;

    try {
      playPromiseRef.current = video.play();
      await playPromiseRef.current;

      hasStartedRef.current = true;
      setPaused(false);
      setEnded(false);
      setLoading(false);
      scheduleControlsHide();
    } catch (err) {
      const isInterruptedAbort =
        err?.name === "AbortError" &&
        err?.message?.includes("media was removed from the document");

      if (!isInterruptedAbort) {
        console.warn("Autoplay blocked or interrupted:", err);
      }

      setPaused(true);
      setShowControls(true);
    } finally {
      playPromiseRef.current = null;
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || loading || error) return;

    if (video.paused) {
      void safePlay();
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const handleVideoAreaTap = (e) => {
    const video = videoRef.current;
    if (!video || loading || error) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    const lastTap = lastTapRef.current;

    if (lastTap.side === side && now - lastTap.time < 280) {
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      lastTapRef.current = { time: 0, side: null };
      skipBySeconds(side === "left" ? -10 : 10);
      return;
    }

    lastTapRef.current = { time: now, side };

    if (tapTimeoutRef.current) {
      window.clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = window.setTimeout(() => {
      revealControls();
      togglePlay();
      tapTimeoutRef.current = null;
    }, 220);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    revealControls();

    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setMuted(video.muted);

    if (!video.paused) return;
    void safePlay();
  };

  const syncTimeline = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime || 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  };

  const handleSeekStart = (e) => {
    e.stopPropagation();
    setIsScrubbing(true);
    isScrubbingRef.current = true;
    setShowControls(true);
    clearControlsTimer();
  };

  const handleSeekChange = (e) => {
    e.stopPropagation();

    const video = videoRef.current;
    const nextTime = Number(e.target.value);

    setCurrentTime(nextTime);

    if (video) {
      video.currentTime = nextTime;
    }
  };

  const handleSeekEnd = (e) => {
    e.stopPropagation();
    setIsScrubbing(false);
    isScrubbingRef.current = false;

    const video = videoRef.current;
    const nextTime = Number(e.target.value);

    setCurrentTime(nextTime);

    if (video) {
      video.currentTime = nextTime;
    }

    scheduleControlsHide();
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHlsUrl = streamUrl?.includes(".m3u8");

    hasStartedRef.current = false;
    playPromiseRef.current = null;

    if (!streamUrl) {
      setLoading(false);
      setError(true);
      setPaused(true);
      setEnded(false);

      video.removeAttribute("src");
      video.load();

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      return;
    }

    let hls = null;

    setLoading(true);
    setError(false);
    setPaused(false);
    setMuted(true);
    setEnded(false);
    setCurrentTime(0);
    setDuration(0);
    setIsScrubbing(false);
    setShowControls(false);

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = isHlsUrl ? "metadata" : "auto";
    video.loop = true;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const detectOrientation = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      setIsVertical(video.videoHeight > video.videoWidth);
    };

    const handleLoadedMetadata = () => {
      detectOrientation();
      syncTimeline();
      setLoading(false);
    };

    const handleCanPlay = () => {
      detectOrientation();
      syncTimeline();
      setLoading(false);
      void safePlay();
    };

    const handleWaiting = () => {
      if (!hasStartedRef.current) {
        setLoading(true);
      }
    };

    const handlePlaying = () => {
      hasStartedRef.current = true;
      syncTimeline();
      setLoading(false);
      setError(false);
      setPaused(false);
      setEnded(false);
      scheduleControlsHide();
    };

    const handlePause = () => {
      if (!video.ended && hasStartedRef.current) {
        setPaused(true);
        setShowControls(true);
        clearControlsTimer();
      }
    };

    const handlePlay = () => {
      setPaused(false);
      setEnded(false);
      scheduleControlsHide();
    };

    const handleEnded = () => {
      syncTimeline();
      setEnded(true);
      setPaused(false);
      setLoading(false);
      setShowControls(true);
      clearControlsTimer();

      if (video.loop) {
        void safePlay();
      }
    };

    const handleNativeError = () => {
      setError(true);
      setLoading(false);
      setShowControls(true);
      clearControlsTimer();
    };

    const handleTimeUpdate = () => {
      if (isScrubbingRef.current) return;
      syncTimeline();
    };

    const handleDurationChange = () => {
      syncTimeline();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleNativeError);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);

    if (isHlsUrl && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        startLevel: -1,
        capLevelToPlayerSize: true,
        lowLatencyMode: false,
        maxBufferLength: 15,
        backBufferLength: 10,
        maxMaxBufferLength: 30,
        maxBufferHole: 0.5,
        maxFragLookUpTolerance: 0.25,
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        void safePlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data);
        }

        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            hlsRef.current = null;
            setError(true);
            setLoading(false);
            break;
        }
      });
    } else if (isHlsUrl && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.load();
    } else if (!isHlsUrl) {
      video.src = streamUrl;
      video.preload = "auto";
      video.load();
      void safePlay();
    } else {
      setError(true);
      setLoading(false);
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleNativeError);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      clearControlsTimer();
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      if (hls) hls.destroy();
    };
  }, [streamUrl, error]);

  useEffect(() => {
    scheduleControlsHide();

    return () => {
      clearControlsTimer();
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
    };
  }, [paused, loading, error, isScrubbing, ended]);

  const hasSeekableTimeline = Number.isFinite(duration) && duration > 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <div
        onClick={handleVideoAreaTap}
        style={touchAreaStyle}
      />

      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay
        loop
        preload="metadata"
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          objectPosition: "center",
          backgroundColor: "#000",
          display: "block",
          position: "relative",
          zIndex: 2,
        }}
      />

      {shouldShowMobileBackdrop && (
        <video
          src={streamUrl}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          aria-hidden="true"
          style={mobileBackdropVideoStyle}
        />
      )}

      {loading && (
        <div style={overlayStyle}>
          <img src="/logo-v2.png" alt="Paragon Planet" style={loaderLogoStyle} />
        </div>
      )}
      {error && !loading && <div style={overlayStyle}>⚠️ Failed</div>}
      {paused && !loading && !error && !ended && (
        <div style={overlayStyle}>▶</div>
      )}

      {hasSeekableTimeline && showControls && (
        <div
          style={timelineWrapStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={timelineTimeRowStyle}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={Math.min(currentTime, duration)}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            style={timelineRangeStyle}
            aria-label="Seek video"
          />
        </div>
      )}

      <button
        onClick={toggleMute}
        style={{
          ...muteStyle,
          ...(showControls ? controlVisibleStyle : controlHiddenStyle),
        }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}

function formatTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const overlayStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontSize: 50,
  color: "#fff",
  zIndex: 4,
  pointerEvents: "none",
};

const loaderLogoStyle = {
  width: 82,
  height: 82,
  borderRadius: 20,
  objectFit: "cover",
  boxShadow: "0 0 34px rgba(255, 205, 86, 0.5)",
};

const touchAreaStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 3,
};

const mobileBackdropVideoStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  filter: "blur(18px)",
  transform: "scale(1.08)",
  opacity: 0.56,
  zIndex: 0,
  pointerEvents: "none",
};

const controlVisibleStyle = {
  opacity: 1,
  pointerEvents: "auto",
  transform: "translateY(0)",
};

const controlHiddenStyle = {
  opacity: 0,
  pointerEvents: "none",
  transform: "translateY(10px)",
};

const muteStyle = {
  position: "absolute",
  bottom: 56,
  right: 20,
  zIndex: 10,
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
  transition: "opacity 0.24s ease, transform 0.24s ease",
};

const timelineWrapStyle = {
  position: "absolute",
  left: 16,
  right: 16,
  bottom: 8,
  zIndex: 10,
  padding: "4px 0 0",
  borderRadius: 0,
  background: "transparent",
  backdropFilter: "none",
  transition: "opacity 0.24s ease, transform 0.24s ease",
};

const timelineTimeRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 2,
  textShadow: "0 2px 10px rgba(0,0,0,0.75)",
};

const timelineRangeStyle = {
  width: "100%",
  cursor: "pointer",
  height: 4,
};
