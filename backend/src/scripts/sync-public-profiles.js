import admin from "../config/firebase.js";

const PROFILE_SOURCES = [
  { collectionName: "citizen_profiles", role: "Citizen" },
  { collectionName: "promoter_profiles", role: "Ambassador" },
  { collectionName: "merchant_profiles", role: "Merchant" },
  { collectionName: "user_profiles", role: "User" },
  { collectionName: "backer_profiles", role: "Backer Contestant" },
  { collectionName: "supernal_profiles", role: "Superboss Candidate" },
  { collectionName: "sponsor_investor_profiles", role: "Sponsor / Investor" },
  { collectionName: "sponsor_profiles", role: "Sponsor / Investor" },
];

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function pickArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function sanitizeProfile(uid, role, data = {}) {
  const accountType = data.accountType || data.sponsorType || "";
  const resolvedRole = role === "Sponsor / Investor" && accountType
    ? accountType
    : role;

  const displayName = firstText(
    data.displayName,
    data.stageName,
    data.storeName,
    data.brandName,
    data.realName,
    data.name,
    resolvedRole
  );

  return {
    uid,
    role: resolvedRole,
    displayName,
    realName: firstText(data.realName),
    stageName: firstText(data.stageName, data.displayName),
    storeName: firstText(data.storeName),
    brandName: firstText(data.brandName),
    profession: firstText(data.profession, data.phone, data.businessType),
    country: firstText(data.country),
    state: firstText(data.state),
    tribe: firstText(data.tribe),
    status: firstText(data.status),
    reviewStatus: firstText(data.reviewStatus),
    accountType: firstText(accountType),
    talents: pickArray(data.talents),
    types: pickArray(data.types),
    productTypes: pickArray(data.productTypes),
    serviceField: firstText(data.serviceField, data.field),
    fields: pickArray(data.fields),
    primaryPromoterId: firstText(data.primaryPromoterId),
    invitedByPromoterId: firstText(data.invitedByPromoterId),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function syncPublicProfiles() {
  const db = admin.firestore();
  let count = 0;

  for (const source of PROFILE_SOURCES) {
    const snapshot = await db.collection(source.collectionName).get();

    for (const profileDoc of snapshot.docs) {
      const publicProfile = sanitizeProfile(profileDoc.id, source.role, profileDoc.data());
      await db.collection("public_profiles").doc(profileDoc.id).set(publicProfile, { merge: true });
      count += 1;
    }
  }

  console.log(`Synced ${count} public profiles.`);
}

syncPublicProfiles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Public profile sync failed:", error);
    process.exit(1);
  });
