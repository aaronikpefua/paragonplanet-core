# Measurement Gaps

- Live L1-L4 could not run without interactive browser/device sessions.
- Android tests could not run because `adb devices` listed no connected device.
- Private call testing could not run without two authenticated participants.
- Wallet/vote/support testing could not run without safe authenticated test wallet value.
- Marketplace message/settlement testing could not run without safe marketplace test state.
- Auth restoration could not run without an interactive authenticated client session.
- Exact Firestore billed reads remain outside application-level instrumentation.
- Cloud Run instance behavior, cold starts, and production rate pressure require deployed runtime logs.

## Instrumentation Defects

No clear Phase 1 instrumentation defect blocked terminal-side Phase 1.1. The blockers were environment/session availability, so no source correction was made.
