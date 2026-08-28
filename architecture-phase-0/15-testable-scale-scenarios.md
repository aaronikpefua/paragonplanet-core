# Testable Scale Scenarios

| Scenario | Baseline Tiers | Metrics |
|---|---:|---|
| Registered users | 10k / 100k / 1M | auth/profile costs |
| Daily active users | 1k / 10k / 100k | API latency and Firestore reads |
| Concurrent online users | 500 / 5k / 50k | backend concurrency/errors |
| Concurrent feed viewers | 100 / 1k / 10k | first content, first frame |
| Concurrent Live viewers per room | 50 / 500 / 5k | viewer startup, chat latency, API reads |
| Concurrent Live broadcasters | 10 / 100 / 1k | start latency, heartbeat writes |
| Live comments per second | 5 / 50 / 500 | send-to-visible latency |
| Reactions/support per second | 1 / 10 / 100 | wallet transaction p95, ledger correctness |
| Votes per second | 1 / 10 / 100 | debit/counter/idempotency behavior |
| Wallet transactions per second | 1 / 10 / 100 | Firestore transaction retries |
| Marketplace messages per second | 5 / 50 / 500 | inbox/query latency |
| Private video calls | 10 / 100 / 1k concurrent | room creation and token issuance |
| MeetUp calls | 10 / 100 / 1k concurrent | signalling/session latency |

No massive load tests should run in Phase 0. Phase 1 should instrument and measure first.
