import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../config/firebase";
import {
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import SuperbossAboutContent from "../components/SuperbossAboutContent";
import CitizenAboutContent from "../components/CitizenAboutContent";
import BackerAboutContent from "../components/BackerAboutContent";
import AmbassadorAboutContent from "../components/AmbassadorAboutContent";
import {
  getStoredActiveRole,
  loadAccountRoles,
  setStoredActiveRole,
} from "../lib/activeRole";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [activeRoleKey, setActiveRoleKey] = useState(getStoredActiveRole());
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState([]);
  const [products, setProducts] = useState([]);
  const [promoters, setPromoters] = useState([]);
  const [invitedCitizens, setInvitedCitizens] = useState([]);
  const [loadingInvitedCitizens, setLoadingInvitedCitizens] = useState(false);
  const [inviteShareLink, setInviteShareLink] = useState("");
  const [inviteSharePurpose, setInviteSharePurpose] = useState("citizen_invite");
  const [backerQuestions, setBackerQuestions] = useState([]);
  const [answerableBackerQuestions, setAnswerableBackerQuestions] = useState([]);
  const [backerQuestionDrafts, setBackerQuestionDrafts] = useState([createEmptyBackerQuestion()]);
  const [backerAttemptHistory, setBackerAttemptHistory] = useState([]);
  const [backerLeaderboard, setBackerLeaderboard] = useState([]);
  const [savingBackerQuestions, setSavingBackerQuestions] = useState(false);
  const [answeringQuestionId, setAnsweringQuestionId] = useState(null);
  const [openedBackerQuestionId, setOpenedBackerQuestionId] = useState(null);
  const [openedBackerQuestionExpiresAt, setOpenedBackerQuestionExpiresAt] = useState(null);
  const [openedBackerQuestionSecondsLeft, setOpenedBackerQuestionSecondsLeft] = useState(null);
  const [failedQuestionIds, setFailedQuestionIds] = useState([]);
  const [showPromoters, setShowPromoters] = useState(false);
  const [loadingPromoters, setLoadingPromoters] = useState(false);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [buyerInboxUnreadCount, setBuyerInboxUnreadCount] = useState(0);
  const [showCitizenContestantAbout, setShowCitizenContestantAbout] = useState(false);
  const [showAmbassadorAbout, setShowAmbassadorAbout] = useState(false);
  const [showUserAbout, setShowUserAbout] = useState(false);
  const [showMerchantAbout, setShowMerchantAbout] = useState(false);
  const [showSponsorInvestorAbout, setShowSponsorInvestorAbout] = useState(false);
  const [showBackerAspirantAbout, setShowBackerAspirantAbout] = useState(false);
  const [showSupernalCandidateAbout, setShowSupernalCandidateAbout] = useState(false);
  const navigate = useNavigate();

  const promoterStatusLabel =
    profile?.status === "APPROVED"
      ? "Approved"
      : profile?.status === "REJECTED"
        ? "Rejected"
        : profile?.status === "PENDING_REVIEW"
          ? "Pending Review"
          : profile?.status || "Pending Review";

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setProfile(null);
        setRole(null);
        setVideos([]);
        setProducts([]);
        setInvitedCitizens([]);

        const roles = await loadAccountRoles(db, user.uid);
        setAvailableRoles(roles);

        if (roles.length === 0) {
          navigate("/roles");
          return;
        }

        const selectedRole =
          roles.find((item) => item.key === activeRoleKey) ||
          roles.find((item) => item.key === getStoredActiveRole()) ||
          roles[0];

        setStoredActiveRole(selectedRole.key);
        setActiveRoleKey(selectedRole.key);
        setProfile(selectedRole.profile);
        setRole(selectedRole.role);

        if (selectedRole.key === "PROMOTER") {
          void loadInvitedCitizens(user.uid);
        }

        if (selectedRole.key === "CITIZEN") {

          const q = query(
            collection(db, "videos"),
            where("uid", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          setVideos(
            snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter((video) => isHomeProfileVideo(video))
          );
        }

        if (selectedRole.key === "MERCHANT") {
          const q = query(
            collection(db, "merchant_products"),
            where("merchantId", "==", user.uid)
          );
          const snapshot = await getDocs(q);
          setProducts(
            snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
              })
          );
        }
      } catch (error) {
        console.error("Profile load failed:", error);
        navigate("/roles");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate, activeRoleKey]);

  /* ================= DELETE VIDEO ================= */
  const deleteVideo = async (videoId) => {
    await deleteDoc(doc(db, "videos", videoId));
    setVideos(videos.filter(v => v.id !== videoId));
  };

  /* ================= DELETE ACCOUNT ================= */
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    const user = auth.currentUser;
    if (!user) return;

    if (role === "CITIZEN") {
      await deleteDoc(doc(db, "citizen_profiles", user.uid));
    } else if (role === "PROMOTER") {
      await deleteDoc(doc(db, "promoter_profiles", user.uid));
    } else if (role === "MERCHANT") {
      await deleteDoc(doc(db, "merchant_profiles", user.uid));
    } else if (role === "USER") {
      await deleteDoc(doc(db, "user_profiles", user.uid));
    } else if (role === "BACKER") {
      await deleteDoc(doc(db, "backer_profiles", user.uid));
    } else if (role === "SUPERNAL") {
      await deleteDoc(doc(db, "supernal_profiles", user.uid));
    } else if (
      role === "INVESTOR" ||
      role === "SPONSOR" ||
      role === "SPONSOR / INVESTOR" ||
      role === "SPONSOR_INVESTOR"
    ) {
      await deleteDoc(doc(db, "sponsor_investor_profiles", user.uid)).catch(() => {});
      await deleteDoc(doc(db, "sponsor_profiles", user.uid)).catch(() => {});
    }

    await deleteDoc(doc(db, "public_profiles", user.uid)).catch(() => {});
    await deleteUser(user);
    navigate("/");
  };

  /* ================= GENERATE INVITE LINK ================= */
  const createInviteLink = async (invitePurpose = "citizen_invite") => {
    const user = auth.currentUser;
    if (!user) return;

    const code = Math.random().toString(36).substring(2, 10);
    const profileName = getProfileInviteName(profile, user);
    const invitePayload =
      invitePurpose === "support_invite"
        ? {
            inviterId: user.uid,
            inviterRole: role,
            supportTargetId: user.uid,
            supportTargetRole: role === "SUPERNAL" ? "Superboss" : "Backer",
            supportTargetName: profileName,
            purpose: "support_invite",
          }
        : {
            promoterId: user.uid,
            inviterId: user.uid,
            inviterRole: "PROMOTER",
            purpose: "citizen_invite",
          };

    await setDoc(doc(db, "invites", code), {
      ...invitePayload,
      createdAt: serverTimestamp(),
      active: true
    });

    return `${window.location.origin}/invite/${code}`;
  };

  const openInviteCitizenPanel = async () => {
    const link = await createInviteLink();
    if (!link) return;
    setInviteSharePurpose("citizen_invite");
    setInviteShareLink(link);
  };

  const openInviteSupportPanel = async () => {
    const link = await createInviteLink("support_invite");
    if (!link) return;
    setInviteSharePurpose("support_invite");
    setInviteShareLink(link);
  };

  const openGeneralInvitePanel = async () => {
    const link = await createInviteLink("general_invite");
    if (!link) return;
    setInviteSharePurpose("general_invite");
    setInviteShareLink(link);
  };

  const shareInviteLink = async (link) => {
    const message = `Join me on Paragon Planet with this invite link: ${link}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Paragon Planet Invite",
          text: message,
          url: link
        });
        return;
      } catch (error) {
        console.warn("Native sharing was cancelled or failed:", error?.message || error);
      }
    }

    const encodedMessage = encodeURIComponent(message);
    const shareOptions = [
      `WhatsApp: https://wa.me/?text=${encodedMessage}`,
      `Email: mailto:?subject=${encodeURIComponent("Paragon Planet Invite")}&body=${encodedMessage}`,
      `SMS: sms:?body=${encodedMessage}`,
      `Copy Link: ${link}`
    ].join("\n\n");

    await navigator.clipboard.writeText(link);
    alert(`Choose how to invite your citizens:\n\n${shareOptions}`);
  };

  const loadInvitedCitizens = async (promoterId = auth.currentUser?.uid) => {
    if (!promoterId) return;
    setLoadingInvitedCitizens(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "citizen_profiles"), where("primaryPromoterId", "==", promoterId))
      );
      setInvitedCitizens(
        snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, uid: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
      );
    } catch (error) {
      console.error("Invited citizens could not load:", error);
      setInvitedCitizens([]);
    } finally {
      setLoadingInvitedCitizens(false);
    }
  };

  /* ================= LOAD PROMOTERS (CITIZEN) ================= */
  const loadPromoters = async () => {
    setShowPromoters(true);
    setLoadingPromoters(true);
    try {
      const snapshot = await getDocs(collection(db, "promoter_profiles"));
      setPromoters(
        snapshot.docs
          .map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() }))
          .sort((a, b) => getPromoterDisplayName(a).localeCompare(getPromoterDisplayName(b)))
      );
    } catch (error) {
      console.error("Ambassador message accounts could not load:", error);
      setPromoters([]);
    } finally {
      setLoadingPromoters(false);
    }
  };

  const messagePromoter = (promoter) => {
    setShowPromoters(false);
    navigate("/inbox", {
      state: {
        restrictToContact: true,
        returnTo: "/profile",
        returnLabel: "Profile",
        contact: {
          uid: promoter.uid || promoter.id,
          displayName: getPromoterDisplayName(promoter),
          role: "Ambassador",
          email: promoter.email || "",
          subtitle: getPromoterSubtitle(promoter),
        },
      },
    });
  };

  const loadBackerQuestions = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const snapshot = await getDocs(collection(db, getChallengeQuestionCollection(role)));
        const questionData = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const aTime =
              a.createdAt?.toMillis?.() ||
              a.updatedAt?.toMillis?.() ||
              a.answeredAt?.toMillis?.() ||
              0;
            const bTime =
              b.createdAt?.toMillis?.() ||
              b.updatedAt?.toMillis?.() ||
              b.answeredAt?.toMillis?.() ||
              0;

            return bTime - aTime;
          })
          .slice(0, 100);

        setBackerQuestions(
          questionData.filter(
            (item) =>
              item.ownerId === user.uid &&
              item.questionText &&
              Array.isArray(item.options) &&
              item.options.length > 0
          )
        );
        setAnswerableBackerQuestions(
          questionData.filter(
            (item) =>
              item.ownerId !== user.uid &&
              item.questionText &&
              Array.isArray(item.options) &&
              item.options.length > 0 &&
              (item.status === "PUBLISHED" || !item.status || item.status === "OPEN") &&
              !item.answeredCorrectly
          )
        );

        const leaderboardMap = new Map();
        questionData
          .filter((item) => item.answeredCorrectly && item.answeredBy)
          .forEach((item) => {
            const current = leaderboardMap.get(item.answeredBy) || {
              responderId: item.answeredBy,
              responderName: item.answeredByName || getChallengeRoleLabel(role),
              totalCorrect: 0,
              totalScore: 0,
              totalParagEquivalent: 0
            };

            const rewardScore = Number(item.rewardParagEquivalent || 0) || 1;
            current.totalCorrect += 1;
            current.totalParagEquivalent += Number(item.rewardParagEquivalent || 0);
            current.totalScore += rewardScore;

            leaderboardMap.set(item.answeredBy, current);
          });

        setBackerLeaderboard(
          Array.from(leaderboardMap.values()).sort((a, b) => {
            if (b.totalScore !== a.totalScore) {
              return b.totalScore - a.totalScore;
            }
            return b.totalCorrect - a.totalCorrect;
          })
        );
      } catch (error) {
        console.error("Backer question load failed:", error);
        setBackerQuestions([]);
        setAnswerableBackerQuestions([]);
        setBackerLeaderboard([]);
      }

      try {
        const attemptSnapshot = await getDocs(
          query(
            collection(db, getChallengeAttemptCollection(role)),
            where("responderId", "==", user.uid)
          )
        );
        const attemptData = attemptSnapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          })
          .slice(0, 100);

        setBackerAttemptHistory(attemptData);
      } catch (error) {
        console.error("Backer attempt load failed:", error);
        setBackerAttemptHistory([]);
      }
    };

  useEffect(() => {
    if (role === "BACKER" || role === "SUPERNAL") {
      loadBackerQuestions();
    }
  }, [role]);

  useEffect(() => {
    const loadUnreadCounts = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const directSnapshot = await getDocs(
          query(
            collection(db, "direct_messages"),
            where("participantIds", "array-contains", user.uid),
            limit(300)
          )
        );

        const buyerSnapshot = await getDocs(
          query(
            collection(db, "merchant_order_messages"),
            where("buyerId", "==", user.uid),
            limit(300)
          )
        );

        const merchantSnapshot = await getDocs(
          query(
            collection(db, "merchant_order_messages"),
            where("merchantId", "==", user.uid),
            limit(300)
          )
        );

        const directMessages = directSnapshot.docs.map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data(),
        }));

        const merchantMessages = [
          ...buyerSnapshot.docs.map((messageDoc) =>
            mapProfileMerchantOrderMessage(messageDoc.id, messageDoc.data(), user.uid)
          ),
          ...merchantSnapshot.docs.map((messageDoc) =>
            mapProfileMerchantOrderMessage(messageDoc.id, messageDoc.data(), user.uid)
          ),
        ];

        const mergedMessages = dedupeProfileMessages([
          ...directMessages,
          ...merchantMessages,
        ]);

        setInboxUnreadCount(countUnreadThreads(mergedMessages, user.uid));
        setBuyerInboxUnreadCount(
          role === "USER"
            ? countUnreadThreads(
                dedupeProfileMessages(
                  buyerSnapshot.docs.map((messageDoc) =>
                    mapProfileMerchantOrderMessage(messageDoc.id, messageDoc.data(), user.uid)
                  )
                ),
                user.uid
              )
            : 0
        );
      } catch (error) {
        console.error("Unread count load failed:", error);
        setInboxUnreadCount(0);
        setBuyerInboxUnreadCount(0);
      }
    };

    if (role) {
      loadUnreadCounts();
    }
  }, [role]);

  const activeOpenedQuestion = useMemo(
      () =>
        answerableBackerQuestions.find(
          (question) => question.id === openedBackerQuestionId
        ) || null,
      [answerableBackerQuestions, openedBackerQuestionId]
    );

    const backerStats = useMemo(() => {
      const correctAnswers = backerAttemptHistory.filter((attempt) => attempt.isCorrect).length;
      const failedAttempts = backerAttemptHistory.filter(
        (attempt) => attempt.didTimeout || (!attempt.isCorrect && !attempt.didTimeout)
      ).length;
      const totalRewardWon = backerAttemptHistory.reduce((sum, attempt) => {
        if (!attempt.isCorrect) return sum;
        return sum + Number(attempt.rewardParagEquivalent || 0);
      }, 0);
      const currentRank =
        backerLeaderboard.findIndex((entry) => entry.responderId === auth.currentUser?.uid) + 1;

      return {
        correctAnswers,
        failedAttempts,
        totalRewardWon,
        currentRank: currentRank > 0 ? currentRank : null,
      };
    }, [backerAttemptHistory, backerLeaderboard]);

    useEffect(() => {
    if (!openedBackerQuestionId || !openedBackerQuestionExpiresAt) return;

    const tick = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((openedBackerQuestionExpiresAt - Date.now()) / 1000)
      );

      setOpenedBackerQuestionSecondsLeft(secondsLeft);

      if (secondsLeft <= 0) {
        const timedOutQuestionId = openedBackerQuestionId;
        setOpenedBackerQuestionId(null);
        setOpenedBackerQuestionExpiresAt(null);
        setOpenedBackerQuestionSecondsLeft(null);
        if (activeOpenedQuestion) {
          void recordBackerAttempt(activeOpenedQuestion, null, false, true);
        } else {
          setFailedQuestionIds((prev) =>
            prev.includes(timedOutQuestionId)
              ? prev
              : [...prev, timedOutQuestionId]
          );
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [openedBackerQuestionId, openedBackerQuestionExpiresAt, activeOpenedQuestion]);

  const handleBackerQuestionChange = (index, field, value) => {
    setBackerQuestionDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index
          ? { ...draft, [field]: value }
          : draft
      )
    );
  };

  const openBackerQuestion = (question) => {
    if (openedBackerQuestionId && openedBackerQuestionId !== question.id) {
      alert("Finish the currently opened timed question first.");
      return;
    }

    const timeLimitSeconds = Math.max(1, Number(question.timeLimitSeconds || 60));
    const expiresAt = Date.now() + timeLimitSeconds * 1000;

    setOpenedBackerQuestionId(question.id);
    setOpenedBackerQuestionExpiresAt(expiresAt);
    setOpenedBackerQuestionSecondsLeft(timeLimitSeconds);
    setFailedQuestionIds((prev) => prev.filter((id) => id !== question.id));
  };

  const handleBackerOptionChange = (questionIndex, optionIndex, value) => {
    setBackerQuestionDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === questionIndex
          ? {
              ...draft,
              options: draft.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? value : option
              )
            }
          : draft
      )
    );
  };

  const addBackerQuestionDraft = () => {
    if (backerQuestions.length + backerQuestionDrafts.length >= 5) {
      alert(`You can only set up 5 ${getChallengeRoleLabel(role).toLowerCase()} challenges.`);
      return;
    }

    setBackerQuestionDrafts((prev) => [...prev, createEmptyBackerQuestion()]);
  };

  const publishBackerQuestions = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const validDrafts = backerQuestionDrafts.filter(
      (draft) =>
        draft.questionText.trim() &&
        draft.options.every((option) => option.trim()) &&
        draft.correctAnswerIndex !== ""
    );

    if (!validDrafts.length) {
      alert("Fill at least one complete question with 4 answers and the correct answer selected.");
      return;
    }

    if (backerQuestions.length + validDrafts.length > 5) {
      alert("You can only publish up to 5 questions.");
      return;
    }

    try {
      setSavingBackerQuestions(true);

      for (const draft of validDrafts) {
        const timeLimitValue = Number(draft.timeLimitValue || 0);
        const timeLimitSeconds =
          draft.timeLimitUnit === "minutes"
            ? timeLimitValue * 60
            : timeLimitValue;
        const rewardAmount = Number(draft.rewardAmount || 0);
        const rewardUnit = draft.rewardUnit || "PARAG";
        const rewardParagEquivalent =
          rewardUnit === "GBAZILO"
            ? rewardAmount * 10
            : rewardAmount;

        await addDoc(collection(db, getChallengeQuestionCollection(role)), {
          ownerId: user.uid,
          ownerName: profile?.realName || user.displayName || user.email || getChallengeRoleLabel(role),
          ownerRole: getChallengeRoleLabel(role),
          questionText: draft.questionText.trim(),
          options: draft.options.map((option) => option.trim()),
          correctAnswerIndex: Number(draft.correctAnswerIndex),
          timeLimitValue,
          timeLimitUnit: draft.timeLimitUnit,
          timeLimitSeconds,
          rewardAmount,
          rewardUnit,
          rewardParagEquivalent,
          status: "PUBLISHED",
          answeredCorrectly: false,
          answeredBy: null,
          answeredByName: null,
          answeredAt: null,
          attemptsCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setBackerQuestionDrafts([createEmptyBackerQuestion()]);
      await loadBackerQuestions();
      alert(`${getChallengeRoleLabel(role)} challenges published successfully.`);
    } catch (error) {
      console.error("Publish backer questions failed:", error);
      alert(`${getChallengeRoleLabel(role)} challenge publish failed. Firestore rules may still need to allow the challenge collection.`);
    } finally {
      setSavingBackerQuestions(false);
    }
  };

  const recordBackerAttempt = async (
    question,
    selectedIndex,
    isCorrect,
    didTimeout = false
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    const responderName =
      profile?.realName || user.displayName || user.email || getChallengeRoleLabel(role);

    await addDoc(collection(db, getChallengeAttemptCollection(role)), {
      questionId: question.id,
      ownerId: question.ownerId,
      ownerName: question.ownerName || getChallengeRoleLabel(role),
      responderId: user.uid,
      responderName,
      questionText: question.questionText,
      selectedIndex: selectedIndex ?? null,
      selectedAnswer:
        selectedIndex !== null && selectedIndex !== undefined
          ? question.options?.[selectedIndex] || null
          : null,
      isCorrect,
      didTimeout,
      rewardAmount: Number(question.rewardAmount || 0),
      rewardUnit: question.rewardUnit || "PARAG",
      rewardParagEquivalent: Number(question.rewardParagEquivalent || 0),
      createdAt: serverTimestamp(),
    });

    if (didTimeout) {
      setFailedQuestionIds((prev) =>
        prev.includes(question.id) ? prev : [...prev, question.id]
      );
    }
  };

  const answerBackerQuestion = async (question, selectedIndex) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setAnsweringQuestionId(question.id);

      const isCorrect = Number(question.correctAnswerIndex) === Number(selectedIndex);
      await recordBackerAttempt(question, selectedIndex, isCorrect, false);

      await updateDoc(doc(db, getChallengeQuestionCollection(role), question.id), {
        attemptsCount: (question.attemptsCount || 0) + 1,
        updatedAt: serverTimestamp(),
        ...(isCorrect
          ? {
              answeredCorrectly: true,
              status: "ANSWERED",
              answeredBy: user.uid,
              answeredByName: profile?.realName || user.displayName || user.email || getChallengeRoleLabel(role),
              answeredAt: serverTimestamp(),
            }
          : {}),
      });

      setOpenedBackerQuestionId(null);
      setOpenedBackerQuestionExpiresAt(null);
      setOpenedBackerQuestionSecondsLeft(null);
      await loadBackerQuestions();
      alert(isCorrect ? "Correct answer. This question is now closed." : "That answer is not correct. The question remains open.");
    } catch (error) {
      console.error("Answer backer question failed:", error);
      alert("Could not submit answer. Firestore rules may still need to allow the challenge collection.");
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  const switchActiveRole = (nextRoleKey) => {
    setStoredActiveRole(nextRoleKey);
    setActiveRoleKey(nextRoleKey);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!profile) return null;

  const displayRole =
    role === "PROMOTER"
      ? "AMBASSADOR"
      : role === "BACKER"
        ? "Backer Contestant"
        : role === "SUPERNAL"
          ? "Superbosses"
          : role;

  const renderActionLabel = (label, unreadCount = 0) => (
    <span style={actionButtonContentStyle}>
      <span>{label}</span>
      {unreadCount > 0 && <span style={actionBadgeStyle}>{unreadCount}</span>}
    </span>
  );

  const topProfileActions = (() => {
    if (role === "CITIZEN") {
      return (
        <ActionRow>
          <Button onClick={() => navigate("/onboarding/citizen")}>Edit Profile</Button>
          <Button onClick={loadPromoters}>List Ambassadors</Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => navigate("/meet-up")}>Meet-Up</Button>
        </ActionRow>
      );
    }

    const emailTarget = profile.email || auth.currentUser?.email || "";
    const whatsappTarget = profile.phone || "";

    if (role === "PROMOTER") {
      return (
        <ActionRow>
          <Button
            onClick={openInviteCitizenPanel}
          >
            Invite Citizen
          </Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
        </ActionRow>
      );
    }

    if (role === "MERCHANT") {
      return (
        <ActionRow>
          <Button onClick={() => navigate("/onboarding/merchant")}>Merchant Center</Button>
          <Button onClick={() => navigate("/marketplace")}>Marketplace</Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => window.location = `mailto:${emailTarget}`}>Email</Button>
          <Button onClick={() => window.open(`https://wa.me/${whatsappTarget}`)}>WhatsApp</Button>
        </ActionRow>
      );
    }

    if (role === "USER") {
      return (
        <ActionRow>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => navigate("/meet-up")}>Meet-Up</Button>
        </ActionRow>
      );
    }

    if (role === "BACKER") {
      return (
        <ActionRow>
          <Button onClick={() => navigate("/onboarding/backer")}>Edit Profile</Button>
          <Button onClick={openInviteSupportPanel}>Invite Supporters</Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => window.location = `mailto:${emailTarget}`}>Email</Button>
          <Button onClick={() => window.open(`https://wa.me/${whatsappTarget}`)}>WhatsApp</Button>
        </ActionRow>
      );
    }

    if (role === "SUPERNAL") {
      return (
        <ActionRow>
          <Button onClick={() => navigate("/onboarding/supernal")}>Edit Profile</Button>
          <Button onClick={openInviteSupportPanel}>Invite Supporters</Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => window.location = `mailto:${emailTarget}`}>Email</Button>
          <Button onClick={() => window.open(`https://wa.me/${whatsappTarget}`)}>WhatsApp</Button>
        </ActionRow>
      );
    }

    if (
      role === "INVESTOR" ||
      role === "SPONSOR" ||
      role === "SPONSOR / INVESTOR" ||
      role === "SPONSOR_INVESTOR"
    ) {
      return (
        <ActionRow>
          <Button onClick={() => navigate("/onboarding/sponsor-investor")}>Edit Profile</Button>
          <Button onClick={openGeneralInvitePanel}>Invite</Button>
          <Button onClick={() => navigate("/inbox")}>{renderActionLabel("Inbox", inboxUnreadCount)}</Button>
          <Button onClick={() => navigate("/wallet")}>Wallet</Button>
          <Button onClick={() => window.location = `mailto:${emailTarget}`}>Email</Button>
          <Button onClick={() => window.open(`https://wa.me/${whatsappTarget}`)}>WhatsApp</Button>
        </ActionRow>
      );
    }

    return null;
  })();

    return (
      <div
    style={{
      padding: 20,
      maxWidth: 1000,
      margin: "auto",
      minHeight: "calc(100vh - 60px)", // ✅ allows full scroll
      paddingBottom: 120 // ✅ prevents bottom buttons from being cut off
    }}
  >

        <div style={cardStyle}>
          {availableRoles.length > 1 && (
            <div style={roleSwitcherStyle}>
              <div>
                <strong>Working role</strong>
                <p style={{ margin: "4px 0 0", color: "#667085" }}>
                  Actions and profile data are limited to the selected role.
                </p>
              </div>
              <div style={roleButtonRowStyle}>
                {availableRoles.map((accountRole) => {
                  const isActive = activeRoleKey === accountRole.key;
                  return (
                    <button
                      key={accountRole.key}
                      type="button"
                      onClick={() => switchActiveRole(accountRole.key)}
                      style={isActive ? activeRoleButtonStyle : roleButtonStyle}
                    >
                      {accountRole.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <h1>{displayRole} Profile</h1>
          <p style={{ color: "#777" }}>{profile.realName}</p>
          {topProfileActions}
        </div>

        {role === "CITIZEN" && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowCitizenContestantAbout((value) => !value)}
              style={buttonStyle}
            >
              {showCitizenContestantAbout ? "Hide About Citizen Contestants" : "About Citizen Contestants"}
            </button>

            {showCitizenContestantAbout && (
              <div style={aboutBackerProfileStyle}>
                <CitizenAboutContent />
                <p>
                  Paragon Planet transforms talented individuals into recognized Stars through
                  visibility, growth, competition, creativity, promotion, audience support,
                  discipline, and recognition.
                </p>
                <p>
                  As contestants gain votes, recognition, performance scores, and public support,
                  they unlock greater visibility, stronger rankings, unique identity colors,
                  rewards, higher influence, and greater positions within the Planet.
                </p>
              </div>
            )}
          </div>
        )}

        {role === "USER" && (
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>User Profile</h2>
            <ActionRow>
              <Button onClick={() => navigate("/wallet")}>Wallet</Button>
              <Button onClick={() => navigate("/meet-up")}>Meet-Up</Button>
              <Button onClick={() => navigate("/onboarding/user")}>Edit Profile</Button>
            </ActionRow>
          </div>
        )}

        {role === "MERCHANT" && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowMerchantAbout((value) => !value)}
              style={buttonStyle}
            >
              {showMerchantAbout ? "Hide About The Merchants" : "About The Merchants"}
            </button>

            {showMerchantAbout && (
              <div style={aboutBackerProfileStyle}>
                <h2 style={{ marginTop: 0 }}>About The Merchants</h2>
                <p>
                  Paragon Planet Merchants are users within the Paragon Planet ecosystem who are
                  authorized to upload, showcase, promote, negotiate, and sell digital products and
                  software-based services to buyers across the Planet.
                </p>
                <p>
                  Any user within the ecosystem may qualify to operate as a Merchant by creating
                  and listing approved digital products through their respective Merchant spaces
                  within the Platform.
                </p>
                <p>
                  Merchants are expected to upload their digital products together with their
                  respective prices, descriptions, previews, and delivery information for
                  interested buyers to view, negotiate, bargain, and agree upon the actual purchase
                  price.
                </p>
                <p>
                  The Merchant system allows direct interaction between sellers and buyers through
                  communication, negotiations, offers, and agreements within the Paragon Planet
                  marketplace environment.
                </p>
                <p>The categories of products that may be sold by Merchants include:</p>
                <ul>
                  {MERCHANT_PRODUCT_CATEGORIES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  Payments for approved digital products may be processed through supported digital
                  billing systems, including Google Billing and other authorized payment systems
                  integrated into the Platform.
                </p>
                <p>Within the transaction structure:</p>
                <ul>
                  <li>
                    Payment processors may collect service percentages for transaction processing,
                    buyer protection, payment security, and digital distribution management.
                  </li>
                  <li>
                    Paragon Planet Administration may also receive a platform percentage for
                    product marketing, promotion, marketplace maintenance, visibility systems, and
                    ecosystem operations.
                  </li>
                  <li>
                    Merchants may withdraw their approved earnings through their respective wallets
                    within the Platform according to the financial policies of Paragon Planet.
                  </li>
                </ul>
                <p>Merchants are expected to:</p>
                <ul>
                  {MERCHANT_EXPECTATIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  The Merchant system is designed to transform creators, developers, innovators,
                  educators, designers, and digital entrepreneurs into recognized marketplace
                  sellers within the Paragon Planet ecosystem.
                </p>
                <p>
                  As Merchants gain sales, visibility, customer trust, ratings, and audience
                  engagement, they unlock greater marketplace exposure, promotional advantages,
                  rewards, rankings, and business opportunities within the Planet.
                </p>
              </div>
            )}
          </div>
        )}

        {(role === "INVESTOR" ||
          role === "SPONSOR" ||
          role === "SPONSOR / INVESTOR" ||
          role === "SPONSOR_INVESTOR") && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowSponsorInvestorAbout((value) => !value)}
              style={buttonStyle}
            >
              {showSponsorInvestorAbout ? "Hide About Sponsors / Investors" : "About Sponsors / Investors"}
            </button>

            {showSponsorInvestorAbout && (
              <div style={aboutBackerProfileStyle}>
                <h2 style={{ marginTop: 0 }}>About Sponsors / Investors</h2>
                <p>
                  Paragon Planet Sponsors and Investors are individuals, organizations, companies,
                  institutions, brands, and strategic partners who support, finance, promote,
                  invest in, or collaborate with activities, talents, contests, projects, and
                  opportunities within the Paragon Planet ecosystem.
                </p>
                <p>
                  Sponsors and Investors play a major role in the growth, visibility, development,
                  empowerment, and expansion of the Planet by supporting Citizens, Superbosses,
                  Ambassadors, Backers, Merchants, events, competitions, digital products, and
                  ecosystem activities.
                </p>
                <p>Sponsors and Investors may operate within the Platform for purposes such as:</p>
                <ul>
                  {SPONSOR_INVESTOR_PURPOSES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>Sponsors may support talents, contests, or ecosystem activities in exchange for:</p>
                <ul>
                  {SPONSOR_EXCHANGE_BENEFITS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>Investors may participate in funding opportunities connected to:</p>
                <ul>
                  {INVESTOR_FUNDING_AREAS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>Sponsors and Investors may collaborate directly with:</p>
                <ul>
                  {SPONSOR_INVESTOR_COLLABORATORS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  The Sponsor and Investor system is designed to create opportunities for
                  financial empowerment, strategic partnerships, business visibility, ecosystem
                  expansion, and sustainable growth within Paragon Planet.
                </p>
                <p>Sponsors and Investors are expected to:</p>
                <ul>
                  {SPONSOR_INVESTOR_EXPECTATIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  As Sponsors and Investors participate within the ecosystem, they gain access to
                  broader visibility, strategic influence, partnership opportunities, audience
                  reach, marketplace exposure, promotional advantages, and long-term collaborative
                  benefits within Paragon Planet.
                </p>
              </div>
            )}
          </div>
        )}

        {role === "BACKER" && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowBackerAspirantAbout((value) => !value)}
              style={buttonStyle}
            >
              {showBackerAspirantAbout ? "Hide About Backer Contestants" : "About Backer Contestants"}
            </button>

            {showBackerAspirantAbout && (
              <div style={aboutBackerProfileStyle}>
                <BackerAboutContent />
              </div>
            )}
          </div>
        )}

        {role === "SUPERNAL" && (
          <div style={cardStyle}>
            <button
              type="button"
              onClick={() => setShowSupernalCandidateAbout((value) => !value)}
              style={buttonStyle}
            >
              {showSupernalCandidateAbout ? "Hide About Superbosses" : "About Superbosses"}
            </button>

            {showSupernalCandidateAbout && (
              <div style={aboutBackerProfileStyle}>
                <SuperbossAboutContent />
              </div>
            )}
          </div>
        )}

      <div style={cardStyle}>

        {/* ================= CITIZEN ================= */}
        {role === "CITIZEN" && (
          <>
            <Info label="Stage Name" value={profile.stageName} />
            <Info label="Real Name" value={profile.realName} />
            <Info label="Age" value={profile.age} />
            <Info label="Gender" value={profile.gender} />
            <Info label="Marital Status" value={profile.maritalStatus} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Tribe" value={profile.tribe} />
            <Info label="Residence" value={profile.residence} />
            <Info label="Profession" value={profile.profession} />
            <Info label="Talents" value={profile.talents?.join(", ")} />

            <h3 style={{ marginTop: 30 }}>My Videos</h3>
            {videos.length === 0 && <p>No videos uploaded.</p>}
            {videos.map(video => (
              <div key={video.id} style={videoItem}>
                {video.title || "Untitled"}
                <button onClick={() => deleteVideo(video.id)} style={deleteBtn}>
                  Delete
                </button>
              </div>
            ))}

            </>
          )}

        {/* ================= AMBASSADOR ================= */}
        {role === "PROMOTER" && (
          <>
            <div style={cardStyle}>
              <button
                type="button"
                onClick={() => setShowAmbassadorAbout((value) => !value)}
                style={buttonStyle}
              >
                {showAmbassadorAbout ? "Hide About Ambassadors" : "About Ambassadors"}
              </button>

              {showAmbassadorAbout && (
                <div style={aboutBackerProfileStyle}>
                  <AmbassadorAboutContent />
                </div>
              )}
            </div>

            <Info label="Brand Name" value={profile.brandName} />
            <Info label="Real Name" value={profile.realName} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Capacity" value={profile.declaredCapacity} />
            <Info label="Types" value={profile.promoterTypes?.join(", ")} />
            <div style={statusCardStyle(profile.status)}>
              <strong>Review Status:</strong> {promoterStatusLabel}
              <div style={{ marginTop: 6, color: "#52616b" }}>
                {profile.status === "APPROVED" && "Your ambassador account is approved and ready to invite citizens."}
                {profile.status === "PENDING_REVIEW" && "Your application is under admin review. Please wait for approval."}
                {profile.status === "REJECTED" && "Your application was rejected. Update your details and submit again."}
              </div>
            </div>

            <div style={sectionCardStyle}>
              <div style={cardHeaderRowStyle}>
                <div>
                  <h3 style={{ margin: 0 }}>Citizens From Your Invitations</h3>
                  <p style={mutedTextStyle}>Citizens who registered through your invite link.</p>
                </div>
                <span style={successBadgeStyle}>{invitedCitizens.length} citizens</span>
              </div>

              {loadingInvitedCitizens ? (
                <p style={mutedTextStyle}>Loading invited citizens...</p>
              ) : invitedCitizens.length === 0 ? (
                <p style={mutedTextStyle}>No citizens have registered through your invite link yet.</p>
              ) : (
                <div style={invitedCitizenListStyle}>
                  {invitedCitizens.map((citizen) => (
                    <article key={citizen.id} style={invitedCitizenCardStyle}>
                      <div>
                        <strong>{citizen.stageName || citizen.realName || "Citizen"}</strong>
                        <div style={promoterMetaStyle}>
                          {[citizen.realName, citizen.talents?.join(", ")].filter(Boolean).join(" • ")}
                        </div>
                        <div style={promoterMetaStyle}>
                          {[citizen.country, citizen.state].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      <span style={neutralBadgeStyle}>{citizen.registrationType || "INVITED"}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            </>
          )}

        {/* ================= MERCHANT ================= */}
        {role === "MERCHANT" && (
          <>
            <Info label="Real Name" value={profile.realName} />
            <Info label="Gender" value={profile.gender} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Email" value={profile.email} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Status" value={profile.status} />

            <h3 style={{ marginTop: 30 }}>My Products</h3>
            {products.length === 0 && <p>No products uploaded.</p>}
            {products.map(product => (
              <div key={product.id} style={videoItem}>
                <span>{product.name || "Untitled Product"} ({product.price || 0} PARAG)</span>
                <button
                  onClick={() => navigate("/onboarding/merchant")}
                  style={buttonStyle}
                >
                  Manage
                </button>
              </div>
            ))}

            </>
          )}

        {/* ================= USER ================= */}
        {role === "USER" && (
          <>
            <div style={cardStyle}>
              <Info label="Email" value={profile.email} />
              <Info label="Real Name" value={profile.realName} />
              <Info label="Gender" value={profile.gender} />
              <Info label="Phone" value={profile.phone} />
              <Info label="Country" value={profile.country} />
              <Info label="State" value={profile.state} />
              <Info label="Status" value={profile.status} />
              <div style={{ marginTop: 18 }}>
                <button onClick={handleDeleteAccount} style={dangerBtn}>
                  Delete Account
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: 10 }}>Select Your Role To Earn</h2>
              <p style={{ color: "#444", marginTop: 0 }}>
                Continue as a User or pick a role to earn on the way to Paragon Planet.
              </p>
              <ActionRow>
                <Button onClick={() => navigate("/")}>Continue as User</Button>
                <Button onClick={() => navigate("/roles?step=earn")}>Next</Button>
              </ActionRow>
            </div>
          </>
        )}

        {(role === "INVESTOR" ||
          role === "SPONSOR" ||
          role === "SPONSOR / INVESTOR" ||
          role === "SPONSOR_INVESTOR") && (
          <>
            <Info label="Account Type" value={profile.accountType} />
            <Info
              label={profile.accountType === "INVESTOR" ? "Investor Type" : "Sponsor Type"}
              value={profile.accountType === "INVESTOR" ? profile.investorType : profile.sponsorType}
            />
            <Info label="Real Name" value={profile.realName} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Email" value={profile.email} />
            <Info label="Country" value={profile.country} />
            <Info label="State / City" value={profile.stateCity || profile.state} />
            <Info label="Brand / Organization Name" value={profile.brandName} />
            <Info label="Website / Social Link" value={profile.websiteLink} />
            <Info label="Talent Field of Interest" value={profile.talentFields?.join(", ")} />
            <Info
              label={profile.accountType === "INVESTOR" ? "Investment Interest" : "Sponsorship Interest"}
              value={
                profile.accountType === "INVESTOR"
                  ? profile.investorInterests?.join(", ")
                  : profile.sponsorInterests?.join(", ")
              }
            />
            <Info label="Budget Range" value={profile.sponsorBudgetRange} />
            <Info label="Benefit Expected" value={profile.sponsorBenefits?.join(", ")} />
            <Info label="Investment Capacity" value={profile.investmentCapacity} />
            <Info label="Risk Level" value={profile.riskLevel} />
            <Info label="Expected Return Type" value={profile.returnTypes?.join(", ")} />
            <Info label="Status" value={profile.status} />
          </>
        )}

        {/* ================= BACKER ================= */}
        {role === "BACKER" && (
          <>
            <Info label="Real Name" value={profile.realName} />
            <Info label="Age" value={profile.age} />
            <Info label="Gender" value={profile.gender} />
            <Info label="Marital Status" value={profile.maritalStatus} />
            <Info label="Profession" value={profile.profession} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Tribe" value={profile.tribe} />
            <Info label="Employment Status" value={profile.employmentStatus} />
            <Info label="Employment Type" value={profile.employmentType} />
            <Info label="Business Name" value={profile.businessName || profile.placeOfEmployment} />
            <Info
              label="Fields of Service"
              value={formatServiceDisplay(profile.serviceCategories, profile.serviceFields || profile.knowledgeFields)}
            />

            <div style={sectionCardStyle}>
              <div style={supernalVoteCardStyle}>
                <div style={cardHeaderRowStyle}>
                  <strong style={cardTitleStyle}>Good Works Testimony</strong>
                  <span style={successBadgeStyle}>{formatCount(getBackerGoodWorksTotal(profile))} public supports</span>
                </div>
                <p style={mutedTextStyle}>
                  Positive testimony can come from people who benefited from this Backer's work.
                </p>
                {BACKER_GOOD_WORK_GROUPS.map(({ key, label }) => (
                  <div key={`backer_good_work_${key}`} style={supernalVoteRowStyle}>
                    <span>{label}</span>
                    <strong>{formatCount(getBackerGoodWorksGroupCount(profile, key))}</strong>
                  </div>
                ))}
              </div>
            </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>Backer Challenge Studio</h3>
                <p style={mutedTextStyle}>
                  Create up to 5 timed challenge cards. Each card needs 4 answer choices, a hidden correct answer, a visible timer, and a visible reward weight.
                </p>

              {backerQuestionDrafts.map((draft, index) => (
                <div key={`draft-${index}`} style={questionDraftCardStyle}>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Challenge {index + 1}</h4>

                  <input
                    value={draft.questionText}
                    onChange={(e) => handleBackerQuestionChange(index, "questionText", e.target.value)}
                    placeholder="Enter your question"
                    style={wideInputStyle}
                  />

                  {draft.options.map((option, optionIndex) => (
                    <input
                      key={`option-${index}-${optionIndex}`}
                      value={option}
                      onChange={(e) => handleBackerOptionChange(index, optionIndex, e.target.value)}
                      placeholder={`Answer option ${optionIndex + 1}`}
                      style={wideInputStyle}
                    />
                  ))}

                  <select
                    value={draft.correctAnswerIndex}
                    onChange={(e) => handleBackerQuestionChange(index, "correctAnswerIndex", e.target.value)}
                    style={wideInputStyle}
                  >
                      <option value="">Select the correct answer</option>
                    <option value="0">Answer 1 is correct</option>
                    <option value="1">Answer 2 is correct</option>
                    <option value="2">Answer 3 is correct</option>
                    <option value="3">Answer 4 is correct</option>
                  </select>

                  <div style={timeLimitRowStyle}>
                    <input
                      type="number"
                      min="1"
                      value={draft.timeLimitValue}
                      onChange={(e) => handleBackerQuestionChange(index, "timeLimitValue", e.target.value)}
                      placeholder="Time limit"
                      style={{ ...wideInputStyle, marginBottom: 0, flex: 1 }}
                    />

                    <select
                      value={draft.timeLimitUnit}
                      onChange={(e) => handleBackerQuestionChange(index, "timeLimitUnit", e.target.value)}
                      style={{ ...wideInputStyle, marginBottom: 0, width: 140 }}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                    </select>
                  </div>

                  <div style={timeLimitRowStyle}>
                    <input
                      type="number"
                      min="0"
                      value={draft.rewardAmount}
                      onChange={(e) => handleBackerQuestionChange(index, "rewardAmount", e.target.value)}
                      placeholder="Price / reward"
                      style={{ ...wideInputStyle, marginBottom: 0, flex: 1 }}
                    />

                    <select
                      value={draft.rewardUnit}
                      onChange={(e) => handleBackerQuestionChange(index, "rewardUnit", e.target.value)}
                      style={{ ...wideInputStyle, marginBottom: 0, width: 140 }}
                    >
                      <option value="PARAG">PARAG</option>
                      <option value="GBAZILO">GBAZILO</option>
                    </select>
                  </div>
                    <p style={mutedTextStyle}>
                      Visible reward: {formatRewardPreview(draft.rewardAmount, draft.rewardUnit)}. 1 PARAG = N100. 1 GBAZILO = N1000.
                    </p>
                  </div>
                ))}

              <ActionRow>
                <Button onClick={addBackerQuestionDraft}>Add Another Question</Button>
                <Button onClick={publishBackerQuestions}>
                  {savingBackerQuestions ? "Publishing..." : "Publish Questions"}
                </Button>
              </ActionRow>
            </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>Published Challenges</h3>

                {backerQuestions.length === 0 && (
                  <p style={mutedTextStyle}>You have not published any challenge cards yet.</p>
                )}

                {backerQuestions.map((question, index) => (
                  <div key={question.id} style={publishedQuestionCardStyle}>
                    <div style={cardHeaderRowStyle}>
                      <strong style={cardTitleStyle}>Challenge {index + 1}</strong>
                      <span style={question.answeredCorrectly ? successBadgeStyle : neutralBadgeStyle}>
                        {question.answeredCorrectly ? "Closed" : "Open"}
                      </span>
                    </div>
                    <p style={cardQuestionStyle}>{question.questionText}</p>
                    <ul style={{ marginTop: 10 }}>
                      {question.options?.map((option, optionIndex) => (
                        <li key={`${question.id}-${optionIndex}`}>{option}</li>
                      ))}
                    </ul>
                    <div style={metaRowStyle}>
                      <span style={metaPillStyle}>Timer: {formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}</span>
                      <span style={metaPillStyle}>Reward: {formatRewardPreview(question.rewardAmount, question.rewardUnit)}</span>
                    </div>
                    {question.answeredCorrectly && (
                      <p><strong>Solved By:</strong> {question.answeredByName || question.answeredBy || "-"}</p>
                    )}
                    {!question.answeredCorrectly && (
                      <p style={mutedTextStyle}>
                        The correct answer stays hidden until another backer solves this challenge.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>Open Backer Challenges</h3>

                {answerableBackerQuestions.length === 0 && (
                  <p style={mutedTextStyle}>There are no open challenge cards from other backers right now.</p>
                )}

                {answerableBackerQuestions.map((question) => (
                  <div key={question.id} style={publishedQuestionCardStyle}>
                    <div style={cardHeaderRowStyle}>
                      <strong style={cardTitleStyle}>{question.ownerName || "Backer"}</strong>
                      <span style={neutralBadgeStyle}>Challenge Card</span>
                    </div>
                    <div style={metaRowStyle}>
                      <span style={metaPillStyle}>Timer: {formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}</span>
                      <span style={metaPillStyle}>Reward: {formatRewardPreview(question.rewardAmount, question.rewardUnit)}</span>
                    </div>

                    {failedQuestionIds.includes(question.id) ? (
                      <p style={{ color: "#b42318", fontWeight: 600 }}>
                        You missed this challenge because the timer ended before you submitted the right answer.
                      </p>
                    ) : activeOpenedQuestion?.id === question.id ? (
                      <>
                        <p style={cardQuestionStyle}>{question.questionText}</p>
                        <p style={{ color: "#b42318", fontWeight: 700 }}>
                          Countdown: {formatCountdown(openedBackerQuestionSecondsLeft)}
                        </p>

                        <div style={answerGridStyle}>
                          {question.options?.map((option, optionIndex) => (
                            <button
                              key={`${question.id}-answer-${optionIndex}`}
                              onClick={() => answerBackerQuestion(question, optionIndex)}
                              disabled={answeringQuestionId === question.id}
                              style={answerOptionButtonStyle}
                            >
                              <span style={answerOptionBadgeStyle}>
                                {String.fromCharCode(65 + optionIndex)}
                              </span>
                              <span style={answerOptionTextStyle}>{option}</span>
                            </button>
                          ))}
                        </div>
                    </>
                    ) : (
                      <Button onClick={() => openBackerQuestion(question)}>
                        Start Challenge
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>My Backer Stats</h3>
                <div style={statsGridStyle}>
                  <div style={statCardStyle}>
                    <span style={statLabelStyle}>Correct Answers</span>
                    <strong style={statValueStyle}>{backerStats.correctAnswers}</strong>
                  </div>
                  <div style={statCardStyle}>
                    <span style={statLabelStyle}>Failed Attempts</span>
                    <strong style={statValueStyle}>{backerStats.failedAttempts}</strong>
                  </div>
                  <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Reward Won</span>
                    <strong style={statValueStyle}>{backerStats.totalRewardWon} PARAG</strong>
                  </div>
                  <div style={statCardStyle}>
                    <span style={statLabelStyle}>Current Rank</span>
                    <strong style={statValueStyle}>{backerStats.currentRank || "-"}</strong>
                  </div>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>My Attempt History</h3>

                {backerAttemptHistory.length === 0 && (
                  <p style={mutedTextStyle}>Your completed challenge attempts will appear here.</p>
                )}

                {backerAttemptHistory.map((attempt) => (
                  <div key={attempt.id} style={publishedQuestionCardStyle}>
                    <p style={{ marginTop: 0, ...cardQuestionStyle }}>{attempt.questionText}</p>
                    <div style={metaRowStyle}>
                      <span style={metaPillStyle}>Host: {attempt.ownerName || "Backer"}</span>
                      <span style={metaPillStyle}>Reward: {formatRewardPreview(attempt.rewardAmount, attempt.rewardUnit)}</span>
                    </div>
                    <p><strong>Your Answer:</strong> {attempt.selectedAnswer || "-"}</p>
                    <p>
                      <strong>Outcome:</strong>{" "}
                      {attempt.didTimeout
                        ? "Failed by timeout"
                        : attempt.isCorrect
                        ? "Correct"
                        : "Wrong answer"}
                  </p>
                </div>
              ))}
            </div>

              <div style={sectionCardStyle}>
                <h3 style={{ marginTop: 0 }}>Backer Leaderboard</h3>
                <p style={mutedTextStyle}>
                  Ranked by completed wins and reward-weight score.
                </p>

                {backerLeaderboard.length === 0 && (
                  <p style={mutedTextStyle}>No solved challenge cards have been recorded yet.</p>
                )}

                {backerLeaderboard.map((entry, index) => (
                  <div key={entry.responderId} style={publishedQuestionCardStyle}>
                    <div style={cardHeaderRowStyle}>
                      <strong style={cardTitleStyle}>{index + 1}. {entry.responderName}</strong>
                      <span style={successBadgeStyle}>Rank #{index + 1}</span>
                    </div>
                    <div style={metaRowStyle}>
                      <span style={metaPillStyle}>Correct Answers: {entry.totalCorrect}</span>
                      <span style={metaPillStyle}>Score: {entry.totalScore}</span>
                      <span style={metaPillStyle}>Total Reward: {entry.totalParagEquivalent} PARAG</span>
                    </div>
                  </div>
                ))}
              </div>

          </>
        )}

        {/* ================= SUPERNAL ================= */}
        {role === "SUPERNAL" && (
          <>
            <Info label="Real Name" value={profile.realName} />
            <Info label="Age" value={profile.age} />
            <Info label="Gender" value={profile.gender} />
            <Info label="Marital Status" value={profile.maritalStatus} />
            <Info label="Profession" value={profile.profession} />
            <Info label="Phone" value={profile.phone} />
            <Info label="Country" value={profile.country} />
            <Info label="State" value={profile.state} />
            <Info label="Tribe" value={profile.tribe} />
            <Info label="Employment Status" value={profile.employmentStatus} />
            <Info label="Employment Type" value={profile.employmentType} />
            <Info label="Business Name" value={profile.businessName || profile.placeOfEmployment} />
            <Info
              label="Fields of Discipline"
              value={formatServiceDisplay(profile.serviceCategories, profile.serviceFields || profile.knowledgeFields)}
            />

            <SuperbossChallengeStudio
              challengeDrafts={backerQuestionDrafts}
              publishedChallenges={backerQuestions}
              openChallenges={answerableBackerQuestions}
              attemptHistory={backerAttemptHistory}
              leaderboard={backerLeaderboard}
              stats={backerStats}
              saving={savingBackerQuestions}
              answeringQuestionId={answeringQuestionId}
              activeOpenedQuestion={activeOpenedQuestion}
              openedQuestionSecondsLeft={openedBackerQuestionSecondsLeft}
              failedQuestionIds={failedQuestionIds}
              onDraftChange={handleBackerQuestionChange}
              onOptionChange={handleBackerOptionChange}
              onAddDraft={addBackerQuestionDraft}
              onPublish={publishBackerQuestions}
              onOpenQuestion={openBackerQuestion}
              onAnswerQuestion={answerBackerQuestion}
            />

            <div style={sectionCardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>Superboss Reputation System</h3>
              <p style={mutedTextStyle}>
                This record balances public praise for good service with reviewed complaint signals,
                so the profile reflects both impact and accountability.
              </p>

              <div style={statsGridStyle}>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Public Testimonials</span>
                  <div style={statValueStyle}>{formatCount(getSupernalPositiveTotal(profile))}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Verified Supporters</span>
                  <div style={statValueStyle}>{formatCount(getSupernalVerifiedSupporters(profile))}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Public Complaints</span>
                  <div style={statValueStyle}>{formatCount(getSupernalComplaintTotal(profile))}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Resolved Complaints</span>
                  <div style={statValueStyle}>{formatCount(getSupernalResolvedComplaints(profile))}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Pending Complaints</span>
                  <div style={statValueStyle}>{formatCount(getSupernalPendingComplaints(profile))}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Trust Score</span>
                  <div style={statValueStyle}>{getSupernalTrustScore(profile)}%</div>
                </div>
              </div>

              <div style={supernalVoteGridStyle}>
                <div style={supernalVoteCardStyle}>
                  <div style={cardHeaderRowStyle}>
                    <strong style={cardTitleStyle}>Public Testimonials</strong>
                    <span style={successBadgeStyle}>{formatCount(getSupernalPositiveTotal(profile))} Testimonials</span>
                  </div>
                  <p style={mutedTextStyle}>
                    Positive testimonies may be submitted by students, tutees, trainees, mentees,
                    followers, beneficiaries, and members of the public who have benefited from this
                    Superboss's knowledge, mentorship, instruction, leadership, and service across
                    various fields of discipline.
                  </p>
                  {SUPERNAL_POSITIVE_GROUPS.map(({ key, label }) => (
                    <div key={`positive_${key}`} style={supernalVoteRowStyle}>
                      <span>{label}</span>
                      <strong>{formatCount(getSupernalPositiveGroupCount(profile, key))}</strong>
                    </div>
                  ))}
                </div>

                <div style={supernalConcernCardStyle}>
                  <div style={cardHeaderRowStyle}>
                    <strong style={cardTitleStyle}>Public Complaint</strong>
                    <span style={supernalConcernBadgeStyle}>{formatCount(getSupernalComplaintTotal(profile))} complaints</span>
                  </div>
                  <p style={mutedTextStyle}>
                    Complaints are meant for alleged misconduct, abuse of office, oppression, or
                    misuse of influence. They should go through review before affecting trust.
                  </p>
                  <div style={supernalVoteRowStyle}>
                    <span>Pending Review</span>
                    <strong>{formatCount(getSupernalPendingComplaints(profile))}</strong>
                  </div>
                  <div style={supernalVoteRowStyle}>
                    <span>Resolved</span>
                    <strong>{formatCount(getSupernalResolvedComplaints(profile))}</strong>
                  </div>
                  <div style={{ paddingTop: 10 }}>
                    <span style={neutralBadgeStyle}>Verified account required</span>{" "}
                    <span style={neutralBadgeStyle}>Evidence recommended</span>{" "}
                    <span style={neutralBadgeStyle}>Right of reply protected</span>
                  </div>
                </div>
              </div>
            </div>

            </>
          )}

      </div>

      {role !== "USER" && (
        <button onClick={handleDeleteAccount} style={dangerBtn}>
          Delete Account
        </button>
      )}

      {/* AMBASSADOR LIST MODAL */}
      {showPromoters && (
        <div style={modalStyle}>
          <div style={promoterModalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <p style={modalEyebrowStyle}>Ambassador message accounts</p>
                <h3 style={{ margin: "4px 0 0" }}>Ambassador Message Accounts</h3>
              </div>
              <Button onClick={() => setShowPromoters(false)}>Close</Button>
            </div>
            {loadingPromoters ? (
              <p style={mutedTextStyle}>Loading ambassadors...</p>
            ) : promoters.length === 0 ? (
              <p style={mutedTextStyle}>No ambassador message accounts available right now.</p>
            ) : (
              <div style={promoterListStyle}>
                {promoters.map(p => (
                  <article key={p.id} style={promoterCardStyle}>
                    <div>
                      <strong>{getPromoterDisplayName(p)}</strong>
                      <div style={promoterMetaStyle}>{getPromoterSubtitle(p)}</div>
                      {p.country || p.state ? (
                        <div style={promoterMetaStyle}>{[p.country, p.state].filter(Boolean).join(", ")}</div>
                      ) : null}
                    </div>
                    <Button onClick={() => messagePromoter(p)}>Message</Button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {inviteShareLink && (
        <div style={modalStyle}>
          <div style={inviteModalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <p style={modalEyebrowStyle}>
                  {inviteSharePurpose === "support_invite"
                    ? "Invite supporters"
                    : inviteSharePurpose === "citizen_invite"
                      ? "Invite citizen"
                      : "Invite people"}
                </p>
                <h3 style={{ margin: "4px 0 0" }}>Share your invitation link</h3>
              </div>
              <Button onClick={() => setInviteShareLink("")}>Close</Button>
            </div>

            <p style={mutedTextStyle}>
              Send this link through Email, WhatsApp, SMS, or any social app.
            </p>

            <div style={inviteLinkBoxStyle}>{inviteShareLink}</div>

            <div style={inviteActionGridStyle}>
              <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildInviteMessage(inviteShareLink))}`, "_blank")}>
                WhatsApp
              </Button>
              <Button onClick={() => window.location = `mailto:?subject=${encodeURIComponent("Paragon Planet Invite")}&body=${encodeURIComponent(buildInviteMessage(inviteShareLink))}`}>
                Email
              </Button>
              <Button onClick={() => window.location = `sms:?body=${encodeURIComponent(buildInviteMessage(inviteShareLink))}`}>
                SMS
              </Button>
              <Button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteShareLink)}`, "_blank")}>
                Facebook
              </Button>
              <Button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildInviteMessage(inviteShareLink))}`, "_blank")}>
                X / Twitter
              </Button>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteShareLink);
                  alert("Invite link copied.");
                }}
              >
                Copy Link
              </Button>
              <Button onClick={() => shareInviteLink(inviteShareLink)}>
                Other Apps
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function isHomeProfileVideo(video) {
  if (video?.uploadPurpose === "meet_up_video") return false;
  if (video?.uploadPurpose === "merchant_product") return false;
  if (video?.productId || video?.merchantId) return false;
  if (video?.source === "admin_meetup_area_upload") return false;
  if (String(video?.source || "").toLowerCase().includes("merchant")) return false;
  if (video?.visibility === "meet_up") return false;
  if (video?.visibility === "marketplace") return false;
  return true;
}

/* COMPONENTS */
const Info = ({ label, value }) => (
  <div style={{ marginBottom: 12 }}>
    <strong>{label}:</strong> {value || "-"}
  </div>
);

const Button = ({ children, onClick }) => (
  <button onClick={onClick} style={buttonStyle}>
    {children}
  </button>
);

const ActionRow = ({ children }) => (
  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
    {children}
  </div>
);

function SuperbossChallengeStudio({
  challengeDrafts,
  publishedChallenges,
  openChallenges,
  attemptHistory,
  leaderboard,
  stats,
  saving,
  answeringQuestionId,
  activeOpenedQuestion,
  openedQuestionSecondsLeft,
  failedQuestionIds,
  onDraftChange,
  onOptionChange,
  onAddDraft,
  onPublish,
  onOpenQuestion,
  onAnswerQuestion,
}) {
  return (
    <>
      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>Superbosses Challenge Studio</h3>
        <p style={mutedTextStyle}>
          After the recommendation process, Superbosses can challenge one another with timed
          question cards to discover the strongest mentors for the Game. Each card needs 4 answer
          choices, a hidden correct answer, a visible timer, and a visible reward weight.
        </p>

        {challengeDrafts.map((draft, index) => (
          <div key={`superboss-draft-${index}`} style={questionDraftCardStyle}>
            <h4 style={{ marginTop: 0, marginBottom: 12 }}>Challenge {index + 1}</h4>

            <input
              value={draft.questionText}
              onChange={(event) => onDraftChange(index, "questionText", event.target.value)}
              placeholder="Enter your challenge question"
              style={wideInputStyle}
            />

            {draft.options.map((option, optionIndex) => (
              <input
                key={`superboss-option-${index}-${optionIndex}`}
                value={option}
                onChange={(event) => onOptionChange(index, optionIndex, event.target.value)}
                placeholder={`Answer option ${optionIndex + 1}`}
                style={wideInputStyle}
              />
            ))}

            <select
              value={draft.correctAnswerIndex}
              onChange={(event) => onDraftChange(index, "correctAnswerIndex", event.target.value)}
              style={wideInputStyle}
            >
              <option value="">Select the correct answer</option>
              <option value="0">Answer 1 is correct</option>
              <option value="1">Answer 2 is correct</option>
              <option value="2">Answer 3 is correct</option>
              <option value="3">Answer 4 is correct</option>
            </select>

            <div style={timeLimitRowStyle}>
              <input
                type="number"
                min="1"
                value={draft.timeLimitValue}
                onChange={(event) => onDraftChange(index, "timeLimitValue", event.target.value)}
                placeholder="Time limit"
                style={{ ...wideInputStyle, marginBottom: 0, flex: 1 }}
              />
              <select
                value={draft.timeLimitUnit}
                onChange={(event) => onDraftChange(index, "timeLimitUnit", event.target.value)}
                style={{ ...wideInputStyle, marginBottom: 0, width: 140 }}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
            </div>

            <div style={timeLimitRowStyle}>
              <input
                type="number"
                min="0"
                value={draft.rewardAmount}
                onChange={(event) => onDraftChange(index, "rewardAmount", event.target.value)}
                placeholder="Price / reward"
                style={{ ...wideInputStyle, marginBottom: 0, flex: 1 }}
              />
              <select
                value={draft.rewardUnit}
                onChange={(event) => onDraftChange(index, "rewardUnit", event.target.value)}
                style={{ ...wideInputStyle, marginBottom: 0, width: 140 }}
              >
                <option value="PARAG">PARAG</option>
                <option value="GBAZILO">GBAZILO</option>
              </select>
            </div>
            <p style={mutedTextStyle}>
              Visible reward: {formatRewardPreview(draft.rewardAmount, draft.rewardUnit)}. 1 PARAG = N100. 1 GBAZILO = N1000.
            </p>
          </div>
        ))}

        <ActionRow>
          <Button onClick={onAddDraft}>Add Another Challenge</Button>
          <Button onClick={onPublish}>{saving ? "Publishing..." : "Publish Challenges"}</Button>
        </ActionRow>
      </div>

      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>Published Superboss Challenges</h3>
        {publishedChallenges.length === 0 && (
          <p style={mutedTextStyle}>You have not published any Superboss challenge cards yet.</p>
        )}

        {publishedChallenges.map((question, index) => (
          <div key={question.id} style={publishedQuestionCardStyle}>
            <div style={cardHeaderRowStyle}>
              <strong style={cardTitleStyle}>Challenge {index + 1}</strong>
              <span style={question.answeredCorrectly ? successBadgeStyle : neutralBadgeStyle}>
                {question.answeredCorrectly ? "Closed" : "Open"}
              </span>
            </div>
            <p style={cardQuestionStyle}>{question.questionText}</p>
            <ul style={{ marginTop: 10 }}>
              {question.options?.map((option, optionIndex) => (
                <li key={`${question.id}-${optionIndex}`}>{option}</li>
              ))}
            </ul>
            <div style={metaRowStyle}>
              <span style={metaPillStyle}>Timer: {formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}</span>
              <span style={metaPillStyle}>Reward: {formatRewardPreview(question.rewardAmount, question.rewardUnit)}</span>
            </div>
            {question.answeredCorrectly ? (
              <p><strong>Solved By:</strong> {question.answeredByName || question.answeredBy || "-"}</p>
            ) : (
              <p style={mutedTextStyle}>
                The correct answer stays hidden until another Superboss solves this challenge.
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>Open Superboss Challenges</h3>
        {openChallenges.length === 0 && (
          <p style={mutedTextStyle}>There are no open challenge cards from other Superbosses right now.</p>
        )}

        {openChallenges.map((question) => (
          <div key={question.id} style={publishedQuestionCardStyle}>
            <div style={cardHeaderRowStyle}>
              <strong style={cardTitleStyle}>{question.ownerName || "Superboss"}</strong>
              <span style={neutralBadgeStyle}>Challenge Card</span>
            </div>
            <div style={metaRowStyle}>
              <span style={metaPillStyle}>Timer: {formatTimeLimit(question.timeLimitValue, question.timeLimitUnit)}</span>
              <span style={metaPillStyle}>Reward: {formatRewardPreview(question.rewardAmount, question.rewardUnit)}</span>
            </div>

            {failedQuestionIds.includes(question.id) ? (
              <p style={{ color: "#b42318", fontWeight: 600 }}>
                You missed this challenge because the timer ended before you submitted the right answer.
              </p>
            ) : activeOpenedQuestion?.id === question.id ? (
              <>
                <p style={cardQuestionStyle}>{question.questionText}</p>
                <p style={{ color: "#b42318", fontWeight: 700 }}>
                  Countdown: {formatCountdown(openedQuestionSecondsLeft)}
                </p>

                <div style={answerGridStyle}>
                  {question.options?.map((option, optionIndex) => (
                    <button
                      key={`${question.id}-superboss-answer-${optionIndex}`}
                      onClick={() => onAnswerQuestion(question, optionIndex)}
                      disabled={answeringQuestionId === question.id}
                      style={answerOptionButtonStyle}
                    >
                      <span style={answerOptionBadgeStyle}>
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span style={answerOptionTextStyle}>{option}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Button onClick={() => onOpenQuestion(question)}>Start Challenge</Button>
            )}
          </div>
        ))}
      </div>

      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>My Superboss Challenge Stats</h3>
        <div style={statsGridStyle}>
          <div style={statCardStyle}>
            <span style={statLabelStyle}>Correct Answers</span>
            <strong style={statValueStyle}>{stats.correctAnswers}</strong>
          </div>
          <div style={statCardStyle}>
            <span style={statLabelStyle}>Failed Attempts</span>
            <strong style={statValueStyle}>{stats.failedAttempts}</strong>
          </div>
          <div style={statCardStyle}>
            <span style={statLabelStyle}>Total Reward Won</span>
            <strong style={statValueStyle}>{stats.totalRewardWon} PARAG</strong>
          </div>
          <div style={statCardStyle}>
            <span style={statLabelStyle}>Current Rank</span>
            <strong style={statValueStyle}>{stats.currentRank || "-"}</strong>
          </div>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>My Superboss Challenge History</h3>
        {attemptHistory.length === 0 && (
          <p style={mutedTextStyle}>Your completed Superboss challenge attempts will appear here.</p>
        )}

        {attemptHistory.map((attempt) => (
          <div key={attempt.id} style={publishedQuestionCardStyle}>
            <p style={{ marginTop: 0, ...cardQuestionStyle }}>{attempt.questionText}</p>
            <div style={metaRowStyle}>
              <span style={metaPillStyle}>Host: {attempt.ownerName || "Superboss"}</span>
              <span style={metaPillStyle}>Reward: {formatRewardPreview(attempt.rewardAmount, attempt.rewardUnit)}</span>
            </div>
            <p><strong>Your Answer:</strong> {attempt.selectedAnswer || "-"}</p>
            <p>
              <strong>Outcome:</strong>{" "}
              {attempt.didTimeout ? "Failed by timeout" : attempt.isCorrect ? "Correct" : "Wrong answer"}
            </p>
          </div>
        ))}
      </div>

      <div style={sectionCardStyle}>
        <h3 style={{ marginTop: 0 }}>Superboss Challenge Leaderboard</h3>
        <p style={mutedTextStyle}>
          Ranked by completed wins and reward-weight score.
        </p>

        {leaderboard.length === 0 && (
          <p style={mutedTextStyle}>No solved Superboss challenge cards have been recorded yet.</p>
        )}

        {leaderboard.map((entry, index) => (
          <div key={entry.responderId} style={publishedQuestionCardStyle}>
            <div style={cardHeaderRowStyle}>
              <strong style={cardTitleStyle}>{index + 1}. {entry.responderName}</strong>
              <span style={successBadgeStyle}>Rank #{index + 1}</span>
            </div>
            <div style={metaRowStyle}>
              <span style={metaPillStyle}>Correct Answers: {entry.totalCorrect}</span>
              <span style={metaPillStyle}>Score: {entry.totalScore}</span>
              <span style={metaPillStyle}>Total Reward: {entry.totalParagEquivalent} PARAG</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const USER_ALLOWANCES = [
  "Create and manage personal accounts",
  "Explore activities within the Planet ecosystem",
  "Watch and engage with talent contents",
  "Follow contestants and creators",
  "Vote for Citizens and participants",
  "Support talents and projects",
  "Participate in discussions and interactions",
  "Purchase approved digital products and services",
  "Connect with communities and supporters",
  "Earn rewards and engagement opportunities within the Platform"
];

const USER_EXPECTATIONS = [
  "Maintain respectful and ethical behavior",
  "Support positive engagement within the ecosystem",
  "Avoid fraudulent, abusive, or harmful activities",
  "Respect the rules, systems, and structures of the Platform",
  "Promote creativity, fairness, and healthy interactions",
  "Contribute positively to the growth of the Planet community"
];

const MERCHANT_PRODUCT_CATEGORIES = [
  "Software Applications",
  "Mobile Applications",
  "Digital Artworks",
  "E-books",
  "Music & Audio Products",
  "Video Content",
  "Templates & Designs",
  "Educational Materials",
  "AI Products & Tools",
  "Digital Courses",
  "Website Scripts",
  "Graphics & Creative Assets",
  "Gaming Assets",
  "Virtual Products",
  "Subscription-Based Digital Services",
  "Other approved digital products and software-related materials"
];

const MERCHANT_EXPECTATIONS = [
  "Upload authentic and approved digital products",
  "Maintain fair pricing and honest negotiations",
  "Deliver quality digital services and products",
  "Respect intellectual property rights",
  "Avoid fraudulent, illegal, or prohibited materials",
  "Build trusted relationships with buyers",
  "Maintain positive ratings, reviews, and marketplace reputation"
];

const SPONSOR_INVESTOR_PURPOSES = [
  "Talent Sponsorship",
  "Contest Sponsorship",
  "Brand Promotion",
  "Event Partnerships",
  "Product Advertising",
  "Marketplace Promotion",
  "Creator Development",
  "Platform Expansion",
  "Sector-Based Investments",
  "Revenue Sharing Partnerships",
  "Strategic Collaborations",
  "Audience Engagement Campaigns"
];

const SPONSOR_EXCHANGE_BENEFITS = [
  "Brand visibility",
  "Promotional opportunities",
  "Advertisement placements",
  "Audience engagement",
  "Product awareness",
  "Partnership recognition",
  "Event branding rights",
  "Campaign exposure within the Planet ecosystem"
];

const INVESTOR_FUNDING_AREAS = [
  "Talent growth and development",
  "Digital products and businesses",
  "Entertainment activities",
  "Technology systems",
  "Educational projects",
  "Media productions",
  "Marketplace systems",
  "Infrastructure expansion",
  "Ecosystem innovations",
  "Revenue-generating activities within the Platform"
];

const SPONSOR_INVESTOR_COLLABORATORS = [
  "Citizens",
  "Superbosses",
  "Ambassadors",
  "Backers",
  "Merchants",
  "Contest organizers",
  "Platform administrators",
  "Creative teams and project developers"
];

const SPONSOR_INVESTOR_EXPECTATIONS = [
  "Maintain ethical and professional relationships",
  "Respect the rules and standards of the Platform",
  "Support legitimate talents, projects, and opportunities",
  "Avoid fraudulent or exploitative activities",
  "Promote positive development within the ecosystem",
  "Encourage creativity, innovation, and healthy competition"
];

const SUPERNAL_POSITIVE_GROUPS = [
  { key: "students", label: "Students" },
  { key: "tutees", label: "Tutees" },
  { key: "trainees", label: "Trainees" },
  { key: "mentees", label: "Mentees" },
  { key: "followers", label: "Followers" },
  { key: "beneficiaries", label: "Beneficiaries" },
  { key: "communityMembers", label: "Community Members" }
];

const BACKER_GOOD_WORK_GROUPS = [
  { key: "fans", label: "Fans" },
  { key: "students", label: "Students" },
  { key: "clients", label: "Clients" },
  { key: "patients", label: "Patients" },
  { key: "communityMembers", label: "Community Members" },
  { key: "beneficiaries", label: "Beneficiaries" },
  { key: "followers", label: "Followers" }
];

const statusCardStyle = (status) => ({
  marginBottom: 16,
  padding: 14,
  borderRadius: 10,
  background:
    status === "APPROVED"
      ? "#eef8f1"
      : status === "REJECTED"
        ? "#fff1f1"
        : "#fff8e8",
  border:
    status === "APPROVED"
      ? "1px solid #b8dfc2"
      : status === "REJECTED"
        ? "1px solid #f0c4c4"
        : "1px solid #ead9a0",
});

/* STYLES */
const cardStyle = {
  background: "white",
  padding: 25,
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
  marginBottom: 25
};

const roleSwitcherStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  padding: 14,
  marginBottom: 18,
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  background: "#f9fafb"
};

const roleButtonRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const roleButtonStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#101828",
  cursor: "pointer",
  fontWeight: 700
};

const activeRoleButtonStyle = {
  ...roleButtonStyle,
  borderColor: "#176b4d",
  background: "#176b4d",
  color: "#ffffff"
};

const buttonStyle = {
  padding: "10px 16px",
  background: "#111",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer"
};

const actionButtonContentStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8
};

const actionBadgeStyle = {
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  background: "#b42318",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

const dangerBtn = {
  background: "red",
  color: "white",
  padding: "12px 20px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer"
};

const videoItem = {
  display: "flex",
  justifyContent: "space-between",
  padding: 10,
  borderBottom: "1px solid #eee"
};

const deleteBtn = {
  background: "red",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  cursor: "pointer"
};

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const promoterModalCardStyle = {
  background: "white",
  padding: 24,
  borderRadius: 12,
  width: "min(640px, 92vw)",
  maxHeight: "82vh",
  overflowY: "auto"
};

const inviteModalCardStyle = {
  background: "white",
  padding: 24,
  borderRadius: 12,
  width: "min(560px, 92vw)",
  maxHeight: "82vh",
  overflowY: "auto"
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18
};

const modalEyebrowStyle = {
  margin: 0,
  textTransform: "uppercase",
  fontSize: 12,
  color: "#667085",
  fontWeight: 700
};

const promoterListStyle = {
  display: "grid",
  gap: 12
};

const promoterCardStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 14,
  alignItems: "center",
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fcfcfd"
};

const promoterMetaStyle = {
  marginTop: 4,
  color: "#667085",
  fontSize: 14
};

const inviteLinkBoxStyle = {
  padding: 12,
  borderRadius: 8,
  background: "#f2f4f7",
  color: "#101828",
  wordBreak: "break-all",
  margin: "14px 0"
};

const inviteActionGridStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap"
};

const invitedCitizenListStyle = {
  display: "grid",
  gap: 12,
  marginTop: 14
};

const invitedCitizenCardStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fcfcfd"
};

const sectionCardStyle = {
  marginTop: 28,
  paddingTop: 20,
  borderTop: "1px solid #ececec"
};

const aboutBackerProfileStyle = {
  marginTop: 16,
  padding: 18,
  borderRadius: 12,
  border: "1px solid #e2d8c8",
  background: "#fffdf8",
  color: "#1f2933",
  lineHeight: 1.6,
};

const supernalVoteGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 18
};

const supernalVoteCardStyle = {
  border: "1px solid #d0f0dc",
  borderRadius: 14,
  padding: 18,
  background: "#f6fef9",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
};

const supernalConcernCardStyle = {
  border: "1px solid #f3d4d4",
  borderRadius: 14,
  padding: 18,
  background: "#fff8f8",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
};

const supernalVoteRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(16, 24, 40, 0.08)"
};

const questionDraftCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 18,
  marginBottom: 16,
  background: "#fcfcfd",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
};

const publishedQuestionCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  background: "#fcfcfd",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
};

const wideInputStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #d7dbe0"
};

const mutedTextStyle = {
  color: "#667085"
};

const cardHeaderRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10
};

const cardTitleStyle = {
  fontSize: 18
};

const cardQuestionStyle = {
  fontSize: 18,
  fontWeight: 600,
  lineHeight: 1.5,
  marginTop: 0,
  marginBottom: 14
};

const metaRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14
};

const metaPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f2f4f7",
  color: "#344054",
  fontSize: 14,
  fontWeight: 500
};

const neutralBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f2f4f7",
  color: "#344054",
  fontSize: 13,
  fontWeight: 700
};

const successBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#027a48",
  fontSize: 13,
  fontWeight: 700
};

const supernalConcernBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#fef3f2",
  color: "#b42318",
  fontSize: 13,
  fontWeight: 700
};

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14
};

const statCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fcfcfd",
  padding: 18,
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)"
};

const statLabelStyle = {
  display: "block",
  color: "#667085",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

const statValueStyle = {
  fontSize: 28,
  lineHeight: 1.1,
  color: "#101828"
};

const answerGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10
};

const timeLimitRowStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center"
};

const answerOptionButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 64,
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #d0d5dd",
    background: "#ffffff",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease"
  };

const answerOptionBadgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "#101828",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0
  };

const answerOptionTextStyle = {
    color: "#101828",
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.45
  };

function createEmptyBackerQuestion() {
  return {
    questionText: "",
    options: ["", "", "", ""],
    correctAnswerIndex: "",
    timeLimitValue: "30",
    timeLimitUnit: "seconds",
    rewardAmount: "0",
    rewardUnit: "PARAG"
  };
}

function getChallengeQuestionCollection(role) {
  return role === "SUPERNAL" ? "superboss_challenges" : "backer_questions";
}

function getChallengeAttemptCollection(role) {
  return role === "SUPERNAL" ? "superboss_challenge_attempts" : "backer_question_attempts";
}

function getChallengeRoleLabel(role) {
  return role === "SUPERNAL" ? "Superboss" : "Backer";
}

function formatTimeLimit(value, unit) {
  if (!value) return "No limit";
  return `${value} ${unit}`;
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatRewardPreview(amount, unit) {
  const safeAmount = Number(amount || 0);
  const safeUnit = unit || "PARAG";
  const nairaValue = safeUnit === "GBAZILO" ? safeAmount * 1000 : safeAmount * 100;

  return `${safeAmount} ${safeUnit} (N${nairaValue.toLocaleString()})`;
}

function buildProfileChatId(uidA, uidB) {
  return [uidA, uidB].filter(Boolean).sort().join("__");
}

function mapProfileMerchantOrderMessage(id, data, currentUid) {
  const buyerId = data.buyerId || "";
  const merchantId = data.merchantId || "";
  const otherPartyId = buyerId === currentUid ? merchantId : buyerId;

  return {
    id: `merchant_${id}`,
    chatId: buildProfileChatId(buyerId, merchantId),
    senderId: data.senderId || "",
    recipientId: otherPartyId,
    text: data.text || "",
    readBy: Array.isArray(data.readBy) ? data.readBy : [],
    createdAt: data.createdAt,
    orderId: data.orderId || "",
    productId: data.productId || "",
  };
}

function getProfileMessageMillis(timestamp) {
  return timestamp?.toMillis?.() || 0;
}

function getTimestampMillis(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp?.seconds === "number") return timestamp.seconds * 1000;
  return 0;
}

function buildInviteMessage(link) {
  return `Join me on Paragon Planet with this invite link: ${link}`;
}

function getProfileInviteName(profile, user) {
  return (
    profile?.stageName ||
    profile?.realName ||
    profile?.brandName ||
    profile?.businessName ||
    user?.displayName ||
    user?.email ||
    "Paragon Member"
  );
}

function getProfileMessageSignature(message) {
  const normalizedText = String(message.text || "").trim().toLowerCase();
  const orderPart = message.orderId || "";
  const productPart = message.productId || "";
  const rawMillis = getProfileMessageMillis(message.createdAt);
  const timePart = rawMillis ? Math.floor(rawMillis / 1000) : message.id || "";

  return `${message.chatId}__${message.senderId}__${orderPart}__${productPart}__${normalizedText}__${timePart}`;
}

function dedupeProfileMessages(messages) {
  const seen = new Set();

  return messages.filter((message) => {
    const key = getProfileMessageSignature(message);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countUnreadThreads(messages, currentUid) {
  const unreadChats = new Set();

  messages.forEach((message) => {
    if (
      message.chatId &&
      message.senderId &&
      message.senderId !== currentUid &&
      (!Array.isArray(message.readBy) || !message.readBy.includes(currentUid))
    ) {
      unreadChats.add(message.chatId);
    }
  });

  return unreadChats.size;
}

function getPromoterDisplayName(promoter) {
  return promoter?.brandName || promoter?.stageName || promoter?.realName || promoter?.email || "Ambassador";
}

function getPromoterSubtitle(promoter) {
  const types = Array.isArray(promoter?.promoterTypes) ? promoter.promoterTypes.join(", ") : "";
  const subFields = Array.isArray(promoter?.subFields) ? promoter.subFields.join(", ") : "";
  return [types, subFields].filter(Boolean).join(" • ") || "Ambassador account";
}

function formatServiceDisplay(serviceCategories, serviceFields) {
  if (Array.isArray(serviceCategories) && serviceCategories.length) {
    return serviceCategories
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return item;
        if (item.field && item.category) return `${item.field}: ${item.category}`;
        return item.category || item.field || null;
      })
      .filter(Boolean)
      .join(", ");
  }

  if (Array.isArray(serviceFields) && serviceFields.length) {
    return serviceFields.join(", ");
  }

  return "-";
}

function getSupernalVoteBucket(profile, bucket) {
  if (!profile) return {};

  const trustRecord = profile.publicTrustRecord || profile.supernalPublicTrust || {};
  const directBucket =
    trustRecord[bucket] ||
    profile[`${bucket}Votes`] ||
    (bucket === "positive" ? profile.goodWorkVotes || profile.testimonyVotes : profile.oppressionVotes || profile.complaintVotes) ||
    {};

  return directBucket && typeof directBucket === "object" ? directBucket : {};
}

function getSupernalVoteCount(profile, bucket, key) {
  const bucketData = getSupernalVoteBucket(profile, bucket);
  const rawValue =
    bucketData[key] ??
    bucketData[`${key}Votes`] ??
    0;

  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getSupernalPositiveGroupCount(profile, key) {
  return getSupernalVoteCount(profile, "positive", key);
}

function getSupernalPositiveTotal(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  const directTotal =
    Number(
      trustRecord.totalGoodWorksTestimonies ??
      profile?.totalGoodWorksTestimonies ??
      profile?.goodWorksTestimonies ??
      profile?.goodWorksTestimony ??
      profile?.positiveVoteTotal
    ) || 0;

  if (directTotal > 0) return directTotal;

  return SUPERNAL_POSITIVE_GROUPS.reduce(
    (sum, item) => sum + getSupernalPositiveGroupCount(profile, item.key),
    0
  );
}

function getSupernalVerifiedSupporters(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  return (
    Number(
      trustRecord.verifiedSupporters ??
      profile?.verifiedSupporters ??
      profile?.verifiedSupporterCount
    ) || 0
  );
}

function getSupernalComplaintTotal(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  return (
    Number(
      trustRecord.totalComplaints ??
      trustRecord.publicComplaints ??
      profile?.totalComplaints ??
      profile?.publicComplaints ??
      profile?.complaintCount ??
      profile?.oppressionVoteTotal
    ) || 0
  );
}

function getSupernalResolvedComplaints(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  return (
    Number(
      trustRecord.resolvedComplaints ??
      profile?.resolvedComplaints ??
      profile?.resolvedComplaintCount
    ) || 0
  );
}

function getSupernalPendingComplaints(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  const directPending =
    Number(
      trustRecord.pendingComplaints ??
      profile?.pendingComplaints ??
      profile?.pendingComplaintCount
    ) || 0;

  if (directPending > 0) return directPending;

  const total = getSupernalComplaintTotal(profile);
  const resolved = getSupernalResolvedComplaints(profile);
  return Math.max(0, total - resolved);
}

function getSupernalTrustScore(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.supernalPublicTrust || {};
  const directScore =
    Number(
      trustRecord.trustScore ??
      profile?.trustScore
    );

  if (Number.isFinite(directScore) && directScore >= 0) {
    return Math.max(0, Math.min(100, Math.round(directScore)));
  }

  const positive = getSupernalPositiveTotal(profile) + getSupernalVerifiedSupporters(profile);
  const complaints = getSupernalComplaintTotal(profile);
  const totalSignals = positive + complaints;

  if (totalSignals <= 0) return 100;

  return Math.max(0, Math.min(100, Math.round((positive / totalSignals) * 100)));
}

function getBackerGoodWorksBucket(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.backerPublicTrust || {};
  const bucket =
    trustRecord.goodWorksTestimony ||
    trustRecord.goodWorksTestimonies ||
    trustRecord.publicSupports ||
    profile?.goodWorksTestimony ||
    profile?.goodWorksTestimonies ||
    profile?.publicSupports ||
    profile?.goodWorkVotes ||
    {};

  return bucket && typeof bucket === "object" ? bucket : {};
}

function getBackerGoodWorksGroupCount(profile, key) {
  const bucket = getBackerGoodWorksBucket(profile);
  const rawValue = bucket[key] ?? bucket[`${key}Votes`] ?? 0;
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getBackerGoodWorksTotal(profile) {
  const trustRecord = profile?.publicTrustRecord || profile?.backerPublicTrust || {};
  const directTotal =
    Number(
      trustRecord.totalGoodWorksTestimonies ??
      trustRecord.totalPublicSupports ??
      profile?.totalGoodWorksTestimonies ??
      profile?.totalPublicSupports ??
      profile?.positiveVoteTotal
    ) || 0;

  if (directTotal > 0) return directTotal;

  return BACKER_GOOD_WORK_GROUPS.reduce(
    (sum, item) => sum + getBackerGoodWorksGroupCount(profile, item.key),
    0
  );
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}




