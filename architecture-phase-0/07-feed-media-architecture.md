# Feed and Media Architecture

## Feed / Explore

- Web feed is centered on `Explore.jsx`, `VideoGrid.jsx`, `VideoPlayer.jsx`, and `useVideos.js`.
- Android feed is centered on `FeedScreen.kt`, `FeedRepository.kt`, `FeedViewModel.kt`, `HomeFeedPlaybackController.kt`, and `HomeModes.kt`.
- Feed data comes through backend video listing APIs and is enriched with profiles, support counts, and local UI state.
- Web components combine UI, support actions, video playback, comments, local cache, and direct Firestore listener behavior.
- Android `FeedScreen.kt` is a large Compose owner for UI, support modals, player surfaces, and interaction state.

## Uploaded Video Pipeline

```text
client upload authorization
-> signed Cloudflare R2 URL
-> client uploads object
-> backend queues/triggers processing
-> video processor creates mobile/desktop variants and thumbnail
-> processed URLs and metadata are written to Firestore
-> feed APIs return playable metadata
-> web/Android players stream from media URLs
```

## Media Classes

| Class | Storage/Transport | Backend Role |
|---|---|---|
| Uploaded feed videos | Cloudflare R2 + public/processed URLs | authorize, process, write metadata |
| Live video | Cloudflare Stream Live | create input, store ingest/playback/session metadata |
| Private call media | Cloudflare RealtimeKit/SFU | create rooms/tokens |
| Marketplace media | R2/product/order metadata | upload/process/attach media |

## Risk Notes

- Profile enrichment can become an N+1/hot-read pattern.
- Player lifecycle is embedded in large UI files, increasing remount/decoder churn risk.
- App servers coordinate media but should continue avoiding media-byte relay.
