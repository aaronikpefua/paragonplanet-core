# Live Architecture

## Lifecycle

```text
GO LIVE
-> backend creates/updates `live_sessions`
-> backend creates Cloudflare Stream Live Input
-> ingest returned to broadcaster
-> web publishes by WHIP or Android publishes by RTMPS
-> session becomes ACTIVE
-> viewers discover through `/api/live/sessions`
-> playback starts through WHEP or HLS
-> chat uses REST polling/posting
-> support actions use backend wallet transactions
-> host heartbeat keeps session fresh
-> host ends or stale session expires
-> replay playback is hydrated if Cloudflare recording/playback exists
```

## Platform Matrix

| Direction | Current Path |
|---|---|
| Web broadcaster to Web viewer | browser camera, WHIP publish, WHEP/HLS playback |
| Web broadcaster to Android viewer | WHIP publish, Android WHEP or HLS playback |
| Android broadcaster to Web viewer | Android RTMPS publish, web HLS playback |
| Android broadcaster to Android viewer | Android RTMPS publish, Android HLS playback |

## Cloudflare/Transport Use

- WHIP: web broadcaster ingest through Cloudflare Stream Live.
- WHEP: low-latency playback when Cloudflare playback URL is available.
- RTMPS: Android broadcaster ingest through `ParagonLiveBroadcaster.kt`.
- HLS/DASH: playback fallback and replay path.
- Cloudflare Stream Live: creates Live Input, ingest credentials, playback URLs, and replay playback metadata.
- App server role: coordinates sessions and credentials; it does not relay video bytes.

## Polling and State

- Live listing is polled by web and Android clients.
- Live chat is polled at approximately 4 seconds.
- Host heartbeat is REST-based and updates `live_sessions`.
- Active freshness uses backend windows in `live.controller.js`.
- Support actions are posted to backend and processed with wallet/ledger transactions.

## Preserve

The current baseline has already shown all four web/Android broadcaster/viewer directions working. Future architecture work must protect this matrix before optimization.
