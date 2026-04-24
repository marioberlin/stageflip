---
title: Tools — Data-Source Bindings Bundle
id: skills/stageflip/tools/data-source-bindings
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-167
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/domain-finance-sales-okr/SKILL.md
  - skills/stageflip/tools/element-cm1/SKILL.md
---

# Tools — Data-Source Bindings Bundle

Two tools for swapping a chart element's `data` field between inline
`ChartData` (`{ labels, series }`) and a `dataSourceRefSchema`
reference (`ds:<id>`). Slide-mode only. Handlers type against
`MutationContext`.

Actual data-source resolution (CSV / Sheets / GraphQL → labels +
series) happens downstream at render time. This bundle only rewrites
the document's binding — no I/O.

Registration: `registerDataSourceBindingsBundle(registry, router)` from
`@stageflip/engine`.

## Tools

### `bind_chart_to_data_source` — `{ slideId, elementId, dataSourceRef }`

Swap a chart's `data` to a `ds:<id>` reference. Overwrites whatever
was there; reports `previousKind: 'inline' | 'reference'` so the caller
knows if they stomped on inline data. The ref format is validated by
`dataSourceRefSchema` (lowercase alphanumerics + `_` + `-` after the
`ds:` prefix).

### `unbind_chart_data_source` — `{ slideId, elementId, replacement }`

Swap a `ds:` reference back to inline `ChartData`. Refuses `not_bound`
if the chart's `data` isn't currently a reference. `replacement` is
Zod-validated against `chartDataSchema`.

## Invariants

- Every handler declares `bundle: 'data-source-bindings'`.
- Both handlers type against `MutationContext`.
- Only targets elements with `type: 'chart'`; non-chart targets refuse
  `wrong_element_type`.
- Handlers make no I/O — they only rewrite the document's binding.
- Tool count 2 → well within I-9's 30 cap.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Composite consumers: `tools/domain-finance-sales-okr/SKILL.md`
  (emits charts that this bundle can bind/unbind)
- Task: T-167
