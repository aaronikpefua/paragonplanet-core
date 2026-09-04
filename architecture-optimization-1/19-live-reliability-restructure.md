# Live Reliability Restructure

## Scope

Status: IMPLEMENTED LOCALLY / NOT DEPLOYED

This cycle creates Cloudflare Durable Object infrastructure for Paragon Live room realtime while preserving the current media transport.

## Standard Live Structure

1. Cloudflare Stream/RealtimKit remains responsible for media ingest, WHEP/WebRTC playback, HLS fallback, recording, and scale-out video delivery.
2. Backend remains responsible for authentication, authorization, Live session correctness, chat persistence, support actions, wallet/ledger authority, and room-token minting.
3. Cloudflare Durable Object owns one ephemeral room per Live session for websocket fanout.
4. Web, Android, and future iOS clients use the same backend room-token endpoint before opening a room websocket.

## Durable Object Boundary

The Durable Object is allowed to handle:

- presence count
- room snapshot
- backend-authorized chat fanout
- backend-authorized support/reaction fanout
- client heartbeat/ping

The Durable Object must not handle:

- video media transport
- wallet balances
- vote/support pricing
- ledger writes
- Firestore security authority
- host role decisions
- Live session publication authority

## New Runtime Contract

Backend endpoint:

- `GET /api/live/sessions/{sessionId}/room-token`

Worker endpoints:

- `GET /health`
- `GET /live/{sessionId}/ws?token=...`
- `POST /live/{sessionId}/events`

## Security Model

- Browser/native clients never receive worker secrets.
- Backend signs short-lived room tokens with `LIVE_ROOM_SHARED_SECRET`.
- Worker validates the token session id, expiry, and HMAC signature before websocket upgrade.
- Backend publishes room events using `LIVE_ROOM_SERVER_TOKEN`.
- Chat still writes through the authenticated backend first; websocket fanout happens only after the Firestore write succeeds.

## Platform Coverage

- Web: optional websocket client added with automatic REST polling fallback.
- Android: API contract method/model added so native websocket client can use the same backend-issued room token.
- iOS: no native app exists yet; the README now documents the same `URLSessionWebSocketTask` contract.

## Expected Reliability Impact

- Reduces chat/read polling pressure when the worker is configured.
- Gives all viewers in one Live session a single ordered room fanout point.
- Avoids moving media or financial authority into client code.
- Keeps existing Live viewer media behavior and HLS fallback intact.

## Deployment Requirements

1. Deploy `cloudflare/live-room-worker` with Wrangler.
2. Set worker secrets:
   - `LIVE_ROOM_SHARED_SECRET`
   - `LIVE_ROOM_SERVER_TOKEN`
3. Set backend environment variables:
   - `LIVE_ROOM_WORKER_URL`
   - `LIVE_ROOM_SHARED_SECRET`
   - `LIVE_ROOM_SERVER_TOKEN`
4. Deploy backend.
5. Deploy web frontend only if the web websocket client change should be active.

## Rollback

Unset `LIVE_ROOM_WORKER_URL` on the backend or remove the worker route configuration. Web automatically falls back to existing REST chat polling when the room token response is unconfigured.

## Classification

- Durable Object infrastructure: IMPLEMENTED LOCALLY
- Production worker: NOT DEPLOYED
- Backend environment configuration: NOT CONFIGURED
- Web realtime room usage: READY WITH FALLBACK
- Android websocket usage: CONTRACT READY / CLIENT WEBSOCKET NOT YET ENABLED
- iOS websocket usage: CONTRACT DOCUMENTED / APP NOT YET IMPLEMENTED
