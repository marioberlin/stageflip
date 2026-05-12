---
id: kahoot-competitive
cluster: audience
clipKind: live-quiz
source: docs/decisions/ADR-010-live-audience-clip-family.md#d10-cluster-i-preset-cluster
status: substantive
preferredFont:
  family: Inter
  license: ofl
fallbackFont:
  family: Inter
  weight: 700
  license: ofl
permissions:
  - audience-network
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Kahoot Competitive Quiz — time-bonus scoring

## Visual tokens

- Final-round shape: vertical scroll of question-result blocks
- Each block: question text + mini horizontal bar chart (one bar per option)
- Correct option's bar accented `#10B981` green; incorrect bars muted gray
- `data-correct="true"` attribute on the correct bar (for QA inspection)
- Total badge "N votes" per question block
- Per-question card background: `#FAFAFA` with 16px padding

## Authoring brief

Use when a presenter wants a competitive multi-question quiz with Kahoot-
style time-bonus scoring. The bound `clipKind` is `'live-quiz'` (T-465);
native adapter (no vendor for v1). Pair with a Leaderboard clip
(`leaderboard-final-standings` if a future preset ships) for ranking.

## Static-fallback render

Renders the final-round shape (activeQuestionId === null) — all questions'
results in vertical scroll with correctness highlighted. Pure layout from
the persisted `LiveQuizAggregation`.

## Scoring (T-473)

Time-bonus formula: `score = isCorrect ? round(500 + 500 * max(0, 1 -
latencyMs / timerMs)) : 0`. Late-joiners locked at their join question.
Disconnect/reconnect preserves prior-question scores.

## Permissions

`audience-network` — required for the live-mount WebSocket subscription.
