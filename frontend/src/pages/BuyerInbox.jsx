import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const STATUS_LABELS = {
  chat_open: "Chatting",
  negotiating: "Negotiating",
  final_offer_sent: "Final Offer Received",
  paid: "Paid — Awaiting Delivery",
  delivering: "Delivering",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function safeDisplayName(value, fallback = "Member") {
  const trimmed = String(value || "").trim();
  if (!trimmed || isEmailLike(trimmed)) return fallback;
  return trimmed;
}

export default function BuyerInbox() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBuyerOrders = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const orderQuery = query(
          collection(db, "merchant_orders"),
          where("buyerId", "==", user.uid),
          limit(50)
        );
        const orderSnap = await getDocs(orderQuery);
        const orderData = orderSnap.docs.map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data(),
        }));

        const messageQuery = query(
          collection(db, "merchant_order_messages"),
          where("buyerId", "==", user.uid),
          limit(100)
        );
        const messageSnap = await getDocs(messageQuery);
        const messageOrders = messageSnap.docs.map((messageDoc) => {
          const data = messageDoc.data();
          return {
            id: data.orderId,
            productId: data.productId,
            productName: data.productName || "Product request",
            productMediaUrl: data.productMediaUrl || "",
            productStreamUrl: data.productStreamUrl || "",
            productOriginalUrl: data.productOriginalUrl || "",
            productThumbnailUrl: data.productThumbnailUrl || "",
            productMediaType: data.productMediaType || "",
            buyerId: data.buyerId,
            buyerName: safeDisplayName(data.buyerName, "Buyer"),
            merchantId: data.merchantId,
            merchantName: safeDisplayName(data.merchantName, "Merchant"),
            amount: data.amount || 0,
            currency: data.currency || "PARAG",
            status: "chat_open",
            createdAt: data.createdAt,
          };
        });

        const mergedOrders = [...orderData];
        messageOrders.forEach((messageOrder) => {
          if (messageOrder.id && !mergedOrders.some((order) => order.id === messageOrder.id)) {
            mergedOrders.push(messageOrder);
          }
        });

        setOrders(
          mergedOrders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          })
        );
      } catch (err) {
        console.error("Buyer inbox load failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBuyerOrders();
  }, [navigate]);

  const openOrder = async (order) => {
    const user = auth.currentUser;
    if (!user) return;

    // Refresh order from Firestore to get latest status
    try {
      const orderSnap = await getDoc(doc(db, "merchant_orders", order.id));
      if (orderSnap.exists()) {
        setSelectedOrder({ id: orderSnap.id, ...orderSnap.data() });
      } else {
        setSelectedOrder(order);
      }
    } catch {
      setSelectedOrder(order);
    }

    const messageQuery = query(
      collection(db, "merchant_order_messages"),
      where("orderId", "==", order.id),
      where("buyerId", "==", user.uid),
      limit(50)
    );
    const messageSnap = await getDocs(messageQuery);
    await markOrderMessagesAsRead(user.uid, messageSnap.docs);

    setMessages(
      messageSnap.docs
        .map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data(),
          readBy:
            Array.isArray(messageDoc.data().readBy) ||
            !messageDoc.data().senderId ||
            messageDoc.data().senderId === user.uid
              ? messageDoc.data().readBy
              : [...(messageDoc.data().readBy || []), user.uid],
        }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        })
    );
  };

  const sendReply = async () => {
    const user = auth.currentUser;
    if (!user || !selectedOrder || !replyText.trim()) return;

    const text = replyText.trim();
    const senderName = safeDisplayName(user.displayName, "Buyer");
    const productPayload = buildProductMessagePayload(selectedOrder);
    const docRef = await addDoc(collection(db, "merchant_order_messages"), {
      orderId: selectedOrder.id,
      productId: selectedOrder.productId,
      productName: selectedOrder.productName || "Product request",
      ...productPayload,
      buyerId: selectedOrder.buyerId,
      buyerName: selectedOrder.buyerName || senderName,
      merchantId: selectedOrder.merchantId,
      merchantName: selectedOrder.merchantName || "Merchant",
      amount: selectedOrder.amount || 0,
      currency: selectedOrder.currency || "PARAG",
      senderId: user.uid,
      senderName,
      text,
      readBy: [user.uid],
      createdAt: serverTimestamp(),
    });

    // Mirror to unified inbox
    try {
      await addDoc(collection(db, "direct_messages"), {
        chatId: buildChatId(selectedOrder.buyerId, selectedOrder.merchantId),
        participantIds: [selectedOrder.buyerId, selectedOrder.merchantId].sort(),
        senderId: user.uid,
        senderName,
        senderRole: "Member",
        recipientId: selectedOrder.merchantId,
        recipientName: selectedOrder.merchantName || "Merchant",
        recipientRole: "Merchant",
        text,
        ...productPayload,
        source: "merchant_order",
        orderId: selectedOrder.id,
        productId: selectedOrder.productId || "",
        productName: selectedOrder.productName || "Product request",
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });
    } catch (mirrorError) {
      console.warn("Direct inbox mirror failed:", mirrorError);
    }

    setMessages([
      ...messages,
      {
        id: docRef.id,
        senderId: user.uid,
        senderName,
        text,
        ...productPayload,
      },
    ]);
    setReplyText("");
  };

  /** Buyer accepts final offer and pays from PARAG wallet */
  const acceptFinalOfferAndPay = async () => {
    const user = auth.currentUser;
    if (!user || !selectedOrder) return;

    const amount = Number(selectedOrder.amount || 0);
    if (amount <= 0) {
      alert("Invalid order amount. Please contact the merchant.");
      return;
    }

    if (!window.confirm(`Pay ${amount} ${selectedOrder.currency || "PARAG"} from your wallet to accept this final offer?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || ""}/api/wallet/settle-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + idToken,
          },
          body: JSON.stringify({ orderId: selectedOrder.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) {
          alert("Insufficient PARAG balance. Please deposit or convert in your wallet first.");
          navigate("/wallet");
          return;
        }
        throw new Error(err.message || "Payment failed");
      }

      // Update local state
      setSelectedOrder((prev) => ({ ...prev, status: "paid", paymentStatus: "paid" }));
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "paid" } : o))
      );

      // Notify merchant via message
      const senderName = safeDisplayName(user.displayName, "Buyer");
      await addDoc(collection(db, "merchant_order_messages"), {
        orderId: selectedOrder.id,
        productId: selectedOrder.productId,
        productName: selectedOrder.productName || "Product request",
        ...buildProductMessagePayload(selectedOrder),
        buyerId: selectedOrder.buyerId,
        buyerName: selectedOrder.buyerName || senderName,
        merchantId: selectedOrder.merchantId,
        merchantName: selectedOrder.merchantName || "Merchant",
        amount: selectedOrder.amount || 0,
        currency: selectedOrder.currency || "PARAG",
        senderId: user.uid,
        senderName,
        text: `✅ Payment of ${amount} ${selectedOrder.currency || "PARAG"} sent. Awaiting your delivery.`,
        type: "payment_confirmation",
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      alert("Payment successful! The merchant has been notified to deliver your product.");
    } catch (err) {
      console.error("Wallet payment failed:", err);
      alert(`Payment failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /** Buyer confirms delivery — completes the transaction */
  const confirmDelivery = async () => {
    const user = auth.currentUser;
    if (!user || !selectedOrder) return;

    if (!window.confirm("Confirm that you have received the digital product and are satisfied?")) {
      return;
    }

    setActionLoading(true);
    try {
      await updateDoc(doc(db, "merchant_orders", selectedOrder.id), {
        status: "completed",
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const senderName = safeDisplayName(user.displayName, "Buyer");
      await addDoc(collection(db, "merchant_order_messages"), {
        orderId: selectedOrder.id,
        productId: selectedOrder.productId,
        productName: selectedOrder.productName || "Product request",
        ...buildProductMessagePayload(selectedOrder),
        buyerId: selectedOrder.buyerId,
        buyerName: selectedOrder.buyerName || senderName,
        merchantId: selectedOrder.merchantId,
        merchantName: selectedOrder.merchantName || "Merchant",
        amount: selectedOrder.amount || 0,
        currency: selectedOrder.currency || "PARAG",
        senderId: user.uid,
        senderName,
        text: "✅ Delivery confirmed. Transaction completed.",
        type: "delivery_confirmation",
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      setSelectedOrder((prev) => ({ ...prev, status: "completed" }));
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "completed" } : o))
      );
      alert("Thank you! The transaction is now complete.");
    } catch (err) {
      console.error("Delivery confirmation failed:", err);
      alert(`Could not confirm delivery: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading buyer inbox...</main>;
  }

  if (error) {
    return <main style={pageStyle}>Buyer inbox could not load. {error}</main>;
  }

  const orderStatus = selectedOrder?.status;
  const canPay = orderStatus === "final_offer_sent";
  const canConfirmDelivery = orderStatus === "delivering" || orderStatus === "delivered";
  const isCompleted = orderStatus === "completed";

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Buyer inbox</p>
          <h1 style={titleStyle}>Merchant Conversations</h1>
          <p style={mutedStyle}>Track replies, continue deals, and pay with your PARAG wallet.</p>
        </div>
        <button onClick={() => navigate("/marketplace")} style={secondaryBtnStyle}>
          Marketplace
        </button>
      </section>

      <section style={layoutStyle}>
        <div style={panelStyle}>
          <h2>Requests</h2>
          {orders.length === 0 ? (
            <p style={mutedStyle}>No merchant conversations yet.</p>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                onClick={() => openOrder(order)}
                style={{
                  ...requestItemStyle,
                  borderLeft: selectedOrder?.id === order.id ? "3px solid #176b4d" : "1px solid #e2d8c8",
                }}
              >
                <strong>{order.productName}</strong>
                <span>{order.merchantName}</span>
                <span>{order.amount} {order.currency}</span>
                <span style={{ color: statusColor(order.status) }}>{statusLabel(order.status)}</span>
              </button>
            ))
          )}
        </div>

        <div style={panelStyle}>
          {selectedOrder ? (
            <>
              <p style={eyebrowStyle}>Private chat</p>
              <h2>{selectedOrder.productName}</h2>
              <p style={mutedStyle}>
                Merchant: {selectedOrder.merchantName}
                {" · "}
                <span style={{ color: statusColor(orderStatus), fontWeight: 700 }}>
                  {statusLabel(orderStatus)}
                </span>
              </p>

              {canPay && (
                <div style={offerBannerStyle}>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    Final Offer: {selectedOrder.amount} {selectedOrder.currency || "PARAG"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#52616b" }}>
                    Accept this offer to pay from your Paragon Planet Wallet.
                  </p>
                  <button
                    onClick={acceptFinalOfferAndPay}
                    disabled={actionLoading}
                    style={primaryBtnStyle}
                  >
                    {actionLoading ? "Processing…" : `Pay ${selectedOrder.amount} ${selectedOrder.currency || "PARAG"} from Wallet`}
                  </button>
                </div>
              )}

              <div style={messagesStyle}>
                {messages.length === 0 ? (
                  <p style={mutedStyle}>No messages yet.</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} style={messageCardStyle}>
                      {hasMessageProductMedia(message) && (
                        <MerchantProductMedia
                          product={getMessageProduct(message)}
                          style={messageMediaStyle}
                        />
                      )}
                      <p style={messageTextStyle}>
                        <strong>{safeDisplayName(message.senderName, "Member")}:</strong> {message.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {!isCompleted && (
                <div style={replyRowStyle}>
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to merchant"
                    style={inputStyle}
                  />
                  <button onClick={sendReply} style={secondaryBtnStyle}>
                    Send
                  </button>
                </div>
              )}

              {canConfirmDelivery && (
                <button
                  onClick={confirmDelivery}
                  disabled={actionLoading}
                  style={{ ...primaryBtnStyle, marginTop: 12 }}
                >
                  {actionLoading ? "Confirming…" : "Confirm Delivery — Complete Transaction"}
                </button>
              )}

              {isCompleted && (
                <p style={{ marginTop: 12, color: "#176b4d", fontWeight: 700 }}>
                  ✅ Transaction completed.
                </p>
              )}
            </>
          ) : (
            <p style={mutedStyle}>Select a conversation.</p>
          )}
        </div>
      </section>
    </main>
  );
}

const offerBannerStyle = {
  padding: "14px 16px",
  background: "#f0fdf4",
  border: "1px solid #6ee7b7",
  borderRadius: 8,
  marginBottom: 12,
};

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#f7f3ea",
  color: "#1f2933",
};

const headerStyle = {
  maxWidth: 1100,
  margin: "0 auto 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const layoutStyle = {
  maxWidth: 1100,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(240px, 340px) 1fr",
  gap: 16,
};

const panelStyle = {
  padding: 20,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const titleStyle = { margin: "6px 0", fontSize: 32 };
const mutedStyle = { color: "#52616b" };

const requestItemStyle = {
  width: "100%",
  display: "grid",
  gap: 5,
  textAlign: "left",
  padding: 12,
  marginBottom: 10,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
  cursor: "pointer",
};

const messagesStyle = {
  minHeight: 220,
  maxHeight: 360,
  overflowY: "auto",
  padding: 12,
  background: "#f7f3ea",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
};

const messageCardStyle = {
  display: "grid",
  gap: 10,
  marginBottom: 12,
};

const messageMediaStyle = {
  width: "100%",
  maxWidth: 220,
  aspectRatio: "4 / 3",
  objectFit: "cover",
  background: "#eee",
  borderRadius: 6,
};

const messageTextStyle = {
  margin: 0,
};

const replyRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  border: "1px solid #c9c0b2",
  borderRadius: 6,
};

const primaryBtnStyle = {
  width: "100%",
  marginTop: 12,
  padding: "11px 18px",
  background: "#176b4d",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtnStyle = {
  padding: "10px 16px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

async function markOrderMessagesAsRead(currentUid, docs) {
  const unreadIncoming = docs.filter((messageDoc) => {
    const data = messageDoc.data();
    return (
      data?.senderId &&
      data.senderId !== currentUid &&
      (!Array.isArray(data.readBy) || !data.readBy.includes(currentUid))
    );
  });

  await Promise.all(
    unreadIncoming.map((messageDoc) =>
      updateDoc(doc(db, "merchant_order_messages", messageDoc.id), {
        readBy: arrayUnion(currentUid),
      }).catch((error) => {
        console.warn("Could not mark buyer inbox message as read:", error?.message || error);
      })
    )
  );
}

function buildChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("__");
}

function statusColor(status) {
  if (status === "completed") return "#176b4d";
  if (status === "final_offer_sent") return "#b45309";
  if (status === "paid" || status === "delivering" || status === "delivered") return "#1d4ed8";
  if (status === "cancelled") return "#dc2626";
  return "#52616b";
}

function buildProductMessagePayload(order) {
  return {
    productMediaUrl: order?.productMediaUrl || "",
    productStreamUrl: order?.productStreamUrl || "",
    productOriginalUrl: order?.productOriginalUrl || "",
    productThumbnailUrl: order?.productThumbnailUrl || "",
    productMediaType: order?.productMediaType || "",
  };
}

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

