import crypto from "crypto";
import admin from "../config/firebase.js";
import { loadServiceAccount } from "../config/serviceAccount.js";

const PLAY_BILLING_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const PLAY_BILLING_METHOD = "google_play_billing";
const DEFAULT_PACKAGE_NAME = "com.app.natureswayproduction";
const DEFAULT_PRODUCTS = {
  parag_1: { parag: 1, gbazilo: 0 },
  parag_5: { parag: 5, gbazilo: 0 },
  parag_10: { parag: 10, gbazilo: 0 },
  parag_50: { parag: 50, gbazilo: 0 },
  parag_100: { parag: 100, gbazilo: 0 },
  gbazilo_1: { parag: 0, gbazilo: 1 },
  gbazilo_2: { parag: 0, gbazilo: 2 },
  gbazilo_5: { parag: 0, gbazilo: 5 },
  gbazilo_10: { parag: 0, gbazilo: 10 },
};

let cachedToken = null;

function getWalletProducts() {
  if (!process.env.GOOGLE_PLAY_WALLET_PRODUCTS) {
    return DEFAULT_PRODUCTS;
  }

  try {
    const parsed = JSON.parse(process.env.GOOGLE_PLAY_WALLET_PRODUCTS);
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([productId, value]) => [
          productId,
          {
            parag: Number(value?.parag ?? value) || 0,
            gbazilo: Number(value?.gbazilo ?? 0) || 0,
          },
        ])
        .filter(([, value]) => value.parag > 0 || value.gbazilo > 0)
    );
  } catch (error) {
    console.error("Invalid GOOGLE_PLAY_WALLET_PRODUCTS JSON:", error);
    return DEFAULT_PRODUCTS;
  }
}

function base64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: PLAY_BILLING_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(serviceAccount.private_key);

  return `${unsignedToken}.${base64Url(signature)}`;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const assertion = createJwt(loadServiceAccount());
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Google auth failed");
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  return cachedToken.accessToken;
}

async function callPlayPublisher(path, options = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return {};
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Google Play API request failed";
    throw new Error(message);
  }

  return data;
}

async function getPlayPurchase({ packageName, productId, purchaseToken }) {
  return callPlayPublisher(
    `applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  );
}

async function consumePlayPurchase({ packageName, productId, purchaseToken }) {
  return callPlayPublisher(
    `applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`,
    { method: "POST" }
  );
}

export async function verifyWalletPurchase(req, res) {
  const userId = req.user?.uid;
  const { productId, purchaseToken } = req.body || {};
  const walletProducts = getWalletProducts();
  const product = walletProducts[productId];

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!productId || !purchaseToken || !product) {
    return res.status(400).json({ error: "Invalid Google Play wallet product" });
  }

  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || DEFAULT_PACKAGE_NAME;
  const db = admin.firestore();
  const processedRef = db.collection("processed_payments").doc(`google_play_${purchaseToken}`);
  const walletRef = db.collection("wallet_accounts").doc(userId);
  const ledgerRef = db.collection("ledger_entries").doc();

  try {
    const purchase = await getPlayPurchase({ packageName, productId, purchaseToken });

    if (String(purchase.purchaseState) !== "0") {
      return res.status(400).json({ error: "Google Play purchase is not completed" });
    }

    if (purchase.obfuscatedExternalAccountId && purchase.obfuscatedExternalAccountId !== userId) {
      return res.status(403).json({ error: "Purchase does not belong to this account" });
    }

    let alreadyProcessed = false;

    await db.runTransaction(async (transaction) => {
      const processedSnap = await transaction.get(processedRef);

      if (processedSnap.exists) {
        alreadyProcessed = true;
        return;
      }

      transaction.set(
        walletRef,
        {
          role: "wallet",
          balances: {
            parag: admin.firestore.FieldValue.increment(product.parag),
            gbazilo: admin.firestore.FieldValue.increment(product.gbazilo),
          },
          lockedBalances: {
            parag: admin.firestore.FieldValue.increment(0),
            gbazilo: admin.firestore.FieldValue.increment(0),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(ledgerRef, {
        accountId: userId,
        direction: "credit",
        amount: product.parag || product.gbazilo,
        amountParag: product.parag,
        amountGbazilo: product.gbazilo,
        currency: product.gbazilo > 0 ? "GBAZILO" : "PARAG",
        paymentProvider: PLAY_BILLING_METHOD,
        productId,
        purchaseToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(processedRef, {
        userId,
        productId,
        purchaseToken,
        provider: PLAY_BILLING_METHOD,
        amountParag: product.parag,
        amountGbazilo: product.gbazilo,
        purchaseState: purchase.purchaseState,
        orderId: purchase.orderId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (!alreadyProcessed) {
      await consumePlayPurchase({ packageName, productId, purchaseToken }).catch((error) => {
        console.error("Google Play purchase credited but consume failed:", error);
      });
    }

    return res.json({
      ok: true,
      alreadyProcessed,
      creditedParag: alreadyProcessed ? 0 : product.parag,
      creditedGbazilo: alreadyProcessed ? 0 : product.gbazilo,
    });
  } catch (error) {
    console.error("Google Play wallet verification failed:", error);
    return res.status(502).json({
      error: "Google Play verification failed",
      details: error.message || "Unknown Google Play API error",
    });
  }
}
