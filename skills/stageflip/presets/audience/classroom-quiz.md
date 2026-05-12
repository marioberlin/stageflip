---
id: classroom-quiz
cluster: audience
clipKind: live-quiz
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

# Classroom Quiz — educational tuned

## Visual tokens

- Same final-round shape as `kahoot-competitive` but tuned for
  classroom aesthetics:
  - Softer accent color `#8B5CF6` violet (vs. Kahoot's competitive
    green)
  - Question text larger `weight: 600, size: 36px` for back-of-room
    readability
  - Correct-option highlight uses BOTH `data-correct="true"` AND a
    subtle checkmark icon overlay (accessibility — color-blind students)
  - Per-question card background `#F5F3FF` (pale violet) for visual
    separation in long quiz sequences

## Authoring brief

Use when a presenter wants a multi-question quiz tuned for K-12 /
university classrooms (vs. Kahoot's competitive vibe). Same bound
`clipKind` (`'live-quiz'`, T-465) as `kahoot-competitive` — the two
presets share the underlying clip family + only differ in visual
styling + accessibility affordances.

## Static-fallback render

Same path as `kahoot-competitive`. Theme + accessibility variation only.

## Permissions

`audience-network`.
