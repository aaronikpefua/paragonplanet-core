import crypto from "crypto";
import admin from "../config/firebase.js";

function secureEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || "").trim());
  const right = Buffer.from(String(rightValue || "").trim());
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function createM1StagingTestToken(req, res) {
  if (process.env.PARAGON_ENVIRONMENT !== "staging" || process.env.FIREBASE_PROJECT_ID !== "paragonplanet-live-stg") {
    return res.status(404).json({ code: "NOT_FOUND", error: "Not found" });
  }
  if (!secureEqual(req.get("x-m1-test-login-secret"), process.env.M1_TEST_LOGIN_SECRET)) {
    return res.status(401).json({ code: "NOT_AUTHORIZED", error: "Staging test login authorization failed" });
  }
  try {
    const email = String(process.env.M1_TEST_USER_EMAIL || "").trim().toLowerCase();
    if (!email) return res.status(503).json({ code: "STAGING_TEST_LOGIN_NOT_CONFIGURED", error: "Staging test user is not configured" });
    const user = await admin.auth().getUserByEmail(email);
    const role = "CITIZEN";
    const displayName = "M1 Test Citizen";
    const existingClaims = user.customClaims || {};
    if (existingClaims.role !== role) {
      await admin.auth().setCustomUserClaims(user.uid, { ...existingClaims, role });
    }

    const db = admin.firestore();
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all([
      db.collection("user_profiles").doc(user.uid).set({
        uid: user.uid,
        email,
        role,
        activeRole: role,
        accountRole: role,
        status: "active",
        realName: displayName,
        updatedAt,
      }, { merge: true }),
      db.collection("citizen_profiles").doc(user.uid).set({
        uid: user.uid,
        email,
        role,
        status: "active",
        warnings: 0,
        isBanned: false,
        stageName: displayName,
        realName: displayName,
        registrationType: "STAGING_M1_TEST",
        updatedAt,
      }, { merge: true }),
      db.collection("public_profiles").doc(user.uid).set({
        uid: user.uid,
        role: "Citizen",
        displayName,
        realName: displayName,
        stageName: displayName,
        status: "active",
        updatedAt,
      }, { merge: true }),
    ]);

    const customToken = await admin.auth().createCustomToken(user.uid, { m1StagingTest: true, role });
    return res.json({ customToken, firebaseProjectId: process.env.FIREBASE_PROJECT_ID });
  } catch (error) {
    return res.status(503).json({ code: "STAGING_TEST_LOGIN_FAILED", error: error.message || "Could not create staging test token" });
  }
}
