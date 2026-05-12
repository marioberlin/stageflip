---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-468 — `SurveyClip` family. Eighth audience-clip variant on disk;
closes the standard-family v1 set. Multi-question pre/post survey:
each question is one of three types (`multiple-choice` / `open-text`
/ `rating`); the runtime aggregates responses per question and the
renderer paints a vertical scroll of per-question result cards.

Schema-side `survey` variant ships a discriminated-union
per-question shape on `type`. Variants: `multiple-choice` (id, type,
text, options[2..10]); `open-text` (id, type, text, maxLength
1..2000 default 280); `rating` (id, type, text, scaleMin literal 1,
scaleMax 2..10, optional labels). Outer `props` shape is
`{ questions: SurveyQuestion[].min(1).max(20), sessionId? }`.

Static-fallback renders per-question mini cards. Each card carries
the question text (looked up by id from `clip.props.questions`) plus
a type-dispatched mini-rendering:
- `multiple-choice` → mini horizontal bar chart (one bar per option;
  width mode-normalised to `optionCounts[i] / max(optionCounts)`);
- `open-text` → top-5 entries as list rows with text + count badge;
- `rating` → mini histogram (one bar per score 1..scaleMax); mean
  label `Mean: X.X` (or `Mean: —` when `totalVotes === 0` / mean is
  NaN).

Total label at the bottom reads `${totalResponses} responses` /
`1 response`. Empty-questionAggregations shape renders the
"Waiting for responses…" placeholder.

Voter UI is the FIRST multi-input form on the dispatcher registry —
a vertical form with one input per question:
- `multiple-choice` → radio buttons (one per option);
- `open-text` → `<textarea>` bounded by `maxLength`;
- `rating` → row of `scaleMax` buttons (current selection
  highlighted with an accent colour).

Submit is gated until every question has a complete response (v1 =
all required); whitespace-only open-text responses are treated as
empty. On submit, emits `{ kind: 'survey', responses: [...] }`
where `value: number` for multiple-choice (the optionIndex) and
rating (the score), `string` for open-text. All inputs + button
disable after submit; "Survey submitted" status appears.

§13 (CLAUDE.md structural-extension) verification ships as
`render-e2e.test.ts` driving the static-fallback path through the
T-454 `StaticFallbackRenderer` with the spec snapshot (3 questions
covering all three types; `totalResponses: 15`) and asserting on
observable DOM (3 cards in input order, 3 mc bars, 2 ot rows, 5
rating bars + "Mean: 3.2" label, total "15 responses") plus
pixel-bucket non-blank proxies (non-default panel chrome + non-empty
per-card backgrounds across all 3 types).

`ELEMENT_TYPES` length: 20 → 21. `defaultVoterInputRegistry` size: 7
→ 8. `check-audience-permissions` reports "8 audience clips
inspected" (was 7 after T-467). RIR compiler + PPTX writer extend
their exhaustive-switch coverage for the new union variant.
