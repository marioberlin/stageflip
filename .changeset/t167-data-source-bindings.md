---
'@stageflip/engine': minor
---

T-167 — Thirteenth handler bundle shipped: `data-source-bindings` (2
tools). Swap a chart element's `data` field between inline
`ChartData` and a `ds:<id>` reference.

- `bind_chart_to_data_source` — replace with `ds:<id>`; reports
  `previousKind: 'inline' | 'reference'`.
- `unbind_chart_data_source` — replace `ds:` ref with inline
  `ChartData`; `not_bound` if data isn't currently a reference.

Actual data-source resolution (CSV / Sheets / GraphQL) happens
downstream at render time; this bundle only rewrites the document
binding.

11 new engine tests (5 handlers + 6 register); 328 total.
All 9 gates green. Skill flipped to substantive.
