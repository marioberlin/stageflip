---
id: slido-classic-poll
cluster: audience
clipKind: live-poll-multiple-choice
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

# Slido Classic Poll — single-question multiple-choice

## Visual tokens

- Horizontal bar chart, one bar per option
- Bar widths proportional to `optionCounts[i] / totalVotes`
- Percentage label overlaid on each bar (right-aligned within the bar)
- Question text at top in `font-family: Inter, weight: 600, size: 48px`
- Total label "N votes" at bottom in `weight: 400, size: 24px`
- Accent color (`#3B82F6` blue) on bars; neutral gray (`#E5E7EB`)
  background track

## Authoring brief

Use when a presenter wants a single multiple-choice poll bound to Slido's
hosted API. The bound `clipKind` is `'live-poll-multiple-choice'` (T-461);
the vendor adapter is `@stageflip/audience-slido` (T-479).

## Static-fallback render

Renders the bar chart from the persisted `AggregationSnapshot.aggregation`
(`{ kind: 'live-poll-multiple-choice', optionCounts, totalVotes }`).
Deterministic-by-construction per ADR-009 §D10.

## Permissions

`audience-network` — grants the clip's `liveMount` path WebSocket egress
to Slido's API (per the T-484 origin allowlist).
