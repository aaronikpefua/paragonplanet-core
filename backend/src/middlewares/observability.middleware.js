import { classifyStatus, durationSinceMs, logPerf, nowMs, requestId } from "../observability/perf.js";

const DOMAIN_RULES = [
  [/^\/api\/live\b/, "live"],
  [/^\/api\/realtime\b/, "realtime"],
  [/^\/api\/marketplace\b/, "marketplace"],
  [/^\/api\/wallet\b|^\/deposit\b|^\/bank\b|^\/withdraw\b|^\/api\/google-play-billing\b/, "finance"],
  [/^\/support\b/, "support"],
  [/^\/api\/video\b|^\/api\/video\/list\b|^\/generate-upload-url\b|^\/trigger-.*compression\b|^\/internal\/video\b/, "media"],
  [/^\/api\/auth\b|^\/api\/native-x-auth\b/, "identity"],
  [/^\/health\b/, "health"],
];

function routePattern(req) {
  const routePath = req.route?.path;
  if (routePath) {
    const mount = req.baseUrl || "";
    return `${req.method} ${mount}${routePath}`.replace(/\/+/g, "/").replace(":/", "://");
  }
  return `${req.method} ${String(req.originalUrl || req.path || "").split("?")[0]
    .replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, "/:id")
    .replace(/\/[A-Za-z0-9_-]{8,}(?=\/|$)/g, "/:id")}`;
}

function domainFor(path = "") {
  return DOMAIN_RULES.find(([pattern]) => pattern.test(path))?.[1] || "unknown";
}

export function requestObservability(req, res, next) {
  const start = nowMs();
  const incoming = String(req.headers["x-request-id"] || req.headers["x-correlation-id"] || "").trim();
  req.requestId = incoming && incoming.length <= 80 ? incoming : requestId();
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const statusCode = res.statusCode;
    logPerf("api.request", {
      domain: domainFor(req.path || req.originalUrl),
      operation: routePattern(req),
      method: req.method,
      route: routePattern(req),
      status: statusCode >= 400 ? "failure" : "success",
      statusCode,
      statusClass: classifyStatus(statusCode),
      durationMs: durationSinceMs(start),
      requestId: req.requestId,
    });
  });

  next();
}
