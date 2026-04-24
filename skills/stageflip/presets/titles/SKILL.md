---
title: Cluster D — Titles, opens, bumpers, credits
id: skills/stageflip/presets/titles
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-354
related:
  - docs/decisions/ADR-004-preset-system.md
  - skills/stageflip/agents/type-design-consultant/SKILL.md
---

# Cluster D — Titles, opens, bumpers, credits

Prestige-TV register: Stranger Things, Game of Thrones, Squid Game, True Detective, Succession, Severance. Depends on the `TitleSequenceClip` gap clip (T-321). The most typographically-demanding cluster.

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Documentary or series title sequence
- High-end corporate brand film open
- Podcast video header
- Segment open / segment close / bumper
- Pastiche of a recognizable prestige-TV title style

Do **not** invoke for social / short-form opens — those belong in cluster F or G.

## Presets

- [`stranger-things-benguiat`](stranger-things-benguiat.md) — titleSequence, red-glow typographic, synth-paced
- [`got-trajan-clockwork`](got-trajan-clockwork.md) — titleSequence, 3D clockwork, camera-swoop
- [`squid-game-geometric`](squid-game-geometric.md) — titleSequence, pink-on-teal, ○△□ symbol set
- [`true-detective-double-exposure`](true-detective-double-exposure.md) — titleSequence, photographic double-exposure, desaturated
- [`succession-home-video`](succession-home-video.md) — titleSequence, grainy sepia + contemporary 16:9 intercuts, piano-paced
- [`severance-surreal-3d`](severance-surreal-3d.md) — titleSequence, CGI body-horror, mid-century corporate type

## Semantic tools

- `compose_title_sequence(show_brief, era, duration_seconds, brand)` — picks preset by era + tone
- `compose_segment_open(segment_name, tone, brand)` — picks shorter-form bumper from the cluster
- `compose_end_credits(credits, style, brand)` — routes to a cluster-matched credits variation

## Cluster conventions (from the compass canon)

- **Typography carries emotional weight.** This cluster's presets are all typographic-first; motion is secondary. The bespoke typeface signals the register (Benguiat = 80s nostalgia; Trajan = mythic; Engravers Gothic = dynastic authority). Fallbacks that collapse this signal make the preset feel like parody.
- **Duration is longer than broadcast lower-thirds.** Expect 30–90 seconds per sequence. Plan the timeline accordingly; the `TitleSequenceClip` (gap clip T-321) is built for multi-shot compositions.
- **Pastiche requires evolution.** Stranger Things spawned a viral meme generator *because* the register is transferable. Succession's sequence evolved across 4 seasons — our presets should support variant-generation per season/year without losing identity.
- **Letterforms fill the frame, not text.** Stranger Things extreme-close-ups of letters. Severance close-ups of disembodied faces. Prestige titles are about scale and texture, not information delivery. Do not shrink the type to fit "subtitle + show name + credits" in one frame.
- **Music is co-authored.** Nearly every prestige title sequence has a signature musical cue (Survive for ST; Britell for Succession). Presets assume a `musicCue` input and sync keyframes to it. If the brief doesn't provide one, either escalate or mark the preset's output as "placeholder timing."

## Escalation

If the brief requests a title register not in the cluster (e.g., Chernobyl, The Crown, Breaking Bad), escalate. Each is typographically distinct; improvising across presets produces an uncanny-valley result.

If no bespoke-font-adequate fallback is available (the type-design-consultant returns "no adequate fallback" for this cluster's key typefaces), the product owner decides whether to ship the cluster with BYO-only posture.

## Type-design batch review

Cluster-D fonts are proprietary (ITC Benguiat, Trajan Pro, Engravers Gothic, custom Severance) or license-specific. Batch review at `reviews/type-design-consultant-cluster-d.md` approves fallbacks; preset PRs link to it.

## Related

- ADR-004 (preset system)
- Gap clip T-321 (`TitleSequenceClip` — blocks every preset in this cluster)
- Compass canon: `docs/compass_artifact.md` § Title cards and opening titles
