---
title: Tools — Data Source Bindings Bundle
id: skills/stageflip/tools/data-source-bindings
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-167
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Data Source Bindings Bundle

Bind document values to external data sources (CSV, Sheets, GraphQL).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/data-source-bindings/`.

Registration: see `@stageflip/engine`'s `registerDataSourceBindingsBundle` (or equivalent) export.

## Tools

### `bind_chart_to_data_source`

Swap a chart element's `data` field to a `ds:<id>` reference. Replaces whatever was there (inline `ChartData` or another reference). Reports `previousKind: 'inline' | 'reference'` so the caller knows what they overwrote. Ref format is enforced by `dataSourceRefSchema` (lowercase alphanumerics + underscores / dashes).

- `slideId` (`string`)
- `elementId` (`string`)
- `dataSourceRef` (`string`) — `ds:<id>` reference — Zod-validated server-side.

### `unbind_chart_data_source`

Replace a chart element's `ds:` reference with inline `ChartData` (`{ labels, series }`). Refuses `not_bound` if the chart's `data` isn't currently a `ds:<id>` reference. `replacement` is Zod-validated against the chart data schema.

- `slideId` (`string`)
- `elementId` (`string`)
- `replacement` (`object`) — Inline chart data — `{ labels, series }` — Zod-validated against `chartDataSchema`.


## Invariants

- Every handler declares `bundle: 'data-source-bindings'`.
- Tool count 2 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-167
