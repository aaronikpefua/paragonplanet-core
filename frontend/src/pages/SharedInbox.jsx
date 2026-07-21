import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import MerchantProductMedia from "../components/MerchantProductMedia";

const PROFILE_COLLECTIONS = [
  { collectionName: "citizen_profiles", role: "Citizen" },
  { collectionName: "promoter_profiles", role: "Ambassador" },
  { collectionName: "merchant_profiles", role: "Merchant" },
  { collectionName: "user_profiles", role: "User" },
  { collectionName: "backer_profiles", role: "Backer" },
  { collectionName: "supernal_profiles", role: "Superboss" },
  { collectionName: "sponsor_investor_profiles", role: "Sponsor / Investor" },
  { collectionName: "sponsor_profiles", role: "Sponsor / Investor" },
];

const BROADCAST_AUDIENCES = [
  { id: "all_stars", label: "All Stars" },
  { id: "citizens", label: "Citizens" },
  { id: "promoters", label: "Ambassadors" },
  { id: "backers", label: "Backers" },
  { id: "supernals", label: "Superbosses" },
  { id: "merchants", label: "Merchants" },
  { id: "users", label: "Users" },
  { id: "sponsors", label: "Sponsors" },
  { id: "investors", label: "Investors" },
];

function SharedInboxResponsiveStyles() {
  return (
    <style>{`
      @media (max-width: 760px) {
        .shared-inbox-page {
          padding: 82px 10px 28px !important;
          overflow-x: hidden !important;
        }

        .shared-inbox-header {
          display: grid !important;
          grid-template-columns: 1fr !important;
          align-items: start !important;
          gap: 12px !important;
        }

        .shared-inbox-header h1 {
          font-size: 30px !important;
          line-height: 1.08 !important;
        }

        .shared-inbox-layout {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        .shared-inbox-panel {
          padding: 16px !important;
          width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .shared-inbox-conversation-panel {
          scroll-margin-top: 88px !important;
        }

        .shared-inbox-directory-card {
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
        }

        .shared-inbox-directory-card button:last-child {
          width: 100% !important;
        }

        .shared-inbox-messages {
          min-height: 300px !important;
          max-height: 55vh !important;
          padding: 10px !important;
        }

        .shared-inbox-messages > div {
          max-width: 92% !important;
        }

        .shared-inbox-reply-row {
          display: grid !important;
          grid-template-columns: 1fr !important;
        }

        .shared-inbox-reply-row input,
        .shared-inbox-reply-row button {
          width: 100% !important;
          box-sizing: border-box !important;
        }
      }
    `}</style>
  );
}

