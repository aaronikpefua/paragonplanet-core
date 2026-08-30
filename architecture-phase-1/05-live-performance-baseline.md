# Live Performance Baseline

## Instrumented

- Backend API durations for all Live routes.
- Backend Firestore durations for session list/start/active/heartbeat/end/chat/support.
- Cloudflare Stream Live upstream request duration.
- Existing web `ParagonLiveTiming` events for viewer and browser publisher lifecycle.
- Web API correlation through `appCheckFetch` and `X-Request-Id`.

## Test-Environment Corrections

- MEASURED: local instrumented frontend runs at `http://localhost:5173` against the direct Cloud Run backend `https://backend-849823064688.us-central1.run.app`.
- MEASURED: backend CORS supports controlled `ADDITIONAL_CORS_ORIGINS=http://localhost:5173` without wildcard origins.
- MEASURED: backend CORS allows `X-Request-Id` for Phase 1 instrumentation without wildcard headers.
- MEASURED: backend revision `backend-00085-d9n` contains the CORS request-header correction.

## Current Manual Results

### Production Web Broadcaster Startup Sample

Classification: MEASURED.

| Event | Elapsed |
|---|---:|
| `T0_start_pressed` | 0ms |
| `T1_session_created` | approximately 1910ms |
| `T2_peer_created` | approximately 2044ms |
| `T3_ice_gathered` | approximately 2236ms |
| `T4_whip_connected` | approximately 5214ms |
| `T5_directory_active` | approximately 6220ms |

Interpretation: this single production sample took approximately 6.2 seconds from GO LIVE being pressed until the session became active in the Live directory. Do not generalize this one sample into a percentile.

### Production Web Viewer Slow WHEP Startup Sample

Classification: MEASURED.

- Session: `Qualification Update`.
- Scope: `web-viewer`.
- Transport: `whep`.
- `T0_watch_selected`: 0ms.
- `T5_first_remote_track`: 15213ms.
- `T6_first_frame_playing`: 15280ms.
- Watch selected to first remote track: approximately 15.213s.
- Watch selected to first playing frame: approximately 15.280s.
- First remote track to first playing frame: approximately 67ms.

Interpretation: this was not a permanent playback failure. The WHEP viewer eventually received the remote track and rendered the first playing frame. The majority of the delay occurred before the first remote track arrived, so current evidence points to slow WHEP/WebRTC startup or delayed remote media arrival rather than browser rendering delay, decoder delay, HLS manifest failure, player recreation, or permanent media failure.

### Localhost LIVE-WW-001 Status

Classification: PARTIAL / MEASURED sub-results.

- MEASURED: instrumented localhost Live is functioning.
- MEASURED: video was visibly playing.
- MEASURED: console contains `[ParagonPerf]` events with `perfRunId=LIVE-WW-001`.
- NOT YET MEASURABLE: a complete clean L1 result with all required timing fields, chat, heartbeat, polling counts, and end-state was not captured.

## WHEP Sub-Stage Gap

Classification: NOT YET MEASURABLE.

Chrome DevTools Network captures attempted to isolate the WHEP request. One capture contained 307 requests and zero matches for `whep`; a later cleaner capture contained approximately 155 requests, but no ordinary Fetch/XHR entry could be confidently identified as the Cloudflare WHEP negotiation request from screenshots. Current evidence cannot reliably separate the 15.213s delay into HTTP WHEP negotiation latency, ICE establishment latency, peer connection state latency, Cloudflare media readiness, or first remote RTP/media arrival.

## Live Polling Observation

- MEASURED: repeated `sessions?tab=Live%20Now` and `chat` request families were visible in Chrome Network captures.
- MEASURED: one extended capture accumulated approximately 744 requests; a cleaner capture accumulated approximately 155 requests.
- NOT YET MEASURABLE: exact requests/minute from screenshots alone because reliable observation duration was not captured.
- DERIVED: Live chat polling is 4 seconds from source and projections are documented in `11-polling-scale-projections.md`.

## What Can Now Be Measured

- `goLiveToSessionCreatedMs` from web client timing + backend API duration.
- `sessionCreateRequestMs` from `api.request` route logs.
- `publisherConnectMs` from web `ParagonLiveTiming` or Android Logcat/API plus broadcaster callbacks where available.
- `viewerOpenToFirstFrameMs` from web Live timing.
- Chat polling latency from API and Firestore logs.
- Heartbeat request count and latency from backend logs.
