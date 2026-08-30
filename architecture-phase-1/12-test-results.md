# Test Results

This file is updated from local validation and manual runtime evidence.

| Validation/Test | Result | Classification | Notes |
|---|---|---|---|
| Backend tests | passed | MEASURED | `npm test`; latest run 4 files passed, 51 tests passed; Vitest duration 4.67s |
| Web production build | passed | MEASURED | `npm run build`; 17.217s; dist 17 files, 7,491,470 bytes |
| Android debug build | passed | MEASURED | `\.\gradlew.bat assembleDebug`; latest run 29s; 38 actionable tasks up-to-date; historical Phase 1 run 83.469s with 4 executed |
| Secret-safety search | safe | MEASURED | candidates are existing token/header handling or env var names; no secret values added to logs/docs |
| Localhost CORS origin | passed after correction | MEASURED | controlled `ADDITIONAL_CORS_ORIGINS=http://localhost:5173` enabled localhost instrumentation |
| Localhost CORS request headers | passed after correction | MEASURED | `X-Request-Id` added to CORS `allowedHeaders` |
| Production web broadcaster startup sample | captured | MEASURED | GO LIVE to directory active approximately 6.220s |
| Production web WHEP viewer startup sample | captured | MEASURED | watch selected to first playing frame approximately 15.280s |
| Localhost LIVE-WW-001 | partial | MEASURED/PARTIAL | instrumented localhost Live functioning and video visibly playing; complete benchmark still incomplete |
| F1 Web Feed cold load | captured | MEASURED/PARTIAL | home/feed loaded successfully, first video visible/usable/playing, eed.* instrumentation active with perfRunId=FEED-WEB-001; numeric durationMs values not provided |
| F2 Android Feed cold load | captured visually | MEASURED/PARTIAL | Android feed loaded and first video was visible/usable/playing; user reported it was a bit fast; Logcat timing entries were not captured |
| F3 Android 13-video swipe | captured visually | MEASURED/PARTIAL | user swiped normally through 13 videos; all played normally with no black screen and no major stalls; numeric player lifecycle timings not captured |
| F4 Web video navigation | captured | MEASURED/PARTIAL | 13/13 videos eventually opened and played; each navigation showed approximately 2-3 seconds of black-screen startup; no permanent failure or major post-start stall; numeric event durations not provided |
| R1 Private video-call setup | deferred | DEFERRED / NOT YET TESTABLE | private video-call setup is not yet complete; not a failed test |
| M1 MeetUp setup | deferred | DEFERRED / NOT YET TESTABLE | MeetUp setup depends on incomplete setup/functionality for this measurement sequence; not a failed test |
| W1 Wallet balance | captured visually | MEASURED/PARTIAL | web and Android wallet balance pages rendered successfully; actual balances intentionally omitted; numeric wallet/API durations not provided |







