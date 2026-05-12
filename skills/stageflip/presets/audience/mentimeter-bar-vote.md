---
id: mentimeter-bar-vote
cluster: audience
clipKind: live-poll-rating
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
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Mentimeter Bar Vote — Likert-scale rating

## Visual tokens

- Vertical histogram, one bar per score (1..scaleMax; default 5)
- Bar heights normalized to the modal bin (max(scoreCounts))
- Modal bar accented (`#10B981` green); other bars neutral (`#9CA3AF`)
- Prominent "Mean: X.X" label above the histogram in `weight: 700, size: 56px`
- Total label "N votes" at bottom; question text overlaid at top
- Optional left/right endpoint labels under bars 1 and scaleMax

## Authoring brief

Use when a presenter wants a Likert-scale rating poll bound to Mentimeter's
hosted API. The bound `clipKind` is `'live-poll-rating'` (T-463); the
vendor adapter is `@stageflip/audience-mentimeter` (T-480).

## Static-fallback render

Renders the histogram + mean from the persisted
`AggregationSnapshot.aggregation` (`{ kind: 'live-poll-rating',
scoreCounts, totalVotes, mean }`). NaN-safe (totalVotes === 0 renders
"Mean: —").

## Permissions

`audience-network` — grants WebSocket egress to Mentimeter's API.
