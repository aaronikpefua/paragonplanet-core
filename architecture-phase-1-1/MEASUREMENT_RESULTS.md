# Measurement Results

## 1. Test Environment

- Date/time: `2026-08-28T21:24:04.9583621+01:00` — MEASURED.
- Branch: `checkpoint/pre-architecture-2026-08-28` — MEASURED.
- HEAD: `802db9c docs: complete Paragon Planet Architecture Phase 0` — MEASURED.
- Working tree: expected uncommitted Phase 1 observability/docs/scripts — MEASURED.
- Windows: Windows 10 Pro version 2009 — MEASURED.
- Java: Android Studio JBR OpenJDK `21.0.10` — MEASURED.
- Android device: none connected by `adb devices` — MEASURED.

## 2. Tests Completed

- Repository state verification — MEASURED.
- Phase 1 documentation and instrumentation review — MEASURED.
- Environment capture — MEASURED.
- Polling projection review — ESTIMATED from source-observed intervals.
- Phase 2 readiness review — DERIVED from available measurements and gaps.

## 3. Tests Not Completed

Live L1-L4, Live repeat, Feed F1-F4, Private Call R1, MeetUp M1, Wallet W1, Vote W2, Support W3, Marketplace MP1-MP3, and Auth A1 were NOT YET MEASURABLE because no interactive browser/device/authenticated test sessions were available.

## 4. Live Measurements

Manual Live measurements are NOT YET MEASURABLE. No Live runtime session was run.

## 5. Live Stability Findings

Intermittent black-screen/buffering was NOT YET MEASURABLE in this milestone because no Live playback session was captured.

## 6. HLS Findings

HLS startup is instrumented on web and Android can log API timing, but HLS runtime startup measurements are NOT YET MEASURABLE without a manual Live viewer run.

## 7. WHEP Findings

WHEP startup is distinguishable in web Live instrumentation, but runtime WHEP measurements are NOT YET MEASURABLE without a manual WHEP viewer run.

## 8. Player Lifecycle Findings

Web feed player creation/release/waiting/error events can be measured. Android detailed player churn remains PARTIAL and requires device Logcat/player lifecycle capture.

## 9. Live Polling Counts

No runtime counts were captured. Source-observed chat polling interval is 4 seconds.

## 10. Chat Amplification Projections

At 4-second chat polling: 100 viewers ≈ 25 req/sec, 1,000 ≈ 250 req/sec, 10,000 ≈ 2,500 req/sec, 100,000 ≈ 25,000 req/sec, 250,000 ≈ 62,500 req/sec. These are ESTIMATED.

## 11. Feed Measurements

Feed runtime measurements are NOT YET MEASURABLE.

## 12. Private Call Measurements

Private-call runtime measurements are NOT YET MEASURABLE.

## 13. MeetUp Measurements

MeetUp runtime measurements are NOT YET MEASURABLE.

## 14. Wallet/Vote/Support Measurements

Wallet, vote, and support runtime measurements are NOT YET MEASURABLE without safe authenticated test wallet state.

## 15. Marketplace Measurements

Marketplace runtime measurements are NOT YET MEASURABLE without safe marketplace test state.

## 16. Auth Measurements

Auth/session restoration is NOT YET MEASURABLE without an interactive authenticated client session.

## 17. API 429/5xx Findings

No runtime API requests were captured. 429/5xx by normalized route are measurable once logs exist.

## 18. Firestore Application-Level Amplification

No runtime Firestore operation logs were captured. Application-level amplification is measurable once Live/feed/realtime traffic is generated.

## 19. MEASURED Results

- Git branch, HEAD, and working tree state.
- Windows version.
- Java version.
- No connected Android device.
- Phase 1 instrumentation exists and was reviewed.

## 20. DERIVED Results

- Phase 2 readiness result is derived from critical missing manual runtime evidence.

## 21. ESTIMATED Results

- Live chat and directory polling projections.

## 22. NOT YET MEASURABLE Items

Manual Live/feed/call/MeetUp/wallet/support/marketplace/auth timings, intermittent buffering classification, exact Firestore billed reads, and production Cloud Run behavior.

## 23. Top Evidence-Backed Bottlenecks

No runtime bottlenecks were observed in Phase 1.1. The strongest evidence-backed risk remains source-observed Live chat polling amplification.

## 24. Phase 2 Readiness Table

Phase 2 is not ready. Critical runtime Live/stability/player/polling/Firestore measurements are still missing.

## 25. Recommended Next Milestone

PHASE 1.2 — Instrumentation Gap Correction and Controlled Manual Measurement Run. Connect Android device/emulator and browser sessions, run the full test matrix, capture logs, summarize with the performance script, then re-evaluate Phase 2.
