const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 120;
const buckets = new Map();

function getClientKey(req) {
  const uid = req.user?.uid ? `uid:${req.user.uid}` : "";
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return uid || forwarded || req.ip || "unknown";
}

function cleanup(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function rateLimit({
  windowMs = DEFAULT_WINDOW_MS,
  limit = DEFAULT_LIMIT,
  keyPrefix = "global",
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 10000) cleanup(now);

    const key = `${keyPrefix}:${getClientKey(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    if (bucket.count > limit) {
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Too many requests. Please slow down and try again.",
      });
    }

    return next();
  };
}
