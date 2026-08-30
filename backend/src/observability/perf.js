import crypto from "node:crypto";
import { performance } from "node:perf_hooks";

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|private_key|api_key|paystack|cloudflare|firebase_admin_json)/i;

export function nowMs() {
  return performance.now();
}

export function durationSinceMs(start) {
  return Math.round((performance.now() - start) * 100) / 100;
}

export function requestId() {
  return crypto.randomUUID();
}

export function sanitizeFields(fields = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    clean[key] = value;
  }
  return clean;
}

export function classifyStatus(statusCode = 0) {
  if (statusCode === 429) return "RATE_LIMIT";
  if (statusCode === 401) return "AUTH";
  if (statusCode === 403) return "PERMISSION";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode >= 500) return "SERVER";
  if (statusCode >= 400) return "VALIDATION";
  return "OK";
}

export function classifyError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.status === 429 || message.includes("too many requests")) return "RATE_LIMIT";
  if (error?.status === 401 || message.includes("unauthorized")) return "AUTH";
  if (error?.status === 403 || message.includes("permission")) return "PERMISSION";
  if (error?.status === 404 || message.includes("not found")) return "NOT_FOUND";
  if (error?.status === 409 || message.includes("conflict")) return "CONFLICT";
  if (error?.name === "AbortError" || message.includes("timeout") || message.includes("timed out")) return "TIMEOUT";
  if (message.includes("firestore")) return "FIRESTORE";
  if (message.includes("cloudflare") || message.includes("paystack") || message.includes("google play")) return "UPSTREAM";
  if (message.includes("network") || message.includes("fetch failed")) return "NETWORK";
  return "UNKNOWN";
}

export function logPerf(event, fields = {}) {
  console.info(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeFields(fields),
  }));
}

export async function measureAsync({ event, domain, operation, requestId: reqId, extra = {} }, fn) {
  const start = nowMs();
  try {
    const result = await fn();
    logPerf(event, {
      domain,
      operation,
      requestId: reqId,
      durationMs: durationSinceMs(start),
      status: "success",
      ...extra,
    });
    return result;
  } catch (error) {
    logPerf(event, {
      domain,
      operation,
      requestId: reqId,
      durationMs: durationSinceMs(start),
      status: "failure",
      errorClass: classifyError(error),
      ...extra,
    });
    throw error;
  }
}

export async function measureFirestore(fields, fn) {
  const start = nowMs();
  try {
    const result = await fn();
    logPerf("firestore.operation", {
      ...fields,
      durationMs: durationSinceMs(start),
      status: "success",
      resultCount: Array.isArray(result?.docs) ? result.docs.length : undefined,
    });
    return result;
  } catch (error) {
    logPerf("firestore.operation", {
      ...fields,
      durationMs: durationSinceMs(start),
      status: "failure",
      errorClass: classifyError(error),
    });
    throw error;
  }
}
