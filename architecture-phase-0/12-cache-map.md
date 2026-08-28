# Cache Map

| Cache | Owner | Data | TTL/Invalidation | Scope |
|---|---|---|---|---|
| React state | web pages/components | videos, Live sessions, chat, support modal state | component lifecycle/refetch | one browser tab |
| Firestore listeners | web flows | messages/meetup/profile snapshots | listener lifecycle | one browser tab |
| Android ViewModel/Compose state | Android screens | screen state, feed/live/profile/wallet data | screen/process lifecycle | one device process |
| Android Media3/ExoPlayer buffers | Android playback | active media buffers | player lifecycle | one device |
| Browser media/HLS buffers | web playback | media segments/manifests | browser/player lifecycle | one browser |
| Cloudflare Stream/CDN | Cloudflare | Live/playback media | provider-defined | edge/global |
| Cloudflare R2/public URLs | Cloudflare | uploaded objects | object/CDN behavior | edge/global |
| Custom backend rate limiter | backend process | request counters | `windowMs` | one Cloud Run instance |
| Express-rate-limit memory store | marketplace routes | request counters | 60s windows | one instance unless configured |

## Future Hot Cache Candidates

`public_profiles`, Live directory summaries, feed pages, marketplace product/catalog reads, and video profile cards. Financial truth should not be cached as authority.
