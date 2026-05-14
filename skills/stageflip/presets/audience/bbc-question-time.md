---
id: bbc-question-time
cluster: audience
clipKind: live-qa
source: docs/decisions/ADR-010-live-audience-clip-family.md#d10-cluster-i-preset-cluster
status: substantive
preferredFont:
  family: Inter
  license: ofl
fallbackFont:
  family: Inter
  weight: 600
  license: ofl
permissions:
  - audience-network
signOff:
  parityFixture: 'signed:2026-05-14'
  typeDesign: pending-cluster-batch
---

# BBC Question Time — broadcast-style Q&A panel

## Visual tokens

- Vertical list of question cards (top-N ordered by upvotes desc)
- Each card: question text in `weight: 500, size: 32px`; upvote count
  badge top-right; "Answered" pill when `answered === true`
- Top-3 cards carry `data-highlight="popular"` + subtle accent
  background `#F0F9FF`
- Relative-time label "Asked X min ago" under each question
- Total label "N questions" at bottom

## Authoring brief

Use when a presenter wants a moderated audience Q&A in a broadcast-style
panel (BBC Question Time canon: submit, upvote, presenter selects).
The bound `clipKind` is `'live-qa'` (T-464); native adapter.

## Static-fallback render

Renders the final question list ordered by upvotes desc (server already
sorts; renderer asserts defensively). Relative-time uses an injected `now`
prop to stay inside the determinism perimeter.

## Permissions

`audience-network` — required for the dual-action (submit + upvote)
WebSocket calls.
