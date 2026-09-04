# iOS Native Track

This directory is reserved for the real native iPhone application for Paragon Planet.

## Planned stack
- Swift
- SwiftUI
- AVPlayer
- shared backend/API integration with the website

## First milestones
1. project bootstrap
2. auth/session foundation
3. feed screen
4. watch/player screen
5. wallet foundation strategy review for iOS purchasing rules

## Notes
- iPhone should mirror the product structure of Android, not the website route structure.
- Billing and digital goods policy may differ from Android and should be handled as a platform-specific concern.
- Live room realtime should use the backend-issued `GET /api/live/sessions/{sessionId}/room-token` contract and connect with `URLSessionWebSocketTask` to the returned `wsUrl`.
- Cloudflare Stream remains the media path; the Durable Object room is for presence, chat fanout, and authorized room events only.
