---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-466 — `LeaderboardClip` family. Sixth audience-clip variant on disk;
FIRST DERIVED clip (paired with `live-quiz` per ADR-010 §D2). The
clip's aggregation is computed server-side from the upstream
`LiveQuizAggregation` referenced by `props.quizId`; voters never cast
votes against the leaderboard — `LeaderboardVote = never`.

Static-fallback renders a vertical ranked list. Each row: `#${rank}`
badge, `displayName` (or "Anonymous voter" when absent), score badge.
Top-3 rows carry `data-medal="gold" | "silver" | "bronze"` with
distinct accent colours (gold #fbbf24, silver #d1d5db, bronze #d97706);
ranks 4+ render plain. Optional title (`clip.props.title`) renders as
an `<h3>` above the list; total label below reads
`${totalParticipants} participants`. Empty-ranking shape renders the
"Waiting for participants…" placeholder.

Voter UI is the FIRST view-only entry on the dispatcher registry —
`<LeaderboardViewOnly>` renders a friendly results-display notice
("This is a results display. Sit back and watch the leaderboard!")
with NO interactive elements. It accepts the dispatcher's standard
`VoterInputProps` (`sessionId`, `clipKind`) for structural
compatibility; per ADR-010 §D2 it never emits a vote. Sets the
precedent for future view-only sibling clip kinds.

§13 (CLAUDE.md structural-extension) verification ships as
`render-e2e.test.ts` driving the static-fallback path through the
T-454 `StaticFallbackRenderer` with the spec snapshot (5 ranked
voters — Alice/Bob/Carol with `displayName`, Dave with `displayName`,
the rank-5 entry without — `totalParticipants: 21`) and asserting on
observable DOM (5 rows in rank order, top-3 carry `data-medal` with
the right medal label, ranks 4-5 omit `data-medal`, rank-5 renders
"Anonymous voter", score badges read correctly, total label reads
"21 participants") plus pixel-bucket non-blank proxies (distinct
medal accent colours per tier; non-default row backgrounds + borders).

`ELEMENT_TYPES` length: 18 → 19. `defaultVoterInputRegistry` size: 5
→ 6. `check-audience-permissions` reports "6 audience clips
registered" (was 5 after T-465). RIR compiler + PPTX writer extend
their exhaustive-switch coverage for the new union variant.
