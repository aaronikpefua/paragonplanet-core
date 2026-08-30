# Backend Observability

## Added

- Request correlation via `X-Request-Id`.
- Normalized route patterns to avoid ID cardinality explosion.
- Domain classification for Live, realtime, marketplace, finance, support, media, identity, and health.
- Structured JSON logs compatible with Cloud Run logging.
- External Cloudflare API duration logs for Stream Live and RealtimeKit.

## Data Safety

No request bodies, Authorization headers, cookies, tokens, API keys, or provider secrets are logged.

## Baseline Status

Runtime API measurements are NOT YET MEASURABLE until local/manual traffic or deployed traffic is captured and passed through `scripts/performance/summarize-performance.mjs`.
