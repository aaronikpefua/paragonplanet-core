# Paragon Live Room Worker

Cloudflare Durable Object infrastructure for Paragon Live room fanout.

This worker does not carry media. Cloudflare Stream/RealtimKit remains the media transport, while the Durable Object keeps one room per Live session for ephemeral realtime events such as presence, chat fanout after backend persistence, and support/reaction fanout after backend authority succeeds.

## Runtime contract

- `GET /health` returns worker status.
- `GET /live/:sessionId/ws?token=...` upgrades an authenticated viewer/host to the room WebSocket.
- `POST /live/:sessionId/events` lets the trusted backend broadcast a persisted/authorized event to room clients.

## Required secrets

- `LIVE_ROOM_SHARED_SECRET` signs short-lived WebSocket tokens from the backend.
- `LIVE_ROOM_SERVER_TOKEN` authorizes backend-to-worker room events.

Set them with Wrangler secrets, not source-controlled files:

```powershell
wrangler secret put LIVE_ROOM_SHARED_SECRET
wrangler secret put LIVE_ROOM_SERVER_TOKEN
```

## Deployment

```powershell
cd cloudflare/live-room-worker
npm install
npm run check
npm run deploy
```

After deploying, configure the backend environment with:

- `LIVE_ROOM_WORKER_URL`
- `LIVE_ROOM_SHARED_SECRET`
- `LIVE_ROOM_SERVER_TOKEN`

Keep the values identical to the worker secrets. Do not expose them in frontend or Android builds.
