---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-464 — `LiveQAClip` family. Fourth audience-clip variant on disk; first
non-LivePoll family. Voters submit questions or upvote existing ones via
a tabbed `Submit` / `Browse` voter UI; the presenter sees a sorted feed
of question cards (by upvotes desc, secondary submittedAt asc) capped at
`topN` (default 100). Top-3 cards carry a `data-highlight="popular"`
ring; questions toggled `answered` carry an Answered badge; each card
shows a relative-time label computed from a deterministic injected
`now` epoch-ms prop (no `Date.now()` in the determinism perimeter).

§13 (CLAUDE.md structural-extension) verification ships as
`render-e2e.test.ts` driving the static-fallback path through the
T-454 `StaticFallbackRenderer` with the spec snapshot and asserting on
observable DOM (3 cards in upvotes-desc order, q1 with the Answered
badge + popular highlight, upvote-count + relative-time labels per
card, total label "3 questions") plus pixel-bucket non-blank proxies.

`ELEMENT_TYPES` length: 16 → 17. `defaultVoterInputRegistry` size: 3 → 4.
`check-audience-permissions` reports "4 audience clips registered" (was
3 after T-463).
