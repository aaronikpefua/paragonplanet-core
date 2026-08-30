# Phase 1 Scope

Phase 1 adds observability and measurable performance baselines only. It does not optimize, migrate, refactor product architecture, change UI, alter polling intervals, change financial behavior, or deploy.

## Starting Point

- Branch: `checkpoint/pre-architecture-2026-08-28`
- HEAD: `802db9c docs: complete Paragon Planet Architecture Phase 0`
- Previous working checkpoint: `7c21800 Checkpoint pre-architecture working source 2026-08-28`

## Measurement Classes

- MEASURED: emitted by runtime instrumentation or build/test commands.
- DERIVED: calculated from measured constants or captured logs.
- ESTIMATED: mathematical projection from current behavior.
- NOT YET MEASURABLE: requires deployed/non-local runtime, manual device session, or provider telemetry not available locally.
