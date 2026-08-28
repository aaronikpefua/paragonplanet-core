# Recommended Migration Order

1. Phase 0 — Architecture discovery and baseline protection.
2. Phase 1 — Observability and measurable performance baseline.
3. Phase 2 — Shared realtime foundation / Live realtime migration.
4. Phase 3 — Feed/Explore performance architecture.
5. Phase 4 — Client/API repository boundaries.
6. Phase 5 — Firestore query/index optimization.
7. Phase 6 — Hot-data caching.
8. Phase 7 — Wallet/voting scale hardening.
9. Phase 8 — Marketplace decomposition.
10. Phase 9 — Profile/directory optimization.
11. Phase 10 — Progressive load testing.

The default order is supported by the repository evidence: measure first, then reduce high-frequency realtime/polling load, then untangle feed/client/data boundaries.
