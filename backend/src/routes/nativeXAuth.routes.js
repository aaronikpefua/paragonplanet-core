import { Router } from "express";
import crypto from "crypto";
import admin from "../config/firebase.js";

const router = Router();
const REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;
const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHORIZE_URL = "https://api.twitter.com/oauth/authenticate";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";
const NATIVE_CALLBACK_URL = "paragonplanet://auth/x";
const pendingTokensCollection = admin.firestore().collection("native_x_oauth_sessions");

router.post("/start", async (req, res) => {
  try {
    const callbackUrl = buildCallbackUrl(req);
    const response = await signedTwitterRequest({
      url: REQUEST_TOKEN_URL,
      method: "POST",
      tokenSecret: "",
      oauthParams: {
        oauth_callback: callbackUrl,
      },
    });
    const values = parseFormEncoded(response);
    const requestToken = values.oauth_token;
    const requestTokenSecret = values.oauth_token_secret;
    const callbackConfirmed = values.oauth_callback_confirmed === "true";

    if (!requestToken || !requestTokenSecret || !callbackConfirmed) {
      return res.status(502).json({ error: "X did not return a valid request token." });
    }

    const state = crypto.randomBytes(18).toString("base64url");
    await savePendingRequestToken(requestToken, {
      requestTokenSecret,
      state,
      expiresAt: Date.now() + REQUEST_TOKEN_TTL_MS,
    });

    return res.json({
      authUrl: `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(requestToken)}`,
      requestToken,
      state,
    });
  } catch (error) {
    console.error("Native X OAuth start failed", error);
    return res.status(500).json({ error: "Could not start X sign-in." });
  }
});

router.get("/callback", async (req, res) => {
  const denied = String(req.query.denied || "").trim();
  if (denied) {
    return redirectToNative(res, { status: "cancelled", message: "X authorization was cancelled." });
  }

  const requestToken = String(req.query.oauth_token || "").trim();
  const verifier = String(req.query.oauth_verifier || "").trim();
  const pending = requestToken ? await getPendingRequestToken(requestToken) : null;

  if (!requestToken || !verifier || !pending || pending.expiresAt < Date.now()) {
    if (requestToken) await deletePendingRequestToken(requestToken);
    return redirectToNative(res, { status: "error", message: "X callback was invalid or expired." });
  }

  try {
    const response = await signedTwitterRequest({
      url: ACCESS_TOKEN_URL,
      method: "POST",
      token: requestToken,
      tokenSecret: pending.requestTokenSecret,
      oauthParams: {
        oauth_verifier: verifier,
      },
    });
    const values = parseFormEncoded(response);
    await deletePendingRequestToken(requestToken);

    const accessToken = values.oauth_token;
    const accessTokenSecret = values.oauth_token_secret;
    if (!accessToken || !accessTokenSecret) {
      return redirectToNative(res, { status: "error", message: "X did not return access credentials." });
    }

    return redirectToNative(res, {
      status: "success",
      token: accessToken,
      secret: accessTokenSecret,
      state: pending.state,
    });
  } catch (error) {
    console.error("Native X OAuth callback failed", error);
    await deletePendingRequestToken(requestToken);
    return redirectToNative(res, { status: "error", message: "Could not complete X sign-in." });
  }
});

function buildCallbackUrl(req) {
  return (
    process.env.X_NATIVE_CALLBACK_URL ||
    process.env.TWITTER_NATIVE_CALLBACK_URL ||
    `${req.protocol}://${req.get("host")}/api/native-x-auth/callback`
  );
}

async function signedTwitterRequest({
  url,
  method,
  token = "",
  tokenSecret = "",
  oauthParams = {},
}) {
  const consumerKey = process.env.X_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY || "";
  const consumerSecret = process.env.X_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET || "";

  if (!consumerKey || !consumerSecret) {
    throw new Error("X consumer key/secret environment variables are missing.");
  }

  const baseOAuthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...oauthParams,
  };
  if (token) baseOAuthParams.oauth_token = token;

  const signature = signOAuthRequest({
    method,
    url,
    params: baseOAuthParams,
    consumerSecret,
    tokenSecret,
  });
  const authorization = buildAuthorizationHeader({
    ...baseOAuthParams,
    oauth_signature: signature,
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`X OAuth request failed (${response.status}): ${body}`);
  }

  return body;
}

function signOAuthRequest({ method, url, params, consumerSecret, tokenSecret }) {
  const parameterString = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(parameterString),
  ].join("&");
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");
}

function buildAuthorizationHeader(params) {
  return `OAuth ${Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ")}`;
}

function parseFormEncoded(value) {
  return Object.fromEntries(new URLSearchParams(value));
}

function redirectToNative(res, params) {
  const url = new URL(NATIVE_CALLBACK_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  res.set("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Return to Paragon Planet</title>
  </head>
  <body>
    <p>Returning to Paragon Planet…</p>
    <script>window.location.replace(${JSON.stringify(url.toString())});</script>
    <p><a href="${escapeHtml(url.toString())}">Tap here if you are not returned automatically.</a></p>
  </body>
</html>`);
}

async function savePendingRequestToken(requestToken, value) {
  await pendingTokensCollection.doc(requestToken).set({
    requestTokenSecret: value.requestTokenSecret,
    state: value.state,
    expiresAt: admin.firestore.Timestamp.fromMillis(value.expiresAt),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getPendingRequestToken(requestToken) {
  const snapshot = await pendingTokensCollection.doc(requestToken).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() || {};
  return {
    requestTokenSecret: String(data.requestTokenSecret || ""),
    state: String(data.state || ""),
    expiresAt: data.expiresAt?.toMillis?.() || 0,
  };
}

async function deletePendingRequestToken(requestToken) {
  await pendingTokensCollection.doc(requestToken).delete().catch(() => {});
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default router;
