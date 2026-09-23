import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { API_URL as BACKEND_URL, appCheckFetch } from "../lib/supportActions";
import { getStoredActiveRole } from "../lib/activeRole";
import { logPerf } from "../lib/perf";

const ADMIN_EMAIL = "natureswaypro2@gmail.com";
const ADMIN_PHONE = "+2348146626688";
const MAX_VIDEO_UPLOAD_MB = Number(import.meta.env.VITE_MAX_VIDEO_UPLOAD_MB || 250);
const MAX_VIDEO_DURATION_SECONDS = Number(
  import.meta.env.VITE_MAX_VIDEO_DURATION_SECONDS || 900
);
const RECENT_UPLOAD_STORAGE_KEY = "paragon_recent_home_upload";
const modalBackdropStyle = { position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.78)", display: "grid", placeItems: "center", padding: 16 };
const modalCardStyle = { width: "min(620px,100%)", maxHeight: "90vh", overflowY: "auto", background: "#fff", color: "#111", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.45)" };

const CATEGORIES = [
  "Dancer",
  "Singer",
  "Instrumentalist",
  "Comedian",
  "Debater",
  "Actor",
  "Model",
  "Cultural Performer",
  "Special Ability",
  "Stunt Performer",
  "Nutritionist",
  "Artist & Designer",
];

const MEET_UP_AREAS = {
  dinner: [
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
  ],
  lunch: [
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
  ],
  breakfast: [
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
  ],
};

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: res.ok
        ? "The server returned an unexpected response."
        : `Upload server returned ${res.status}. Please try again.`,
    };
  }
}

function isAdminUser(user) {
  return Boolean(
    String(user?.email || "").toLowerCase() === ADMIN_EMAIL ||
      user?.phoneNumber === ADMIN_PHONE
  );
}

function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationSeconds = Number(video.duration || 0);
      URL.revokeObjectURL(url);
      resolve({ durationSeconds });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video details. Please choose another file."));
    };
    video.src = url;
  });
}

