# Test Matrix

## Live

- TEST L1: Web broadcaster → Web viewer. Status: PARTIAL. Localhost instrumentation works and video was visibly playing with `perfRunId=LIVE-WW-001`, but complete benchmark fields are not fully captured.
- TEST L2: Web broadcaster → Android viewer. Status: NOT YET MEASURABLE in current manual sequence.
- TEST L3: Android broadcaster → Web viewer. Status: NOT YET MEASURABLE in current manual sequence.
- TEST L4: Android broadcaster → Android viewer. Status: NOT YET MEASURABLE unless a second Android device/emulator is available.

## Live Additional Evidence

- Production web broadcaster startup sample: MEASURED, approximately 6.220s from GO LIVE to directory active.
- Production web WHEP viewer startup sample: MEASURED, approximately 15.280s from watch selected to first playing frame.
- Live polling request repetition: MEASURED observation; exact requests/minute remains NOT YET MEASURABLE without timed logs.

## Feed

- TEST F1: Web Feed cold load. Status: PARTIAL/MEASURED. Home/feed loaded successfully and first video became visible/usable/playing with perfRunId=FEED-WEB-001; numeric timing values still need expanded console entries.
- TEST F2: Android Feed cold load. Status: PARTIAL/MEASURED. Android feed loaded and first video was visible/usable/playing; Logcat timing values were not captured.
- TEST F3: Android continuous swipe through at least 10 videos. Status: PARTIAL/MEASURED. User swiped normally through 13 videos; all played normally with no black screen and no major stalls; numeric lifecycle timing remains unavailable.
- TEST F4: Web continuous navigation through videos. Status: PARTIAL/MEASURED. 13/13 videos opened and played; approximately 2-3 seconds black-screen startup was observed on each navigation; exact numeric event durations were not provided.

## Calls, Finance, Marketplace, Auth

- TEST R1: Private video-call setup. Status: DEFERRED / NOT YET TESTABLE. Private video-call setup is not yet complete; not classified as failed.
- TEST M1: MeetUp setup. Status: DEFERRED / NOT YET TESTABLE. MeetUp setup depends on incomplete setup/functionality for this Phase 1 measurement sequence; not classified as failed.
- TEST W1: Wallet balance. Status: PARTIAL/MEASURED. Web and Android wallet pages rendered successfully; actual balances omitted; numeric latency not captured.
- TEST W2: Vote. Status: NEXT RECOMMENDED / APPROVAL REQUIRED. Do not perform with real funds or value without explicit approval.
- TEST W3: Pour/Spray/Pop representative support operation. Status: NOT YET MEASURABLE; do not perform with real funds without approval.
- TEST MP1: Marketplace product list. Status: NOT YET MEASURABLE.
- TEST MP2: Marketplace message. Status: NOT YET MEASURABLE.
- TEST MP3: Marketplace settlement flow in safe development/test conditions only. Status: NOT YET MEASURABLE.
- TEST A1: Existing auth login/session restoration. Status: NOT YET MEASURABLE.

Do not perform real-money operations merely to collect metrics.






