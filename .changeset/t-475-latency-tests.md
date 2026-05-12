---
'@stageflip/app-api': patch
---

T-475 — Opt-in audience-latency vitest suite asserting ADR-009 §D4 budget
(p50 < 200 ms / p95 < 500 ms voter-tap → presenter screen) at 10 / 50 / 100
concurrent voters.

Test-only addition. Three new files under `apps/api/src/test/`:

- `audience-latency-helpers.ts` — pure helpers: `synthesizeVoterTaps`
  (deterministic batch of `live-poll-multiple-choice` taps cycling
  option index across 0..2) and `computePercentile` (closest-sample,
  no interpolation).
- `audience-latency-helpers.test.ts` — full unit coverage.
- `audience-latency.test.ts` — three sub-cases at concurrency 10 / 50 /
  100; gated on `RUN_LATENCY_TESTS=1`. Drives the Hono app via
  `app.request(...)` (no real socket); per-tap latency captured via
  `performance.now()` around the WS dispatcher (`dispatchAudienceMessage`)
  + REST `/state` snapshot read. End-to-end p50 / p95 asserted against
  the §D4 ceiling; per-hop p50 / p95 logged to stderr as
  `[T-475] N=... ack p50=... e2e p50=...` so CI artifacts capture
  the numbers.

New `test:latency` script: `RUN_LATENCY_TESTS=1 vitest run
src/test/audience-latency.test.ts`. Default `pnpm test` skips the suite
via `describe.skipIf(!process.env.RUN_LATENCY_TESTS)` to keep shared CI
runners free of latency-flake risk.

§13 — NOT a structural extension; render verification N/A.

Closes P15 δ fourth closeout task; T-477 covers the K6 1000-voter load
test separately.
