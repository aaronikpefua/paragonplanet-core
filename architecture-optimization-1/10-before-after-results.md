# Before / After Results

## Web feed transition

| Metric | Before | After | Classification |
| --- | --- | --- | --- |
| Successful web video navigations | 13/13 | 13/13 | MEASURED / PARTIAL |
| Visible black-screen startup | Approximately 2–3 seconds on each navigation | Reduced, still visible | MEASURED / PARTIAL |
| Permanent playback failure | None observed | None observed | MEASURED |
| Post-start major stall | None observed | None reported | MEASURED / PARTIAL |
| Numeric first-frame timings | Not available from supplied evidence | Not supplied in post-test result | NOT YET MEASURABLE |

## FEED-WEB-NAV-POST-002

Classification: MEASURED / IMPROVED / PARTIAL.

- 13 of 13 videos played successfully.
- Original baseline: approximately 2–3 seconds black screen on navigation.
- Patch 1: black screen reduced.
- Patch 2: black screen reduced further.
- Remaining delay may still exist and should stay measurable in later feed tests.

## Required after-test

FEED-WEB-NAV-POST-001 has been completed. A second after-test is only needed if the bounded next-video preparation follow-up is approved and implemented.

## FEED-WEB-NAV-POST-002 procedure

Run after bounded next-video preparation:

1. Open `http://localhost:5173/`.
2. Use run ID `FEED-WEB-NAV-POST-002` where the current debug tooling supports it.
3. Navigate normally through at least 13 feed videos.
4. Do not stress-swipe.
5. Record successful playback count.
6. Classify visible transition as `GONE`, `NEARLY GONE`, `REDUCED FURTHER`, `UNCHANGED`, or `WORSE`.
7. Capture available `feed.preload.next.start`, `feed.preload.next.ready`, `feed.preload.next.release`, `feed.preload.next.error`, `feed.player.source_assigned`, `feed.player.waiting`, `feed.player.ready`, and `feed.video.first_frame_ms`.

Success should be based on reduced visible startup delay, not merely successful playback.

