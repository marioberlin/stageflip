---
'@stageflip/adapter-regression': minor
---

T-435 — adapter regression test suite.

New `@stageflip/adapter-regression` package plus a CI gate
(`pnpm check-adapter-regression`) that guards the 9 Phase 14 β
reference adapters (T-426..T-434) against silent behavioral drift.

For each adapter, a per-vendor JSON snapshot at
`packages/adapter-regression/snapshots/<adapter-id>.json` records
the canonicalized descriptor SHA-256, a canonical sample input,
and the resulting `cacheKey` + canonicalized-output SHA-256. The
gate replays each snapshot and asserts byte-equality.

Closes Phase 14 β; opens Phase γ cross-cutting integrations.
