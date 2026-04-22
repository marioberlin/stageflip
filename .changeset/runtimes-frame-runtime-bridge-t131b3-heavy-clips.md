---
'@stageflip/runtimes-frame-runtime-bridge': minor
'@stageflip/cdp-host-bundle': minor
---

T-131b.3 — heavy tranche of the frame-runtime-bridge port. Closes
T-131b: `ALL_BRIDGE_CLIPS` now exposes 14 clips across b.1 / b.2 / b.3.

Clips landed:
- `animated-value` — reusable spring count-up primitive; also exports
  `AnimatedProgressBar` / `AnimatedProgressRing` as non-clip building
  blocks for dashboard compositions.
- `kpi-grid` — dashboard grid composed of `AnimatedValue` cards with
  per-card spring stagger + trend ▲/▼ markers.
- `pull-quote` — spring-scaled decorative quote mark + typewriter
  quote body + attribution slide-in.
- `comparison-table` — two-column comparison with staggered row reveal
  (rows slide in from their respective sides).

All four are fresh implementations against `@stageflip/frame-runtime`
(zero Remotion imports per CLAUDE.md §3). Each declares a Zod
`propsSchema` and a `themeSlots` map binding default colour props to
`palette.*` roles. Parity fixtures land for each. KNOWN_KINDS
allowlist extended. cdp-host-bundle picks them up automatically via
the existing `ALL_BRIDGE_CLIPS` registration; the runtimes test now
verifies all 14 kinds resolve.
