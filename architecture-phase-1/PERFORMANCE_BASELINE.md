# Performance Baseline

## 1. Starting Checkpoint

- Branch: `checkpoint/pre-architecture-2026-08-28`
- HEAD: `802db9c docs: complete Paragon Planet Architecture Phase 0`
- Previous source checkpoint: `7c21800`

## 2. Instrumentation Added

- Backend structured request logs with request IDs and normalized routes.
- Backend Firestore operation/transaction timing helpers.
- Cloudflare Stream Live and RealtimeKit upstream timing.
- Web `paragonPerfDebug` performance logger and run ID.
- Web API, feed snapshot, and video player lifecycle timing.
- Android central API timing with Logcat tag `ParagonPerf`.
- Local log summarizer at `scripts/performance/summarize-performance.mjs`.

## 3. Build Validation

- Backend tests: MEASURED passed, 4 files and 51 tests; latest Phase 1 continuation validation passed in Vitest duration 4.67s after documentation updates.
- Web production build: MEASURED passed in 17.217s; `dist` contains 17 files and 7,491,470 bytes.
- Android `assembleDebug`: MEASURED passed in latest run 29s with 38 tasks up-to-date; historical Phase 1 run 83.469s with 4 executed.
- Web bundle increased from the historical reference 7,487,967 bytes to 7,491,470 bytes, an increase of 3,503 bytes. This is small and consistent with lightweight instrumentation.
- Secret-safety scan: safe; no secret values were added to logs or documentation.

## 4. Test-Environment Corrections

- MEASURED: localhost instrumented web initially failed CORS against the deployed backend.
- MEASURED: backend CORS now supports controlled `ADDITIONAL_CORS_ORIGINS` and the measurement origin `http://localhost:5173` without wildcard origins.
- MEASURED: Phase 1 web instrumentation sends `X-Request-Id`; backend CORS `allowedHeaders` now includes `Content-Type`, `Authorization`, `X-Firebase-AppCheck`, and `X-Request-Id` without wildcard headers.
- MEASURED: backend tests passed after the CORS request-header correction.
- MEASURED: backend source deployment used the existing source-deploy method and reached revision `backend-00085-d9n`.

## 5. Live Runtime Evidence

- MEASURED: production web broadcaster startup sample reached `T5_directory_active` at approximately 6.220s after GO LIVE was pressed.
- MEASURED: production web WHEP viewer sample for session `Qualification Update` reached `T5_first_remote_track` at 15.213s and `T6_first_frame_playing` at 15.280s.
- MEASURED: first remote track to first playing frame was approximately 67ms, so the observed delay occurred before remote media arrival rather than after browser media rendering.
- MEASURED: localhost `LIVE-WW-001` instrumentation is operational and video was visibly playing with `[ParagonPerf]` events carrying `perfRunId=LIVE-WW-001`.
- NOT YET MEASURABLE: a complete clean localhost `LIVE-WW-001` benchmark with all required timings, chat, heartbeat, polling counts, and end-state was not captured.
- NOT YET MEASURABLE: WHEP HTTP negotiation, ICE establishment, Cloudflare media readiness, and first remote RTP/media arrival cannot yet be separated from screenshots alone.

## 6. Live Polling Evidence

- MEASURED: Chrome Network captures showed repeated `sessions?tab=Live%20Now` and `chat` request families during Live viewing.
- MEASURED: one extended capture showed approximately 744 requests; a cleaner capture showed approximately 155 requests.
- NOT YET MEASURABLE: exact requests/minute from screenshots alone because reliable observation durations were not captured.
- DERIVED: source-defined Live chat polling remains 4 seconds, producing mathematical scale projections in `11-polling-scale-projections.md`.

## 7. Feed Runtime Evidence

- MEASURED: F1 Web Feed cold load ran at `http://localhost:5173/` with `perfRunId=FEED-WEB-001`.
- MEASURED: home/feed loaded successfully and the first feed video became visible and usable/playing.
- MEASURED: `[ParagonPerf]` instrumentation was active and included `feed.player.create`, `feed.player.waiting`, `feed.snapshot`, `feed.player.metadata`, `feed.player.ready`, and `feed.video.first_frame_ms`.
- MEASURED: repeated `feed.player.waiting` → `feed.player.ready` → `feed.video.first_frame_ms` sequences occurred during continued playback.
- NOT YET MEASURABLE: numeric F1 `durationMs` values, first-frame timing classification, player create/release counts, and exact repeated-lifecycle counts because the expanded event object values were not provided.
## 8. Scale Projections

Live chat polling at 4 seconds derives to 25 req/sec at 100 viewers, 250 req/sec at 1,000, 2,500 req/sec at 10,000, 25,000 req/sec at 100,000, and 62,500 req/sec at 250,000. These are DERIVED mathematical projections, not load-test results.

## 9. Classification

- MEASURED: source constants, build/test durations, emitted log fields, localhost CORS/test-environment correction evidence, one production broadcaster startup sample, one production WHEP viewer startup sample, observed repeated Live request families, and F1 web feed successful cold-load/event-sequence evidence.
- DERIVED: polling requests/sec and requests/min from source-defined intervals.
- ESTIMATED: future scale risk implications where no runtime load test exists.
- NOT YET MEASURABLE: WHEP/ICE/media-arrival sub-stage attribution, exact Firestore billed reads, exact Live requests/minute from screenshots alone, numeric F1 feed timings from unexpanded console summaries, Android Live/feed player lifecycle, and complete Live matrix results.

## 10. Top Observed Bottlenecks

- MEASURED: WHEP viewer startup can be slow; the production sample took approximately 15.280s from watch selection to first playing frame.
- MEASURED: web broadcaster startup can take multiple seconds; the production sample took approximately 6.220s from GO LIVE to directory active.
- MEASURED/PARTIAL: repeated session/chat polling is visible during Live viewing, but exact runtime rate still needs timestamped capture.
- MEASURED/PARTIAL: F4 confirmed repeated web video startup black-screen behavior across 13 navigations; exact event durations/counts still require expanded console logs.

## 11. Unknowns

WHEP negotiation vs ICE vs media readiness split, HLS vs WHEP startup distribution, Android player lifecycle churn, real 429/5xx pressure under concurrent traffic, and exact Firestore amplification under active rooms require more targeted measurement.

## 12. Deferred Runtime Tests

- DEFERRED / NOT YET TESTABLE: R1 private video-call setup because private video-call setup is not yet complete.
- DEFERRED / NOT YET TESTABLE: M1 MeetUp setup for this measurement sequence because required setup/functionality is not yet complete.

## 12. Phase 2 Readiness

Phase 2 is not ready yet. Current recommendation: continue targeted Phase 1 manual measurement, next requiring explicit approval for W2 Vote because it may affect wallet value.







## 13. Wallet Runtime Evidence

- MEASURED/PARTIAL: W1 wallet balance pages rendered successfully on web and Android.
- NOT RECORDED: actual wallet balance amounts are intentionally omitted from Phase 1 documentation.
- NOT YET MEASURABLE: wallet API duration, backend Firestore duration, transaction-history query duration, and route-level status classification because expanded timing events/backend logs were not provided.
- PRESERVED: no deposit, withdrawal, vote, support action, or financial mutation was performed for W1.
