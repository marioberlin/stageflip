---
title: Cluster D — Titles, opens, bumpers, credits
id: skills/stageflip/presets/titles
tier: cluster
status: substantive
last_updated: 2026-05-14
owner_task: T-354
related:
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

## Compose tools

The agent-facing routing surface lives in the `cluster-d-compose` bundle (T-354). All three tools are read-only (`ToolContext`) and return `(presetId, props)` — the caller mounts the resulting clip via a separate write-tier tool (e.g. `add_clip` from `create-mutate`). Per cluster posture (typography carries emotional weight; the bespoke typeface signals the register), `presetId` is **caller-required** — no semantic dispatch can collapse the 6 typographically distinct registers, so the caller picks the preset and the composer forwards the brief.

- `compose_title_sequence(presetId, title, subtitle?, durationSeconds?, accentColor?)` — main "show title" entrance for a documentary / series / brand film. Composer-transparent on optional fields: omitted keys do NOT appear in the output `props` and the preset default flows through.
- `compose_segment_open(presetId, segmentTitle, segmentNumber?, durationSeconds?)` — shorter title card for a chapter / segment break within longer-form content. Same caller-required `presetId` posture — not all 6 registers are typographically appropriate for short opens, but the contract leaves selection to the caller.
- `compose_end_credits(presetId, credits, scrollSpeed?)` — credits roll / cast-list / "end of episode" register. `credits` is a 1–64-entry `{ role, name }` array; `scrollSpeed` is `slow | medium | fast` (omitted → preset default).

## Multi-clip composition (T-348 / T-348a)

Five Cluster D presets — `stranger-things-benguiat`, `true-detective-double-exposure`, `succession-home-video`, `severance-surreal-3d`, `got-trajan-clockwork` — compose the parent `titleSequence` primitive with one or more atmospheric overlays (`grain`, `light-leak`, `particles`, `photographic-overlay`) via `ClipKindBinding.overlays?` (T-348 D-T348-1). Declaration order = z-order; the parent renders at zIndex 0 and overlays at 1, 2, 3, ... at full canvas + full duration. Sixth Cluster D preset `squid-game-geometric` is single-clip (zIndex 0 only).

For overlay primitives that produce opaque rendering output, `mix-blend-mode` on the primitive's container is the compositing contract — the renderer does not synthesise blend modes per-element. T-348a wires this for `photographic-overlay` (`mix-blend-mode: multiply`); `grain` / `particles` already render transparent canvases; `light-leak` already declares `mix-blend-mode: screen`. Future overlay primitives whose renders are opaque (whole-canvas tints, gradient-backed regions) MUST declare a primitive-level `mix-blend-mode` or document why they don't need one — silent CI bypass on byte-identical-blank parity goldens caught this regression at PO ratification, not before.

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
