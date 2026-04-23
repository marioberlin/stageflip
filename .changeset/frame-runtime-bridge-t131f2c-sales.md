---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131f.2c — dashboard composites tranche 3/3. `sales-dashboard`
closes the T-131f.2 dashboard tranche.

- `sales-dashboard` — pipeline composite over `stages[]` + `deals[]`
  + optional `summary`. Five `pipelineType` modes:
  - `funnel` / `quarterly_review`: PipelineFunnel (per-stage bars
    sized by total deal value, at-risk badge, stage probability
    labels) + optional DealCard strip below when
    `settings.showDealCards` is set.
  - `forecast`: ForecastChart (closed-won / weighted / total
    pipeline bars vs quota line) + a summary-KPI column.
  - `deal_review`: full-bleed DealCard grid sorted by
    `settings.sortBy` (default: value desc).
  - `win_loss`: two-column Won / Lost DealCard split (the ONLY
    mode where lost deals render).

`PipelineFunnel` / `ForecastChart` / `DealCard` are inlined as
module-private helpers inside `sales-dashboard.tsx` (single
consumer). Same flat-prop Zod schema + `_dashboard-utils.ts`
helpers as the rest of the T-131f.2 tranche.

Density (`executive` / `standard` / `detailed`) controls
`maxDealsShown` default. Currency prefix auto-selects `$` for
USD, `€` for EUR, empty for anything else.

`ALL_BRIDGE_CLIPS` now exposes 29 clips. KNOWN_KINDS +
cdp-host-bundle clip-count test + parity fixture + plan row all
updated. T-131f.2 marked `[shipped]`.
