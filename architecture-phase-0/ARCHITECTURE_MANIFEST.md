# Architecture Manifest

## 1. Current Architecture Diagram

```text
Web React / Android Native
|
+-- Firebase Auth + App Check
+-- Node/Express REST API on Cloud Run
|   |
|   +-- Firestore
|   +-- Cloudflare Stream Live
|   +-- Cloudflare RealtimeKit
|   +-- Cloudflare R2
|   +-- Paystack
|   +-- Google Play Billing
|
+-- Cloudflare media playback/ingest
+-- Selected direct Firebase client reads/listeners
```

## 2. Domain Ownership

| Domain | Current Owner |
|---|---|
| Identity/Auth | Firebase Auth, backend auth middleware/routes, web auth context, Android session/AuthViewModel/PPIF |
| Profile/Social | profile screens/pages, public profile helpers, Firestore profile collections |
| Feed | video APIs, `Explore.jsx`, `VideoGrid.jsx`, `FeedScreen.kt`, `HomeFeedPlaybackController.kt` |
| Media | backend video service/processor/queue, Cloudflare R2, player components |
| Live | backend Live controller/routes, Cloudflare Stream Live, web/Android Live screens |
| Realtime Calls | backend realtime controller, Cloudflare RealtimeKit, private call screens |
| MeetUp | web and Android MeetUp screens/repositories |
| Wallet/Finance | backend wallet/payment/support controllers and ledger/wallet collections |
| Marketplace | marketplace controller, services, routes, pages, Android API methods |
| Notifications/Admin | marketplace notifications/audit/admin routes and screens |

## 3. Realtime Ownership

| Area | Current Mechanism | Future Boundary |
|---|---|---|
| Live comments | REST post + 4s polling from Firestore subcollection | room realtime fanout plus durable append |
| Live presence | heartbeat writes on `live_sessions` | ephemeral presence/lease with durable summary |
| Private calls | Cloudflare RealtimeKit rooms/tokens | preserve media/SFU, share signalling patterns |
| MeetUp | client/session flows and listeners | possible shared signalling |
| Notifications | durable Firestore notifications and client fetch/listen | lightweight fanout, durable notification records |

## 4. Firestore Data Classification

- Transactional truth: `wallet_accounts`, `ledger_entries`, `deposits`, `withdrawals`, `processed_payments`, `marketplace_escrow`, marketplace settlement/order finance.
- Durable app data: `videos`, profiles, follows, comments, saved videos, Live sessions, call history, marketplace catalog/orders/messages/notifications/audit.
- Ephemeral realtime data currently persisted: Live chat as primary transport, Live heartbeat/active state, native X OAuth pending sessions.

## 5. Media-Plane Ownership

- Uploaded videos: Cloudflare R2 objects; backend authorizes upload and writes/processes metadata.
- Live broadcast ingest/playback: Cloudflare Stream Live; web uses WHIP, Android uses RTMPS, viewers use WHEP/HLS where available.
- Private calls: Cloudflare RealtimeKit/SFU rooms and participant tokens.
- App servers coordinate media, but should not relay media bytes.

## 6. Financial Authority Boundary

Wallet balances, votes/support charges, deposits, withdrawals, escrow, settlements, and ledger entries must remain backend-authoritative. Realtime/WebSocket systems may broadcast results but must never become the financial source of truth.

## 7. Top Scaling Risks

1. Live chat 4-second polling creates linear read amplification.
2. Live session directory polling repeats backend/Firestore work.
3. Host heartbeat writes use durable session documents for active presence.
4. Rate limits are process-local under horizontal scaling.
5. Profile enrichment creates hot repeated reads.
6. Large client files combine UI, media, network, state, and business behavior.
7. Player lifecycle/remount behavior can create decoder churn.
8. Cloudflare playback hydration during Live listing can add provider latency.
9. Marketplace controller breadth raises maintenance and incident risk.
10. Firestore is used for some realtime-ish high-frequency state.

## 8. Files Most Urgently Needing Future Separation

- `frontend/src/pages/ParagonLive.jsx`
- `frontend/src/components/Explore.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/SharedInbox.jsx`
- `frontend/src/pages/MerchantMarketplace.jsx`
- `android-native/app/src/main/java/com/app/natureswayproduction/nativeapp/feature/live/ParagonLiveScreen.kt`
- `android-native/app/src/main/java/com/app/natureswayproduction/nativeapp/feature/feed/FeedScreen.kt`
- `android-native/app/src/main/java/com/app/natureswayproduction/nativeapp/data/api/ParagonApiService.kt`
- `backend/src/controllers/marketplace.controller.js`
- `backend/src/live/live.controller.js`
- `backend/src/realtime/realtime.controller.js`

## 9. Infrastructure To Preserve

- Firebase Auth/App Check boundary.
- Backend-authoritative wallet and ledger transactions.
- Cloudflare Stream Live for Live ingest/playback.
- Cloudflare RealtimeKit for private call media rooms.
- Cloudflare R2 for uploaded media storage.
- Paystack and Google Play as payment integrations.
- Existing web/Android Live interoperability matrix.

## 10. Infrastructure Not To Duplicate

- Do not duplicate wallet/ledger truth in realtime infrastructure.
- Do not duplicate Cloudflare Stream media transport with app-server media relay.
- Do not duplicate Cloudflare RealtimeKit SFU/private-call media with a socket room layer.
- Do not create Durable Objects before Phase 1 measurements and Phase 2 design.

## 11. Recommended Migration Order

1. Phase 0 — Architecture discovery and baseline protection.
2. Phase 1 — Observability and measurable performance baseline.
3. Phase 2 — Shared realtime foundation / Live realtime migration.
4. Phase 3 — Feed/Explore performance architecture.
5. Phase 4 — Client/API repository boundaries.
6. Phase 5 — Firestore query/index optimization.
7. Phase 6 — Hot-data caching.
8. Phase 7 — Wallet/voting scale hardening.
9. Phase 8 — Marketplace decomposition.
10. Phase 9 — Profile/directory optimization.
11. Phase 10 — Progressive load testing.

## 12. Clear Phase 1 Objective

Instrument and measure the current system without behavior changes: API latency, Live startup, viewer time-to-first-frame, WHEP/HLS readiness, Firestore reads/writes, chat latency, backend errors/rate limits, wallet transaction latency, marketplace latency, feed startup, Android player reuse, and Cloud Run instance behavior.
