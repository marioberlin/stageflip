---
title: Presets — Cluster index
id: skills/stageflip/presets
tier: cluster
status: substantive
last_updated: 2026-05-11
owner_task: T-412
related:
  - skills/stageflip/presets/news/SKILL.md
  - skills/stageflip/presets/sports/SKILL.md
  - skills/stageflip/presets/weather/SKILL.md
  - skills/stageflip/presets/titles/SKILL.md
  - skills/stageflip/presets/data/SKILL.md
  - skills/stageflip/presets/captions/SKILL.md
  - skills/stageflip/presets/ctas/SKILL.md
  - skills/stageflip/presets/ar/SKILL.md
  - skills/stageflip/concepts/skills-tree/SKILL.md
---

# Presets — Cluster index

50 ratified presets across 8 clusters on `main`. Each cluster is a domain group with a canonical visual register and (except titles) a `cluster-*-compose` handler bundle exposing `compose_*` tools to the agent surface.

A preset is selected by the orchestrator either via the cluster's `compose_*` tool (Pattern C — preferred for new content) or by direct preset-id binding (`PRESET_ID_BINDINGS`).

## Clusters

| Cluster | Domain | Presets | Compose bundle | SKILL |
|---|---|---:|---|---|
| **A** | News & broadcast | 8 | `cluster-a-compose` | [`news/SKILL.md`](news/SKILL.md) |
| **B** | Sports | 9 | `cluster-b-compose` | [`sports/SKILL.md`](sports/SKILL.md) |
| **C** | Weather | 6 | `cluster-c-compose` | [`weather/SKILL.md`](weather/SKILL.md) |
| **D** | Titles & main-on-end | 6 | (none — titles ship as-is) | [`titles/SKILL.md`](titles/SKILL.md) |
| **E** | Data & finance | 6 | `cluster-e-compose` | [`data/SKILL.md`](data/SKILL.md) |
| **F** | Captions & subtitles | 6 | `cluster-f-compose` | [`captions/SKILL.md`](captions/SKILL.md) |
| **G** | CTAs / social | 5 | `cluster-g-compose` | [`ctas/SKILL.md`](ctas/SKILL.md) |
| **H** | AR & environmental overlays | 4 | `cluster-h-compose` | [`ar/SKILL.md`](ar/SKILL.md) |
| **TOTAL** | — | **50** | **7 of 7** (D excluded) | — |

Cluster D is the deliberate exception: title cards and main-on-end sequences are picked verbatim rather than composed; no `compose_*` tools.

Cluster H presets render via static-fallback in v1; live-mount of the underlying `ThreeSceneClip` is gated on Track A finale (T-397..T-405) and the tenant frontier-enablement toggle (T-411).

## When to invoke a cluster's compose tool

The orchestrator routes a brief to a cluster by intent:

- Breaking news / political / corporate-broadcast register → Cluster A
- Live sports broadcast / scorebug / timing → Cluster B
- Weather / climate / disaster response → Cluster C
- Title card / opening / closing-credit register → Cluster D (no compose; pick a preset)
- Data dashboards / finance tickers / Bloomberg-style → Cluster E
- Caption tracks / subtitles / on-screen dialogue → Cluster F
- Subscribe / follow / link CTAs → Cluster G
- AR-composited sports / VAR / stadium / environmental → Cluster H

When the brief spans clusters (e.g. "weather report with a CNN-style lower-third"), invoke each cluster's tool and let the document model resolve overlap — the framework supports multiple per-element compositing modes (per `mixBlendMode` on `ClipDefinition`).

## Adding a new preset to an existing cluster

See the cluster's own SKILL.md and the canonical M-sized cluster-compose template at `docs/tasks/T-340.md`. Pattern in two parts:

1. Land the preset markdown + binding + golden + thresholds + sign-off in one PR (Pattern D in-PR sign-off). Cluster H pattern: first preset for a new clipKind goes through `DEFAULT_CLIP_KIND_RESOLVER`; subsequent siblings via `PRESET_ID_BINDINGS`.
2. Bump the cluster SKILL's preset list. The auto-gen tools/SKILL bundles will pick the new compose tool on the next `pnpm gen:tool-skills` run.

## Adding a new cluster

Adding a new cluster requires:

- A new directory under `skills/stageflip/presets/<cluster>/`
- A `SKILL.md` (substantive) in that directory
- ≥1 ratified preset markdown
- A `cluster-<x>-compose` handler bundle in `packages/engine/src/handlers/`
- Registration in `CANONICAL_BUNDLES`, `app-agent/orchestrator.ts`, and the engine `registry.test.ts` size assertion
- Bump this index's row + total

The full template is `docs/tasks/T-340.md` (canonical M-sized cluster-compose dispatch).
