# Private Call Measurements

TEST R1 private video-call setup is NOT YET MEASURABLE.

## Reason

A private call requires two participants/devices or two authenticated browser/device sessions. This terminal milestone did not have an available interactive second participant.

## Instrumentation Ready

- Backend API request timing for `/api/realtime/*`.
- Firestore timing for call plan and call list queries.
- Transaction timing for reservation, release, and final charge.
- Cloudflare RealtimeKit room and token creation timing.

Room tokens are not logged.
