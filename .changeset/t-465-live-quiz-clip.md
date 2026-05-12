---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-465 — `LiveQuizClip` family. Fifth audience-clip variant on disk;
competitive multi-question quiz (per ADR-010 §D2 / §D3 + already in
`@stageflip/audience-contract`). Voters select an answer per active
question via tap-to-submit option buttons; the presenter sees a
horizontal-bar layout with per-question result blocks. The
static-fallback (final-round) shape highlights the correct option per
block in accent green; the live (active-question) shape renders the
active question alone with NO correctness highlight (correctness
reveals only at final). Bar widths normalise to the MAX `optionCounts`
in each block (NOT to `totalVotes`) so a narrow-spread distribution
still presents a full-width winner.

Voter UI active-question routing: when `activeQuestionId === null` (or
the id does not resolve) the voter sees the "Waiting for next
question…" placeholder; when resolved the voter sees the active
question's options as buttons and tap-submit locks every option until
the host advances `activeQuestionId` (the local memo clears on the
prop change).

§13 (CLAUDE.md structural-extension) verification ships as
`render-e2e.test.ts` driving the static-fallback path through the
T-454 `StaticFallbackRenderer` with the spec snapshot (3 questions ×
4 options each, 21 votes per question) and asserting on observable
DOM (3 result blocks in order, 4 bar elements per block, the correct
option per block carries `data-correct="true"` + accent colour, total
badges read "21 votes", bar widths proportional within block) plus
pixel-bucket non-blank proxies (per-block non-default background +
border colours; correct-vs-incorrect bar fills use distinct accent /
muted colours).

`ELEMENT_TYPES` length: 17 → 18. `defaultVoterInputRegistry` size: 4
→ 5. `check-audience-permissions` reports "5 audience clips
registered" (was 4 after T-464). RIR compiler + PPTX writer extend
their exhaustive-switch coverage for the new union variant.
