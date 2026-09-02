# Web Feed Optimization

## Change made

Added a bounded visual bridge for active web feed playback:

- `Explore.jsx` now passes the existing `video.thumbnailUrl` into `VideoPlayer`.
- `VideoPlayer.jsx` keeps that thumbnail visible until the first `playing` event for the assigned source.
- The underlying player lifecycle, source assignment, autoplay behavior, HLS handling, polling, APIs, and media transport are unchanged.

## Why this is safe

- It does not preload the entire feed.
- It does not add a new player pool.
- It does not change Feed API behavior.
- It does not change Firestore queries.
- It does not change wallet, vote, Live, marketplace, auth, or backend behavior.
- It only preserves the already-available thumbnail visual while the existing player prepares the same video.

## Validation

- Web production build: PASSED.
- Command: `npm run build` from `frontend/`.
- Result: Vite build completed in 14.96s.
- Bundle warning remains: main chunk is larger than 500 kB; this existed as a known bundle concern and was not addressed in this feed transition patch.

## Measurement status

- Before: MEASURED / PARTIAL, 13 of 13 videos played with approximately 2–3 seconds black-screen startup per navigation.
- After: MEASURED / PARTIAL, 13 of 13 videos played; black-screen transition was reduced but not completely removed.

## Smallest proposed follow-up

Add a bounded next-video preparation path for web feed only:

- Keep rendering the visible active `VideoPlayer` exactly as today.
- Prepare at most one next playable video, not the whole feed.
- Do not autoplay the prepared next item.
- Do not render it visibly or redesign the UI.
- Reuse existing `VideoPlayer` source handling where safe, or add a minimal hidden/preload-only media preparation component.
- Keep memory and bandwidth bounded to one adjacent item.

Expected effect: reduce the remaining activation-time delay by moving metadata/manifest/source preparation for the next video before the user lands on it.

Implementation was approved and completed.

## Follow-up implementation

Files changed:

- `frontend/src/components/Explore.jsx`
- `frontend/src/components/VideoPlayer.jsx`

Implementation details:

- `Explore.jsx` computes only the immediately next playable video after the current `activeIndex`.
- `Explore.jsx` renders exactly one `FeedNextVideoPreloader` for that next playable video.
- `VideoPlayer.jsx` exports `FeedNextVideoPreloader`, a hidden muted metadata/manifest preparation element.
- The preloader logs `feed.preload.next.start`, `feed.preload.next.ready`, `feed.preload.next.release`, and `feed.preload.next.error`.
- HLS preparation uses `autoStartLoad: false` and marks ready at manifest parse, avoiding intentional full video buffering.
- File/video preparation uses native `preload="metadata"` and marks ready at metadata/canplay.
- Cleanup pauses, removes the source, calls `load()`, destroys the HLS instance, and logs release.

## Bounded lifecycle

When active item is `N`:

1. Visible `VideoPlayer` plays item `N`.
2. `Explore.jsx` finds the first playable item after `N`, normally `N+1`.
3. Only that one source is passed to `FeedNextVideoPreloader`.
4. If `activeIndex` changes, React replaces/releases the old preloader and prepares the new next source.
5. No `N+2`, `N+3`, or feed-wide media loop is created.

## Expected network impact

- One additional adjacent source may fetch metadata or HLS manifest while the current video is active.
- The implementation does not intentionally download complete videos.
- HLS segment loading is not intentionally started during preload.
- Network use remains bounded to at most one next playable item.

## Risks

- Some browsers may fetch more than metadata for direct file URLs despite `preload="metadata"`.
- HLS manifest readiness may not fully eliminate first-frame delay because segment/decoder startup still occurs on active playback.
- If feed order changes rapidly, releases should occur frequently but remain bounded to one hidden element.

## Rollback

Rollback by removing:

- `FeedNextVideoPreloader` import and render from `Explore.jsx`.
- `FeedNextVideoPreloader` export and `preloadVideoStyle` from `VideoPlayer.jsx`.

Keep the thumbnail bridge unless specifically reverting Optimization Patch 1.

## Validation

- Web production build: PASSED.
- Command: `npm run build` from `frontend/`.
- Result: Vite build completed in 28.49s.
- Initial sandboxed build attempt failed due sandbox file-access limits; escalated build passed.

