import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
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

export default function MeetUpDirectory() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadMembers = async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        navigate("/login");
        return;
      }

      setLoading(true);
      const peopleMap = new Map();

      for (const source of PROFILE_SOURCES) {
        try {
          const snapshot = await getDocs(collection(db, source.collectionName));
          snapshot.docs.forEach((docSnap) => {
            if (docSnap.id === currentUid || peopleMap.has(docSnap.id)) return;

            const data = docSnap.data();
            const role = source.collectionName === "sponsor_investor_profiles"
              ? data.accountType === "Investor" ? "Investor" : "Sponsor"
              : source.role;
            peopleMap.set(docSnap.id, {
              uid: docSnap.id,
              role,
              displayName: getDisplayName(data),
              subtitle: data.profession || data.businessName || data.brandName || data.country || "",
            });
          });
        } catch (error) {
          console.warn(`Skipping meet-up directory source ${source.collectionName}:`, error?.message || error);
        }
      }

      setMembers(
        Array.from(peopleMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
      setLoading(false);
    };

    void loadMembers();
  }, [navigate]);

  const filteredMembers = members.filter((member) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [member.displayName, member.role, member.subtitle]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <p style={eyebrowStyle}>Request meet-up</p>
            <h1 style={titleStyle}>Choose a user to meet</h1>
            <p style={mutedStyle}>Select any member and send a meet-up request to their profile.</p>
          </div>
          <button type="button" onClick={() => navigate("/profile")} style={secondaryButtonStyle}>
            Profile
          </button>
        </div>

        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search users"
          style={searchInputStyle}
        />

        {loading ? (
          <p style={mutedStyle}>Loading users...</p>
        ) : filteredMembers.length === 0 ? (
          <p style={mutedStyle}>No users found.</p>
        ) : (
          <div style={memberGridStyle}>
            {filteredMembers.map((member) => (
              <article key={member.uid} style={memberCardStyle}>
                <div style={avatarStyle}>{member.displayName.slice(0, 1).toUpperCase()}</div>
                <div style={memberBodyStyle}>
                  <strong>{member.displayName}</strong>
                  <span style={metaStyle}>{member.role}</span>
                  <span style={metaStyle}>{member.subtitle || "Open meet-up request"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/meet-up/${member.uid}`)}
                  style={primaryButtonStyle}
                >
                  Request Meet-Up
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function getDisplayName(data) {
  return (
    data.stageName ||
    data.realName ||
    data.brandName ||
    data.fullName ||
    data.companyName ||
    data.name ||
    "Member"
  );
}

const pageStyle = { minHeight: "100vh", padding: "96px 24px 48px", background: "#f7f3ea", color: "#1f2933" };
const panelStyle = { maxWidth: 1120, margin: "0 auto", padding: 24, borderRadius: 14, background: "#fffdf8", border: "1px solid #e2d8c8" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 };
const eyebrowStyle = { margin: 0, textTransform: "uppercase", color: "#6b5f4b", fontSize: 12, fontWeight: 700 };
const titleStyle = { margin: "6px 0", fontSize: 34 };
const mutedStyle = { margin: 0, color: "#52616b", lineHeight: 1.6 };
const searchInputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8, border: "1px solid #d7cdbd", marginBottom: 18, font: "inherit" };
const memberGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };
const memberCardStyle = { display: "grid", gridTemplateColumns: "56px 1fr", gap: 12, padding: 16, borderRadius: 10, border: "1px solid #eee2d3", background: "#fff", alignItems: "center" };
const avatarStyle = { width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", fontSize: 22, fontWeight: 800 };
const memberBodyStyle = { display: "grid", gap: 4, minWidth: 0 };
const metaStyle = { color: "#52616b", fontSize: 14 };
const primaryButtonStyle = { gridColumn: "1 / -1", padding: "10px 14px", borderRadius: 999, border: "none", background: "#101828", color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle = { padding: "10px 14px", borderRadius: 999, border: "1px solid #d7cdbd", background: "#fff", color: "#101828", fontWeight: 800, cursor: "pointer" };
