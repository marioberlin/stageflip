---
id: conference-qa-upvote
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
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Conference Q&A with Upvote — tech-conference tuned

## Visual tokens

- Same vertical list shape as `bbc-question-time` but tuned for
  tech-conference aesthetics:
  - Card background `#0F172A` slate; text `#E2E8F0` for high-contrast
    keynote screens
  - Upvote count badge in `#3B82F6` blue (matches conference branding)
  - Top-3 cards carry `#1E40AF` deep-blue accent borders
  - Question text `weight: 500, size: 28px` (smaller than BBC variant —
    more questions visible at once on a big conference screen)
- Total label "N questions" at bottom with conference-style
  monospace-numeric tabular alignment

## Authoring brief

Use when a presenter wants an audience Q&A tuned for a tech-conference
keynote (vs. BBC's broadcast aesthetic). Same bound `clipKind`
(`'live-qa'`, T-464) as `bbc-question-time` — the two presets share the
underlying clip family + only differ in visual styling.

## Static-fallback render

Same path as `bbc-question-time`. Theme variation only.

## Permissions

`audience-network`.
