import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteUser } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import MerchantProductMedia from "../components/MerchantProductMedia";
import { API_URL as BACKEND_URL, appCheckFetch } from "../lib/supportActions";
import { savePublicProfile } from "../lib/publicProfile";

const PROFILE_FIELDS = [
  ["storeName", "Store / Brand name"],
  ["realName", "Real name"],
  ["gender", "Gender"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["country", "Country"],
  ["state", "State"],
];

const DIGITAL_PRODUCT_TYPES = [
  {
    key: "ebooks",
    title: "E-books",
    verdict: "Very good",
    bestFor: "Talent guides, dance tutorials, fitness plans, acting lessons, comedy writing, motivational books.",
    examples: ["How To Become A Viral Dancer", "Music Promotion Guide", "Nigerian Fashion Design Secrets"],
  },
  {
    key: "notion_templates",
    title: "Notion Templates",
    verdict: "Good",
    bestFor: "Entrepreneurs, students, creators, and influencers.",
    examples: ["Budget tracker", "Creator planner", "Contest planner", "Social media planner"],
  },
  {
    key: "canva_templates",
    title: "Canva Templates",
    verdict: "Very good",
    bestFor: "Flyers, social posts, thumbnails, resumes, and event banners.",
    examples: ["Flyer templates", "Instagram post templates", "YouTube thumbnail templates", "Resume templates"],
  },
  {
    key: "printables",
    title: "Printables",
    verdict: "Good",
    bestFor: "Teachers, students, planners, and business forms.",
    examples: ["Wedding planners", "Workout sheets", "Meal planners", "Church programs"],
  },
  {
    key: "mini_courses",
    title: "Mini Courses",
    verdict: "Excellent",
    bestFor: "Video lessons, subscriptions, course access fees, and premium memberships.",
    examples: ["Singing lessons", "Dance classes", "Fitness classes", "Acting classes", "Coding tutorials"],
  },
  {
    key: "presets_filters",
    title: "Presets & Filters",
    verdict: "Very good",
    bestFor: "Photographers, influencers, and video editors.",
    examples: ["Lightroom presets", "TikTok filters", "Cinematic LUTs"],
  },
  {
    key: "swipe_files",
    title: "Swipe Files",
    verdict: "Good",
    bestFor: "Marketers, influencers, and business creators.",
    examples: ["Caption packs", "Ad templates", "Viral hooks", "Email templates"],
  },
  {
    key: "toolkits_bundles",
    title: "Toolkits & Bundles",
    verdict: "Extremely good",
    bestFor: "High-value creator starter packs and bundled resources.",
    examples: ["Canva templates", "Caption ideas", "Video hooks", "Thumbnail packs", "Music pack"],
  },
  {
    key: "digital_wallpapers",
    title: "Digital Wallpapers",
    verdict: "Good",
    bestFor: "Simple, profitable visual products.",
    examples: ["Anime wallpapers", "Motivational wallpapers", "Celebrity wallpapers", "African art wallpapers"],
  },
  {
    key: "video_products",
    title: "Video Products",
    verdict: "Very good",
    bestFor: "Short videos, tutorials, video packs, lessons, promos, and downloadable video content.",
    examples: ["Dance tutorial videos", "Fitness video packs", "Acting lessons", "Promo video templates"],
  },
  {
    key: "audio_products",
    title: "Audio Products",
    verdict: "Excellent",
    bestFor: "Meditation, prayer, voice packs, podcasts, audiobooks, beats, and music loops.",
    examples: ["Meditation audio", "Prayer audio", "Voice packs", "Podcasts", "Audiobooks", "Beats/music loops"],
  },
];

const PAYMENT_OPTIONS = ["Parag coins", "Google Billing", "Paystack"];

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

const initialProfile = {
  ...PROFILE_FIELDS.reduce((acc, [key]) => ({ ...acc, [key]: "" }), {}),
  productTypes: [],
  paymentMethods: ["Parag coins"],
};

const initialProduct = {
  name: "",
  category: DIGITAL_PRODUCT_TYPES[0].key,
  description: "",
  materials: "",
  price: "",
  currency: "PARAG",
  mediaUrl: "",
};

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".ogg",
  ".ogv",
  ".m3u8",
];

const MAX_PRODUCT_VIDEO_MB = 50;
const MAX_PRODUCT_VIDEO_BYTES = MAX_PRODUCT_VIDEO_MB * 1024 * 1024;

async function readJsonResponse(res) {
  const text = await res.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: res.ok
        ? "The server returned an unexpected response."
        : `Upload server returned ${res.status}. Please try again.`,
    };
  }
}

