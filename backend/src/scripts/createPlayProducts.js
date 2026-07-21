import crypto from "crypto";
import { loadServiceAccount } from "../config/serviceAccount.js";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.app.natureswayproduction";
const CURRENCY = process.env.GOOGLE_PLAY_PRODUCT_CURRENCY || "NGN";
const PRODUCTS = [
  { sku: "parag_1", currency: "PARAG", amount: 1, price: 100 },
  { sku: "parag_5", currency: "PARAG", amount: 5, price: 500 },
  { sku: "parag_10", currency: "PARAG", amount: 10, price: 1000 },
  { sku: "parag_50", currency: "PARAG", amount: 50, price: 5000 },
  { sku: "parag_100", currency: "PARAG", amount: 100, price: 10000 },
  { sku: "gbazilo_1", currency: "GBAZILO", amount: 1, price: 1000 },
  { sku: "gbazilo_2", currency: "GBAZILO", amount: 2, price: 2000 },
  { sku: "gbazilo_5", currency: "GBAZILO", amount: 5, price: 5000 },
  { sku: "gbazilo_10", currency: "GBAZILO", amount: 10, price: 10000 },
];

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
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  )}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(serviceAccount.private_key);

  return `${unsigned}.${base64Url(signature)}`;
}

async function getAccessToken() {
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

  return data.access_token;
}

async function playRequest(accessToken, path, options = {}) {
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message || data?.error || "Google Play API request failed";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function buildProduct({ sku, currency, amount, price }) {
  return {
    packageName: PACKAGE_NAME,
    sku,
    status: "active",
    purchaseType: "managedUser",
    defaultPrice: {
      priceMicros: String(Math.round(price * 1000000)),
      currency: CURRENCY,
    },
    listings: {
      "en-US": {
        title: `${amount} ${currency}`,
        description: `Credit ${amount} ${currency} to your Paragon Planet wallet.`,
      },
    },
    defaultLanguage: "en-US",
    managedProductTaxesAndComplianceSettings: {
      isTokenizedDigitalAsset: false,
    },
  };
}

async function main() {
  const accessToken = await getAccessToken();
  const packagePath = `applications/${encodeURIComponent(PACKAGE_NAME)}/inappproducts`;

  for (const product of PRODUCTS) {
    try {
      await playRequest(accessToken, `${packagePath}/${encodeURIComponent(product.sku)}`);
      console.log(`${product.sku}: already exists`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      await playRequest(accessToken, packagePath, {
        method: "POST",
        body: JSON.stringify(buildProduct(product)),
      });
      console.log(`${product.sku}: created`);
    }
  }
}

main().catch((error) => {
  console.error(error.data ? JSON.stringify(error.data, null, 2) : error);
  process.exit(1);
});
