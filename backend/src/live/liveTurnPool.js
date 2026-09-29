import crypto from "crypto";

function pool() {
  try { return JSON.parse(process.env.LIVE_TURN_POOL_JSON || "[]"); } catch { return []; }
}

export function issueTurnCredentials({ subject = "viewer", region = "", ttlSeconds = 600 } = {}) {
  const secret = String(process.env.LIVE_TURN_SHARED_SECRET || "");
  if (!secret) return [];
  const nodes = pool().filter((node) => node?.healthy !== false && (!region || node.region === region));
  const selected = nodes.length ? nodes : pool().filter((node) => node?.healthy !== false);
  const expires = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(3600, Number(ttlSeconds || 600)));
  const username = `${expires}:${String(subject).slice(0, 80)}`;
  const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
  return selected.slice(0, 4).map((node) => ({ urls: node.urls, username, credential, region: node.region || "" }));
}