export default function Upload() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMeetUpMode = new URLSearchParams(location.search).get("purpose") === "meetup";

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [mealMode, setMealMode] = useState("dinner");
  const [areaTitle, setAreaTitle] = useState(MEET_UP_AREAS.dinner[0].title);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [uploadSource, setUploadSource] = useState("file");
  const [videoLink, setVideoLink] = useState("");
  const [acceptance, setAcceptance] = useState(null);
  const acceptanceResolveRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const requestUploadAcceptance = (policy) => new Promise((resolve) => {
    acceptanceResolveRef.current = resolve;
    setAcceptance({ policy, checked: false });
  });

  const closeAcceptance = (accepted) => {
    acceptanceResolveRef.current?.(Boolean(accepted));
    acceptanceResolveRef.current = null;
    setAcceptance(null);
  };

  const selectedArea = useMemo(
    () => MEET_UP_AREAS[mealMode].find((area) => area.title === areaTitle) || MEET_UP_AREAS[mealMode][0],
    [areaTitle, mealMode]
  );

  useEffect(() => {
    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/");

      if (isMeetUpMode) {
        if (!isAdminUser(user)) {
          alert("Only admin can upload meet-up area videos.");
          return navigate("/");
        }
        setCheckingAccess(false);
        return;
      }

      try {
        if (getStoredActiveRole() && getStoredActiveRole() !== "CITIZEN") {
          alert("Switch your active role to Citizen before uploading videos to the home feed.");
          return navigate("/roles");
        }

        const citizenSnap = await getDoc(doc(db, "citizen_profiles", user.uid));
        if (!citizenSnap.exists() || citizenSnap.data()?.status === "banned") {
          alert("Only Citizens can upload videos to the home feed.");
          return navigate("/");
        }
        setCheckingAccess(false);
      } catch (error) {
        console.error("Upload access check failed:", error);
        alert("Could not verify upload access right now.");
        navigate("/");
      }
    };

    checkAccess();
  }, [isMeetUpMode, navigate]);

  const handleMealModeChange = (nextMealMode) => {
    setMealMode(nextMealMode);
    setAreaTitle(MEET_UP_AREAS[nextMealMode][0].title);
  };

  const handlePickSource = (source) => {
    setUploadSource(source);
    if (source === "file") {
      fileInputRef.current?.click();
      return;
    }
    if (source === "camera") {
      cameraInputRef.current?.click();
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    const usingLink = uploadSource === "link";

    if ((!usingLink && !file) || (!isMeetUpMode && (!title || !category))) {
      return alert("Fill all required fields");
    }

    if (usingLink) {
      return alert("Paste-link upload is being prepared next. For now, use Camera / Video or Choose file.");
    }

    try {
      setLoading(true);
      setProgress(0);
      setStatusText("Preparing upload...");
      const uploadStart = performance.now();
      logPerf("upload.web.T0_upload_submit", {
        platform: "web",
        domain: "upload",
        uploadPurpose: isMeetUpMode ? "meet_up_video" : "home_video",
      });

      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      if (!file.type.startsWith("video/")) {
        throw new Error("Please choose a valid video file.");
      }

      const maxUploadBytes = MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
      if (file.size > maxUploadBytes) {
        throw new Error(`Video is too large. Maximum size is ${MAX_VIDEO_UPLOAD_MB} MB.`);
      }

      const { durationSeconds } = await getVideoMetadata(file);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error("Could not read video duration. Please choose another file.");
      }

      if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        throw new Error(
          `Video is too long. Maximum duration is ${MAX_VIDEO_DURATION_SECONDS / 60} minutes (${MAX_VIDEO_DURATION_SECONDS} seconds).`
        );
      }

      const token = await user.getIdToken();
      const uploadPurpose = isMeetUpMode ? "meet_up_video" : "home_video";
      const effectiveTitle = isMeetUpMode ? selectedArea.title : title;
      const effectiveDescription = isMeetUpMode ? selectedArea.pitch : description;
      const effectiveCategory = isMeetUpMode ? selectedArea.title : category;
      let acceptedQuote = null;
      if (!isMeetUpMode) {
        setStatusText("Loading current video terms and pricing...");
        const policyRes = await appCheckFetch(`${BACKEND_URL}/api/video/upload-policy?fileSize=${encodeURIComponent(file.size)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const policy = await readJsonResponse(policyRes);
        if (!policyRes.ok) throw new Error(policy.error || "Could not load current video upload terms");
        acceptedQuote = policy.quote;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const uploadFee = Number(policy.quote?.uploadFee || 0);
        const maintenanceFee = Number(policy.quote?.monthlyMaintenanceFee || 0);
        if (!await requestUploadAcceptance({ ...policy, sizeMb, uploadFee, maintenanceFee, fileName: file.name })) {
          throw new Error("Video upload cancelled before terms acceptance.");
        }
      }

      const res = await appCheckFetch(`${BACKEND_URL}/generate-upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          durationSeconds,
          uploadPurpose,
          title: effectiveTitle,
          description: effectiveDescription,
          category: effectiveCategory,
          acceptedTerms: !isMeetUpMode,
          pricingVersion: acceptedQuote?.pricingVersion,
          termsVersion: acceptedQuote?.termsVersion,
          uploadFeeAccepted: acceptedQuote?.uploadFee,
          monthlyMaintenanceAccepted: acceptedQuote?.monthlyMaintenanceFee,
        }),
      });

      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Could not create upload URL");

      const { uploadUrl, fileName, fileUrl, uploadId } = data;
      if (!fileUrl) throw new Error("Backend did not return original video URL");
      const cleanName = fileName.split("/").pop();
      const backendVideoId = data.video?.videoId || cleanName.split("-")[0];
      logPerf("upload.web.T1_upload_url_ready", {
        platform: "web",
        domain: "upload",
        videoId: backendVideoId,
        durationMs: Math.round(performance.now() - uploadStart),
      });
      logPerf("upload.web.T5_feed_record_created", {
        platform: "web",
        domain: "upload",
        videoId: backendVideoId,
        durationMs: Math.round(performance.now() - uploadStart),
      });

      setStatusText("Uploading video...");

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        };
        xhr.onerror = () => reject(new Error("Upload error"));
        xhr.send(file);
      });
      logPerf("upload.web.T2_media_upload_complete", {
        platform: "web",
        domain: "upload",
        videoId: backendVideoId,
        durationMs: Math.round(performance.now() - uploadStart),
      });
      if (!isMeetUpMode && uploadId) {
        await appCheckFetch(`${BACKEND_URL}/api/video/upload-complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            videoId: backendVideoId,
            uploadId,
          }),
        }).catch((completeError) => {
          console.warn("Upload completion reconciliation request failed:", completeError);
        });
      }
      try {
        window.sessionStorage?.setItem(
          RECENT_UPLOAD_STORAGE_KEY,
          JSON.stringify({
            id: backendVideoId,
            uid: user.uid,
            title: effectiveTitle,
            description: effectiveDescription,
            about: effectiveDescription,
            category: effectiveCategory,
            genre: effectiveCategory,
            fileName,
            originalUrl: fileUrl,
            fileUrl,
            streamUrl: fileUrl,
            durationSeconds,
            fileSize: file.size,
            status: "processing",
            processingStatus: "queued",
            source: isMeetUpMode ? "admin_meetup_area_upload" : "citizen_upload",
            visibility: isMeetUpMode ? "meet_up" : "home",
            uploadPurpose,
            votes: 0,
            createdAtMs: Date.now(),
          })
        );
      } catch {}

      setStatusText("Saving video details...");
      logPerf("upload.web.T3_metadata_save_start", {
        platform: "web",
        domain: "upload",
        videoId: backendVideoId,
        writer: "backend-upload-url",
      });
      logPerf("upload.web.T4_metadata_save_complete", {
        platform: "web",
        domain: "upload",
        videoId: backendVideoId,
        writer: "backend-upload-url",
        durationMs: Math.round(performance.now() - uploadStart),
      });

      setStatusText("Starting background processing...");
      appCheckFetch(`${BACKEND_URL}/trigger-compression`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName,
          originalUrl: fileUrl,
          videoId: backendVideoId,
          durationSeconds,
          title: effectiveTitle,
          description: effectiveDescription,
          category: effectiveCategory,
        }),
      }).catch((compressionErr) => {
        console.warn("Compression request failed:", compressionErr);
      });

      setStatusText(isMeetUpMode ? "Returning to admin..." : "Returning to feed...");
      navigate(isMeetUpMode ? "/admin" : "/", { replace: true });
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.message || "Upload error");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return <p style={{ padding: 20 }}>Checking access...</p>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <h2>{isMeetUpMode ? "Admin Meet-Up Area Video Upload" : "Upload Video"}</h2>
      <p style={{ color: "#52616b", lineHeight: 1.5 }}>
        {isMeetUpMode
          ? "Upload Dinner, Lunch, and Breakfast area videos. Each video is tied to its exact meet-up box."
          : "Citizen videos upload to the main home video feed."}
      </p>

      {acceptance && <div role="dialog" aria-modal="true" style={modalBackdropStyle}><div style={modalCardStyle}><h2>PARAGON PLANET VIDEO UPLOAD</h2><p><strong>Video:</strong> {acceptance.policy.fileName}</p><p><strong>Video Size:</strong> {acceptance.policy.sizeMb} MB</p><p><strong>Pricing Tier:</strong> {Math.ceil((acceptance.policy.quote?.tier?.minBytes || 0) / 1048576)}–{Math.round((acceptance.policy.quote?.tier?.maxBytes || 0) / 1048576)} MB</p><p><strong>Current Upload Fee:</strong> {acceptance.policy.uploadFee} PARAG</p><p><strong>Monthly Maintenance:</strong> {acceptance.policy.maintenanceFee} PARAG/month</p><p><strong>Maximum Upload Size:</strong> {Math.round(Number(acceptance.policy.quote?.maxUploadSizeBytes || 0) / 1073741824 * 10) / 10} GB</p><p><strong>Current Pricing Version:</strong> {acceptance.policy.quote?.pricingVersion}</p><p><strong>Current Terms Version:</strong> {acceptance.policy.quote?.termsVersion}</p><details><summary>View Video Upload Terms &amp; Conditions</summary><p>{acceptance.policy.terms?.body}</p></details><label><input type="checkbox" checked={acceptance.checked} onChange={(event) => setAcceptance((current) => ({ ...current, checked: event.target.checked }))} /> I have read and agree to the Terms and displayed upload and maintenance charges.</label><div style={{display:"flex",gap:12,marginTop:16}}><button type="button" onClick={() => closeAcceptance(false)}>CANCEL</button><button type="button" disabled={!acceptance.checked} onClick={() => closeAcceptance(true)}>AGREE &amp; UPLOAD</button></div></div></div>}
      <form onSubmit={handleUpload}>
        {isMeetUpMode ? (
          <>
            <label style={labelStyle}>Meal group</label>
            <select value={mealMode} onChange={(e) => handleMealModeChange(e.target.value)} required style={fieldStyle}>
              <option value="dinner">Dinner</option>
              <option value="lunch">Lunch</option>
              <option value="breakfast">Breakfast</option>
            </select>

            <label style={labelStyle}>Meet-up area box</label>
            <select value={areaTitle} onChange={(e) => setAreaTitle(e.target.value)} required style={fieldStyle}>
              {MEET_UP_AREAS[mealMode].map((area) => (
                <option key={area.title} value={area.title}>
                  {area.icon} {area.title}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={labelStyle}>Talent category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required style={fieldStyle}>
              {CATEGORIES.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
          </>
        )}

        {!isMeetUpMode && (
          <>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={fieldStyle}
            />

            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...fieldStyle, minHeight: 90 }}
            />
          </>
        )}

        <label style={labelStyle}>Video file</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => handlePickSource("camera")}
            style={sourceButtonStyle(uploadSource === "camera")}
          >
            Camera / Video
          </button>
          <button
            type="button"
            onClick={() => handlePickSource("file")}
            style={sourceButtonStyle(uploadSource === "file")}
          >
            Choose file
          </button>
          <button
            type="button"
            onClick={() => setUploadSource("link")}
            style={sourceButtonStyle(uploadSource === "link")}
          >
            Paste link
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
          style={{ display: "none" }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files[0] || null)}
          style={{ display: "none" }}
        />

        {uploadSource === "link" ? (
          <>
            <input
              type="url"
              placeholder="Paste direct video link"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              style={fieldStyle}
            />
            <p style={{ color: "#52616b", fontSize: 13, marginTop: 8 }}>
              Link upload is the next safe rollout. For now, Camera / Video and Choose file are ready first.
            </p>
          </>
        ) : (
          <div style={{ ...fieldStyle, background: "#fff", border: "1px solid #d0d5dd" }}>
            {file ? file.name : uploadSource === "camera" ? "No camera/video chosen" : "No file chosen"}
          </div>
        )}

        {loading && (
          <>
            <div style={{ background: "#eee", height: 10, marginTop: 16 }}>
              <div style={{ width: `${progress}%`, background: "green", height: 10 }} />
            </div>
            <p>{progress < 100 ? `${progress}% uploading` : statusText || "Finalizing..."}</p>
          </>
        )}

        <button disabled={loading} style={buttonStyle}>
          {loading ? "Uploading..." : isMeetUpMode ? "Upload Meet-Up Area Video" : "Upload"}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { display: "block", margin: "14px 0 6px", fontWeight: 700 };
const fieldStyle = { width: "100%", maxWidth: 520, padding: "10px 12px", font: "inherit" };
const buttonStyle = { marginTop: 18, padding: "10px 16px", border: "none", borderRadius: 8, background: "#101828", color: "#fff", fontWeight: 800, cursor: "pointer" };
const sourceButtonStyle = (selected) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: `1px solid ${selected ? "#101828" : "#d0d5dd"}`,
  background: selected ? "#101828" : "#fff",
  color: selected ? "#fff" : "#101828",
  fontWeight: 700,
  cursor: "pointer",
});


