# Wallet and Finance Architecture

## Authority Boundary

Financial truth belongs to backend APIs and Firestore transactions. Future realtime systems may notify clients, but must not become the authority for balances, votes, deposits, withdrawals, escrow, settlements, or ledger entries.

| Flow | Authority | Key Data |
|---|---|---|
| Wallet create/balance | backend wallet controller | `wallet_accounts` |
| Admin/system credit | backend wallet controller | `wallet_accounts`, `ledger_entries` |
| PARAG/GBAZILO conversion | backend wallet route/controller | wallet + ledger |
| Paystack deposit | backend deposit controller | Paystack, `deposits`, wallet, ledger |
| Withdrawal | backend bank controller | Paystack, `withdrawals`, wallet |
| Google Play wallet purchase | backend billing controller | Google Play, `processed_payments`, wallet, ledger |
| Feed support/vote/pour/spray/pop | backend support controller | `videos`, `video_supports`, wallet, ledger |
| Live support/vote/pour/spray/pop | backend Live controller | `live_sessions`, `live_supports`, wallet, ledger |
| Private call payment | backend realtime controller | call sessions, wallet, ledger |
| Marketplace escrow/release/refund | backend marketplace controller/services | escrow, orders, wallet, ledger |

## Protections Observed

- Firestore transactions are used for wallet/support/marketplace/realtime financial flows.
- Paystack verification uses sanitized reference-based ledger/deposit records.
- Google Play verification uses `processed_payments` keyed by purchase token.
- Private call requests require an idempotency key and reserve funds before connection.
