import { doc, getDoc } from "firebase/firestore";

export const ACTIVE_ROLE_STORAGE_KEY = "paragon_active_role";

export const ACCOUNT_ROLES = [
  {
    key: "USER",
    label: "User",
    collectionName: "user_profiles",
    onboardingPath: "/onboarding/user",
  },
  {
    key: "CITIZEN",
    label: "Citizen",
    collectionName: "citizen_profiles",
    onboardingPath: "/onboarding/citizen",
  },
  {
    key: "PROMOTER",
    label: "Ambassador",
    collectionName: "promoter_profiles",
    onboardingPath: "/onboarding/promoter",
  },
  {
    key: "MERCHANT",
    label: "Merchant",
    collectionName: "merchant_profiles",
    onboardingPath: "/onboarding/merchant",
  },
  {
    key: "BACKER",
    label: "Backer Contestant",
    collectionName: "backer_profiles",
    onboardingPath: "/onboarding/backer",
  },
  {
    key: "SUPERNAL",
    label: "Superboss",
    collectionName: "supernal_profiles",
    onboardingPath: "/onboarding/supernal",
  },
  {
    key: "SPONSOR_INVESTOR",
    label: "Sponsor / Investor",
    collectionName: "sponsor_investor_profiles",
    onboardingPath: "/onboarding/sponsor-investor",
    profileRole: "SPONSOR / INVESTOR",
  },
  {
    key: "SPONSOR_INVESTOR_LEGACY",
    label: "Sponsor / Investor",
    collectionName: "sponsor_profiles",
    onboardingPath: "/onboarding/sponsor-investor",
    profileRole: "SPONSOR / INVESTOR",
  },
];

export function normalizeRoleKey(role) {
  const value = String(role || "").trim().toUpperCase();
  if (
    value === "SPONSOR" ||
    value === "INVESTOR" ||
    value === "SPONSOR / INVESTOR" ||
    value === "SPONSOR_INVESTOR"
  ) {
    return "SPONSOR_INVESTOR";
  }
  return value;
}

export function getStoredActiveRole() {
  if (typeof window === "undefined") return "";
  return normalizeRoleKey(window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY));
}

export function setStoredActiveRole(role) {
  if (typeof window === "undefined") return;
  const normalizedRole = normalizeRoleKey(role);
  if (normalizedRole) {
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, normalizedRole);
  }
}

export function clearStoredActiveRole() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
}

export function getAccountRole(roleKey) {
  const normalizedRole = normalizeRoleKey(roleKey);
  return ACCOUNT_ROLES.find((item) => normalizeRoleKey(item.key) === normalizedRole) || null;
}

export async function loadAccountRoles(db, uid) {
  const roleResults = await Promise.all(
    ACCOUNT_ROLES.map(async (roleConfig) => {
      try {
        const snap = await getDoc(doc(db, roleConfig.collectionName, uid));
        if (!snap.exists()) return null;
        return {
          ...roleConfig,
          key: normalizeRoleKey(roleConfig.key),
          role: roleConfig.profileRole || roleConfig.key,
          profile: snap.data(),
          docId: snap.id,
        };
      } catch (error) {
        console.warn(`Skipping ${roleConfig.collectionName} profile lookup:`, error?.message || error);
        return null;
      }
    })
  );

  const rolesByKey = new Map();
  roleResults.filter(Boolean).forEach((roleConfig) => {
    if (!rolesByKey.has(roleConfig.key)) {
      rolesByKey.set(roleConfig.key, roleConfig);
    }
  });

  return Array.from(rolesByKey.values());
}
