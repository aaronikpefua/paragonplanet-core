# System Overview

```text
Web React client / Android native client
|
+-- Firebase Auth / App Check
+-- Node/Express REST API
|   |
|   +-- Firestore
|   +-- Cloudflare Stream Live
|   +-- Cloudflare RealtimeKit
|   +-- Cloudflare R2
|   +-- Paystack
|   +-- Google Play Billing
|
+-- Direct Firebase reads/listeners in selected client flows
+-- Cloudflare-hosted media ingest/playback
```

Paragon Planet is currently a modular-monolith product with web, Android native, Firebase identity, Firestore persistence, Cloudflare media/realtime products, and backend-owned wallet/ledger authority.

## Current Shape

- Backend owns Live session coordination, private call lifecycle, wallet/ledger mutations, video upload/processing, marketplace escrow, and selected auth helpers.
- Web owns large page-level orchestration in `ParagonLive.jsx`, `Explore.jsx`, `Profile.jsx`, marketplace pages, and inbox pages.
- Android owns native feed playback, Live broadcast/viewer screens, API service aggregation, wallet, auth, profile, upload, realtime call, and marketplace UI.
- Firestore stores transactional truth, durable app data, and some realtime-ish data such as Live chat.
- Cloudflare Stream Live and Cloudflare RealtimeKit are separate current integrations.
