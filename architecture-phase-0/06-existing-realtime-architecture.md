# Existing Realtime Architecture

## Product/API Used

`backend/src/realtime/cloudflareRealtime.js` uses Cloudflare RealtimeKit-style APIs under:

```text
https://api.cloudflare.com/client/v4/accounts/{accountId}/calls/apps
```

It creates SFU-style rooms/apps and participant sessions/tokens. This is media/session infrastructure for private calls, not a generic app WebSocket layer.

## Responsibilities

| Responsibility | Current Owner |
|---|---|
| Plan lookup | `callPlans.js`, `realtime_call_plans` |
| Call request/ringing state | `realtime.controller.js`, `realtime_call_sessions` |
| Payment reservation | backend Firestore transaction, wallet + ledger |
| Cloudflare room creation | `createRealtimeRoom()` |
| Participant token creation | `createParticipantToken()` |
| Connected charge finalization | backend Firestore transaction |
| Cancel/decline/end refunds | backend transaction and ledger entries |
| Media transport | Cloudflare RealtimeKit/SFU |

## Authentication and Persistence

- Routes require backend authentication.
- Join/connect/end operations verify the requester or recipient.
- Caller/callee state is persisted in `realtime_call_sessions`.
- Completed calls are persisted in `realtime_call_history`.
- Wallet reservations, charges, and refunds are backed by `wallet_accounts` and `ledger_entries`.
- Participant display names are enriched from `public_profiles`.

## Reuse Decision

- Reuse: provider config pattern, room/token creation concepts, authenticated lifecycle ownership, and backend-mediated state.
- Do not reuse directly: two-person private-call pricing/status assumptions, reservation/charge timing, and room-per-private-call semantics.
- Live needs a public room interaction layer for comments, presence, challenges, and reactions; it should not be forced into the private call model.

## Durable Objects Decision

Durable Objects would complement this system if used later for room-local ephemeral state and fanout. They would duplicate it only if used to replace Cloudflare RealtimeKit media/SFU responsibilities.
