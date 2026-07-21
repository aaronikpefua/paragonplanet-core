import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { API_URL, appCheckFetch } from "../lib/supportActions";
import SuperbossAboutContent from "../components/SuperbossAboutContent";
import BackerAboutContent from "../components/BackerAboutContent";

const SERVICE_FIELDS = [
  { name: "Health", emoji: "🏥" },
  { name: "Environment", emoji: "🌱" },
  { name: "Education", emoji: "📚" },
  { name: "Enterprise", emoji: "🏢" },
  { name: "Entertainment", emoji: "🎬" },
  { name: "Finance", emoji: "💰" },
  { name: "Security", emoji: "🛡️" },
  { name: "Media", emoji: "📺" },
  { name: "Law", emoji: "⚖️" },
  { name: "Technology", emoji: "💻" },
  { name: "Governance", emoji: "🏛️" },
  { name: "Religion", emoji: "🙏" },
];

const TESTIMONIAL_GROUPS = [
  { key: "students", label: "Students" },
  { key: "tutees", label: "Tutees" },
  { key: "trainees", label: "Trainees" },
  { key: "mentees", label: "Mentees" },
  { key: "followers", label: "Followers" },
  { key: "beneficiaries", label: "Beneficiaries" },
  { key: "communityMembers", label: "Community Members" },
];

const DIRECTORY_CONFIG = {
  supernal: {
    eyebrow: "The Mentors",
    title: "The Mentors for Superbosses",
    description: "Select a field of Discipline to see Superbosses in that field and their trust scores.",
    fieldPrompt: "Fields of Discipline",
    collectionName: "supernal_profiles",
    roleLabel: "Superboss",
    emptyText: "No Superbosses found in this field yet.",
  },
  backer: {
    eyebrow: "",
    title: "The Backer Contestants",
    description: "",
    fieldPrompt: "Select a field of service to see Backer Contestants in that field and their scores.",
    collectionName: "backer_profiles",
    roleLabel: "Backer Contestant",
    emptyText: "No Backer Contestants found in this field yet.",
  },
};

