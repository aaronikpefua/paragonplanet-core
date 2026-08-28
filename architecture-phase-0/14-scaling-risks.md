# Scaling Risks

| Severity | Risk | Current Mechanism | Why Expensive | Domain | Future Category |
|---|---|---|---|---|---|
| Critical | Live chat read amplification | every room client polls chat about every 4 seconds | backend/Firestore reads grow linearly with viewers | Live | realtime fanout + durable append |
| High | Live directory polling | clients repeatedly call `/api/live/sessions` | repeated session/profile/follow reads | Live/Discovery | cached read model/push invalidation |
| High | Heartbeat durable writes | hosts update `live_sessions` | many broadcasters create high-frequency writes | Live | presence/lease separation |
| High | Process-local rate limits | in-memory custom and express limiters | limits weaken across multiple instances | Backend/API | shared/edge limiter |
| High | Profile enrichment | repeated `public_profiles` reads | N+1-style hot reads | Feed/Profile/Live | batched API/read cache |
| High | Large client files | Live/feed/profile files mix UI/network/media/state | regressions and remount/retry risks | Web/Android | client boundaries |
| Medium | Player/decoder churn | player lifecycle in large UI screens | remounts and multiple players slow startup | Feed/Live | measured player reuse |
| Medium | Cloudflare playback hydration in list | backend may hydrate playback during session listing | provider latency slows listing | Live | background hydration/cache |
| Medium | Marketplace controller breadth | one controller owns many flows | hard maintenance and incident isolation | Marketplace | internal modules |
| Medium | Firestore for realtime-ish state | chat/presence-like data persisted directly | high-frequency events become durable write/read load | Live/Realtime | ephemeral room state |
| Medium | Android monolithic API service | one service owns all domain methods | auth/retry/cache coupling | Android | domain API interfaces |
| Low | Local UI timers | controls/progress loops | local CPU only | UI | profile if jank appears |
