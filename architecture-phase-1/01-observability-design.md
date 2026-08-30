# Observability Design

## Backend

- `backend/src/observability/perf.js` provides monotonic timing, structured JSON logging, safe field sanitization, status/error classification, and async measurement helpers.
- `backend/src/middlewares/observability.middleware.js` adds `X-Request-Id`, normalized route logging, domain classification, status code, and duration.
- Cloudflare Stream Live and Cloudflare RealtimeKit calls are wrapped as `upstream.request` events without logging credentials.
- Key Live and private realtime Firestore operations are wrapped with application-level timing.

## Web

- `frontend/src/lib/perf.js` provides `paragonPerfDebug` gating, `perfRunId`, status classification, normalized paths, and structured browser console events.
- `appCheckFetch` logs web API duration and correlation IDs.
- `useVideos` logs feed/profile Firestore listener snapshots.
- `VideoPlayer` logs player source assignment, creation, manifest readiness, metadata, ready, first playback, waiting, error, and release events.

## Android

- `ParagonApiService.kt` logs API request timings with Logcat tag `ParagonPerf`.
- Logs include method, normalized route, status class, duration, and request ID.
- Authorization, App Check, and payload values are not logged.
