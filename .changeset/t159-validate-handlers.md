---
'@stageflip/engine': minor
---

T-159 — Fifth handler bundle shipped: `validate` (4 tools). Read-tier;
types against `DocumentContext` so it can plug into the
`Validator.extraProgrammaticChecks` hook.

- `validate_schema({})` — `documentSchema.parse` + Zod issues.
- `check_duplicate_ids({})` — duplicate slide / element ids.
- `check_timing_coverage({})` — per-slide `durationMs` + known-total sum.
- `validate_all({})` — runs the other three, aggregates findings.

16 new engine tests; 135 total.
