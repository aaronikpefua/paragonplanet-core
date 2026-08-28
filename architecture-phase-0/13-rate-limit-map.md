# Rate Limit Map

| Area | Implementation | Limit | Scope Risk |
|---|---|---|---|
| Global API | custom `rateLimit.middleware.js` | app-level; skips `/api/live` | process-local |
| Upload URL | custom limiter | 20/min | process-local |
| Native X auth | custom limiter | 20/min | process-local |
| Wallet conversion | custom limiter | 10/min | process-local |
| Realtime call request | custom limiter | 10/min | process-local |
| Live status | custom limiter | 60/min | process-local |
| Live sessions | custom limiter | 120/min | process-local |
| Live schedule | custom limiter | 10/min | process-local |
| Live start | custom limiter | 5/min | process-local |
| Live active/heartbeat/end | custom limiter | 20/min each | process-local |
| Live chat list | custom limiter | 120/min | process-local |
| Live chat post | custom limiter | 30/min | process-local |
| Live support | custom limiter | 30/min | process-local |
| Marketplace base | `express-rate-limit` | 300/min | memory store unless configured |
| Marketplace sensitive routes | `express-rate-limit` | 5-20/min | memory store unless configured |
| Marketplace read/admin routes | `express-rate-limit` | 30-60/min | memory store unless configured |

Rate limits currently help per instance but do not provide globally coordinated enforcement across horizontal Cloud Run scaling.
