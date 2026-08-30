const PERF_DEBUG_KEY = "paragonPerfDebug";

export function perfDebugEnabled() {
  try {
    return Boolean(import.meta.env.DEV || window.localStorage?.getItem(PERF_DEBUG_KEY) === "1");
  } catch {
    return Boolean(import.meta.env.DEV);
  }
}

export function perfRunId() {
  try {
    const existing = window.sessionStorage?.getItem("paragonPerfRunId");
    if (existing) return existing;
    const generated = `perf_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage?.setItem("paragonPerfRunId", generated);
    return generated;
  } catch {
    return "perf_unavailable";
  }
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

export function logPerf(event, fields = {}) {
  if (!perfDebugEnabled()) return;
  console.info("[ParagonPerf]", {
    event,
    perfRunId: perfRunId(),
    timestamp: new Date().toISOString(),
    ...fields,
  });
}

export function normalizedPath(url) {
  try {
    return new URL(url, window.location.origin).pathname
      .replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, "/:id")
      .replace(/\/[A-Za-z0-9_-]{8,}(?=\/|$)/g, "/:id");
  } catch {
    return "unknown";
  }
}
