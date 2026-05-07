---
'@stageflip/engine': patch
---

T-361 — Add the `cluster-e-compose` engine handler bundle: 5 read-only composer tools (`compose_live_data` / `compose_market_ticker` / `compose_election_board` / `compose_big_number` / `compose_stat_callout`) that bind a semantic Cluster E (Data) brief to a ratified preset id + opaque props payload. Tools declare `ToolContext` (no document reads, no patch sink); the caller mounts the chosen clip via a separate write-tier tool (`add_clip` / `add_element`).

Dispatches across the 6 ratified Cluster E presets (T-355..T-360): `compose_live_data` routes by `layout` (`wall` → `magic-wall-drilldown`, `big-number` → `big-number-stat-impact`); `compose_market_ticker` always → `bloomberg-ticker`; `compose_election_board` always → `magic-wall-drilldown`; `compose_big_number` routes by `sport` (`f1` → `f1-sector-purple-green`, default → `big-number-stat-impact`); `compose_stat_callout` routes by `sport` across all 4 callout-bearing presets (`cricket` / `f1` / `olympic` / generic-big-number default). All 6 Cluster E preset ids are reachable from at least one (tool, input gate) pair.

`compose_live_data` is routing-only per D-T361-9 — the runtime evaluates frontier capability at compose time and uses the live or snapshot path; the composer does NOT fetch. Olympic + wall is rejected with `unsupported_domain` (use `compose_stat_callout` for Olympic data instead). Closes the cluster-compose surface for all 4 ratified clusters: T-340 (Cluster B sports) / T-368 (Cluster F captions) / T-331 (Cluster A news) / T-361 (Cluster E data). 5-tool footprint vs sibling 4-tool clusters reflects Cluster E's broader sport-stat-overlay scope. No clip / parity-cli / preset markdown / parity golden touched.
