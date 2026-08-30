# Metric Catalog

| Category | Event/Metric | Source |
|---|---|---|
| Backend | `api.request` | Express middleware |
| Backend | `upstream.request` | Cloudflare wrappers |
| Firestore | `firestore.operation` | application-level wrappers |
| Firestore | `firestore.transaction` | transaction wrappers |
| Live broadcast | `api.request` for start/active/heartbeat | backend + client fetch |
| Live viewer | `ParagonLiveTiming` existing browser timing | web Live viewer |
| Live stability | `ParagonLiveTiming`, player events | web Live viewer |
| Feed | `feed.snapshot`, `feed.player.*` | web hook/player |
| Android API | `event=api.request` Logcat | central API service |
| Realtime calls | `realtime.room.create`, `realtime.token.create`, API events | backend realtime |
| Finance | `api.request`, `firestore.transaction` | wallet/support/marketplace routes |
| Marketplace | `api.request` | backend middleware |
| Rate limit/errors | `api.request` status/statusClass | backend/client logs |

## Required Aggregates

The local summarizer calculates count, success, failure, 429 count, 5xx count, min, max, average, p50, p95, and p99 when logs contain `durationMs`.
