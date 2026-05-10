---
title: Tools — Index
id: skills/stageflip/tools
tier: tools
status: auto-generated
last_updated: 2026-04-24
owner_task: T-220
related:
  - skills/stageflip/concepts/tool-bundles
  - skills/stageflip/concepts/tool-router
---

# Tools — Index

**Auto-generated from `@stageflip/engine`'s bundle registry.** Do
NOT edit by hand — run `pnpm skills-sync` after registering a
new bundle; `pnpm skills-sync:check` fails in CI if this file
drifts.

23 bundles, 133 tools total.

StageFlip ships tools grouped into bundles so an agent context
rarely needs more than 30 tool definitions loaded at once
(invariant I-9). The Planner picks bundles by name — see
`concepts/tool-bundles/SKILL.md` for the loading policy and
`concepts/tool-router/SKILL.md` for dispatch semantics.

## Bundles

| Bundle | Tools | Description |
|---|---|---|
| [`read`](./read/SKILL.md) | 5 | Read-only inspection of the current document — get_document, get_slide, list_elements, describe_selection, get_theme. |
| [`create-mutate`](./create-mutate/SKILL.md) | 8 | Add, update, duplicate, reorder, and delete slides + elements. |
| [`timing`](./timing/SKILL.md) | 4 | Adjust per-slide duration, sequence, and timeline timing hints. |
| [`layout`](./layout/SKILL.md) | 5 | Apply alignment, distribution, grids, and constraint-based layout. |
| [`validate`](./validate/SKILL.md) | 4 | Run the pre-render linter, schema validation, and fixable-rule checks. |
| [`clip-animation`](./clip-animation/SKILL.md) | 14 | Pick and configure clips + animations across all registered runtimes. |
| [`element-cm1`](./element-cm1/SKILL.md) | 12 | Element-level content-mutation tools (text, shape, image, table cells). |
| [`slide-cm1`](./slide-cm1/SKILL.md) | 6 | Slide-level content-mutation + accessibility (alt text, reading order). |
| [`table-cm1`](./table-cm1/SKILL.md) | 6 | Table-specific content-mutation tools — rows, columns, cell merges. |
| [`qc-export-bulk`](./qc-export-bulk/SKILL.md) | 9 | Batch quality checks, bulk operations, and export-trigger tools. |
| [`fact-check`](./fact-check/SKILL.md) | 2 | Fact-verification tools using web search + citation. |
| [`domain-finance-sales-okr`](./domain-finance-sales-okr/SKILL.md) | 27 | Domain composites for finance / sales / OKR clip authoring and KPI binding. |
| [`data-source-bindings`](./data-source-bindings/SKILL.md) | 2 | Bind document values to external data sources (CSV, Sheets, GraphQL). |
| [`semantic-layout`](./semantic-layout/SKILL.md) | 4 | Semantic-role layout helpers — title blocks, KPI strips, two-column flows. |
| [`video-mode`](./video-mode/SKILL.md) | 1 | StageFlip.Video profile tools — multi-aspect export planning, per-aspect layout helpers (T-185 and onward). |
| [`display-mode`](./display-mode/SKILL.md) | 2 | StageFlip.Display profile tools — file-size optimization planning, multi-size preview resolution (T-206 and onward). |
| [`arrange-variants`](./arrange-variants/SKILL.md) | 1 | Variant generation — turn one canonical Document into a message × locale matrix of variants (T-386). |
| [`cluster-a-compose`](./cluster-a-compose/SKILL.md) | 4 | Cluster A (News & Broadcast) composer tools — preset-binding factories for breaking-news / ongoing-update / guest-intro / documentary-title-card briefs across the 8 ratified Cluster A presets (T-331). |
| [`cluster-b-compose`](./cluster-b-compose/SKILL.md) | 4 | Cluster B (Sports) composer tools — preset-binding factories for live-sports score / standings / VAR / player-intro briefs (T-340). |
| [`cluster-c-compose`](./cluster-c-compose/SKILL.md) | 0 | Cluster C (Weather) composer tools — preset-binding factories for weather alerts / forecast maps / storm tracks / temperature maps across the 6 ratified Cluster C presets (T-347). |
| [`cluster-e-compose`](./cluster-e-compose/SKILL.md) | 5 | Cluster E (Data) composer tools — preset-binding factories for live-data / market-ticker / election-board / big-number / stat-callout briefs across the 6 ratified Cluster E presets (T-361). |
| [`cluster-f-compose`](./cluster-f-compose/SKILL.md) | 4 | Cluster F (Captions / Lyrics) composer tools — preset-binding factories for creator-caption / subtitle / lyric-video / keyword-highlight briefs (T-368). |
| [`cluster-g-compose`](./cluster-g-compose/SKILL.md) | 4 | Cluster G (CTAs / social) composer tools — preset-binding factories for subscribe / follow / link-sticker / QR-bounce / social-handle briefs across the 5 ratified Cluster G presets (T-374). |

## Per-bundle reference

Each bundle ships a SKILL.md listing every tool it registers,
its input schema, and invariants. Those are auto-generated too,
but by a separate script (`pnpm gen:tool-skills`, T-169) so the
index + per-bundle surfaces stay independent.