function getMediaType({ file, url, storedType }) {
  if (storedType === "video") return "video";
  if (storedType === "image") {
    const normalizedStoredUrl = String(url || "").toLowerCase().split("?")[0];
    if (!VIDEO_EXTENSIONS.some((extension) => normalizedStoredUrl.includes(extension))) {
      return "image";
    }
  }

  if (file?.type?.startsWith("video/")) return "video";
  if (file?.type?.startsWith("image/")) return "image";

  const normalizedUrl = String(url || "").toLowerCase().split("?")[0];
  return VIDEO_EXTENSIONS.some((extension) => normalizedUrl.includes(extension))
    ? "video"
    : "image";
}

export default function MerchantOnboarding() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [profile, setProfile] = useState(initialProfile);
  const [product, setProduct] = useState(initialProduct);
  const [mediaFile, setMediaFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderMessages, setOrderMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [finalOfferAmount, setFinalOfferAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryLinks, setDeliveryLinks] = useState("");
  const [deliveryCodes, setDeliveryCodes] = useState("");
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProduct, setUploadingProduct] = useState(false);
  const [productUploadProgress, setProductUploadProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [showMerchantAbout, setShowMerchantAbout] = useState(false);

  useEffect(() => {
    const loadMerchantData = async () => {
      if (!user) return;

      const profileSnap = await getDoc(doc(db, "merchant_profiles", user.uid));
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setProfile((prev) => ({
          ...prev,
          ...data,
          productTypes: Array.isArray(data.productTypes) ? data.productTypes : [],
          paymentMethods: Array.isArray(data.paymentMethods) && data.paymentMethods.length
            ? data.paymentMethods
            : ["Parag coins"],
        }));
        setProfileExists(true);
        setEditingProfile(false);
      } else if (user.email) {
        setProfile((prev) => ({ ...prev, email: user.email }));
        setEditingProfile(true);
      }

      const productQuery = query(
        collection(db, "merchant_products"),
        where("merchantId", "==", user.uid)
      );
      const productSnap = await getDocs(productQuery);
      setProducts(
        productSnap.docs
          .map((productDoc) => ({
            id: productDoc.id,
            ...productDoc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          })
      );

      const orderQuery = query(
        collection(db, "merchant_orders"),
        where("merchantId", "==", user.uid),
        limit(50)
      );
      const orderSnap = await getDocs(orderQuery);
      const orderData = orderSnap.docs.map((orderDoc) => ({
        id: orderDoc.id,
        ...orderDoc.data(),
      }));

      const messageQuery = query(
        collection(db, "merchant_order_messages"),
        where("merchantId", "==", user.uid),
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
          buyerName: data.buyerName || data.senderName || "Buyer",
          merchantId: data.merchantId,
          amount: data.amount || 0,
          currency: data.currency || "PARAG",
          status: "chat_open",
          escrowStatus: "not_requested",
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
    };

    loadMerchantData();
  }, [user]);

  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProductChange = (e) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const toggleProfileListValue = (field, value) => {
    const currentValues = Array.isArray(profile[field]) ? profile[field] : [];
    setProfile({
      ...profile,
      [field]: currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
    });
  };

  const handleMediaFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;

    if (
      selectedFile?.type?.startsWith("video/") &&
      selectedFile.size > MAX_PRODUCT_VIDEO_BYTES
    ) {
      alert(`Video too large. Please upload a product video under ${MAX_PRODUCT_VIDEO_MB}MB.`);
      e.target.value = "";
      setMediaFile(null);
      return;
    }

    setMediaFile(selectedFile);
  };

  const uploadMediaFile = async () => {
    if (!mediaFile) {
      const pastedUrl = product.mediaUrl.trim();
      return {
        url: pastedUrl,
        fileName: "",
        isUploadedFile: false,
      };
    }

    setProductUploadProgress(0);

    const token = await user.getIdToken();
    const res = await appCheckFetch(`${BACKEND_URL}/generate-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: `merchant-${mediaFile.name}`,
        fileType: mediaFile.type,
        title: product.name.trim(),
        description: product.description.trim(),
        category: product.category || DIGITAL_PRODUCT_TYPES[0].key,
        uploadPurpose: "merchant_product",
      }),
    });

    const data = await readJsonResponse(res);
    if (!res.ok) throw new Error(data.error || "Could not prepare upload");

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.uploadUrl);
      xhr.setRequestHeader("Content-Type", mediaFile.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProductUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProductUploadProgress(100);
          resolve();
        }
        else reject(new Error("Product media upload failed"));
      };
      xhr.onerror = () => reject(new Error("Product media upload failed"));
      xhr.send(mediaFile);
    });

    return {
      url: data.fileUrl,
      fileName: data.fileName,
      isUploadedFile: true,
    };
  };

  const saveProfile = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Login first");
      navigate("/login");
      return;
    }

    if (!profile.storeName || !profile.realName || !profile.phone || !profile.country) {
      alert("Store name, real name, phone, and country are required");
      return;
    }

    if (!profile.productTypes?.length) {
      alert("Select at least one digital product type");
      return;
    }

    if (!profile.paymentMethods?.length) {
      alert("Select at least one payment method");
      return;
    }

    setSavingProfile(true);
    setMessage("");

    try {
      const profileRef = doc(db, "merchant_profiles", currentUser.uid);
      const profileSnap = await getDoc(profileRef);
      const profileData = {
        ...profile,
        uid: currentUser.uid,
        role: "MERCHANT",
        status: "active",
        productTypes: profile.productTypes || [],
        paymentMethods: profile.paymentMethods || [],
        updatedAt: serverTimestamp(),
      };

      if (!profileSnap.exists()) {
        profileData.createdAt = serverTimestamp();
      }

      await setDoc(
        profileRef,
        profileData,
        { merge: true }
      );
      await savePublicProfile(currentUser.uid, "Merchant", profileData);

      setMessage("Merchant profile saved.");
      setProfileExists(true);
      setEditingProfile(false);
      alert("Merchant profile saved successfully");
      navigate("/profile", { replace: true });
    } catch (err) {
      console.error("Merchant profile save failed:", err);
      alert(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadProduct = async () => {
    if (!user) return;
    if (!product.name || !product.description || !product.materials || !product.price) {
      alert("Product name, description, materials, and price are required");
      return;
    }

    if (
      mediaFile?.type?.startsWith("video/") &&
      mediaFile.size > MAX_PRODUCT_VIDEO_BYTES
    ) {
      alert(`Video too large. Please upload a product video under ${MAX_PRODUCT_VIDEO_MB}MB.`);
      return;
    }

    setUploadingProduct(true);
    setProductUploadProgress(0);
    setMessage("");

    try {
      const profileSnap = await getDoc(doc(db, "merchant_profiles", user.uid));
      if (!profileSnap.exists()) {
        alert("Save your merchant profile before uploading products");
        return;
      }

      const uploadedMedia = await uploadMediaFile();
      const mediaUrl = uploadedMedia.url;
      if (!mediaUrl) {
        alert("Upload a product image/video or paste a media URL");
        return;
      }

      const mediaType = getMediaType({ file: mediaFile, url: mediaUrl });
      const isVideo = mediaType === "video";

      const docRef = await addDoc(collection(db, "merchant_products"), {
        merchantId: user.uid,
        merchantName: profile.realName || user.email || "Merchant",
        name: product.name.trim(),
        description: product.description.trim(),
        materials: product.materials.trim(),
        price: Number(product.price),
        currency: product.currency || "PARAG",
        mediaUrl,
        originalUrl: mediaUrl,
        streamUrl: mediaUrl,
        sourceFileName: uploadedMedia.fileName,
        mediaType,
        processingStatus: isVideo && uploadedMedia.isUploadedFile ? "processing" : "ready",
        category: product.category || DIGITAL_PRODUCT_TYPES[0].key,
        uploadPurpose: "merchant_product",
        visibility: "marketplace",
        source: "merchant_product_upload",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (isVideo && uploadedMedia.isUploadedFile) {
        appCheckFetch(`${BACKEND_URL}/trigger-merchant-product-compression`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await user.getIdToken()}`,
          },
          body: JSON.stringify({
            productId: docRef.id,
            fileName: uploadedMedia.fileName,
            originalUrl: mediaUrl,
          }),
        }).catch((err) => {
          console.warn("Merchant product compression trigger failed:", err);
        });
      }

      setProducts([
        {
          id: docRef.id,
          merchantId: user.uid,
          merchantName: profile.realName || user.email || "Merchant",
          ...product,
          price: Number(product.price),
          currency: product.currency || "PARAG",
          mediaUrl,
          originalUrl: mediaUrl,
          streamUrl: mediaUrl,
          sourceFileName: uploadedMedia.fileName,
          mediaType,
          processingStatus: isVideo && uploadedMedia.isUploadedFile ? "processing" : "ready",
          status: "active",
        },
        ...products,
      ]);

      setProduct(initialProduct);
      setMediaFile(null);
      setProductUploadProgress(0);
      setMessage("Product uploaded to the marketplace.");
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingProduct(false);
    }
  };

  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, "merchant_products", id));
    setProducts(products.filter((item) => item.id !== id));
  };

  const deleteAccount = async () => {
    if (!user) return;
    const confirmDelete = window.confirm("Delete this merchant account?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "merchant_profiles", user.uid));
    await deleteDoc(doc(db, "public_profiles", user.uid));
    await deleteUser(user);
    navigate("/");
  };

  const openOrder = async (order) => {
    if (!user) return;

    // Refresh order from Firestore to get latest status
    try {
      const orderSnap = await getDoc(doc(db, "merchant_orders", order.id));
      if (orderSnap.exists()) {
        setSelectedOrder({ id: orderSnap.id, ...orderSnap.data() });
        setFinalOfferAmount(String(orderSnap.data()?.amount || order.amount || ""));
      } else {
        setSelectedOrder(order);
        setFinalOfferAmount(String(order.amount || ""));
      }
    } catch {
      setSelectedOrder(order);
      setFinalOfferAmount(String(order.amount || ""));
    }

    const messageQuery = query(
      collection(db, "merchant_order_messages"),
      where("orderId", "==", order.id),
      where("merchantId", "==", user.uid),
      limit(50)
    );
    const messageSnap = await getDocs(messageQuery);
    await markOrderMessagesAsRead(user.uid, messageSnap.docs);

    setOrderMessages(
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

  const sendMerchantReply = async () => {
    if (!user || !selectedOrder || !replyText.trim()) return;

    const text = replyText.trim();
    const senderName = profile.realName || user.email || "Merchant";
    const productPayload = buildProductMessagePayload(selectedOrder);
    const docRef = await addDoc(collection(db, "merchant_order_messages"), {
      orderId: selectedOrder.id,
      productId: selectedOrder.productId,
      productName: selectedOrder.productName || "Product request",
      ...productPayload,
      buyerId: selectedOrder.buyerId,
      merchantId: selectedOrder.merchantId,
      senderId: user.uid,
      senderName,
      text,
      readBy: [user.uid],
      createdAt: serverTimestamp(),
    });

    try {
      await addDoc(collection(db, "direct_messages"), {
        chatId: buildChatId(selectedOrder.buyerId, selectedOrder.merchantId),
        participantIds: [selectedOrder.buyerId, selectedOrder.merchantId].sort(),
        senderId: user.uid,
        senderName,
        senderRole: "Merchant",
        recipientId: selectedOrder.buyerId,
        recipientName: selectedOrder.buyerName || "Buyer",
        recipientRole: "Member",
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

    setOrderMessages([
      ...orderMessages,
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

  const sendFinalOffer = async () => {
    if (!user || !selectedOrder) return;
    const amount = Number(finalOfferAmount);
    if (!amount || amount <= 0) {
      alert("Enter a valid final offer amount.");
      return;
    }
    if (!window.confirm(`Send a final offer of ${amount} ${selectedOrder.currency || "PARAG"} to the buyer?`)) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, "merchant_orders", selectedOrder.id), {
        status: "final_offer_sent",
        amount,
        updatedAt: serverTimestamp(),
      });

      const senderName = profile.realName || user.email || "Merchant";
      const productPayload = buildProductMessagePayload(selectedOrder);
      await addDoc(collection(db, "merchant_order_messages"), {
        orderId: selectedOrder.id,
        productId: selectedOrder.productId,
        productName: selectedOrder.productName || "Product request",
        ...productPayload,
        buyerId: selectedOrder.buyerId,
        merchantId: selectedOrder.merchantId,
        senderId: user.uid,
        senderName,
        text: `📋 Final Offer: ${amount} ${selectedOrder.currency || "PARAG"}. Please accept and pay from your wallet to proceed.`,
        type: "final_offer",
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      });

      setSelectedOrder((prev) => ({ ...prev, status: "final_offer_sent", amount }));
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "final_offer_sent", amount } : o))
      );
      alert("Final offer sent to buyer.");
    } catch (err) {
      console.error("Send final offer failed:", err);
      alert(`Could not send final offer: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const markAsDelivered = async () => {
    if (!user || !selectedOrder) return;
    if (!window.confirm("Submit delivery? You can include download links, access codes, and notes for the buyer.")) return;

    setActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const links = deliveryLinks.split("\n").map((l) => l.trim()).filter(Boolean);
      const accessCodes = deliveryCodes.split("\n").map((c) => c.trim()).filter(Boolean);

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || ""}/api/marketplace/deliver`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            deliveryNote: deliveryNote.trim(),
            links,
            accessCodes,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Delivery submission failed");
      }

      setSelectedOrder((prev) => ({ ...prev, status: "delivering" }));
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "delivering" } : o))
      );
      setShowDeliveryForm(false);
      setDeliveryNote("");
      setDeliveryLinks("");
      setDeliveryCodes("");
      alert("Delivery submitted. Waiting for buyer confirmation.");
    } catch (err) {
      console.error("Mark as delivered failed:", err);
      alert(`Could not submit delivery: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={topActionStyle}>
        <button type="button" onClick={() => navigate(-1)} style={secondaryBtnStyle}>
          Go Back
        </button>
      </div>
      <section style={panelStyle}>
        <button
          type="button"
          onClick={() => setShowMerchantAbout((value) => !value)}
          style={secondaryBtnStyle}
        >
          {showMerchantAbout ? "Hide About The Merchants" : "About The Merchants"}
        </button>
        {showMerchantAbout && <MerchantAboutContent />}
      </section>
      {editingProfile ? (
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Paragon merchant</p>
              <h1 style={titleStyle}>
                {profileExists ? "Edit Merchant Profile" : "Merchant Registration"}
              </h1>
              <p style={mutedStyle}>
                Register as a digital merchant and declare what you want to sell on Paragon Planet.
              </p>
            </div>
            <button onClick={() => navigate("/marketplace")} style={secondaryBtnStyle}>
              Marketplace
            </button>
          </div>

          <h2 style={subtitleStyle}>Identity</h2>
          <div style={gridStyle}>
            {PROFILE_FIELDS.map(([key, label]) => (
              <label key={key} style={labelStyle}>
                {label}
                <input
                  name={key}
                  value={profile[key] || ""}
                  onChange={handleProfileChange}
                  style={inputStyle}
                />
              </label>
            ))}
          </div>

          <h2 style={subtitleStyle}>Digital products you want to sell</h2>
          <div style={digitalGridStyle}>
            {DIGITAL_PRODUCT_TYPES.map((type) => {
              const selected = profile.productTypes?.includes(type.key);
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => toggleProfileListValue("productTypes", type.key)}
                  style={{ ...digitalCardStyle, ...(selected ? digitalCardActiveStyle : null) }}
                >
                  <div style={digitalCardHeaderStyle}>
                    <strong>{type.title}</strong>
                    <span style={digitalBadgeStyle}>{type.verdict}</span>
                  </div>
                  <p style={digitalTextStyle}>{type.bestFor}</p>
                  <div style={chipRowStyle}>
                    {type.examples.map((example) => (
                      <span key={example} style={chipStyle}>{example}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <h2 style={subtitleStyle}>Payment methods</h2>
          <div style={checkboxGridStyle}>
            {PAYMENT_OPTIONS.map((option) => (
              <label key={option} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={profile.paymentMethods?.includes(option)}
                  onChange={() => toggleProfileListValue("paymentMethods", option)}
                />
                {option}
              </label>
            ))}
          </div>

          <button onClick={saveProfile} style={primaryBtnStyle} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
          {profileExists && (
            <button
              onClick={() => setEditingProfile(false)}
              style={{ ...secondaryBtnStyle, marginLeft: 10 }}
              type="button"
            >
              Cancel
            </button>
          )}
        </section>
      ) : (
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={eyebrowStyle}>Paragon merchant</p>
              <h1 style={titleStyle}>Merchant Center</h1>
              <p style={mutedStyle}>
                Manage digital products, buyer requests, and marketplace uploads.
              </p>
            </div>
            <div style={buttonRowStyle}>
              <button onClick={() => setEditingProfile(true)} style={secondaryBtnStyle}>
                Edit Profile
              </button>
              <button onClick={() => navigate("/marketplace")} style={secondaryBtnStyle}>
                Marketplace
              </button>
            </div>
          </div>
        </section>
      )}

      <section style={panelStyle}>
        <p style={eyebrowStyle}>Digital marketplace</p>
        <h2 style={subtitleStyle}>Upload Product</h2>

        <div style={gridStyle}>
          <label style={labelStyle}>
            Product name
            <input
              name="name"
              value={product.name}
              onChange={handleProductChange}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Product type
            <select
              name="category"
              value={product.category}
              onChange={handleProductChange}
              style={inputStyle}
            >
              {DIGITAL_PRODUCT_TYPES.map((type) => (
                <option key={type.key} value={type.key}>{type.title}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Price
            <div style={priceInputRowStyle}>
              <input
                type="number"
                min="1"
                name="price"
                value={product.price}
                onChange={handleProductChange}
                placeholder="Enter amount"
                style={inputStyle}
              />
              <select
                name="currency"
                value={product.currency || "PARAG"}
                onChange={handleProductChange}
                style={currencySelectStyle}
              >
                <option value="PARAG">PARAG</option>
                <option value="GBAZILO">GBAZILO</option>
              </select>
            </div>
          </label>
        </div>

        <label style={labelStyle}>
          Description
          <textarea
            name="description"
            value={product.description}
            onChange={handleProductChange}
            style={textareaStyle}
          />
        </label>

        <label style={labelStyle}>
          What the buyer gets
          <textarea
            name="materials"
            value={product.materials}
            onChange={handleProductChange}
            style={textareaStyle}
            placeholder="Example: PDF guide, Canva template link, audio pack, video course access, or downloadable files."
          />
        </label>

        <label style={labelStyle}>
          Product image or video
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaFileChange}
            style={fileStyle}
          />
          <span style={hintStyle}>
            Product videos must be under {MAX_PRODUCT_VIDEO_MB}MB. Images can stay as normal pictures.
          </span>
        </label>

        <label style={labelStyle}>
          Or paste image/video URL
          <input
            name="mediaUrl"
            value={product.mediaUrl}
            onChange={handleProductChange}
            style={inputStyle}
          />
        </label>

        <div style={buttonRowStyle}>
          <button onClick={uploadProduct} style={primaryBtnStyle} disabled={uploadingProduct}>
            {uploadingProduct
              ? productUploadProgress > 0
                ? `Uploading ${productUploadProgress}%`
                : "Preparing upload..."
              : "Upload Product"}
          </button>
          <button onClick={() => navigate("/wallet")} style={secondaryBtnStyle}>
            Wallet
          </button>
          <button onClick={deleteAccount} style={dangerBtnStyle}>
            Delete Account
          </button>
        </div>

        {message && <p style={messageStyle}>{message}</p>}
        {uploadingProduct && (
          <div style={progressTrackStyle}>
            <div
              style={{
                ...progressFillStyle,
                width: `${productUploadProgress}%`,
              }}
            />
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={subtitleStyle}>Buyer Requests</h2>
        {orders.length === 0 ? (
          <p style={mutedStyle}>No buyer requests yet.</p>
        ) : (
          <div style={requestGridStyle}>
            <div>
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => openOrder(order)}
                  style={requestItemStyle}
                >
                  <strong>{order.productName}</strong>
                  <span>{order.buyerName}</span>
                  <span>{order.amount} {order.currency}</span>
                  <span style={{ color: merchantStatusColor(order.status) }}>{merchantStatusLabel(order.status)}</span>
                </button>
              ))}
            </div>

        <div style={chatPanelStyle}>
              {selectedOrder ? (
                <>
                  <p style={eyebrowStyle}>Private chat</p>
                  <h3>{selectedOrder.productName}</h3>
                  <p style={mutedStyle}>
                    Buyer: {selectedOrder.buyerName}
                    {" · "}
                    <span style={{ fontWeight: 700, color: merchantStatusColor(selectedOrder.status) }}>
                      {merchantStatusLabel(selectedOrder.status)}
                    </span>
                  </p>

                  <div style={messagesStyle}>
                    {orderMessages.length === 0 ? (
                      <p style={mutedStyle}>No messages yet.</p>
                    ) : (
                      orderMessages.map((chat) => (
                        <div key={chat.id} style={messageCardStyle}>
                          {hasMessageProductMedia(chat) && (
                            <MerchantProductMedia
                              product={getMessageProduct(chat)}
                              style={chatMediaStyle}
                            />
                          )}
                          <p style={chatTextStyle}>
                            <strong>{chat.senderName}:</strong> {chat.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedOrder.status !== "completed" && (
                    <div style={replyRowStyle}>
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Reply to buyer"
                        style={inputStyle}
                      />
                      <button onClick={sendMerchantReply} style={secondaryBtnStyle}>
                        Send
                      </button>
                    </div>
                  )}

                  {(selectedOrder.status === "chat_open" ||
                    selectedOrder.status === "negotiating" ||
                    selectedOrder.status === "final_offer_sent") && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="number"
                        min="0"
                        value={finalOfferAmount}
                        onChange={(e) => setFinalOfferAmount(e.target.value)}
                        placeholder="Final offer amount"
                        style={{ ...inputStyle, maxWidth: 160 }}
                      />
                      <span style={{ fontSize: 13, color: "#52616b" }}>{selectedOrder.currency || "PARAG"}</span>
                      <button
                        onClick={sendFinalOffer}
                        disabled={actionLoading}
                        style={primaryBtnStyle}
                      >
                        {actionLoading ? "Sending…" : "Send Final Offer"}
                      </button>
                    </div>
                  )}

                  {selectedOrder.status === "paid" || selectedOrder.status === "escrow_funded" ? (
                    showDeliveryForm ? (
                      <div style={{ marginTop: 12, padding: "14px 16px", background: "#f0fdf4", border: "1px solid #6ee7b7", borderRadius: 8 }}>
                        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#176b4d" }}>📦 Submit Delivery</p>
                        <textarea
                          value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          placeholder="Delivery note for the buyer…"
                          rows={2}
                          style={{ ...inputStyle, display: "block", width: "100%", marginBottom: 8, resize: "vertical", boxSizing: "border-box" }}
                        />
                        <textarea
                          value={deliveryLinks}
                          onChange={(e) => setDeliveryLinks(e.target.value)}
                          placeholder="Download links / URLs (one per line)"
                          rows={2}
                          style={{ ...inputStyle, display: "block", width: "100%", marginBottom: 8, resize: "vertical", boxSizing: "border-box" }}
                        />
                        <textarea
                          value={deliveryCodes}
                          onChange={(e) => setDeliveryCodes(e.target.value)}
                          placeholder="Access codes / license keys (one per line)"
                          rows={2}
                          style={{ ...inputStyle, display: "block", width: "100%", marginBottom: 8, resize: "vertical", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={markAsDelivered} disabled={actionLoading} style={{ ...primaryBtnStyle, flex: 1, marginTop: 0 }}>
                            {actionLoading ? "Submitting…" : "Submit Delivery"}
                          </button>
                          <button onClick={() => setShowDeliveryForm(false)} style={{ ...secondaryBtnStyle, flex: 1 }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeliveryForm(true)}
                        style={{ ...primaryBtnStyle, marginTop: 12 }}
                      >
                        Deliver Product
                      </button>
                    )
                  ) : null}

                  {selectedOrder.status === "completed" && (
                    <p style={{ marginTop: 12, color: "#176b4d", fontWeight: 700 }}>
                      ✅ Transaction completed. Payment has been released to your wallet.
                    </p>
                  )}

                  {selectedOrder.status === "disputed" && (
                    <MerchantDisputeResponse
                      order={selectedOrder}
                      onResponded={() => {
                        setSelectedOrder((prev) => ({ ...prev, status: "admin_review" }));
                        setOrders((prev) =>
                          prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "admin_review" } : o))
                        );
                      }}
                    />
                  )}

                  {selectedOrder.status === "admin_review" && (
                    <p style={{ marginTop: 12, color: "#6d28d9", fontWeight: 700 }}>
                      🔍 Under admin review. You will be notified of the decision.
                    </p>
                  )}

                  {["cancelled", "expired", "refunded", "closed"].includes(selectedOrder.status) && (
                    <p style={{ marginTop: 12, color: "#dc2626", fontWeight: 700 }}>
                      Order is {merchantStatusLabel(selectedOrder.status)}.
                    </p>
                  )}
                </>
              ) : (
                <p style={mutedStyle}>Select a buyer request to chat.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={subtitleStyle}>Your Products</h2>
        {products.length === 0 ? (
          <p style={mutedStyle}>No products uploaded yet.</p>
        ) : (
          <div style={productGridStyle}>
            {products.map((item) => (
              <article key={item.id} style={productCardStyle}>
                <MerchantProductMedia product={item} style={mediaStyle} />
                <h3>{item.name}</h3>
                <p style={mutedStyle}>{item.materials}</p>
                <strong>{item.price} {item.currency || "PARAG"}</strong>
                <button onClick={() => deleteProduct(item.id)} style={deleteBtnStyle}>
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
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

const topActionStyle = {
  maxWidth: 1040,
  margin: "0 auto 16px",
};

const panelStyle = {
  maxWidth: 1040,
  margin: "0 auto 24px",
  padding: 24,
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

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const eyebrowStyle = {
  margin: 0,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
  color: "#6b5f4b",
  fontWeight: 700,
};

const titleStyle = { margin: "6px 0 20px", fontSize: 34 };
const subtitleStyle = { margin: "4px 0 18px", fontSize: 24 };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const digitalGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 14,
  marginBottom: 22,
};

const digitalCardStyle = {
  width: "100%",
  display: "grid",
  gap: 10,
  padding: 16,
  textAlign: "left",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
  background: "#fff",
  color: "#1f2933",
  cursor: "pointer",
  font: "inherit",
};

const digitalCardActiveStyle = {
  borderColor: "#176b4d",
  background: "#effaf3",
  boxShadow: "0 10px 24px rgba(23, 107, 77, 0.08)",
};

const digitalCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const digitalBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  background: "#f5eee2",
  color: "#5c4b33",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const digitalTextStyle = {
  margin: 0,
  color: "#52616b",
  lineHeight: 1.5,
  fontSize: 14,
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 9px",
  borderRadius: 999,
  background: "#f7f3ea",
  color: "#3e3528",
  fontSize: 12,
  fontWeight: 700,
};

const checkboxGridStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 22,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid #e2d8c8",
  background: "#fff",
  fontWeight: 700,
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginBottom: 14,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #c9c0b2",
  borderRadius: 6,
  font: "inherit",
  color: "#111111",
  background: "#ffffff",
};

const priceInputRowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 120px",
  gap: 10,
};

const currencySelectStyle = {
  ...inputStyle,
  fontWeight: 800,
  color: "#111111",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 86,
  resize: "vertical",
};

const fileStyle = {
  ...inputStyle,
  background: "#fff",
};

const hintStyle = {
  color: "#111111",
  fontSize: 13,
  fontWeight: 700,
};

const buttonRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
};

const primaryBtnStyle = {
  padding: "11px 18px",
  background: "#176b4d",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtnStyle = {
  padding: "11px 18px",
  background: "#1f2933",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBtnStyle = {
  ...secondaryBtnStyle,
  background: "#b42318",
};

const deleteBtnStyle = {
  ...dangerBtnStyle,
  marginTop: 12,
};

const messageStyle = {
  marginTop: 14,
  color: "#176b4d",
  fontWeight: 700,
};

const progressTrackStyle = {
  width: "100%",
  height: 10,
  marginTop: 14,
  background: "#e2d8c8",
  borderRadius: 999,
  overflow: "hidden",
};

const progressFillStyle = {
  height: "100%",
  background: "#176b4d",
  transition: "width 0.2s ease",
};

const mutedStyle = {
  color: "#232323",
};

const productGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
};

const productCardStyle = {
  padding: 14,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
};

const requestGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 320px) 1fr",
  gap: 16,
};

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

const chatPanelStyle = {
  padding: 14,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 8,
};

const messagesStyle = {
  minHeight: 140,
  maxHeight: 260,
  overflowY: "auto",
  padding: 12,
  background: "#f7f3ea",
  border: "1px solid #e2d8c8",
  borderRadius: 6,
};

const replyRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const messageCardStyle = {
  display: "grid",
  gap: 10,
  marginBottom: 12,
};

const chatMediaStyle = {
  width: "100%",
  maxWidth: 220,
  aspectRatio: "4 / 3",
  objectFit: "cover",
  background: "#eee",
  borderRadius: 6,
};

const chatTextStyle = {
  margin: 0,
};

const mediaStyle = {
  width: "100%",
  aspectRatio: "4 / 3",
  objectFit: "cover",
  background: "#eee",
  borderRadius: 6,
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
        console.warn("Could not mark merchant inbox message as read:", error?.message || error);
      })
    )
  );
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

function buildChatId(uidA, uidB) {
  return [uidA, uidB].sort().join("__");
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


const MERCHANT_STATUS_LABELS = {
  chat_open: "Chatting",
  negotiating: "Negotiating",
  final_offer_sent: "Awaiting Buyer Payment",
  buyer_accepted: "Buyer Accepted — Awaiting Payment",
  escrow_funded: "Paid (Escrow) — Ready to Deliver",
  paid: "Paid — Ready to Deliver",
  delivering: "Delivering",
  buyer_review: "Awaiting Buyer Review",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  disputed: "Disputed",
  admin_review: "Admin Review",
  refunded: "Refunded",
  closed: "Closed",
};

function merchantStatusLabel(status) {
  return MERCHANT_STATUS_LABELS[status] || status || "—";
}

function merchantStatusColor(status) {
  if (status === "completed") return "#176b4d";
  if (["final_offer_sent", "buyer_accepted"].includes(status)) return "#b45309";
  if (["escrow_funded", "paid"].includes(status)) return "#1d4ed8";
  if (["delivering", "buyer_review", "delivered"].includes(status)) return "#6d28d9";
  if (["disputed", "admin_review"].includes(status)) return "#b45309";
  if (["cancelled", "expired", "closed", "refunded"].includes(status)) return "#dc2626";
  return "#52616b";
}

function MerchantDisputeResponse({ order, onResponded }) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const user = auth.currentUser;
    if (!user || !response.trim()) { alert("Please describe your response."); return; }
    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || ""}/api/marketplace/dispute/${order.id}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify({ response: response.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Could not submit response");
      }
      alert("Response submitted. Admin is now reviewing.");
      onResponded();
    } catch (err) {
      alert(`Could not submit: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: "14px 16px", background: "#fff7ed", border: "1px solid #f59e0b", borderRadius: 8 }}>
      <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#b45309" }}>⚠️ Dispute Filed — Submit Your Response</p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Describe your side of the dispute in detail…"
        rows={4}
        style={{ display: "block", width: "100%", padding: "8px 10px", border: "1px solid #c9c0b2", borderRadius: 6, marginBottom: 8, resize: "vertical", boxSizing: "border-box" }}
      />
      <button onClick={submit} disabled={submitting} style={{ padding: "10px 18px", background: "#b45309", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
        {submitting ? "Submitting…" : "Submit Dispute Response"}
      </button>
    </div>
  );
}
