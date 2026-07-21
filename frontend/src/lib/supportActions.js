import { getAppCheckHeader } from "../config/firebase";

const configuredApiUrl = import.meta.env.VITE_BACKEND_URL?.trim();

export const API_URL =
  configuredApiUrl || "https://backend-849823064688.us-central1.run.app";

export async function appCheckFetch(url, options = {}) {
  const appCheckHeaders = await getAppCheckHeader();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...appCheckHeaders,
    },
  });
}

export const SUPPORT_ACTIONS = {
  vote: {
    key: "vote",
    label: "Vote",
    parag: 1,
    gbazilo: 0,
    group: "vote",
  },
  pour_me_water: {
    key: "pour_me_water",
    label: "Pour Me Water",
    parag: 5,
    gbazilo: 0,
    group: "spray",
  },
  spray_money: {
    key: "spray_money",
    label: "Spray Money",
    parag: 0,
    gbazilo: 0,
    group: "spray",
    variable: true,
  },
  mineral: {
    key: "mineral",
    label: "Mineral",
    parag: 2,
    gbazilo: 0,
    group: "bottle",
  },
  malt: {
    key: "malt",
    label: "Malt",
    parag: 3,
    gbazilo: 0,
    group: "bottle",
  },
  juice: {
    key: "juice",
    label: "Juice",
    parag: 4,
    gbazilo: 0,
    group: "bottle",
  },
  mocktail: {
    key: "mocktail",
    label: "Mocktail",
    parag: 5,
    gbazilo: 0,
    group: "bottle",
  },
  beer: {
    key: "beer",
    label: "Beer",
    parag: 6,
    gbazilo: 0,
    group: "bottle",
  },
  gin: {
    key: "gin",
    label: "Gin",
    parag: 7,
    gbazilo: 0,
    group: "bottle",
  },
  rum: {
    key: "rum",
    label: "Rum",
    parag: 8,
    gbazilo: 0,
    group: "bottle",
  },
  vodka: {
    key: "vodka",
    label: "Vodka",
    parag: 9,
    gbazilo: 0,
    group: "bottle",
  },
  whiskey: {
    key: "whiskey",
    label: "Whiskey",
    parag: 0,
    gbazilo: 1,
    group: "bottle",
  },
  cocktail: {
    key: "cocktail",
    label: "Cocktail",
    parag: 2,
    gbazilo: 1,
    group: "bottle",
  },
};

export const SPRAY_ACTION_KEYS = ["spray_money"];
export const BOTTLE_ACTION_KEYS = [
  "mineral",
  "malt",
  "juice",
  "mocktail",
  "beer",
  "gin",
  "rum",
  "vodka",
  "whiskey",
  "cocktail",
];

export function formatSupportCost(action, customParagAmount = 0, customGbaziloAmount = 0) {
  if (!action) return "";

  if (action.variable) {
    if (Number(customGbaziloAmount || 0) > 0) {
      return `${Number(customGbaziloAmount || 0)} Gbazilo`;
    }
    return `${Number(customParagAmount || 0)} Parag`;
  }

  const parts = [];
  if (action.gbazilo) parts.push(`${action.gbazilo} Gbazilo`);
  if (action.parag) parts.push(`${action.parag} Parag`);
  return parts.join(" ");
}
