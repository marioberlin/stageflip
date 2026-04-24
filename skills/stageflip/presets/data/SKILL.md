---
title: Cluster E — Data visualization & live data
id: skills/stageflip/presets/data
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-361
related:
  - docs/decisions/ADR-004-preset-system.md
  - docs/decisions/ADR-005-frontier-clip-catalogue.md
  - skills/stageflip/presets/sports/SKILL.md
  - skills/stageflip/presets/news/SKILL.md
---

# Cluster E — Data visualization & live data

Data register: CNN Magic Wall, Bloomberg ticker, Olympic medal tracker, cricket ball-by-ball dots, F1 sector colors, big-number stat impact. Depends on the Chart clip family (T-406) for frame-deterministic SVG. Prime cluster for `LiveDataClip` frontier interaction.

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Financial / market data (stocks, crypto, rates)
- Election coverage, voting, polling
- Sports stats companion (paired with cluster B presets)
- Big-number impact stat (call-out, earnings highlight)
- Live dashboard feed

Do **not** invoke for sports score overlays — those are cluster B. This cluster is for the data visualizations that sit alongside them.

## Presets

- [`magic-wall-drilldown`](magic-wall-drilldown.md) — fullScreen interactive election map; Code and Theory canonical
- [`bloomberg-ticker`](bloomberg-ticker.md) — newsTicker, financial register, symbol + price + delta
- [`olympic-medal-tracker`](olympic-medal-tracker.md) — standings, gold/silver/bronze canonical, national-flag register
- [`cricket-ball-by-ball-dots`](cricket-ball-by-ball-dots.md) — scoreBug annex, colored-dot sequence over
- [`f1-sector-purple-green`](f1-sector-purple-green.md) — timing-tower annex, sector color delta
- [`big-number-stat-impact`](big-number-stat-impact.md) — bigNumber, count-up animation, impact zoom

## Semantic tools

- `compose_live_data(endpoint, schema, brand)` — routes to `LiveDataClip` if the tenant has enabled the frontier; falls back to a static snapshot preset otherwise
- `compose_market_ticker(symbols, brand)` — Bloomberg-register scrolling ticker
- `compose_election_board(candidates, regions, brand)` — Magic Wall register
- `compose_big_number(value, label, brand)` — big-number stat with count-up
- `compose_stat_callout(stat, context, brand)` — inline stat highlight for video / slide

## Cluster conventions (from the compass canon)

- **Tabular numerals are mandatory.** Every preset must support them; fallbacks must too. Non-tabular rendering is visually broken for column alignment.
- **Count-ups are not animations for their own sake.** They slow the viewer down to let the number register. Never start a count-up from zero if the actual number is a delta from a baseline — start from the baseline.
- **Red / green for financial register is locale-dependent.** Western markets: red = down, green = up. East Asian markets (e.g., Nikkei coverage): red = up, green = down. Preset must take `locale` as an input for any Up/Down semantics.
- **Theater is a feature, not a bug (Magic Wall canon).** Code and Theory designed the Magic Wall drill-down to "pop in a theatrical way that would look great on camera." Pair this cluster's presets with motion that reads well on broadcast, not just on mobile.
- **`LiveDataClip` vs. static snapshot is a capability decision, not a taste one.** If the tenant has frontier enabled, the live path renders; otherwise, the static snapshot fallback (last cached value) renders. Either way, the preset's visual tokens are the same.
- **Never bury the unit.** "$3.2M" not "3200000". Format the number at the compose layer; don't leave it to the viewer's mental arithmetic.

## Escalation

If the brief demands a non-standard chart type (Sankey, treemap, chord diagram) that isn't in the Chart clip family (T-406), escalate. We should expand the Chart family deliberately, not inline-compose.

If a tenant wants a frontier `LiveDataClip` with a data source we don't have a connector for, route to the frontier-integration track — don't ship an ad-hoc fetch inline.

## Type-design — no cluster-wide batch review

Most presets in this cluster use Roboto, Bloomberg's in-house, or Gotham. Individual presets escalate if they cite bespoke type.

## Related

- ADR-004, ADR-005 (the `LiveDataClip` frontier)
- Gap clip / family: Chart clip family (T-406) — blocks data-viz presets
- `skills/stageflip/presets/sports/SKILL.md` — pairs for stat overlays
- `skills/stageflip/presets/news/SKILL.md` — pairs for election nights, earnings coverage
- Compass canon: `docs/compass_artifact.md` §§ News and breaking (Magic Wall), Dynamic sports results (cricket, F1)
