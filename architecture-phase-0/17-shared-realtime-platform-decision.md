# Shared Realtime Platform Decision

## Recommendation

Paragon Planet should eventually have one shared room-oriented realtime platform for interaction and signalling, while preserving REST/backend/Firestore for durable and financial authority.

## Include

- Live room presence.
- Live comments and broadcaster-visible audience chat.
- Reactions, challenges, and non-financial interaction state.
- Private call signalling state.
- MeetUp signalling state.
- Lightweight notification fanout.

## Keep Separate

- Media transport remains Cloudflare Stream Live, HLS/WHEP/RTMPS, and Cloudflare RealtimeKit/SFU as appropriate.
- Wallet balances, votes, support charges, deposits, withdrawals, escrow, settlements, and ledger entries remain backend-authoritative.
- Durable records remain in Firestore/backend-owned storage.

## Specific Answers

| Question | Answer |
|---|---|
| Can `backend/src/realtime` be extended? | Yes, as a provider/session coordination seed. |
| What remains there? | Cloudflare RealtimeKit config, private call lifecycle, room/token provider patterns. |
| What moves to room realtime? | Live comments, presence, challenges, reactions, audience/broadcaster fanout. |
| Durable Objects: complement or duplicate? | Complement for ephemeral room state; duplicate only if replacing media/SFU. |
| What stays REST/backend? | finance, support/vote mutations, escrow, deposits, withdrawals, durable start/end operations. |
| What stays Firestore? | durable sessions, history, transactions, ledger, profiles, videos, orders, audit. |
| What becomes ephemeral socket state? | presence, typing, transient counters, in-progress challenges, read receipts. |