export default function SharedInbox({
  returnTo = "/profile",
  returnLabel = "Profile",
  inboxEyebrow = "Shared inbox",
  inboxTitle = "Direct Messages",
  inboxDescription = "Message citizens, ambassadors, merchants, users, backers, superbosses, and sponsors from one place.",
  isAdminMode = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const inboxState = location.state || {};
  const contactParams = new URLSearchParams(location.search);
  const queryContactUid = contactParams.get("contactUid") || "";
  const queryContactName = contactParams.get("contactName") || "";
  const queryContactRole = contactParams.get("contactRole") || "Member";
  const queryContactSubtitle = contactParams.get("contactSubtitle") || "";
  const queryContact = queryContactUid
    ? {
        uid: queryContactUid,
        displayName: queryContactName || queryContactRole,
        role: queryContactRole,
        subtitle: queryContactSubtitle,
      }
    : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selfProfile, setSelfProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastAudience, setBroadcastAudience] = useState("all_stars");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [contactRestriction, setContactRestriction] = useState(() =>
    queryContact || (inboxState.restrictToContact && inboxState.contact ? inboxState.contact : null)
  );
  const conversationPanelRef = useRef(null);

  const isContactOnly = Boolean(contactRestriction?.uid);
  const effectiveReturnTo = isContactOnly ? inboxState.returnTo || `/member/${contactRestriction.uid}` : returnTo;
  const effectiveReturnLabel = isContactOnly ? inboxState.returnLabel || returnLabel : returnLabel;

  useEffect(() => {
    if (inboxState.restrictToContact && inboxState.contact?.uid) {
      setContactRestriction(inboxState.contact);
    }
  }, [inboxState.contact, inboxState.restrictToContact]);

  useEffect(() => {
    const loadInbox = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const self = await loadCurrentUserProfile(user.uid, user.email);
        setSelfProfile(self);

        const isPromoterCitizenInbox =
          !isAdminMode && !contactRestriction?.uid && self.role === "Ambassador";
        const isRestrictedMemberInbox = !isAdminMode && !contactRestriction?.uid;
        let people = contactRestriction?.uid
          ? [normalizeContact(contactRestriction)]
          : isRestrictedMemberInbox && !isPromoterCitizenInbox
            ? []
          : await loadDirectory(user.uid, self);
        const restrictedChatId = contactRestriction?.uid
          ? buildChatId(user.uid, contactRestriction.uid)
          : "";

        const directThreadSnap = await getDocs(
          query(
            collection(db, "direct_messages"),
            where("participantIds", "array-contains", user.uid),
            limit(300)
          )
        );

        const directMessages = directThreadSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        const merchantThreadSnap = contactRestriction?.uid
          ? { docs: [] }
          : await getDocs(
              query(
                collection(db, "merchant_order_messages"),
                where("buyerId", "==", user.uid),
                limit(300)
              )
            );

        const merchantBuyerMessages = merchantThreadSnap.docs.map((docSnap) =>
          mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid)
        );

        const merchantSellerSnap = contactRestriction?.uid
          ? { docs: [] }
          : await getDocs(
              query(
                collection(db, "merchant_order_messages"),
                where("merchantId", "==", user.uid),
                limit(300)
              )
            );

        const merchantSellerMessages = merchantSellerSnap.docs.map((docSnap) =>
          mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid)
        );

        const rawMessages = dedupeMessages([
          ...directMessages,
          ...merchantBuyerMessages,
          ...merchantSellerMessages,
        ]);
        const incomingContactIds = isRestrictedMemberInbox && !isPromoterCitizenInbox
          ? new Set(
              rawMessages
                .filter((message) => message.senderId && message.senderId !== user.uid)
                .map((message) => message.senderId)
            )
          : null;
        if (incomingContactIds) {
          const incomingContacts = buildContactsFromMessages(rawMessages, user.uid, incomingContactIds);
          const profileContacts = await loadContactsByIds(incomingContactIds, user.uid);
          const openContacts = await loadOpenMessageDirectory(user.uid, self);
          people = mergeContacts([...profileContacts, ...incomingContacts, ...openContacts]);
        }
        setMembers(people);
        const allowedContactIds = isPromoterCitizenInbox
          ? new Set(people.map((person) => person.uid))
          : incomingContactIds
            ? new Set(people.map((person) => person.uid))
            : null;
        const visibleMessages = restrictedChatId
          ? rawMessages.filter((message) => message.chatId === restrictedChatId)
          : allowedContactIds
            ? rawMessages.filter((message) =>
                allowedContactIds.has(
                  message.senderId === user.uid ? message.recipientId : message.senderId
                )
              )
          : rawMessages;

        const groupedThreads = buildThreads(visibleMessages, user.uid, people);
        setThreads(groupedThreads);
      } catch (err) {
        console.error("Shared inbox load failed:", err);
        setError(err.message || "Shared inbox could not load.");
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
  }, [contactRestriction, navigate]);

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    if (!term) return members;

    return members.filter((member) =>
      [
        member.displayName,
        member.role,
        member.subtitle,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [memberSearch, members]);

  const broadcastTargets = useMemo(
    () => filterMembersByAudience(members, broadcastAudience),
    [members, broadcastAudience]
  );

  const openConversation = useCallback(async (contact) => {
    const user = auth.currentUser;
    if (!user) return;
    if (contactRestriction?.uid && contact.uid !== contactRestriction.uid) return;

    setSelectedContact(contact);
    setError("");

    try {
      const chatId = buildChatId(user.uid, contact.uid);
      const directSnap = await getDocs(
        query(
          collection(db, "direct_messages"),
          where("participantIds", "array-contains", user.uid),
          limit(300)
        )
      );

      const directMessages = directSnap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((message) => message.chatId === chatId);

      const merchantBuyerSnap = contactRestriction?.uid
        ? { docs: [] }
        : await getDocs(
            query(
              collection(db, "merchant_order_messages"),
              where("buyerId", "==", user.uid),
              limit(300)
            )
          );

      const merchantSellerSnap = contactRestriction?.uid
        ? { docs: [] }
        : await getDocs(
            query(
              collection(db, "merchant_order_messages"),
              where("merchantId", "==", user.uid),
              limit(300)
            )
          );

      const merchantMessages = [
        ...merchantBuyerSnap.docs.map((docSnap) =>
          mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid)
        ),
        ...merchantSellerSnap.docs.map((docSnap) =>
          mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid)
        ),
      ].filter((message) => message.chatId === chatId);

      const threadMessages = dedupeMessages([...directMessages, ...merchantMessages])
        .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));

      await markMessagesAsRead(
        user.uid,
        directSnap.docs.filter((docSnap) => docSnap.data()?.chatId === chatId),
        "direct_messages"
      );
      await markMessagesAsRead(
        user.uid,
        merchantBuyerSnap.docs.filter(
          (docSnap) => mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid).chatId === chatId
        ),
        "merchant_order_messages"
      );
      await markMessagesAsRead(
        user.uid,
        merchantSellerSnap.docs.filter(
          (docSnap) => mapMerchantOrderMessage(docSnap.id, docSnap.data(), user.uid).chatId === chatId
        ),
        "merchant_order_messages"
      );

      setMessages(threadMessages);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.chatId === chatId
            ? { ...thread, unreadCount: 0 }
            : thread
        )
      );
    } catch (err) {
      console.error("Conversation load failed:", err);
      setMessages([]);
    }
  }, [contactRestriction?.uid]);

  useEffect(() => {
    if (!selectedContact || typeof window === "undefined" || window.innerWidth > 760) return;

    const scrollTimer = window.setTimeout(() => {
      conversationPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, [selectedContact]);

  useEffect(() => {
    const requestedContact = contactRestriction || location.state?.contact;
    if (!requestedContact || !members.length || selectedContact) return;

    const match =
      members.find((member) => member.uid === requestedContact.uid) ||
      requestedContact;

    void openConversation(match);
    if (!contactRestriction) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [contactRestriction, location.pathname, location.state, members, navigate, openConversation, selectedContact]);

  const sendMessage = async () => {
    const user = auth.currentUser;
    if (!user || !selectedContact || !draftMessage.trim() || sending) return;

    const text = draftMessage.trim();
    const senderName = safeDisplayName(selfProfile?.displayName || user.displayName, "Member");
    const senderRole = selfProfile?.role || "Member";
    const chatId = buildChatId(user.uid, selectedContact.uid);

    setSending(true);

    try {
      const docRef = await addDoc(collection(db, "direct_messages"), {
        chatId,
        participantIds: [user.uid, selectedContact.uid].sort(),
        senderId: user.uid,
        senderName,
        senderRole,
        recipientId: selectedContact.uid,
        recipientName: selectedContact.displayName,
        recipientRole: selectedContact.role,
        text,
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      const optimisticMessage = {
        id: docRef.id,
        chatId,
        participantIds: [user.uid, selectedContact.uid].sort(),
        senderId: user.uid,
        senderName,
        senderRole,
        recipientId: selectedContact.uid,
        recipientName: selectedContact.displayName,
        recipientRole: selectedContact.role,
        text,
        readBy: [user.uid],
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setDraftMessage("");
      setThreads((prev) =>
        upsertThread(prev, {
          chatId,
          participant: selectedContact,
          lastMessage: text,
          lastCreatedAt: Date.now(),
          unreadCount: 0,
        })
      );
    } catch (err) {
      console.error("Send message failed:", err);
      setError(err.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async () => {
    const user = auth.currentUser;
    if (!isAdminMode || !user || !broadcastMessage.trim() || broadcastSending) return;

    const targets = filterMembersByAudience(members, broadcastAudience);
    if (!targets.length) {
      setError("No members found for that broadcast group.");
      return;
    }

    const text = broadcastMessage.trim();
    const senderName = safeDisplayName(selfProfile?.displayName || user.displayName, "Admin");
    const senderRole = "Admin";

    setBroadcastSending(true);
    setError("");

    try {
      await Promise.all(
        targets.map((target) =>
          addDoc(collection(db, "direct_messages"), {
            chatId: buildChatId(user.uid, target.uid),
            participantIds: [user.uid, target.uid].sort(),
            senderId: user.uid,
            senderName,
            senderRole,
            recipientId: target.uid,
            recipientName: target.displayName,
            recipientRole: target.role,
            text,
            readBy: [user.uid],
            createdAt: serverTimestamp(),
          })
        )
      );

      setBroadcastMessage("");
      setGlobalThreadPreview(targets, text);
    } catch (err) {
      console.error("Broadcast send failed:", err);
      setError(err.message || "Broadcast could not be sent.");
    } finally {
      setBroadcastSending(false);
    }
  };

  const setGlobalThreadPreview = (targets, text) => {
    setThreads((prev) => {
      let nextThreads = [...prev];
      targets.forEach((target) => {
        nextThreads = upsertThread(nextThreads, {
          chatId: buildChatId(auth.currentUser.uid, target.uid),
          participant: target,
          lastMessage: text,
          lastCreatedAt: Date.now(),
          unreadCount: 0,
        });
      });
      return nextThreads;
    });
  };

  if (loading) {
    return <main style={pageStyle}>Loading inbox...</main>;
  }

  if (error) {
    return <main style={pageStyle}>Inbox could not load. {error}</main>;
  }

  const isPromoterCitizenInbox =
    !isAdminMode && !isContactOnly && selfProfile?.role === "Ambassador";
  const isCitizenReplyInbox =
    !isAdminMode && !isContactOnly && selfProfile?.role === "Citizen";
  const isMerchantReplyInbox =
    !isAdminMode && !isContactOnly && selfProfile?.role === "Merchant";
  const isRestrictedMemberInbox = !isAdminMode && !isContactOnly;
  const isLimitedDirectoryInbox = isRestrictedMemberInbox && !isPromoterCitizenInbox;
  const effectiveInboxTitle = isPromoterCitizenInbox ? "Direct Messages to Citizens" : inboxTitle;
  const effectiveInboxDescription = isPromoterCitizenInbox
      ? "Message only the citizens who registered through your ambassador invite link."
    : isLimitedDirectoryInbox
      ? selfProfile?.role === "Citizen"
        ? "Reply to people who messaged you or contact ambassador accounts."
        : selfProfile?.role === "Merchant"
          ? "Reply only to people who have already sent you a direct message."
          : "Reply only to people who have already sent you a direct message."
    : inboxDescription;
  const recentConversationsTitle = isPromoterCitizenInbox
    ? "Recent Citizen Conversations"
    : "Recent Conversations";
  const directoryTitle = isPromoterCitizenInbox
    ? "Invited Citizen Directory"
    : isCitizenReplyInbox
      ? "Allowed Message Contacts"
      : isMerchantReplyInbox
        ? "People Who Messaged You"
        : isLimitedDirectoryInbox
          ? "Allowed Message Contacts"
      : "Member Directory";
  const emptyDirectoryText = isPromoterCitizenInbox
    ? "No citizens from your invitation link are available right now."
    : isMerchantReplyInbox
      ? "No one has sent you a direct message yet."
      : isLimitedDirectoryInbox
        ? "No allowed message contacts are available right now."
    : "No members match your search right now.";

  return (
    <main className="shared-inbox-page" style={pageStyle}>
      <SharedInboxResponsiveStyles />
      <section className="shared-inbox-header" style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>{inboxEyebrow}</p>
          <h1 style={titleStyle}>{effectiveInboxTitle}</h1>
          <p style={mutedStyle}>
            {effectiveInboxDescription}
          </p>
        </div>
        <button onClick={() => navigate(effectiveReturnTo)} style={secondaryBtnStyle}>
          {effectiveReturnLabel}
        </button>
      </section>

      <section className="shared-inbox-layout" style={layoutStyle}>
        <div className="shared-inbox-panel" style={panelStyle}>
          {isAdminMode && (
            <div style={broadcastBlockStyle}>
              <div style={directoryHeaderStyle}>
                <h2 style={panelTitleStyle}>Admin Broadcast</h2>
                <p style={mutedStyle}>
                  Send one message to a whole role group at once.
                </p>
              </div>

              <div style={broadcastAudienceGridStyle}>
                {BROADCAST_AUDIENCES.map((audience) => (
                  <button
                    key={audience.id}
                    type="button"
                    onClick={() => setBroadcastAudience(audience.id)}
                    style={audienceChipStyle(broadcastAudience === audience.id)}
                  >
                    {audience.label}
                  </button>
                ))}
              </div>

              <p style={broadcastMetaStyle}>
                Recipients: {broadcastTargets.length}
              </p>

              <textarea
                value={broadcastMessage}
                onChange={(event) => setBroadcastMessage(event.target.value)}
                placeholder="Write your message to this role group"
                style={broadcastTextareaStyle}
              />

              <button
                type="button"
                onClick={sendBroadcast}
                style={primaryBtnStyle}
                disabled={broadcastSending || !broadcastMessage.trim() || !broadcastTargets.length}
              >
                {broadcastSending ? "Sending..." : `Send to ${getAudienceLabel(broadcastAudience)}`}
              </button>
            </div>
          )}

          {isContactOnly ? (
            <div style={directoryBlockStyle}>
              <h2 style={panelTitleStyle}>Meet-Up Contact</h2>
              {members.map((member) => (
                <button
                  key={member.uid}
                  onClick={() => openConversation(member)}
                  style={listItemStyle}
                >
                  <strong>{member.displayName}</strong>
                  <span>{member.role}</span>
                  <span style={mutedStyle}>{safeSubtitle(member.subtitle, "Open direct chat")}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <h2 style={panelTitleStyle}>{recentConversationsTitle}</h2>
              {threads.length === 0 ? (
                <p style={mutedStyle}>No conversations yet.</p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.chatId}
                    onClick={() => openConversation(thread.participant)}
                    style={listItemStyle}
                  >
                    <div style={threadHeaderStyle}>
                      <strong>{thread.participant.displayName}</strong>
                      {thread.unreadCount > 0 && (
                        <span style={unreadBadgeStyle}>{thread.unreadCount}</span>
                      )}
                    </div>
                    <span>{thread.participant.role}</span>
                    <span style={mutedStyle}>{thread.lastMessage || "Open conversation"}</span>
                  </button>
                ))
              )}

              <div style={directoryBlockStyle}>
                <div style={directoryHeaderStyle}>
                  <h2 style={panelTitleStyle}>{directoryTitle}</h2>
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search members"
                    style={searchInputStyle}
                  />
                </div>

                {filteredMembers.length === 0 ? (
                  <p style={mutedStyle}>{emptyDirectoryText}</p>
                ) : (
                  filteredMembers.map((member) => (
                    <div key={member.uid} className="shared-inbox-directory-card" style={directoryMemberCardStyle}>
                      <button
                        type="button"
                        onClick={() => openConversation(member)}
                        style={directoryMemberInfoButtonStyle}
                      >
                        <strong>{member.displayName}</strong>
                        <span>{member.role}</span>
                        <span style={mutedStyle}>{safeSubtitle(member.subtitle, "Open direct chat")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openConversation(member)}
                        style={directoryMessageBtnStyle}
                      >
                        Message
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div
          ref={conversationPanelRef}
          className="shared-inbox-panel shared-inbox-conversation-panel"
          style={panelStyle}
        >
          {selectedContact ? (
            <>
              <p style={eyebrowStyle}>Private conversation</p>
              <div style={conversationHeaderStyle}>
                <div>
                  <h2 style={{ margin: "6px 0" }}>{selectedContact.displayName}</h2>
                  <p style={mutedStyle}>
                    {selectedContact.role}
                  </p>
                </div>
                <span style={rolePillStyle}>{selectedContact.role}</span>
              </div>

              <div className="shared-inbox-messages" style={messagesStyle}>
                {messages.length === 0 ? (
                  <p style={mutedStyle}>Start the conversation here.</p>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === auth.currentUser?.uid;
                    return (
                      <div
                        key={message.id}
                        style={{
                          ...messageBubbleStyle,
                          ...(mine ? ownMessageStyle : otherMessageStyle),
                        }}
                      >
                        {hasMessageProductMedia(message) && (
                          <MerchantProductMedia
                            product={getMessageProduct(message)}
                            style={messageMediaStyle}
                          />
                        )}
                        <p style={messageNameStyle}>
                          {mine ? "You" : safeDisplayName(message.senderName, selectedContact.displayName || "Member")}
                        </p>
                        <p style={messageTextStyle}>{message.text}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shared-inbox-reply-row" style={replyRowStyle}>
                <input
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder={`Message ${selectedContact.displayName}`}
                  style={inputStyle}
                />
                <button onClick={sendMessage} style={primaryBtnStyle} disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          ) : (
            <div style={emptyStateStyle}>
              <p style={eyebrowStyle}>{inboxEyebrow}</p>
              <h2 style={{ marginTop: 8 }}>
                {isPromoterCitizenInbox ? "Choose a citizen to message" : "Choose a person to start chatting"}
              </h2>
              <p style={mutedStyle}>
                {isPromoterCitizenInbox
                  ? "Use the Message button beside any registered citizen to open the private chat box here."
                  : isLimitedDirectoryInbox
                    ? "Open a recent conversation or choose one of the allowed contacts from the list."
                  : "Open an existing conversation or pick someone from the directory to start a direct message."}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

async function loadCurrentUserProfile(uid, email) {
  for (const source of PROFILE_COLLECTIONS) {
    try {
      const snap = await getDoc(doc(db, source.collectionName, uid));
      if (snap.exists()) {
        const data = snap.data();
        const resolvedRole = resolveProfileRole(source, data);
        return {
          uid,
          role: resolvedRole,
          displayName: getDisplayName(data, resolvedRole),
          email: "",
          subtitle: safeSubtitle(data.profession || data.stageName || ""),
        };
      }
    } catch (error) {
      console.warn(`Skipping ${source.collectionName} self lookup:`, error?.message || error);
    }
  }

  return {
    uid,
    role: "Member",
    displayName: "Member",
    email: "",
    subtitle: "",
  };
}

function normalizeContact(contact) {
  return {
    uid: contact.uid,
    role: contact.role || "Member",
    displayName: safeDisplayName(contact.displayName, contact.role || "Member"),
    email: "",
    subtitle: safeSubtitle(contact.subtitle || ""),
  };
}

async function loadDirectory(currentUid, selfProfile = null) {
  if (selfProfile?.role === "Ambassador") {
    try {
      const [primarySnapshot, invitedSnapshot] = await Promise.all([
        getDocs(
          query(collection(db, "citizen_profiles"), where("primaryPromoterId", "==", currentUid))
        ),
        getDocs(
          query(collection(db, "citizen_profiles"), where("invitedByPromoterId", "==", currentUid))
        ),
      ]);
      const citizenDocs = new Map();
      [...primarySnapshot.docs, ...invitedSnapshot.docs].forEach((docSnap) => {
        citizenDocs.set(docSnap.id, docSnap);
      });

      return Array.from(citizenDocs.values())
        .filter((docSnap) => docSnap.id !== currentUid)
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            uid: docSnap.id,
            role: "Citizen",
            displayName: getDisplayName(data, "Citizen"),
            email: "",
            subtitle: [
              data.profession,
              data.country,
              data.state,
            ].filter(Boolean).join(" • "),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      console.warn("Skipping invited citizen directory:", error?.message || error);
      return [];
    }
  }

  const peopleMap = new Map();

  for (const source of PROFILE_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, source.collectionName));
      snapshot.docs.forEach((docSnap) => {
        if (docSnap.id === currentUid) return;
        if (peopleMap.has(docSnap.id)) return;

        const data = docSnap.data();
        const resolvedRole = resolveProfileRole(source, data);
        peopleMap.set(docSnap.id, {
          uid: docSnap.id,
          role: resolvedRole,
          displayName: getDisplayName(data, resolvedRole),
          email: "",
          subtitle:
            safeSubtitle(
              data.profession ||
              data.stageName ||
            (Array.isArray(data.promoterTypes) ? data.promoterTypes.join(", ") : "") ||
            data.country ||
              ""
            ),
        });
      });
    } catch (error) {
      console.warn(`Skipping directory source ${source.collectionName}:`, error?.message || error);
    }
  }

  return Array.from(peopleMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

async function loadOpenMessageDirectory(currentUid, selfProfile) {
  if (!selfProfile?.role) {
    return [];
  }

  const contacts = [];

  if (selfProfile.role === "Citizen") {
    contacts.push(...await loadPromoterMessageAccounts(currentUid));
  }

  return mergeContacts(contacts);
}

async function loadContactsByIds(contactIds, currentUid) {
  const remainingIds = new Set(Array.from(contactIds || []).filter((uid) => uid && uid !== currentUid));
  const contacts = [];

  for (const source of PROFILE_COLLECTIONS) {
    if (!remainingIds.size) break;

    await Promise.all(
      Array.from(remainingIds).map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, source.collectionName, uid));
          if (!snap.exists()) return;

          const data = snap.data();
          const resolvedRole = resolveProfileRole(source, data);
          contacts.push({
            uid,
            role: resolvedRole,
            displayName: getDisplayName(data, resolvedRole),
            email: "",
            subtitle: safeSubtitle(
              data.profession ||
              data.stageName ||
              (Array.isArray(data.promoterTypes) ? data.promoterTypes.join(", ") : "") ||
              data.country ||
              ""
            ),
          });
          remainingIds.delete(uid);
        } catch (error) {
          console.warn(`Could not resolve inbox contact ${uid}:`, error?.message || error);
        }
      })
    );
  }

  return contacts;
}

async function loadPromoterMessageAccounts(currentUid) {
  try {
    const snapshot = await getDocs(collection(db, "promoter_profiles"));
    return snapshot.docs
      .filter((docSnap) => docSnap.id !== currentUid)
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          role: "Ambassador",
          displayName: getDisplayName(data, "Ambassador"),
          email: "",
          subtitle:
            (Array.isArray(data.promoterTypes) ? data.promoterTypes.join(", ") : "") ||
            data.brandName ||
            data.country ||
            "Ambassador account",
        };
      });
  } catch (error) {
    console.warn("Ambassador message accounts could not load:", error?.message || error);
    return [];
  }
}

function buildThreads(rawMessages, currentUid, people) {
  const peopleMap = new Map(people.map((person) => [person.uid, person]));
  const grouped = new Map();

  rawMessages.forEach((message) => {
    const partnerId = message.senderId === currentUid ? message.recipientId : message.senderId;
    const fallbackPerson = {
      uid: partnerId,
      displayName:
        message.senderId === currentUid
          ? safeDisplayName(message.recipientName, "Member")
          : safeDisplayName(message.senderName, "Member"),
      role:
        message.senderId === currentUid
          ? message.recipientRole || "Member"
          : message.senderRole || "Member",
      email: "",
      subtitle: "",
    };
    const participant = peopleMap.get(partnerId) || fallbackPerson;
    const current = grouped.get(message.chatId);
    const currentTime = getMillis(message.createdAt);

    if (!current || currentTime > current.lastCreatedAt) {
      grouped.set(message.chatId, {
        chatId: message.chatId,
        participant,
        lastMessage: message.text,
        lastCreatedAt: currentTime,
        unreadCount:
          message.senderId !== currentUid &&
          !message.readBy?.includes?.(currentUid)
            ? 1
            : 0,
      });
    } else if (
      message.senderId !== currentUid &&
      !message.readBy?.includes?.(currentUid)
    ) {
      current.unreadCount = (current.unreadCount || 0) + 1;
    }
  });

  return Array.from(grouped.values()).sort((a, b) => b.lastCreatedAt - a.lastCreatedAt);
}

function buildContactsFromMessages(rawMessages, currentUid, allowedContactIds) {
  const contactMap = new Map();

  rawMessages.forEach((message) => {
    const partnerId = message.senderId === currentUid ? message.recipientId : message.senderId;
    if (!partnerId || !allowedContactIds.has(partnerId) || contactMap.has(partnerId)) return;

    const isSentByCurrentUser = message.senderId === currentUid;
    contactMap.set(partnerId, {
      uid: partnerId,
      displayName: isSentByCurrentUser
        ? safeDisplayName(message.recipientName, "Member")
        : safeDisplayName(message.senderName, "Member"),
      role: isSentByCurrentUser
        ? message.recipientRole || "Member"
        : message.senderRole || "Member",
      email: "",
      subtitle: "Open direct chat",
    });
  });

  return Array.from(contactMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

function mergeContacts(contacts) {
  const contactMap = new Map();

  contacts.forEach((contact) => {
    if (!contact?.uid || contactMap.has(contact.uid)) return;
    contactMap.set(contact.uid, contact);
  });

  return Array.from(contactMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

function mapMerchantOrderMessage(id, data, currentUid) {
  const buyerId = data.buyerId || "";
  const merchantId = data.merchantId || "";
  const otherPartyId = buyerId === currentUid ? merchantId : buyerId;

  return {
    id: `merchant_${id}`,
    chatId: buildChatId(buyerId, merchantId),
    participantIds: [buyerId, merchantId].filter(Boolean).sort(),
    senderId: data.senderId || "",
    senderName: safeDisplayName(data.senderName, "Member"),
    senderRole: data.senderId === merchantId ? "Merchant" : "Member",
    recipientId: otherPartyId,
    recipientName:
      buyerId === currentUid
        ? safeDisplayName(data.merchantName, "Merchant")
        : safeDisplayName(data.buyerName, "Buyer"),
    recipientRole: buyerId === currentUid ? "Merchant" : "Member",
    text: data.text || "",
    productMediaUrl: data.productMediaUrl || "",
    productStreamUrl: data.productStreamUrl || "",
    productOriginalUrl: data.productOriginalUrl || "",
    productThumbnailUrl: data.productThumbnailUrl || "",
    productMediaType: data.productMediaType || "",
    createdAt: data.createdAt,
    source: "merchant_order",
    orderId: data.orderId || "",
    productId: data.productId || "",
    productName: data.productName || "Product request",
  };
}

function dedupeMessages(messages) {
  const seen = new Set();
  return messages.filter((message) => {
    const key = getMessageSignature(message);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMessageSignature(message) {
  const normalizedText = String(message.text || "").trim().toLowerCase();
  const orderPart = message.orderId || "";
  const productPart = message.productId || "";
  const rawMillis = getMillis(message.createdAt);
  const timePart = rawMillis ? Math.floor(rawMillis / 1000) : message.id || "";
  return `${message.chatId}__${message.senderId}__${orderPart}__${productPart}__${normalizedText}__${timePart}`;
}

function upsertThread(threads, nextThread) {
  const filtered = threads.filter((thread) => thread.chatId !== nextThread.chatId);
  return [nextThread, ...filtered].sort((a, b) => b.lastCreatedAt - a.lastCreatedAt);
}

async function markMessagesAsRead(currentUid, docs, collectionName) {
  const unreadIncoming = docs.filter((docSnap) => {
    const data = docSnap.data();
    return (
      data?.senderId &&
      data.senderId !== currentUid &&
      (!Array.isArray(data.readBy) || !data.readBy.includes(currentUid))
    );
  });

  await Promise.all(
    unreadIncoming.map((docSnap) =>
      updateDoc(doc(db, collectionName, docSnap.id), {
        readBy: arrayUnion(currentUid),
      }).catch((error) => {
        console.warn(`Could not mark ${collectionName} message as read:`, error?.message || error);
      })
    )
  );
}

function buildChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("__");
}

function resolveProfileRole(source, data) {
  if (source.collectionName === "sponsor_investor_profiles") {
    if (data?.accountType === "SPONSOR") return "Sponsor";
    if (data?.accountType === "INVESTOR") return "Investor";
  }

  if (source.collectionName === "sponsor_profiles") {
    return "Sponsor";
  }

  return source.role;
}

function getDisplayName(data, role, fallback = "") {
  return safeDisplayName(
    data?.stageName ||
    data?.realName ||
    data?.name ||
    fallback ||
    role,
    role
  );
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function safeDisplayName(value, fallback = "Member") {
  const trimmed = String(value || "").trim();
  if (!trimmed || isEmailLike(trimmed)) return fallback;
  return trimmed;
}

function safeSubtitle(value, fallback = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed || isEmailLike(trimmed)) return fallback;
  return trimmed;
}

function getMillis(timestamp) {
  return timestamp?.toMillis?.() || 0;
}

function filterMembersByAudience(members, audience) {
  if (audience === "all_stars") return members;

  const roleMap = {
    citizens: "Citizen",
    promoters: "Ambassador",
    backers: "Backer",
    supernals: "Superboss",
    merchants: "Merchant",
    users: "User",
    sponsors: "Sponsor",
    investors: "Investor",
  };

  return members.filter((member) => member.role === roleMap[audience]);
}

function getAudienceLabel(audience) {
  return (
    BROADCAST_AUDIENCES.find((item) => item.id === audience)?.label || "Members"
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#f7f3ea",
  color: "#1f2933",
};

const headerStyle = {
  maxWidth: 1180,
  margin: "0 auto 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const titleStyle = { margin: "6px 0", fontSize: 36 };

const layoutStyle = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(320px, 380px) 1fr",
  gap: 18,
};

const panelStyle = {
  padding: 22,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 10,
  boxShadow: "0 2px 10px rgba(31, 41, 51, 0.05)",
};

const broadcastBlockStyle = {
  marginBottom: 24,
  paddingBottom: 20,
  borderBottom: "1px solid #ece2d4",
  display: "grid",
  gap: 12,
};

const panelTitleStyle = {
  margin: 0,
  fontSize: 22,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const mutedStyle = { color: "#52616b" };

const listItemStyle = {
  width: "100%",
  display: "grid",
  gap: 6,
  textAlign: "left",
  padding: 14,
  marginBottom: 10,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(31, 41, 51, 0.04)",
};

const directoryMemberCardStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
  padding: 14,
  marginBottom: 10,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  boxShadow: "0 1px 2px rgba(31, 41, 51, 0.04)",
};

const directoryMemberInfoButtonStyle = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
};

const directoryMessageBtnStyle = {
  padding: "9px 14px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const threadHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const unreadBadgeStyle = {
  minWidth: 22,
  height: 22,
  padding: "0 7px",
  borderRadius: 999,
  background: "#b42318",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const directoryBlockStyle = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: "1px solid #ece2d4",
};

const directoryHeaderStyle = {
  display: "grid",
  gap: 12,
  marginBottom: 12,
};

const searchInputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: "1px solid #d7cdbd",
  background: "#fff",
};

const broadcastAudienceGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const audienceChipStyle = (active) => ({
  padding: "9px 12px",
  borderRadius: 999,
  border: `1px solid ${active ? "#176b4d" : "#d7cdbd"}`,
  background: active ? "#176b4d" : "#fff",
  color: active ? "#fff" : "#1f2933",
  fontWeight: 700,
  cursor: "pointer",
});

const broadcastMetaStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 13,
  fontWeight: 700,
};

const broadcastTextareaStyle = {
  width: "100%",
  minHeight: 110,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d7cdbd",
  background: "#fff",
  resize: "vertical",
  font: "inherit",
};

const conversationHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const rolePillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: 999,
  background: "#f3efe6",
  color: "#4f4639",
  fontWeight: 700,
  fontSize: 13,
};

const messagesStyle = {
  minHeight: 320,
  maxHeight: 500,
  overflowY: "auto",
  padding: 14,
  background: "#f7f3ea",
  border: "1px solid #e2d8c8",
  borderRadius: 10,
  display: "grid",
  gap: 10,
};

const messageBubbleStyle = {
  maxWidth: "78%",
  padding: "12px 14px",
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(31, 41, 51, 0.04)",
};

const ownMessageStyle = {
  justifySelf: "end",
  background: "#1f2933",
  color: "#fff",
  borderBottomRightRadius: 6,
};

const otherMessageStyle = {
  justifySelf: "start",
  background: "#fff",
  color: "#1f2933",
  border: "1px solid #e2d8c8",
  borderBottomLeftRadius: 6,
};

const messageNameStyle = {
  margin: 0,
  fontWeight: 700,
  fontSize: 13,
};

const messageTextStyle = {
  margin: "4px 0 0",
  lineHeight: 1.55,
};

const messageMediaStyle = {
  width: "100%",
  maxWidth: 220,
  aspectRatio: "4 / 3",
  objectFit: "cover",
  background: "#eee",
  borderRadius: 8,
};

const replyRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 14,
};

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "12px 14px",
  border: "1px solid #c9c0b2",
  borderRadius: 8,
};

const primaryBtnStyle = {
  padding: "12px 18px",
  background: "#176b4d",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtnStyle = {
  padding: "10px 16px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const emptyStateStyle = {
  minHeight: 420,
  display: "grid",
  alignContent: "center",
  gap: 8,
};

function hasMessageProductMedia(message) {
  return Boolean(
    message?.productStreamUrl ||
    message?.productMediaUrl ||
    message?.productOriginalUrl
  );
}

function getMessageProduct(message) {
  return {
    name: message?.productName || "Product",
    mediaUrl: message?.productMediaUrl || "",
    streamUrl: message?.productStreamUrl || "",
    originalUrl: message?.productOriginalUrl || "",
    thumbnailUrl: message?.productThumbnailUrl || "",
    mediaType: message?.productMediaType || "",
  };
}
