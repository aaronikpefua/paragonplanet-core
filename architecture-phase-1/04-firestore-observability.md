# Firestore Observability

## Added

- `measureFirestore()` records domain, operation, collection, operation type, duration, status, and query result count where the SDK result exposes `docs`.
- `measureAsync()` records transaction duration for selected Live and realtime financial/session operations.

## Instrumented Hot Paths

- Live session listing and following lookup.
- Live start/schedule/active/heartbeat/end session writes.
- Live chat session lookup, chat query, and chat message write.
- Live support transaction.
- Private realtime call plan/list queries.
- Private call request/reservation, reservation release, and final charge transactions.

## Limits

These are application-level operation timings, not exact Firestore billing counts. Exact billed reads remain NOT YET MEASURABLE from local instrumentation alone.
