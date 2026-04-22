---
'@stageflip/runtimes-frame-runtime-bridge': minor
'@stageflip/cdp-host-bundle': minor
---

T-131b.2 — medium tranche of the frame-runtime-bridge port:
`subtitle-overlay`, `light-leak`, `pie-chart-build`, `stock-ticker`,
`line-chart-draw`. Each is a fresh implementation against
`@stageflip/frame-runtime` (zero Remotion imports per CLAUDE.md §3).
Per-clip palette wiring via `themeSlots` where appropriate;
`light-leak` deliberately ships without `themeSlots` since its film-
tone palette is intentionally off-theme. `ALL_BRIDGE_CLIPS` now
exposes 10 clips (b.1 + b.2). cdp-host-bundle picks them up via the
existing `ALL_BRIDGE_CLIPS` registration. Parity fixtures land for
each. KNOWN_KINDS allowlist updated. The remaining T-131b.3 tranche
(pull-quote, comparison-table, kpi-grid, animated-value) extends the
same surface.
