# Web Feed Investigation

## Source inspected

- `frontend/src/components/Explore.jsx`
- `frontend/src/components/VideoPlayer.jsx`

## Source-level cause

The active feed item replaces the thumbnail placeholder with `VideoPlayer` only for the active index. Non-active playable items render a thumbnail-backed placeholder, but the active item immediately switches to a fresh video surface with a black background while the new source is assigned and prepared.

`VideoPlayer` sets `loading` while assigning the source, logs `feed.player.waiting`, then later logs `feed.player.ready` and `feed.video.first_frame_ms`. During that startup window, the visible media element is black unless the browser has already painted a video frame.

This matches the F4 manual evidence: playback succeeds, but each navigation has an approximately 2–3 second black-screen startup before first visible video frame.

## Post-patch investigation

FEED-WEB-NAV-POST-001 confirmed the thumbnail bridge reduced the black-screen transition but did not eliminate the remaining startup delay.

The remaining source-level bottleneck is that the next feed video is still not prepared before it becomes active:

- `Explore.jsx` attempts to set `nextVideo.preload = "metadata"` from the intersection observer.
- The next item does not contain a `<video>` element while inactive; it renders a thumbnail placeholder instead.
- Therefore `next?.querySelector("video")` normally finds nothing for the next playable item.
- When the user navigates, the active item mounts `VideoPlayer`, assigns the source, creates the player/HLS instance, waits for metadata/ready, then reaches first frame.
- The thumbnail bridge hides much of the visual black gap, but the underlying startup delay remains because media preparation still begins at activation time.

## Remaining dominant delay

Classification: MEASURED / SOURCE-CONFIRMED.

The remaining transition delay is dominated by on-activation player/source preparation rather than a permanent playback failure:

- Player recreation/source assignment occurs per active item.
- Metadata/readiness work starts after the item becomes active.
- Bounded next-video preload is effectively absent in the current source because inactive cards are not media elements.

## Inference boundary

- Observed: active feed videos show black before playback paints.
- Observed: inactive feed entries already have thumbnail placeholders.
- Inferred from source: the black interval is primarily a presentation gap during source preparation/first-frame readiness, not a permanent media failure.
- Not proven yet: exact split between network fetch, metadata, canplay, and first-frame timing for every video, because numeric `durationMs` values from F4 screenshots were not available.
- Observed after patch: black-screen transition is reduced but still visible.
- Source-confirmed after patch: next media is not actually preloaded by the existing intersection observer path because inactive cards do not render video elements.

