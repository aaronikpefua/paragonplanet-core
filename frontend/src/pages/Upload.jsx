import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import {
  getFirestore,
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";

const db = getFirestore();
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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
  "Artist & Designer"
];

export default function Upload() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file || !title || !category) {
      alert("Please complete required fields");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);
      setProcessing(false);

      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      /* =========================
         1️⃣ REQUEST SIGNED URL
      ========================== */

      const signedResponse = await fetch(
        `${BACKEND_URL}/generate-upload-url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          })
        }
      );

      const signedData = await signedResponse.json();

      if (!signedResponse.ok) {
        throw new Error(signedData.error || "Failed to generate upload URL");
      }

      const { uploadUrl, fileUrl, fileName } = signedData;

      /* =========================
         2️⃣ DIRECT UPLOAD TO GCS
      ========================== */

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round(
              (event.loaded / event.total) * 100
            );
            setProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error("Upload to storage failed"));
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.send(file);
      });

      /* =========================
         3️⃣ TRIGGER COMPRESSION (ASYNC)
      ========================== */

      setProcessing(true);

      await fetch(`${BACKEND_URL}/trigger-compression`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fileName })
      });

      /* =========================
         4️⃣ SAVE METADATA
      ========================== */

      await addDoc(collection(db, "videos"), {
        uid: user.uid,
        title,
        description,
        category,
        videoUrl: fileUrl,
        createdAt: serverTimestamp(),
        votes: 0,
        views: 0,
        comments: 0
      });

      // Immediate redirect (compression continues in background)
      navigate("/", { replace: true });

    } catch (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Upload Video</h2>

      <form onSubmit={handleUpload}>
        <div>
          <label>Category *</label><br />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <br />

        <div>
          <label>Title *</label><br />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <br />

        <div>
          <label>Description</label><br />
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <br />

        <div>
          <label>Video File *</label><br />
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => setFile(e.target.files[0])}
            required
          />
        </div>

        <br />

        {loading && (
          <>
            <div
              style={{
                width: "100%",
                background: "#eee",
                height: 10,
                borderRadius: 6,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  background: "#28a745",
                  height: "100%",
                  transition: "width 0.2s ease"
                }}
              />
            </div>

            <p style={{ marginTop: 5 }}>
              {progress < 100
                ? `Uploading ${progress}%`
                : processing
                ? "Optimizing video in background..."
                : "Finalizing..."}
            </p>
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
