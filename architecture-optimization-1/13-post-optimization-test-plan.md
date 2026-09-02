# Post-Optimization Test Plan

## Next manual test

Run exactly one test next: `FEED-WEB-NAV-POST-002`.

## Steps

1. Open `http://localhost:5173/`.
2. Ensure the performance run ID is `FEED-WEB-NAV-POST-002` if the debug control is available.
3. Navigate normally through at least 13 feed videos.
4. Do not stress-swipe.
5. Confirm how many of the 13 videos played.
6. Compare visible startup delay against:
   - original baseline: approximately 2–3 seconds black screen;
   - Optimization Patch 1: reduced but still visible.
7. Classify the new transition as `GONE`, `NEARLY GONE`, `REDUCED FURTHER`, `UNCHANGED`, or `WORSE`.
8. Capture any available preload/player instrumentation events.

## Stop condition

Do not proceed to Live optimization until FEED-WEB-NAV-POST-002 is reviewed.

