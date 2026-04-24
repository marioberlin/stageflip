---
title: Tools — Finance/Sales/OKR Bundle
id: skills/stageflip/tools/domain-finance-sales-okr
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-166
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
  - skills/stageflip/tools/element-cm1/SKILL.md
---

# Tools — Finance/Sales/OKR Bundle

27 composite tools that each insert a fully-formed slide (title +
themed elements) via a single `add /content/slides/-` JSON-Patch op.
The largest handler bundle; split into three sub-modules of 9 tools
each. Slide-mode only. All handlers type against `MutationContext`.

Registration: `registerDomainBundle(registry, router)` from
`@stageflip/engine`.

## Sub-modules

All 27 tools share a common output shape
`{ ok: true, slideId, position }` / `{ ok: false, reason: 'wrong_mode' }`
and use shared element builders (metric cards, progress bars, charts,
hero numbers, horizontal strip layouts) from the bundle's internal
`builders.ts`. Slide ids are auto-generated via `nextSlideId` from
`create-mutate/ids.ts`, so composites chain cleanly with downstream
edits.

### Finance (9)

- `create_kpi_strip_slide` — 1–6 metric cards
- `create_revenue_chart_slide` — line / bar / area / combo chart
- `create_expense_breakdown_slide` — donut / pie chart
- `create_cashflow_slide` — inflow/outflow bar chart
- `create_runway_callout` — hero months + subtitle
- `create_arr_mrr_snapshot` — ARR + MRR cards + growth line
- `create_funding_timeline` — horizontal rounds timeline
- `create_balance_sheet_summary` — Assets / Liabilities / Equity cards
- `create_margin_callout` — 1–3 margin callout cards

### Sales (9)

- `create_pipeline_funnel_slide` — tapered stage cards
- `create_quota_attainment_slide` — per-rep progress bars
- `create_win_loss_breakdown` — won vs lost + reasons pie
- `create_pipeline_coverage_callout` — hero multiple
- `create_top_opportunities_slide` — grid of opp cards
- `create_rep_leaderboard_slide` — ranked rows
- `create_sales_cycle_slide` — stage-days bar chart
- `create_territory_summary_slide` — grid of territory cards
- `create_close_rate_callout` — hero percentage + benchmark

### OKR (9)

- `create_okr_slide` — objective + key-result progress bars
- `create_okr_summary_slide` — quarterly roll-up with status accents
- `create_objective_hero_slide` — single-objective hero
- `create_okr_check_in_slide` — weekly update rows
- `create_okr_retro_slide` — wins / misses two-column
- `create_quarterly_roadmap_slide` — 1–4 quarter columns
- `create_key_result_scorecard_slide` — target vs actual rows
- `create_okr_divider_slide` — section divider
- `create_okr_grading_rubric_slide` — 2–6 grading bands

Status accent colors (OKR): `#22c55e` (on-track), `#f59e0b` (at-risk),
`#ef4444` (off-track).

## Invariants

- Every handler declares `bundle: 'domain-finance-sales-okr'`.
- All 27 handlers type against `MutationContext`.
- Tool count 27 → within I-9's 30 cap (close to the ceiling; no room
  to add more tools without splitting).
- Every handler inserts exactly one slide via `add /content/slides/-`.
- Builders emit elements at the 1920×1080 reference canvas; layouts
  auto-fill with margins + gaps.
- Sub-modules (finance / sales / okr) are internal; external consumers
  use `DOMAIN_HANDLERS` / `DOMAIN_TOOL_DEFINITIONS` from
  `@stageflip/engine`.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Low-level siblings: `tools/create-mutate/SKILL.md`,
  `tools/element-cm1/SKILL.md`
- Task: T-166
