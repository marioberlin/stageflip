---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-463 — `LivePollRatingClip`: third standard audience clip family (closes the LivePoll family).

- Adds the schema-side `live-poll-rating` `Element` discriminator
  variant (`packages/schema/src/elements/live-poll-rating.ts`) with
  the strict `props: { question, scaleMin: literal 1, scaleMax: int
  2..10, labels?, sessionId? }` shape, the `permissions:
  ['audience-network']` literal tuple per ADR-009 §D13, and the
  optional `provenance` slot per ADR-010 §D5. Third audience-clip
  variant on the `Element` union (T-461 + T-462 were the first two);
  `ELEMENT_TYPES` bumped 15 → 16.
- Ships the `live-poll-rating` clip family under
  `packages/runtimes/audience/src/clips/live-poll-rating/`: manifest,
  clip-definition (registered with `audienceRuntime`), factory
  (registered with `audienceClipRegistry`), and a deterministic
  static-fallback renderer (registered with `staticFallbackRenderer`).
  Static-fallback layout: histogram with one bar per score
  1..scaleMax, heights NORMALISED TO THE MODE (max scoreCount); the
  bar at `Math.round(mean) - 1` (zero-indexed) carries
  `data-highlight="mean"` and a deeper accent colour; mean label
  "Mean: X.X" above the chart, total label "N votes" below.
  `totalVotes === 0` (mean === NaN) renders "Mean: —" with no `NaN`
  literal in the DOM.
- Wires `LivePollRatingVoterInput` into the audience-join voter-input
  dispatcher's default registry (size grows from 2 → 3). Voter UI is
  a row of `scaleMax` numbered rating buttons; tap submits and
  disables. Optional left/right end labels.
- §13 (CLAUDE.md structural-extension) verification ships as
  `render-e2e.test.ts` — drives the static-fallback path through the
  T-454 dispatcher with the spec snapshot (`{ scoreCounts: [2, 3, 5,
  7, 4], totalVotes: 21, mean: 3.38 }`) and asserts on observable DOM
  (5 bars, bar index 2 (score 3) highlighted, "Mean: 3.4" label, "21
  votes" total label, mode-normalised heights with bar 3 (score 4,
  count 7) tallest, non-blank bar fills with distinct
  highlight/non-highlight backgrounds) per option-1 of the §13 menu.
  Plus a separate case for `totalVotes === 0` rendering "Mean: —"
  with no `NaN` literal anywhere in the DOM.
- RIR compiler + PPTX writer extend their exhaustive-switch coverage
  for the new `Element` variant.
- `check-audience-permissions` reports "3 audience clips inspected"
  (was 2 after T-462).
