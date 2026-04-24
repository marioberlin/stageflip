---
title: Tools — Domain Finance Sales OKR Bundle
id: skills/stageflip/tools/domain-finance-sales-okr
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-166
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Domain Finance Sales OKR Bundle

Domain composites for finance / sales / OKR clip authoring and KPI binding.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/domain-finance-sales-okr/`.

Registration: see `@stageflip/engine`'s `registerDomainFinanceSalesOkrBundle` (or equivalent) export.

## Tools

### `create_kpi_strip_slide`

Finance: insert a KPI-strip slide. `metrics` (1–6) become equal-width cards with a label + value. Card layout auto-fills the 1920-px canvas.

- `title` (`string`)
- `metrics` (`array`)

### `create_revenue_chart_slide`

Finance: slide with a revenue chart. `chartKind` defaults to `line`. Each series represents one revenue stream / period; values may contain `null` for gaps.

- `title` (`string`)
- `labels` (`array`)
- `series` (`array`)
- `chartKind` (`string`) _(optional)_ — enum: `line` / `bar` / `area` / `combo`

### `create_expense_breakdown_slide`

Finance: slide with a pie or donut chart of expense categories. Chart data is built from `categories` (2–12 entries).

- `title` (`string`)
- `categories` (`array`)
- `kind` (`string`) _(optional)_ — enum: `pie` / `donut`

### `create_cashflow_slide`

Finance: slide with a grouped bar chart showing inflow vs outflow across periods. Arrays must be the same length as `periods`.

- `title` (`string`)
- `periods` (`array`)
- `inflow` (`array`)
- `outflow` (`array`)

### `create_runway_callout`

Finance: slide with a single hero number showing cash runway in months. Optional `subtitle` appears below.

- `title` (`string`)
- `months` (`number`)
- `subtitle` (`string`) _(optional)_

### `create_arr_mrr_snapshot`

Finance: slide showing ARR and MRR side-by-side as large metric cards, with an optional growth delta line below.

- `title` (`string`)
- `arr` (`string`)
- `mrr` (`string`)
- `delta` (`string`) _(optional)_

### `create_funding_timeline`

Finance: slide with a horizontal funding-rounds timeline. Each round is a shape with amount + date labels. `rounds` should be chronological.

- `title` (`string`)
- `rounds` (`array`)

### `create_balance_sheet_summary`

Finance: 3-column balance-sheet summary slide — Assets / Liabilities / Equity — with totals as hero values on each card.

- `title` (`string`)
- `assets` (`string`)
- `liabilities` (`string`)
- `equity` (`string`)

### `create_margin_callout`

Finance: slide showing one to three margin values side-by-side. `grossMargin` is required; operating + net are optional. Good for P&L summary or investor-update hero slides.

- `title` (`string`)
- `grossMargin` (`string`)
- `operatingMargin` (`string`) _(optional)_
- `netMargin` (`string`) _(optional)_

### `create_pipeline_funnel_slide`

Sales: slide with a pipeline funnel. Each stage becomes a metric card showing stage name + count, stacked vertically (widest on top).

- `title` (`string`)
- `stages` (`array`)

### `create_quota_attainment_slide`

Sales: slide with a per-rep quota-attainment list (progress bars, 0..1 = % of quota; values > 1 show >100%). `attained` is capped at 2.0 in the UI.

- `title` (`string`)
- `team` (`array`)

### `create_win_loss_breakdown`

Sales: slide with won vs lost counts (two metric cards) and optional `reasons` pie chart below.

- `title` (`string`)
- `won` (`integer`)
- `lost` (`integer`)
- `reasons` (`array`) _(optional)_

### `create_pipeline_coverage_callout`

Sales: hero slide with pipeline-coverage multiple (e.g. `3.2x`) plus optional quota context line.

- `title` (`string`)
- `coverageMultiple` (`number`)
- `quota` (`string`) _(optional)_

### `create_top_opportunities_slide`

Sales: grid of top-opportunity cards (account + dollar amount + optional stage). Up to 6 cards in two rows.

- `title` (`string`)
- `opportunities` (`array`)

### `create_rep_leaderboard_slide`

Sales: rep leaderboard slide. Each row is a full-width metric card showing the rep name + their value (closed revenue, win count, etc.).

- `title` (`string`)
- `rows` (`array`)

### `create_sales_cycle_slide`

Sales: horizontal timeline of sales-cycle stages with average days per stage. Renders as a bar chart with stages as categories.

- `title` (`string`)
- `stages` (`array`)

### `create_territory_summary_slide`

Sales: grid of territory cards (name + revenue + optional growth). Up to 8 cards (4 columns × 2 rows).

- `title` (`string`)
- `territories` (`array`)

### `create_close_rate_callout`

Sales: hero close-rate slide. `closeRate` is 0..1 and renders as a large percentage. Optional `benchmark` renders as a small comparison below.

- `title` (`string`)
- `closeRate` (`number`)
- `benchmark` (`number`) _(optional)_
- `subtitle` (`string`) _(optional)_

### `create_okr_slide`

OKR: slide with one objective (as body text) and up to 5 key-result progress bars.

- `title` (`string`)
- `objective` (`string`)
- `keyResults` (`array`)

### `create_okr_summary_slide`

OKR: roll-up slide for a quarter. Each OKR becomes a metric-card with objective + status-tinted accent + progress %.

- `title` (`string`)
- `quarter` (`string`)
- `okrs` (`array`)

### `create_objective_hero_slide`

OKR: hero slide featuring a single objective statement, optional owner line. Use to open OKR deck sections.

- `title` (`string`)
- `objective` (`string`)
- `owner` (`string`) _(optional)_

### `create_okr_check_in_slide`

OKR: weekly check-in slide. Each update row is status-tinted with an optional note.

- `title` (`string`)
- `weekLabel` (`string`)
- `updates` (`array`)

### `create_okr_retro_slide`

OKR: two-column retrospective slide. Left column lists wins, right column lists misses.

- `title` (`string`)
- `quarter` (`string`)
- `wins` (`array`)
- `misses` (`array`) _(optional)_

### `create_quarterly_roadmap_slide`

OKR/strategy: 2–4 column quarterly roadmap. Each quarter column lists up to 6 bullet items.

- `title` (`string`)
- `quarters` (`array`)

### `create_key_result_scorecard_slide`

OKR: scorecard slide listing KR target vs actual + a status accent per row.

- `title` (`string`)
- `rows` (`array`)

### `create_okr_divider_slide`

OKR: section-divider slide (big heading + optional subhead). Use between OKR-deck sections (Company → Team → Individual).

- `heading` (`string`)
- `subhead` (`string`) _(optional)_

### `create_okr_grading_rubric_slide`

OKR: grading-rubric reference slide (e.g. 0–0.3 miss / 0.4–0.6 ok / 0.7–1.0 good). Each band becomes a metric card.

- `title` (`string`)
- `bands` (`array`)


## Invariants

- Every handler declares `bundle: 'domain-finance-sales-okr'`.
- Tool count 27 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-166