export default function ServiceFieldDirectory({ type = "supernal" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const selectedField = searchParams.get("field") || "";
  const config = DIRECTORY_CONFIG[type] || DIRECTORY_CONFIG.supernal;
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialDrafts, setTestimonialDrafts] = useState({});
  const [submittingTestimonialId, setSubmittingTestimonialId] = useState("");
  const [donationDrafts, setDonationDrafts] = useState({});
  const [submittingDonationId, setSubmittingDonationId] = useState("");
  const [testimonialNotice, setTestimonialNotice] = useState("");

  useEffect(() => {
    const loadProfiles = async () => {
      if (!selectedField) {
        setProfiles([]);
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, config.collectionName));
        setProfiles(
          snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() }))
            .filter((profile) => hasServiceField(profile, selectedField))
            .sort((a, b) => getProfileScore(b, type) - getProfileScore(a, type))
        );
      } catch (error) {
        console.error(`${config.title} could not load:`, error);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
  }, [config.collectionName, config.title, selectedField, type]);

  useEffect(() => {
    if (type !== "supernal" || !selectedField) {
      setTestimonials([]);
      return;
    }

    loadTestimonials(selectedField).then(setTestimonials).catch(() => setTestimonials([]));
  }, [selectedField, type]);

  const selectedTitle = useMemo(
    () => SERVICE_FIELDS.find((field) => field.name === selectedField)?.name || selectedField,
    [selectedField]
  );

  const openField = (field) => {
    navigate(`?field=${encodeURIComponent(field)}`);
  };

  const updateTestimonialDraft = (profileId, updates) => {
    setTestimonialDrafts((current) => ({
      ...current,
      [profileId]: {
        relationship: "students",
        comment: "",
        ...(current[profileId] || {}),
        ...updates,
      },
    }));
  };

  const submitTestimonial = async (profile) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/signup");
      return;
    }

    if (user.uid === profile.uid) {
      setTestimonialNotice("You cannot submit a testimonial for your own Superboss profile.");
      return;
    }

    const draft = testimonialDrafts[profile.uid] || {};
    const relationship = draft.relationship || "students";
    const comment = String(draft.comment || "").trim();

    if (!comment) {
      setTestimonialNotice("Please write a short appreciation comment before submitting.");
      return;
    }

    setSubmittingTestimonialId(profile.uid);
    setTestimonialNotice("");

    try {
      await addDoc(collection(db, "supernal_testimonials"), {
        supernalId: profile.uid,
        supernalName: getDisplayName(profile, "Superboss"),
        field: selectedField,
        relationship,
        relationshipLabel: testimonialLabel(relationship),
        comment,
        voterId: user.uid,
        voterName: getViewerName(user),
        status: "published",
        createdAt: serverTimestamp(),
      });

      updateTestimonialDraft(profile.uid, { comment: "" });
      setTestimonials(await loadTestimonials(selectedField));
      setTestimonialNotice("Appreciation submitted.");
    } catch (error) {
      console.error("Superboss testimonial failed:", error);
      setTestimonialNotice("Could not submit this appreciation right now.");
    } finally {
      setSubmittingTestimonialId("");
    }
  };

  const updateDonationDraft = (profileId, value) => {
    setDonationDrafts((current) => ({
      ...current,
      [profileId]: value,
    }));
  };

  const submitDonation = async (profile) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/signup");
      return;
    }

    if (user.uid === profile.uid) {
      setTestimonialNotice("You cannot donate to your own Superboss profile.");
      return;
    }

    const amountParag = Math.floor(Number(donationDrafts[profile.uid] || 1));
    if (!Number.isFinite(amountParag) || amountParag < 1) {
      setTestimonialNotice("Enter at least 1 PARAG to donate.");
      return;
    }

    setSubmittingDonationId(profile.uid);
    setTestimonialNotice("");

    try {
      const token = await user.getIdToken();
      const response = await appCheckFetch(`${API_URL}/support/superboss/${profile.uid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountParag }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Donation failed.");
      }

      updateDonationDraft(profile.uid, "");
      setTestimonialNotice(`${amountParag} PARAG donated to ${getDisplayName(profile, "this Superboss")}.`);
    } catch (error) {
      const message = error.message || "Could not complete this donation right now.";
      setTestimonialNotice(message);
      if (shouldRedirectToWallet(message)) {
        navigate("/wallet?deposit=1");
      }
    } finally {
      setSubmittingDonationId("");
    }
  };

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          {config.eyebrow && <p style={eyebrowStyle}>{config.eyebrow}</p>}
          <h1 style={titleStyle}>{config.title}</h1>
          {config.description && <p style={mutedStyle}>{config.description}</p>}
          {type === "supernal" && (
            <details style={aboutDetailsStyle}>
              <summary style={aboutSummaryStyle}>About Superbosses</summary>
              <div style={aboutBodyStyle}>
                <SuperbossAboutContent
                  footer={
                    <button
                      type="button"
                      onClick={() => navigate("/onboarding/supernal")}
                      style={joinButtonStyle}
                    >
                      Join Superboss Candidates
                    </button>
                  }
                />
              </div>
            </details>
          )}
          {type === "backer" && (
            <details style={aboutDetailsStyle}>
              <summary style={aboutSummaryStyle}>About Backer Contestants</summary>
              <div style={aboutBodyStyle}>
                <BackerAboutContent
                  footer={
                    <button
                      type="button"
                      onClick={() => navigate("/onboarding/backer")}
                      style={joinButtonStyle}
                    >
                      Join The Backer Contestants
                    </button>
                  }
                />
              </div>
            </details>
          )}
        </div>
        <div style={heroButtonRowStyle}>
          <button type="button" onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            Go Back
          </button>
          {selectedField && (
            <button type="button" onClick={() => navigate(location.pathname)} style={secondaryButtonStyle}>
              Fields
            </button>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>
          {config.fieldPrompt || "Fields of Service"}
        </h2>
        <div style={fieldGridStyle}>
          {SERVICE_FIELDS.map((field) => (
            <button
              key={field.name}
              type="button"
              onClick={() => openField(field.name)}
              style={fieldButtonStyle(field.name === selectedField)}
            >
              <span style={symbolStyle}>{field.emoji}</span>
              <span style={fieldNameStyle}>{field.name}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedField && (
        <section style={panelStyle}>
          <div style={resultHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{selectedTitle}</p>
              <h2 style={sectionTitleStyle}>{config.roleLabel}s in {selectedTitle}</h2>
            </div>
            <span style={countBadgeStyle}>{profiles.length} found</span>
          </div>

          {loading ? (
              <p style={mutedStyle}>Loading {config.roleLabel.toLowerCase()}s...</p>
          ) : profiles.length === 0 ? (
            <p style={mutedStyle}>{config.emptyText}</p>
          ) : (
            <div style={profileGridStyle}>
              {profiles.map((profile, index) => (
                <article key={profile.id} style={profileCardStyle}>
                  <div style={profileMainStyle}>
                    <span style={rankStyle}>#{index + 1}</span>
                    <h3 style={profileNameStyle}>{getDisplayName(profile, config.roleLabel)}</h3>
                    <p style={mutedStyle}>{profile.profession || profile.businessName || profile.country || config.roleLabel}</p>
                    <p style={fieldTextStyle}>{formatServiceDisplay(profile)}</p>
                    {type === "supernal" ? (
                      <SuperbossTestimonialPanel
                        profile={profile}
                        testimonials={testimonials.filter((item) => item.supernalId === profile.uid)}
                        draft={testimonialDrafts[profile.uid] || { relationship: "students", comment: "" }}
                        onDraftChange={(updates) => updateTestimonialDraft(profile.uid, updates)}
                        onSubmit={() => submitTestimonial(profile)}
                        submitting={submittingTestimonialId === profile.uid}
                        donationAmount={donationDrafts[profile.uid] || ""}
                        onDonationChange={(value) => updateDonationDraft(profile.uid, value)}
                        onDonate={() => submitDonation(profile)}
                        donating={submittingDonationId === profile.uid}
                      />
                    ) : null}
                  </div>
                  <div style={scoreBoxStyle}>
                    <span style={scoreLabelStyle}>Score</span>
                    <strong style={scoreValueStyle}>{getProfileScore(profile, type)}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
          {testimonialNotice ? <p style={noticeStyle}>{testimonialNotice}</p> : null}
        </section>
      )}
    </main>
  );
}

function SuperbossTestimonialPanel({
  profile,
  testimonials,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  donationAmount,
  onDonationChange,
  onDonate,
  donating,
}) {
  const counts = countTestimonialsByRelationship(testimonials);
  const recentTestimonials = [...testimonials]
    .sort((first, second) => timestampMillis(second.createdAt) - timestampMillis(first.createdAt))
    .slice(0, 3);

  return (
    <section style={testimonialPanelStyle}>
      <div style={testimonialHeaderStyle}>
        <div>
          <p style={testimonialEyebrowStyle}>Public appreciation</p>
          <h4 style={testimonialTitleStyle}>Comment for {getDisplayName(profile, "this Superboss")}</h4>
        </div>
        <span style={testimonialTotalStyle}>{testimonials.length} testimonials</span>
      </div>

      <div style={testimonialGroupGridStyle}>
        {TESTIMONIAL_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => onDraftChange({ relationship: group.key })}
            style={testimonialGroupButtonStyle(draft.relationship === group.key)}
          >
            <span>{group.label}</span>
            <strong>{counts[group.key] || 0}</strong>
          </button>
        ))}
      </div>

      <textarea
        value={draft.comment || ""}
        onChange={(event) => onDraftChange({ comment: event.target.value })}
        placeholder={`Write an appreciation as ${testimonialLabel(draft.relationship || "students").toLowerCase()}...`}
        style={testimonialTextAreaStyle}
        rows={3}
      />
      <button type="button" onClick={onSubmit} disabled={submitting} style={testimonialSubmitStyle}>
        {submitting ? "Submitting..." : "Submit Appreciation"}
      </button>

      <div style={donationBoxStyle}>
        <div>
          <strong>Donate to support {getDisplayName(profile, "this Superboss")}</strong>
        </div>
        <div style={donationActionStyle}>
          <input
            type="number"
            min="1"
            value={donationAmount}
            onChange={(event) => onDonationChange(event.target.value)}
            placeholder="PARAG"
            style={donationInputStyle}
          />
          <button type="button" onClick={onDonate} disabled={donating} style={donationButtonStyle}>
            {donating ? "Donating..." : "Donate"}
          </button>
        </div>
      </div>

      {recentTestimonials.length ? (
        <div style={recentTestimonialListStyle}>
          {recentTestimonials.map((item) => (
            <article key={item.id} style={recentTestimonialStyle}>
              <strong>{safeName(item.voterName)} • {testimonialLabel(item.relationship)}</strong>
              <p>{item.comment}</p>
            </article>
          ))}
        </div>
      ) : (
        <p style={testimonialEmptyStyle}>No public appreciation yet.</p>
      )}
    </section>
  );
}

async function loadTestimonials(field) {
  const testimonialSnap = await getDocs(
    query(
      collection(db, "supernal_testimonials"),
      where("status", "==", "published")
    )
  );

  return testimonialSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
    .filter((item) => item.field === field);
}

function hasServiceField(profile, field) {
  const wanted = normalize(field);
  const fields = [
    ...(Array.isArray(profile.serviceFields) ? profile.serviceFields : []),
    ...(Array.isArray(profile.knowledgeFields) ? profile.knowledgeFields : []),
    ...(Array.isArray(profile.serviceCategories)
      ? profile.serviceCategories.map((item) =>
          typeof item === "string" ? item : item?.field || item?.category || ""
        )
      : []),
    ...(Array.isArray(profile.serviceCategoryLabels) ? profile.serviceCategoryLabels : []),
  ];

  return fields.some((item) => normalize(String(item).split(":")[0]) === wanted);
}

function getProfileScore(profile, type) {
  if (type === "supernal") {
    const trustRecord = profile.publicTrustRecord || profile.supernalPublicTrust || {};
    const directScore = Number(trustRecord.trustScore ?? profile.trustScore);
    if (Number.isFinite(directScore) && directScore >= 0) {
      return Math.max(0, Math.min(100, Math.round(directScore)));
    }

    const positive =
      Number(trustRecord.totalGoodWorksTestimonies ?? profile.totalGoodWorksTestimonies ?? profile.positiveVoteTotal ?? 0) +
      Number(trustRecord.verifiedSupporters ?? profile.verifiedSupporters ?? 0);
    const complaints = Number(trustRecord.totalComplaints ?? profile.totalComplaints ?? profile.complaintCount ?? 0);
    const totalSignals = positive + complaints;
    if (totalSignals <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((positive / totalSignals) * 100)));
  }

  return (
    Number(profile.providerScore ?? profile.backerScore ?? profile.totalScore ?? profile.correctAnswers ?? 0) || 0
  );
}

function getDisplayName(profile, fallback) {
  return profile.stageName || profile.realName || profile.name || profile.email || fallback;
}

function getViewerName(user) {
  return user.displayName || user.email?.split("@")[0] || "Paragon Member";
}

function safeName(name) {
  const value = String(name || "").trim();
  if (!value || value.includes("@")) return "Paragon Member";
  return value;
}

function testimonialLabel(key) {
  return TESTIMONIAL_GROUPS.find((group) => group.key === key)?.label || "Community Members";
}

function shouldRedirectToWallet(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("insufficient") &&
    (normalized.includes("parag") || normalized.includes("gbazilo") || normalized.includes("balance"))
  );
}

function countTestimonialsByRelationship(testimonials) {
  return testimonials.reduce((counts, item) => {
    const key = item.relationship || "communityMembers";
    return {
      ...counts,
      [key]: (counts[key] || 0) + 1,
    };
  }, {});
}

function timestampMillis(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.seconds === "number") return timestamp.seconds * 1000;
  return 0;
}

function formatServiceDisplay(profile) {
  if (Array.isArray(profile.serviceCategoryLabels) && profile.serviceCategoryLabels.length) {
    return profile.serviceCategoryLabels.join(", ");
  }

  if (Array.isArray(profile.serviceCategories) && profile.serviceCategories.length) {
    return profile.serviceCategories
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.field && item?.category) return `${item.field}: ${item.category}`;
        return item?.field || item?.category || "";
      })
      .filter(Boolean)
      .join(", ");
  }

  return [...(profile.serviceFields || []), ...(profile.knowledgeFields || [])].join(", ");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#000",
  color: "#fff",
};

const heroStyle = {
  maxWidth: 1120,
  margin: "0 auto 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const heroButtonRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const panelStyle = {
  maxWidth: 1120,
  margin: "0 auto 22px",
  padding: 22,
  background: "#080808",
  border: "1px solid #222",
  borderRadius: 12,
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
};

const eyebrowStyle = {
  margin: 0,
  color: "#c9b48a",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "6px 0",
  fontSize: 38,
};

const mutedStyle = {
  color: "#d9d4ca",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 24,
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const fieldButtonStyle = (active) => ({
  minHeight: 112,
  padding: "16px 14px",
  borderRadius: 12,
  border: `1px solid ${active ? "#c9b48a" : "#222"}`,
  background: active ? "#1f2933" : "#111",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: active ? "0 0 0 1px rgba(201, 180, 138, 0.25)" : "none",
});

const symbolStyle = {
  fontSize: 30,
  lineHeight: 1,
};

const fieldNameStyle = {
  fontSize: 14,
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 18,
};

const countBadgeStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#1f2933",
  color: "#fff",
  fontWeight: 800,
};

const profileGridStyle = {
  display: "grid",
  gap: 12,
};

const profileCardStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 16,
  alignItems: "center",
  padding: 16,
  border: "1px solid #222",
  borderRadius: 10,
  background: "#111",
};

const profileMainStyle = {
  minWidth: 0,
};

const rankStyle = {
  color: "#c9b48a",
  fontWeight: 800,
  fontSize: 13,
};

const profileNameStyle = {
  margin: "4px 0",
  fontSize: 20,
};

const fieldTextStyle = {
  color: "#f3efe6",
  marginBottom: 0,
};

const testimonialPanelStyle = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(201, 180, 138, 0.22)",
  background: "rgba(255,255,255,0.04)",
};

const testimonialHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const testimonialEyebrowStyle = {
  margin: 0,
  color: "#c9b48a",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const testimonialTitleStyle = {
  margin: "4px 0 0",
  fontSize: 17,
};

const testimonialTotalStyle = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(22, 163, 74, 0.18)",
  color: "#86efac",
  fontWeight: 800,
  fontSize: 12,
};

const testimonialGroupGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 8,
};

const testimonialGroupButtonStyle = (active) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
  padding: "9px 10px",
  borderRadius: 10,
  border: active ? "1px solid #c9b48a" : "1px solid #2b2b2b",
  background: active ? "#1f2933" : "#0b0b0b",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
});

const testimonialTextAreaStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #2f2f2f",
  background: "#050505",
  color: "#fff",
  font: "inherit",
  resize: "vertical",
};

const testimonialSubmitStyle = {
  justifySelf: "start",
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: "#f3efe6",
  color: "#101828",
  fontWeight: 900,
  cursor: "pointer",
};

const donationBoxStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "center",
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(134, 239, 172, 0.22)",
  background: "rgba(22, 163, 74, 0.08)",
};

const donationActionStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const donationInputStyle = {
  width: 100,
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #2f2f2f",
  background: "#050505",
  color: "#fff",
  font: "inherit",
};

const donationButtonStyle = {
  minHeight: 40,
  padding: "9px 14px",
  borderRadius: 999,
  border: "none",
  background: "#22c55e",
  color: "#052e16",
  fontWeight: 900,
  cursor: "pointer",
};

const recentTestimonialListStyle = {
  display: "grid",
  gap: 8,
};

const recentTestimonialStyle = {
  padding: 10,
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const testimonialEmptyStyle = {
  margin: 0,
  color: "#d9d4ca",
  fontSize: 14,
};

const noticeStyle = {
  margin: "14px 0 0",
  color: "#fde68a",
  fontWeight: 800,
};

const scoreBoxStyle = {
  minWidth: 92,
  padding: 12,
  borderRadius: 10,
  background: "#f3efe6",
  color: "#101828",
  textAlign: "center",
};

const scoreLabelStyle = {
  display: "block",
  fontSize: 12,
  opacity: 0.82,
};

const scoreValueStyle = {
  fontSize: 28,
};

const secondaryButtonStyle = {
  padding: "10px 16px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const aboutDetailsStyle = {
  marginTop: 16,
  maxWidth: 760,
};

const aboutSummaryStyle = {
  display: "inline-flex",
  padding: "10px 14px",
  borderRadius: 8,
  background: "#1f2933",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const aboutBodyStyle = {
  marginTop: 12,
  padding: 16,
  borderRadius: 12,
  background: "#111",
  border: "1px solid #222",
  color: "#f3efe6",
  lineHeight: 1.6,
};

const joinButtonStyle = {
  marginTop: 10,
  padding: "12px 18px",
  borderRadius: 999,
  border: "none",
  background: "#f3efe6",
  color: "#101828",
  fontWeight: 900,
  cursor: "pointer",
};
