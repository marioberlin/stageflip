---
title: Cluster I — Live audience
id: skills/stageflip/presets/audience
tier: cluster
status: substantive
last_updated: 2026-05-12
owner_task: T-486
related:
  - skills/stageflip/tools/audience-engagement/SKILL.md
---

# Cluster I — Live audience

Live audience presets exercise the eleven `AudienceClipKind` discriminants
shipped in P15 γ (T-461..T-471) through six named compositions (per ADR-010
§D10). Each preset binds to one of the standard or marquee differentiator
audience clip families; the runtime dispatches via the standard `findClip`
seam.

## When to invoke

Invoke any `compose_audience_*` tool in this cluster when the brief cites:

- Live polling, audience Q&A, audience-driven quizzes
- Word clouds, surveys, ranked leaderboards
- Spatial input (interactive heatmaps)
- Audience-driven AI generation
- Conferences, classrooms, keynotes, livestreams

Do **not** invoke for static charts / data viz — those are Cluster F.
Do **not** invoke for one-way presenter chrome — those are Cluster D / G.

## Preset list

| Preset id | Bound clipKind | Vendor adapter (illustrative) | Notes |
|---|---|---|---|
| `slido-classic-poll` | `live-poll-multiple-choice` | audience-slido | Single-question multiple-choice with bar visualization |
| `mentimeter-bar-vote` | `live-poll-rating` | audience-mentimeter | Likert-scale rating with mean display |
| `kahoot-competitive` | `live-quiz` | audience-native | Time-bonus scoring; pairs with Leaderboard |
| `bbc-question-time` | `live-qa` | audience-native | Submit + upvote questions; presenter moderates |
| `conference-qa-upvote` | `live-qa` | audience-native | Same family as bbc-question-time; tuned for tech conferences |
| `classroom-quiz` | `live-quiz` | audience-native | Multi-question quiz; native motion-native variant |

The six presets cover all 6 illustrative scenarios per ADR-010 §D10. Future
presets for HeatmapClip / ReactionStream / AudienceAiPromptClip arrive in
Phase 16 marketplace packs (not Cluster I v1).

## Permissions

Every audience clip's `liveMount` path requires the `audience-network`
permission (per ADR-009 §D13 + T-455 CI gate). The preset frontmatter
declares `permissions: ['audience-network']` so the editor pre-authorizes the
egress at preset-instantiation time.

## Parity-fixture sign-off

Static-fallback golden frames for each clip family live at
`parity-fixtures/audience/<clip-kind>/` (T-476). Cluster I preset goldens
are auto-generated on first CI render; PO ratification signs them off via the
manifest's `auditTagged` field (NOT via `docs/ops/parity-fixture-signoff.md`
per memory `feedback_parity_signoff_doc_is_procedural.md`).

## Determinism

Audience clips' `staticFallback` path is deterministic-by-construction per
ADR-009 §D10 (same `AggregationSnapshot` bytes → same rendered frame). The
`liveMount` path is observably non-deterministic (live WebSocket events).
Cluster I presets target `staticFallback` for export-time parity; the
`liveMount` path is exercised at presenter-time.
