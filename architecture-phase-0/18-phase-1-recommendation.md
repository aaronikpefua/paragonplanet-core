# Phase 1 Recommendation

## Objective

Add observability and establish a measurable performance baseline without changing product behavior.

## Measurements

- API p50/p95/p99 latency by route/domain.
- Live session start latency from button click to backend response.
- Broadcaster time to first published frame and active mark.
- Viewer time to first frame for WHEP and HLS separately.
- HLS manifest readiness timing and failure rate.
- WHEP startup, ICE timeout, and error rate.
- Firestore reads/writes per Live viewer and broadcaster.
- Live chat send-to-visible latency and polling request rate.
- Backend 429/4xx/5xx rates by route.
- Wallet/support transaction latency and retry/failure rate.
- Marketplace transaction/message/admin latency.
- Feed first-content time and first-video-frame time.
- Android player creation/reuse counts and jank/dropped frames if measurable.
- Cloud Run instance count, concurrency, and cold starts where available.

## Not Phase 1

Do not migrate Live realtime, add Durable Objects, split APIs, add Redis, refactor feed, or change financial behavior until measurements exist.
