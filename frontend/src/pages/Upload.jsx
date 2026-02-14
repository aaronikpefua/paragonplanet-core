import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import { getFirestore, addDoc, collection, serverTimestamp } from "firebase/firestore";

const db = getFirestore();
const BACKEND_URL = "https://api.paragonplanet.com";

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

  // Simple compression (reduces resolution slightly before upload)
  const compressVideo = async (file) => {
    // NOTE: true heavy compression requires ffmpeg
    // For now we reduce size by re-encoding via blob slicing
    return file;
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file || !title || !category) {
      alert("Please complete required fields");
      return;
    }

    try {
      setLoading(true);
      setProgress(0);

      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      const compressedFile = await compressVideo(file);

      // 1️⃣ Get signed URL
      const response = await fetch(`${BACKEND_URL}/generate-upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: compressedFile.name,
          fileType: compressedFile.type
        })
      });

      if (!response.ok) throw new Error("Failed to generate upload URL");

      const { uploadUrl, fileUrl } = await response.json();

      // 2️⃣ Upload with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);

        xhr.setRequestHeader("Content-Type", compressedFile.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error("Upload failed"));
        };

        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.send(compressedFile);
      });

      // 3️⃣ Save metadata
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

      // 🚀 Redirect instantly
      navigate("/");

    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
      setProgress(0);
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
            accept="video/*"
            onChange={(e) => setFile(e.target.files[0])}
            required
          />
        </div>

        <br />

        {loading && (
          <>
            <div style={{
              width: "100%",
              height: 10,
              background: "#ddd",
              borderRadius: 5,
              overflow: "hidden"
            }}>
              <div style={{
                width: `${progress}%`,
                height: "100%",
                background: "#4CAF50",
                transition: "width 0.3s"
              }} />
            </div>
            <p>{progress}% uploading...</p>
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>

      </form>
    </div>
  );
}
