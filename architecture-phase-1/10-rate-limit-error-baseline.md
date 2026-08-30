# Rate Limit and Error Baseline

## Added

- Every backend request log includes status code and status class.
- `429` responses are classified as `RATE_LIMIT`.
- `5xx` responses are counted by the summarizer.
- Web Phase 1 requests include `X-Request-Id` for correlation.

## Current Result

- MEASURED: localhost preflight initially exposed missing `X-Request-Id` in CORS `allowedHeaders`.
- MEASURED: the CORS request-header gap was corrected and backend tests passed.
- MEASURED: no 429 or 5xx Live runtime failure was captured in the provided screenshots.
- NOT YET MEASURABLE: actual 429/5xx pressure by normalized route requires captured backend/runtime logs from a timed session or load scenario.
