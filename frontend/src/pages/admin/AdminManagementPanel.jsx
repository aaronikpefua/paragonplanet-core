import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export default function AdminManagementPanel({
  title,
  profileCollection,
  contentCollection = null,
  contentOwnerField = null,
  profileFields = [],
  profileTitleField = "realName",
  emptyLabel = "No records found.",
}) {
  const [profiles, setProfiles] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);

      const profileQuery = query(collection(db, profileCollection));
      const profileSnap = await getDocs(profileQuery);
      const profileData = profileSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      let contentData = [];
      if (contentCollection) {
        const contentQuery = query(
          collection(db, contentCollection),
          orderBy("createdAt", "desc")
        );
        const contentSnap = await getDocs(contentQuery);
        contentData = contentSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
      }

      setProfiles(profileData);
      setContentItems(contentData);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to load management data. Check admin permissions and indexes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profileCollection, contentCollection]);

  const groupedProfiles = useMemo(() => {
    return profiles
      .map((profile) => {
        const ownedContent = contentCollection && contentOwnerField
          ? contentItems.filter((item) => item[contentOwnerField] === profile.id)
          : [];

        return {
          ...profile,
          ownedContent,
        };
      })
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
  }, [profiles, contentItems, contentCollection, contentOwnerField]);

  const handleDeleteContent = async (contentId) => {
    if (!contentCollection) return;
    if (!window.confirm("Delete this post permanently?")) return;

    try {
      setProcessingKey(`content-${contentId}`);
      await deleteDoc(doc(db, contentCollection, contentId));
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Post delete failed. Admin Firestore delete permission may still need to be added.");
    } finally {
      setProcessingKey(null);
    }
  };

  const handleDeleteProfile = async (profileId, ownedContent) => {
    if (!window.confirm("Delete this account profile? This will also try to delete related posts shown here.")) {
      return;
    }

    try {
      setProcessingKey(`profile-${profileId}`);

      if (contentCollection && ownedContent?.length) {
        for (const item of ownedContent) {
          await deleteDoc(doc(db, contentCollection, item.id));
        }
      }

      await deleteDoc(doc(db, profileCollection, profileId));
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Account delete failed. Admin Firestore delete permission may still need to be added.");
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h2>{title}</h2>

      {loading && <p>Loading management records...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !groupedProfiles.length && <p>{emptyLabel}</p>}

      {groupedProfiles.map((profile) => (
        <div
          key={profile.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
            background: "#fafafa",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ marginTop: 0 }}>
                {profile[profileTitleField] || profile.realName || profile.email || profile.id}
              </h3>

              {profileFields.map(([field, label]) => (
                <p key={field} style={{ margin: "6px 0" }}>
                  <strong>{label}:</strong> {formatValue(profile[field])}
                </p>
              ))}
            </div>

            <div>
              <button
                onClick={() => handleDeleteProfile(profile.id, profile.ownedContent)}
                disabled={processingKey === `profile-${profile.id}`}
                style={dangerBtn}
              >
                {processingKey === `profile-${profile.id}` ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>

          {contentCollection && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ marginBottom: 12 }}>Posts</h4>

              {profile.ownedContent.length === 0 && (
                <p style={{ color: "#666" }}>No posts for this account.</p>
              )}

              {profile.ownedContent.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {item.title || item.name || "Untitled Post"}
                    </div>
                    <div style={{ color: "#666", fontSize: 14 }}>
                      {item.description || item.about || item.materials || item.category || "No extra details"}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteContent(item.id)}
                    disabled={processingKey === `content-${item.id}`}
                    style={dangerBtn}
                  >
                    {processingKey === `content-${item.id}` ? "Deleting..." : "Delete Post"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }

  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return value;
}

const dangerBtn = {
  background: "#c62828",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "10px 14px",
  cursor: "pointer",
};
