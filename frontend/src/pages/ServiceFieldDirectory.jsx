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

const SUPERBOSS_TESTIMONIAL_GROUPS = [
  { key: "students", label: "Students" },
  { key: "tutees", label: "Tutees" },
  { key: "trainees", label: "Trainees" },
  { key: "mentees", label: "Mentees" },
  { key: "followers", label: "Followers" },
  { key: "beneficiaries", label: "Beneficiaries" },
  { key: "communityMembers", label: "Community Members" },
];

const BACKER_TESTIMONIAL_GROUPS = [
  { key: "clients", label: "Clients" },
  { key: "customers", label: "Customers" },
  { key: "consumers", label: "Consumers" },
  { key: "patients", label: "Patient" },
  { key: "followers", label: "Followers" },
  { key: "beneficiaries", label: "Beneficiaries" },
  { key: "communityMembers", label: "Community Members" },
];

const DIRECTORY_CONFIG = {
  supernal: {
    eyebrow: "",
    title: "The Candidates for Paragon Planet Superbosses",
    description: "Select a field of discipline to find your former educators, or add an educator who positively influenced your life. Comment on their impact, express your appreciation, and vote for outstanding educators to help them qualify for the Superboss competition on Paragon Planet.",
    fieldPrompt: "Fields of Discipline",
    collectionName: "supernal_profiles",
    roleLabel: "Superboss",
    emptyText: "No Superbosses found in this field yet.",
  },
  backer: {
    eyebrow: "",
    title: "The Aspirants for Paragon Planet Backer",
    description: "",
    fieldPrompt: "Select a field of service to find professionals, or introduce a professional who has made a positive impact or rendered valuable service in your life. Share your experience, express your appreciation, and vote for deserving professionals to help them qualify for the Backer competition on Paragon Planet.",
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
  const shareInvite = async () => {
    const text = "Join me on Paragon Planet on Google Play: https://play.google.com/store/apps/details?id=com.app.natureswayproduction";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Paragon Planet Invite", text, url: "https://play.google.com/store/apps/details?id=com.app.natureswayproduction" });
        return;
      } catch {
        // Fall back to clipboard below when share is unavailable or cancelled.
      }
    }
    await navigator.clipboard?.writeText(text);
  };
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testimonials, setTestimonials] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [testimonialDrafts, setTestimonialDrafts] = useState({});
  const [submittingTestimonialId, setSubmittingTestimonialId] = useState("");
  const [donationDrafts, setDonationDrafts] = useState({});
  const [submittingDonationId, setSubmittingDonationId] = useState("");
  const [testimonialNotice, setTestimonialNotice] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [submittingVoteId, setSubmittingVoteId] = useState("");
  const [activeCommentProfileId, setActiveCommentProfileId] = useState("");
  const [visibleSections, setVisibleSections] = useState({});
  const [expandedScores, setExpandedScores] = useState({});

  useEffect(() => {
    const loadProfiles = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, config.collectionName));
        setProfiles(
          snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() }))
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
  }, [config.collectionName, config.title, type]);

  useEffect(() => {
    if (!selectedField && !searchTerm) {
      setTestimonials([]);
      setAttempts([]);
      return;
    }

    loadTestimonials(type, selectedField).then(setTestimonials).catch(() => setTestimonials([]));
    loadQuestions(type, selectedField).then(setQuestions).catch(() => setQuestions([]));
    loadAttempts(type).then(setAttempts).catch(() => setAttempts([]));
  }, [selectedField, searchTerm, type]);

  const selectedTitle = useMemo(
    () => SERVICE_FIELDS.find((field) => field.name === selectedField)?.name || selectedField,
    [selectedField]
  );

  const openField = (field) => {
    navigate(`?field=${encodeURIComponent(field)}`);
  };

  const updateTestimonialDraft = (profileId, updates) => {
    const defaultRelationship = type === "backer" ? "clients" : "students";
    setTestimonialDrafts((current) => ({
      ...current,
      [profileId]: {
        relationship: defaultRelationship,
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
      setTestimonialNotice(`You cannot submit a comment for your own ${config.roleLabel} profile.`);
      return;
    }

    const draft = testimonialDrafts[profile.uid] || {};
    const relationship = draft.relationship || (type === "backer" ? "clients" : "students");
    const comment = String(draft.comment || "").trim();

    if (!comment) {
      setTestimonialNotice("Please write a short appreciation comment before submitting.");
      return;
    }

    setSubmittingTestimonialId(profile.uid);
    setTestimonialNotice("");

    try {
      const collectionName = type === "supernal" ? "supernal_testimonials" : "backer_testimonials";
      const profileIdKey = type === "supernal" ? "supernalId" : "backerId";
      const profileNameKey = type === "supernal" ? "supernalName" : "backerName";
      await addDoc(collection(db, collectionName), {
        [profileIdKey]: profile.uid,
        [profileNameKey]: getDisplayName(profile, config.roleLabel),
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
      setTestimonials(await loadTestimonials(type, selectedField));
      setTestimonialNotice("Appreciation submitted.");
    } catch (error) {
      console.error(`${config.roleLabel} comment failed:`, error);
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
      setTestimonialNotice(`You cannot donate to your own ${config.roleLabel} profile.`);
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
      const response = await supportProfileRequest(type, profile.uid, token, {
        actionKey: "donate",
        amountParag,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Donation failed.");
      }

      updateDonationDraft(profile.uid, "");
      setTestimonialNotice(`${amountParag} PARAG donated to ${getDisplayName(profile, config.roleLabel)}.`);
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

  const submitVote = async (profile) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/signup");
      return;
    }

    if (user.uid === profile.uid) {
      setTestimonialNotice(`You cannot vote for your own ${config.roleLabel} profile.`);
      return;
    }

    setSubmittingVoteId(profile.uid);
    setTestimonialNotice("");
    try {
      const token = await user.getIdToken();
      const response = await supportProfileRequest(type, profile.uid, token, {
        actionKey: "vote",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Vote failed.");
      }

      setProfiles((current) =>
        current.map((item) =>
          item.uid === profile.uid
            ? { ...item, score: getProfileScore(item, type) + 1, votes: Number(item.votes || 0) + 1 }
            : item
        )
      );
      setTestimonialNotice(`1 PARAG vote recorded for ${getDisplayName(profile, config.roleLabel)}.`);
    } catch (error) {
      const message = error.message || "Could not record this vote right now.";
      setTestimonialNotice(message);
      if (shouldRedirectToWallet(message)) {
        navigate("/wallet?deposit=1");
      }
    } finally {
      setSubmittingVoteId("");
    }
  };

  const filteredProfiles = useMemo(() => {
    const needle = normalize(searchTerm);
    const fieldProfiles = selectedField
      ? profiles.filter((profile) => hasServiceField(profile, selectedField))
      : profiles;
    if (!needle) return fieldProfiles;

    return profiles.filter((profile) =>
      [
        getDisplayName(profile, config.roleLabel),
        profile.profession,
        profile.businessName,
        profile.country,
        formatServiceDisplay(profile),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [config.roleLabel, profiles, searchTerm, selectedField]);

  async function supportProfileRequest(profileType, profileId, token, body) {
    const rolePath = profileType === "supernal" ? "superboss" : "backer";
    return appCheckFetch(`${API_URL}/support/${rolePath}/${profileId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      body: JSON.stringify(body),
      });
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          {config.eyebrow && <p style={eyebrowStyle}>{config.eyebrow}</p>}
          <h1 style={titleStyle}>{config.title}</h1>
          {config.description && <p style={mutedStyle}>{config.description}</p>}
          {type === "supernal" && (
            <details style={aboutDetailsStyle}>
              <summary style={aboutSummaryStyle}>About Superbosses Candidates</summary>
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
              <summary style={aboutSummaryStyle}>About Backer Aspirants</summary>
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
          <button
            type="button"
            onClick={shareInvite}
            style={joinButtonStyle}
          >
            Invite {type === "supernal" ? "Superboss" : "Backer"}
          </button>
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
        <input
          type="search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setSearchTerm(searchDraft);
            }
          }}
          placeholder={`Search ${config.roleLabel.toLowerCase()}s by name, field, or profession`}
          style={searchInputStyle}
        />
        <div style={searchActionRowStyle}>
          <button type="button" onClick={() => setSearchTerm(searchDraft)} style={secondaryButtonStyle}>
            Search
          </button>
          {(searchDraft || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchDraft("");
                setSearchTerm("");
              }}
              style={secondaryButtonStyle}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {(selectedField || searchTerm) && (
        <section style={panelStyle}>
          <div style={resultHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>{selectedField ? selectedTitle : "Search Results"}</p>
              <h2 style={sectionTitleStyle}>
                {selectedField ? `${config.roleLabel}s in ${selectedTitle}` : `${config.roleLabel}s matching your search`}
              </h2>
            </div>
            <span style={countBadgeStyle}>{filteredProfiles.length} found</span>
          </div>
          {loading ? (
              <p style={mutedStyle}>Loading {config.roleLabel.toLowerCase()}s...</p>
          ) : filteredProfiles.length === 0 ? (
            <p style={mutedStyle}>{profiles.length === 0 ? config.emptyText : "No matching profiles found."}</p>
          ) : (
            <div style={profileGridStyle}>
              {filteredProfiles.map((profile, index) => (
                <article key={profile.id} style={profileCardStyle}>
                  {(() => {
                    const profileQuestions = questions.filter((item) => item.ownerId === profile.uid);
                    const profileAttempts = attempts.filter(
                      (item) => item.ownerId === profile.uid || item.responderId === profile.uid
                    );
                    const scoreStats = buildQuestionStats(profile.uid, profileQuestions, profileAttempts);
                    return (
                      <>
                  <div style={profileMainStyle}>
                    <span style={rankStyle}>#{index + 1}</span>
                    <h3 style={profileNameStyle}>{getDisplayName(profile, config.roleLabel)}</h3>
                    <p style={mutedStyle}>{profile.profession || profile.businessName || profile.country || config.roleLabel}</p>
                    <p style={fieldTextStyle}>{formatServiceDisplay(profile)}</p>
                    <SupportActionPanel
                      roleLabel={config.roleLabel}
                      type={type}
                        profile={profile}
                      testimonials={testimonials.filter((item) => item.profileId === profile.uid)}
                      questions={profileQuestions}
                      visibleSections={visibleSections[profile.uid] || {}}
                      onToggleSection={(section) =>
                        setVisibleSections((current) => ({
                          ...current,
                          [profile.uid]: {
                            ...(current[profile.uid] || {}),
                            [section]: !(current[profile.uid] || {})[section],
                          },
                        }))
                      }
                        draft={testimonialDrafts[profile.uid] || { relationship: type === "backer" ? "clients" : "students", comment: "" }}
                        onDraftChange={(updates) => updateTestimonialDraft(profile.uid, updates)}
                        onSubmit={() => submitTestimonial(profile)}
                        submitting={submittingTestimonialId === profile.uid}
                        donationAmount={donationDrafts[profile.uid] || ""}
                        onDonationChange={(value) => updateDonationDraft(profile.uid, value)}
                      onDonate={() => submitDonation(profile)}
                        donating={submittingDonationId === profile.uid}
                      onVote={() => submitVote(profile)}
                      voting={submittingVoteId === profile.uid}
                      showCommentBox={activeCommentProfileId === profile.uid}
                      onToggleCommentBox={() =>
                        setActiveCommentProfileId((current) => (current === profile.uid ? "" : profile.uid))
                      }
                      />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedScores((current) => ({
                        ...current,
                        [profile.uid]: !current[profile.uid],
                      }))
                    }
                    style={scoreBoxStyle}
                  >
                    <span style={scoreHintStyle}>{expandedScores[profile.uid] ? "Hide scores" : "View scores"}</span>
                  </button>
                  {expandedScores[profile.uid] && (
                    <div style={scoreStatsGridStyle}>
                      {scoreStats.map((item) => (
                        <div key={item.label} style={scoreStatPillStyle}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          )}
          {testimonialNotice ? <p style={noticeStyle}>{testimonialNotice}</p> : null}
        </section>
      )}

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
    </main>
  );
}

function SupportActionPanel({
  roleLabel,
  type,
  profile,
  testimonials,
  questions,
  visibleSections,
  onToggleSection,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  donationAmount,
  onDonationChange,
  onDonate,
  donating,
  onVote,
  voting,
  showCommentBox,
  onToggleCommentBox,
}) {
  const counts = countTestimonialsByRelationship(testimonials);
  const testimonialGroups = type === "backer" ? BACKER_TESTIMONIAL_GROUPS : SUPERBOSS_TESTIMONIAL_GROUPS;
  const showTestimonials = Boolean(visibleSections.testimonies);
  const recentTestimonials = [...testimonials]
    .sort((first, second) => timestampMillis(second.createdAt) - timestampMillis(first.createdAt))
    .slice(0, 3);
  const answeredQuestions = questions.filter((item) => item.answeredCorrectly || item.answeredBy);
  const openQuestions = questions.filter((item) => !item.answeredCorrectly && !item.answeredBy);

  return (
    <section style={testimonialPanelStyle}>
      <div style={testimonialHeaderStyle}>
        <div>
          <p style={testimonialEyebrowStyle}>Public appreciation</p>
          <h4 style={testimonialTitleStyle}>Comment for {getDisplayName(profile, `this ${roleLabel}`)}</h4>
        </div>
        <span style={testimonialTotalStyle}>{testimonials.length} testimonies</span>
      </div>

      <div style={actionButtonRowStyle}>
        <button type="button" onClick={() => onToggleSection("comments")} style={secondaryMiniButtonStyle}>
          {visibleSections.comments ? "Hide Comments" : "View Comments"}
        </button>
        <button type="button" onClick={() => onToggleSection("testimonies")} style={secondaryMiniButtonStyle}>
          {showTestimonials ? "Hide Testimonies" : "Testimonies"}
        </button>
      </div>

      {showTestimonials && (
        <div style={testimonialGroupGridStyle}>
        {testimonialGroups.map((group) => (
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
      )}

      <div style={actionButtonRowStyle}>
        <button type="button" onClick={onVote} disabled={voting} style={testimonialSubmitStyle}>
          {voting ? "Voting..." : "Vote 1 PARAG"}
        </button>
        <button type="button" onClick={onToggleCommentBox} style={testimonialSubmitStyle}>
          Comment
        </button>
      </div>

      {showCommentBox && (
        <div style={commentBoxStyle}>
          <textarea
            value={draft.comment || ""}
            onChange={(event) => onDraftChange({ comment: event.target.value })}
            placeholder={`Write an appreciation as ${testimonialLabel(draft.relationship || "students").toLowerCase()}...`}
            style={testimonialTextAreaStyle}
            rows={3}
          />
          <button type="button" onClick={onSubmit} disabled={submitting} style={testimonialSubmitStyle}>
            {submitting ? "Submitting..." : "Submit Comment"}
          </button>
        </div>
      )}

      <div style={donationBoxStyle}>
        <div>
          <strong>Donate to support {getDisplayName(profile, `this ${roleLabel}`)}</strong>
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

      {visibleSections.comments && (recentTestimonials.length ? (
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
      ))}

      {visibleSections.questions && (
        <div style={recentTestimonialListStyle}>
          {openQuestions.length ? openQuestions.map((item) => (
            <article key={item.id} style={recentTestimonialStyle}>
              <strong>Question Asked</strong>
              <p>{item.questionText || "Untitled question"}</p>
            </article>
          )) : <p style={testimonialEmptyStyle}>No open questions asked yet.</p>}
        </div>
      )}

      {visibleSections.answers && (
        <div style={recentTestimonialListStyle}>
          {answeredQuestions.length ? answeredQuestions.map((item) => (
            <article key={item.id} style={recentTestimonialStyle}>
              <strong>Answered by {safeName(item.answeredByName) || "Member"}</strong>
              <p>{item.questionText || "Untitled question"}</p>
            </article>
          )) : <p style={testimonialEmptyStyle}>No answered questions yet.</p>}
        </div>
      )}
    </section>
  );
}

async function loadTestimonials(type, field) {
  const collectionName = type === "supernal" ? "supernal_testimonials" : "backer_testimonials";
  const testimonialSnap = await getDocs(
    query(
      collection(db, collectionName),
      where("status", "==", "published")
    )
  );

  return testimonialSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
    .map((item) => ({
      ...item,
      profileId: type === "supernal" ? item.supernalId : item.backerId,
    }))
    .filter((item) => item.field === field);
}

async function loadQuestions(type, field) {
  const collectionName = type === "supernal" ? "superboss_challenges" : "backer_questions";
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((item) => {
      const ownerFields = [
        ...(Array.isArray(item.serviceFields) ? item.serviceFields : []),
        ...(Array.isArray(item.knowledgeFields) ? item.knowledgeFields : []),
        item.field,
        item.serviceField,
      ].filter(Boolean);
      return !field || ownerFields.length === 0 || ownerFields.some((value) => normalize(String(value).split(":")[0]) === normalize(field));
    });
}

async function loadAttempts(type) {
  const collectionName = type === "supernal" ? "superboss_challenge_attempts" : "backer_question_attempts";
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function buildQuestionStats(profileId, questions, attempts) {
  const ownAttempts = attempts.filter((item) => item.ownerId === profileId);
  const otherAttempts = attempts.filter((item) => item.responderId === profileId && item.ownerId !== profileId);
  const touchedQuestionIds = new Set(ownAttempts.map((item) => item.questionId).filter(Boolean));
  return [
    { label: "Set", value: questions.length },
    { label: "Solved", value: questions.filter((item) => item.answeredCorrectly || item.answeredBy).length },
    { label: "Failed", value: ownAttempts.filter((item) => item.didTimeout || !item.isCorrect).length },
    {
      label: "Untouched",
      value: questions.filter((item) => !item.answeredCorrectly && !item.answeredBy && !touchedQuestionIds.has(item.id)).length,
    },
    { label: "My Fails", value: otherAttempts.filter((item) => item.didTimeout || !item.isCorrect).length },
    { label: "My Solves", value: otherAttempts.filter((item) => item.isCorrect).length },
  ];
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
  return [...SUPERBOSS_TESTIMONIAL_GROUPS, ...BACKER_TESTIMONIAL_GROUPS].find((group) => group.key === key)?.label || "Community Members";
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

const searchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 10,
  padding: "13px 15px",
  borderRadius: 12,
  border: "1px solid #2f2f2f",
  background: "#050505",
  color: "#fff",
  font: "inherit",
};

const searchActionRowStyle = {
  display: "flex",
  gap: 10,
  marginBottom: 16,
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

const actionButtonRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const secondaryMiniButtonStyle = {
  padding: "8px 11px",
  borderRadius: 999,
  border: "1px solid #2f2f2f",
  background: "#050505",
  color: "#f3efe6",
  fontWeight: 800,
  cursor: "pointer",
};

const commentBoxStyle = {
  display: "grid",
  gap: 10,
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
  border: "none",
  background: "#f3efe6",
  color: "#101828",
  textAlign: "center",
  cursor: "pointer",
};

const scoreLabelStyle = {
  display: "block",
  fontSize: 12,
  opacity: 0.82,
};

const scoreValueStyle = {
  display: "block",
  fontSize: 28,
};

const scoreHintStyle = {
  display: "block",
  marginTop: 4,
  fontSize: 11,
  fontWeight: 800,
};

const scoreStatsGridStyle = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const scoreStatPillStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #2f2f2f",
  background: "#050505",
  color: "#f3efe6",
  fontWeight: 800,
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
