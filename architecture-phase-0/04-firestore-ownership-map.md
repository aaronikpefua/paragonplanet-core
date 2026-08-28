# Firestore Ownership Map

| Collection | Purpose | Writers | Readers | Owner | Classification |
|---|---|---|---|---|---|
| `wallet_accounts` | PARAG/GBAZILO balances and locked balances | backend finance/support/marketplace/realtime | wallet APIs/backend | backend | transactional truth |
| `ledger_entries` | financial ledger | backend only | backend/admin | backend | transactional truth |
| `transactions` | transaction records where used | backend/legacy | wallet/admin | backend target | transactional/durable |
| `deposits` | Paystack deposit records | backend | wallet/admin | backend | transactional truth |
| `withdrawals` | withdrawal requests | backend | wallet/admin | backend | transactional truth |
| `bank_accounts` | bank metadata if present | backend/client | wallet UI | mixed | durable app data |
| `processed_payments` | Google Play purchase idempotency | backend | backend | backend | transactional truth |
| `videos` | feed media metadata and counters | upload/processor/support backend, possible clients | feed/backend | mixed | durable hot data |
| `video_processing_jobs` | processing queue state | backend | backend | backend | operational data |
| `upload_daily_limits` | upload quota counters | backend policy | backend | backend | operational/rate data |
| `public_profiles` | public profile card data | profile/sync flows | feed/live/realtime/clients | shared | durable hot data |
| `user_profiles` | base user profile | auth/profile | clients/backend | mixed | durable app data |
| `citizen_profiles` | citizen role profile | onboarding/profile | clients/backend | mixed | durable app data |
| `promoter_profiles` | promoter role profile | onboarding/profile | clients/backend | mixed | durable app data |
| `merchant_profiles` | merchant role profile | onboarding/marketplace | clients/backend | mixed | durable app data |
| `creator_follows` | follow graph | clients/backend | live/feed/social | mixed | durable social data |
| `video_comments` | feed video comments | client/backend comments | feed/watch | mixed | durable social data |
| `saved_videos` | saved videos | clients | clients | client | durable user data |
| `video_supports` | video vote/pour/spray/pop events | backend support | backend/UI | backend | transactional support event |
| `live_sessions` | Live schedule/active/replay metadata | backend Live | web/android | backend | durable + operational room data |
| `live_sessions/{id}/chat_messages` | Live public chat | backend Live chat | broadcasters/viewers | backend API | durable realtime-ish data |
| `live_supports` | Live vote/pour/spray/pop events | backend Live support | backend/UI | backend | transactional support event |
| `realtime_call_plans` | private call plans/prices | admin/backend | realtime API | backend/admin | durable config |
| `realtime_call_sessions` | private call active state | backend realtime | web/android call screens | backend | durable session data |
| `realtime_call_history` | completed private calls | backend realtime | users/admin | backend | durable app data |
| `meetup_call_sessions` | MeetUp sessions if present | MeetUp flows | MeetUp screens | mixed | durable session data |
| `direct_messages` | direct chat | web/client flows | inbox UI | client-heavy | durable social data |
| `merchant_products` | product catalog/media metadata | merchant/upload flows | marketplace/feed | mixed | durable commerce data |
| `merchant_orders` | order state | marketplace backend | marketplace/admin | backend | transactional commerce data |
| `merchant_order_messages` | order conversation | marketplace/inbox | marketplace/inbox | mixed/backend | durable conversation data |
| `marketplace_escrow` | escrow account state | marketplace backend | backend/admin | backend | transactional truth |
| `marketplace_deliveries` | delivery submissions | marketplace backend | marketplace/admin | backend | durable commerce data |
| `marketplace_disputes` | dispute state | marketplace backend/admin | marketplace/admin | backend | transactional commerce data |
| `marketplace_notifications` | marketplace notifications | backend services | clients/admin | backend | durable notification data |
| `marketplace_audit_log` | audit trail | backend AuditService | admin | backend | durable audit data |
| `marketplace_settings` | marketplace config | admin backend | marketplace backend | backend/admin | durable config |
| `native_x_oauth_sessions` | pending native X OAuth state | backend native X | backend/native client | backend | ephemeral auth coordination |

## Ephemeral Persistence Flags

- Live chat is persisted in Firestore; acceptable for history but expensive as the primary high-frequency transport.
- Live heartbeat and active presence are stored on `live_sessions`; future room presence should avoid high-frequency durable writes.
- `native_x_oauth_sessions` is ephemeral coordination data and should have clear TTL/cleanup ownership.
