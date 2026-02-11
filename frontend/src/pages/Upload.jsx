import { useState } from "react";
import { auth } from "../config/firebase";
import { getFirestore, addDoc, collection, serverTimestamp } from "firebase/firestore";

const db = getFirestore();

const BACKEND_URL = "https://paragonplanet-backend-849823064688.us-central1.run.app";

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
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file || !title || !category) {
      alert("Please complete required fields");
      return;
    }

    try {
      setLoading(true);

      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();

      // Step 1: Request signed URL
      const response = await fetch(`${BACKEND_URL}/generate-upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!response.ok) throw new Error("Failed to generate upload URL");

      const { uploadUrl, fileUrl } = await response.json();

      // Step 2: Upload file directly to GCS
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      // Step 3: Save metadata to Firestore
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

      alert("Upload successful!");

      setFile(null);
      setTitle("");
      setDescription("");
      setCategory("");

    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600 }}>
      <h2>Upload Video</h2>

      <form onSubmit={handleUpload}>
        <div>
          <label>Category *</label><br />
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
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

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
