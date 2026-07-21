import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

function text(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

export function toPublicProfile(uid, role, data = {}) {
  const accountType = text(data.accountType, data.sponsorType);
  const publicRole = role === "Sponsor / Investor" && accountType ? accountType : role;

  return {
    uid,
    role: publicRole,
    displayName: text(
      data.displayName,
      data.stageName,
      data.storeName,
      data.brandName,
      data.realName,
      data.name,
      publicRole
    ),
    realName: text(data.realName),
    stageName: text(data.stageName, data.displayName),
    storeName: text(data.storeName),
    brandName: text(data.brandName),
    profession: text(data.profession, data.businessType),
    country: text(data.country),
    state: text(data.state, data.stateCity),
    tribe: text(data.tribe),
    status: text(data.status),
    reviewStatus: text(data.reviewStatus),
    accountType,
    talents: list(data.talents),
    types: list(data.types || data.promoterTypes || data.talentCategories),
    productTypes: list(data.productTypes),
    serviceField: text(data.serviceField, data.field),
    fields: list(data.fields || data.serviceFields || data.knowledgeFields),
    primaryPromoterId: text(data.primaryPromoterId),
    invitedByPromoterId: text(data.invitedByPromoterId),
    updatedAt: serverTimestamp(),
  };
}

export async function savePublicProfile(uid, role, data) {
  await setDoc(doc(db, "public_profiles", uid), toPublicProfile(uid, role, data), {
    merge: true,
  });
}
