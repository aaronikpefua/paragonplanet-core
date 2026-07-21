import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import MerchantProductMedia from "../components/MerchantProductMedia";

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
  "Other approved digital products and software-related materials",
];

const MERCHANT_EXPECTATIONS = [
  "Upload authentic and approved digital products",
  "Maintain fair pricing and honest negotiations",
  "Deliver quality digital services and products",
  "Respect intellectual property rights",
  "Avoid fraudulent, illegal, or prohibited materials",
  "Build trusted relationships with buyers",
  "Maintain positive ratings, reviews, and marketplace reputation",
];

function buildProductMessagePayload(product) {
  return {
    productMediaUrl: product?.mediaUrl || "",
    productStreamUrl: product?.streamUrl || "",
    productOriginalUrl: product?.originalUrl || "",
    productThumbnailUrl: product?.thumbnailUrl || "",
    productMediaType: product?.mediaType || "",
  };
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function safeDisplayName(value, fallback = "Member") {
  const trimmed = String(value || "").trim();
  if (!trimmed || isEmailLike(trimmed)) return fallback;
  return trimmed;
}

export default function MerchantMarketplace() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [comments, setComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderMessages, setOrderMessages] = useState([]);
  const [dealMessage, setDealMessage] = useState("");
  const [dealLoading, setDealLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMerchantAbout, setShowMerchantAbout] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const productQuery = query(
          collection(db, "merchant_products"),
          where("status", "==", "active"),
          limit(40)
        );

        const snap = await getDocs(productQuery);
        const nextProducts = snap.docs
          .map((productDoc) => ({
            id: productDoc.id,
            ...productDoc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

        setProducts(nextProducts);

        const commentEntries = await Promise.all(
          nextProducts.map(async (product) => {
            const commentQuery = query(
              collection(db, "merchant_product_comments"),
              where("productId", "==", product.id),
              limit(5)
            );
            const commentSnap = await getDocs(commentQuery);
            return [
              product.id,
              commentSnap.docs
                .map((commentDoc) => ({
                  id: commentDoc.id,
                  ...commentDoc.data(),
                }))
                .sort((a, b) => {
                  const aTime = a.createdAt?.toMillis?.() || 0;
                  const bTime = b.createdAt?.toMillis?.() || 0;
                  return bTime - aTime;
                }),
            ];
          })
        );

        setComments(Object.fromEntries(commentEntries));
      } catch (err) {
        console.error("Marketplace load failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const addComment = async (product) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Login first");
      navigate("/signup");
      return;
    }

    const text = commentDrafts[product.id]?.trim();
    if (!text) return;

    const docRef = await addDoc(collection(db, "merchant_product_comments"), {
      productId: product.id,
      merchantId: product.merchantId,
      uid: user.uid,
      userName: safeDisplayName(user.displayName, "Buyer"),
      text,
      createdAt: serverTimestamp(),
    });

    setComments({
      ...comments,
      [product.id]: [
        {
          id: docRef.id,
          productId: product.id,
          userName: safeDisplayName(user.displayName, "Buyer"),
          text,
        },
        ...(comments[product.id] || []),
      ],
    });
    setCommentDrafts({ ...commentDrafts, [product.id]: "" });
  };

  const openDealPanel = async (product) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Login first");
      navigate("/signup");
      return;
    }

    if (product.merchantId === user.uid) {
      alert("You cannot buy your own product");
      return;
    }

    setSelectedProduct(product);
    setDealLoading(true);
    setActiveOrder(null);
    setOrderMessages([]);

    try {
      const orderQuery = query(
        collection(db, "merchant_orders"),
        where("productId", "==", product.id),
        where("buyerId", "==", user.uid),
        limit(1)
      );
      const orderSnap = await getDocs(orderQuery);

      let order = null;

      if (orderSnap.empty) {
        const docRef = await addDoc(collection(db, "merchant_orders"), {
          productId: product.id,
          productName: product.name,
          buyerId: user.uid,
          buyerName: safeDisplayName(user.displayName, "Buyer"),
          merchantId: product.merchantId,
          merchantName: product.merchantName || "Merchant",
          amount: Number(product.price),
          currency: product.currency || "PARAG",
          paymentMethod: "google_billing",
          paymentStatus: "not_started",
          ...buildProductMessagePayload(product),
          status: "chat_open",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        order = {
          id: docRef.id,
          productId: product.id,
          productName: product.name,
          buyerId: user.uid,
          merchantId: product.merchantId,
          amount: Number(product.price),
          currency: product.currency || "PARAG",
          paymentMethod: "google_billing",
          paymentStatus: "not_started",
          ...buildProductMessagePayload(product),
          status: "chat_open",
        };
      } else {
        const orderDoc = orderSnap.docs[0];
        order = { id: orderDoc.id, ...orderDoc.data() };
      }

      setActiveOrder(order);
      await loadOrderMessages(order);
    } catch (err) {
      console.error("Could not open deal panel:", err);
      alert(err.message);
    } finally {
      setDealLoading(false);
    }
  };

  const loadOrderMessages = async (order) => {
    const user = auth.currentUser;
    if (!user || !order) return;

    const messageQuery = query(
      collection(db, "merchant_order_messages"),
      where("orderId", "==", order.id),
      where("buyerId", "==", user.uid),
      limit(50)
    );
    const messageSnap = await getDocs(messageQuery);

    setOrderMessages(
      messageSnap.docs
        .map((messageDoc) => ({
          id: messageDoc.id,
          ...messageDoc.data(),
        }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        })
    );
  };

  const sendDealMessage = async () => {
    const user = auth.currentUser;
    if (!user || !activeOrder || !dealMessage.trim()) return;

    const text = dealMessage.trim();
    const productPayload = buildProductMessagePayload(selectedProduct || activeOrder);
    const docRef = await addDoc(collection(db, "merchant_order_messages"), {
      orderId: activeOrder.id,
      productId: activeOrder.productId,
      productName: activeOrder.productName || selectedProduct?.name || "Product request",
      buyerId: activeOrder.buyerId,
      buyerName: safeDisplayName(activeOrder.buyerName || user.displayName, "Buyer"),
      merchantId: activeOrder.merchantId,
      merchantName: activeOrder.merchantName || selectedProduct?.merchantName || "Merchant",
      amount: activeOrder.amount || Number(selectedProduct?.price || 0),
      currency: activeOrder.currency || selectedProduct?.currency || "PARAG",
      ...productPayload,
      senderId: user.uid,
      senderName: safeDisplayName(user.displayName, "User"),
      text,
      createdAt: serverTimestamp(),
    });

    setOrderMessages([
      ...orderMessages,
      {
        id: docRef.id,
        senderId: user.uid,
        senderName: safeDisplayName(user.displayName, "User"),
        text,
        ...productPayload,
      },
    ]);
    setDealMessage("");
  };

  const requestGoogleBillingPayment = async () => {
    const user = auth.currentUser;
    if (!user || !activeOrder || !selectedProduct) return;
    const selectedCurrency = selectedProduct.currency || activeOrder.currency || "PARAG";

    await addDoc(collection(db, "merchant_payment_requests"), {
      orderId: activeOrder.id,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      buyerId: activeOrder.buyerId,
      buyerName: safeDisplayName(activeOrder.buyerName || user.displayName, "Buyer"),
      merchantId: activeOrder.merchantId,
      merchantName: activeOrder.merchantName || selectedProduct.merchantName || "Merchant",
      amount: Number(selectedProduct.price),
      currency: selectedCurrency,
      paymentProvider: selectedCurrency.toLowerCase(),
      status: "payment_started",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const paymentMessage = `${selectedCurrency} payment started for ${selectedProduct.name}.`;
    const docRef = await addDoc(collection(db, "merchant_order_messages"), {
      orderId: activeOrder.id,
      productId: activeOrder.productId,
      productName: activeOrder.productName || selectedProduct.name || "Product request",
      buyerId: activeOrder.buyerId,
      buyerName: safeDisplayName(activeOrder.buyerName || user.displayName, "Buyer"),
      merchantId: activeOrder.merchantId,
      merchantName: activeOrder.merchantName || selectedProduct.merchantName || "Merchant",
      amount: Number(selectedProduct.price),
      currency: selectedCurrency,
      paymentProvider: selectedCurrency.toLowerCase(),
      ...buildProductMessagePayload(selectedProduct),
      senderId: user.uid,
      senderName: safeDisplayName(user.displayName, "Buyer"),
      text: paymentMessage,
      createdAt: serverTimestamp(),
    });

    setOrderMessages([
      ...orderMessages,
      {
        id: docRef.id,
        senderId: user.uid,
        senderName: safeDisplayName(user.displayName, "Buyer"),
        text: paymentMessage,
        ...buildProductMessagePayload(selectedProduct),
      },
    ]);
    setActiveOrder({
      ...activeOrder,
      paymentMethod: "google_billing",
      currency: selectedCurrency,
      paymentStatus: "payment_started",
      status: "payment_started",
    });

    alert(`${selectedCurrency} payment started. Complete the payment flow to finish the purchase.`);
  };

  if (loading) {
    return <main style={pageStyle}>Loading marketplace...</main>;
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <section style={emptyStyle}>
          Marketplace could not load. {error}
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Paragon marketplace</p>
          <h1 style={titleStyle}>Digital Products</h1>
        </div>
        <button onClick={() => navigate("/onboarding/merchant")} style={primaryBtnStyle}>
          Sell Product
        </button>
        <button onClick={() => navigate("/buyer-inbox")} style={secondaryBtnStyle}>
          Buyer Inbox
        </button>
      </section>

      <section style={aboutPanelStyle}>
        <button
          type="button"
          onClick={() => setShowMerchantAbout((value) => !value)}
          style={secondaryBtnStyle}
        >
          {showMerchantAbout ? "Hide About The Merchants" : "About The Merchants"}
        </button>
        {showMerchantAbout && <MerchantAboutContent />}
      </section>

      {products.length === 0 ? (
        <section style={emptyStyle}>No merchant products yet.</section>
      ) : (
        <section style={gridStyle}>
          {products.map((product) => (
            <article key={product.id} style={cardStyle}>
              <MerchantProductMedia product={product} style={mediaStyle} />

              <div style={cardBodyStyle}>
                <p style={merchantStyle}>{product.merchantName}</p>
                <h2 style={productTitleStyle}>{product.name}</h2>
                <p>{product.description}</p>
                <p style={materialsStyle}>Materials: {product.materials}</p>
                <strong>{product.price} {product.currency || "PARAG"}</strong>

                <button onClick={() => openDealPanel(product)} style={primaryBtnStyle}>
                  Chat / Agree Deal
                </button>

                <div style={privateNoteStyle}>
                  Questions and price discussions stay inside the private deal inbox.
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedProduct && (
        <div style={modalBackdropStyle} onClick={() => setSelectedProduct(null)}>
          <section style={dealPanelStyle} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedProduct(null)} style={closeBtnStyle}>
              Close
            </button>

            <p style={eyebrowStyle}>Private buyer and merchant space</p>
            <h2 style={productTitleStyle}>{selectedProduct.name}</h2>
            <p>{selectedProduct.description}</p>
            <p style={materialsStyle}>Materials: {selectedProduct.materials}</p>
            <strong>{selectedProduct.price} {selectedProduct.currency || "PARAG"}</strong>

            {dealLoading ? (
              <p>Opening private deal...</p>
            ) : (
              <>
                <div style={messageListStyle}>
                  {orderMessages.length === 0 ? (
                    <p style={materialsStyle}>
                      Start the conversation with the merchant. Discuss quantity,
                      delivery, pickup, and final agreement here.
                    </p>
                  ) : (
                    orderMessages.map((message) => (
                      <div key={message.id} style={messageCardStyle}>
                        {hasMessageProductMedia(message) && (
                          <MerchantProductMedia
                            product={getMessageProduct(message)}
                            style={messageMediaStyle}
                          />
                        )}
                        <p style={messageStyle}>
                          <b>{safeDisplayName(message.senderName, "Member")}:</b> {message.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div style={commentInputRowStyle}>
                  <input
                    value={dealMessage}
                    onChange={(e) => setDealMessage(e.target.value)}
                    placeholder="Message the merchant privately"
                    style={inputStyle}
                  />
                  <button onClick={sendDealMessage} style={smallBtnStyle}>
                    Send
                  </button>
                </div>

                <button onClick={requestGoogleBillingPayment} style={paymentBtnStyle}>
                  Start Payment
                </button>
                <p style={finePrintStyle}>
                  Buyers pay with the currency selected by the merchant for this product.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function MerchantAboutContent() {
  return (
    <div style={aboutBoxStyle}>
      <h2 style={{ marginTop: 0 }}>About The Merchants</h2>
      <p>
        Paragon Planet Merchants are users within the Paragon Planet ecosystem who are authorized
        to upload, showcase, promote, negotiate, and sell digital products and software-based
        services to buyers across the Planet.
      </p>
      <p>
        Any user within the ecosystem may qualify to operate as a Merchant by creating and listing
        approved digital products through their respective Merchant spaces within the Platform.
      </p>
      <p>
        Merchants are expected to upload their digital products together with their respective
        prices, descriptions, previews, and delivery information for interested buyers to view,
        negotiate, bargain, and agree upon the actual purchase price.
      </p>
      <p>
        The Merchant system allows direct interaction between sellers and buyers through
        communication, negotiations, offers, and agreements within the Paragon Planet marketplace
        environment.
      </p>
      <p>The categories of products that may be sold by Merchants include:</p>
      <ul>
        {MERCHANT_PRODUCT_CATEGORIES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        Payments for approved digital products may be processed through supported digital billing
        systems, including Google Billing and other authorized payment systems integrated into the
        Platform.
      </p>
      <p>Within the transaction structure:</p>
      <ul>
        <li>
          Payment processors may collect service percentages for transaction processing, buyer
          protection, payment security, and digital distribution management.
        </li>
        <li>
          Paragon Planet Administration may also receive a platform percentage for product
          marketing, promotion, marketplace maintenance, visibility systems, and ecosystem
          operations.
        </li>
        <li>
          Merchants may withdraw their approved earnings through their respective wallets within
          the Platform according to the financial policies of Paragon Planet.
        </li>
      </ul>
      <p>Merchants are expected to:</p>
      <ul>
        {MERCHANT_EXPECTATIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        The Merchant system is designed to transform creators, developers, innovators, educators,
        designers, and digital entrepreneurs into recognized marketplace sellers within the
        Paragon Planet ecosystem.
      </p>
      <p>
        As Merchants gain sales, visibility, customer trust, ratings, and audience engagement,
        they unlock greater marketplace exposure, promotional advantages, rewards, rankings, and
        business opportunities within the Planet.
      </p>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "96px 24px 48px",
  background: "#f7f3ea",
  color: "#1f2933",
};

const heroStyle = {
  maxWidth: 1160,
  margin: "0 auto 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = { margin: "6px 0", fontSize: 34 };
const copyStyle = { margin: 0, color: "#52616b" };

const aboutPanelStyle = {
  maxWidth: 1160,
  margin: "0 auto 24px",
  padding: 18,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
};

const aboutBoxStyle = {
  marginTop: 16,
  padding: 18,
  borderRadius: 8,
  border: "1px solid #e2d8c8",
  background: "#fff",
  color: "#1f2933",
  lineHeight: 1.65,
};

const gridStyle = {
  maxWidth: 1160,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 18,
};

const cardStyle = {
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  overflow: "hidden",
};

const mediaStyle = {
  width: "100%",
  aspectRatio: "4 / 3",
  objectFit: "cover",
  display: "block",
  background: "#eee",
};

const cardBodyStyle = { padding: 16 };
const merchantStyle = { margin: 0, color: "#6b5f4b", fontWeight: 700 };
const productTitleStyle = { margin: "6px 0", fontSize: 22 };
const materialsStyle = { color: "#52616b" };

const primaryBtnStyle = {
  padding: "10px 16px",
  marginTop: 12,
  background: "#176b4d",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtnStyle = {
  padding: "10px 16px",
  marginTop: 12,
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const commentInputRowStyle = {
  display: "flex",
  gap: 8,
  marginTop: 10,
};

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "9px 10px",
  border: "1px solid #c9c0b2",
  borderRadius: 6,
};

const smallBtnStyle = {
  padding: "9px 12px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const privateNoteStyle = {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 6,
  border: "1px solid #e2d8c8",
  background: "#fff8e8",
  color: "#1f2933",
  fontWeight: 700,
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 3000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
};

const dealPanelStyle = {
  width: "min(680px, 100%)",
  maxHeight: "88vh",
  overflowY: "auto",
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  padding: 20,
  boxSizing: "border-box",
};

const closeBtnStyle = {
  float: "right",
  padding: "8px 12px",
  border: "none",
  borderRadius: 6,
  background: "#1f2933",
  color: "#fff",
  cursor: "pointer",
};

const messageListStyle = {
  marginTop: 14,
  padding: 12,
  background: "#f7f3ea",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
  maxHeight: 240,
  overflowY: "auto",
};

const messageStyle = {
  margin: "8px 0",
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

const paymentBtnStyle = {
  ...primaryBtnStyle,
  width: "100%",
  marginTop: 14,
  background: "#0f5f46",
};

const finePrintStyle = {
  margin: "8px 0 0",
  color: "#52616b",
  fontSize: 13,
};

const emptyStyle = {
  maxWidth: 1160,
  margin: "0 auto",
  padding: 24,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
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
