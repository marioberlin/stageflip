---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131f.2a — dashboard composites tranche 1/3. Two new clips on the
frame-runtime bridge:

- `hr-dashboard` — KPI strip (headcount / open positions / avg
  attrition) + per-department table (headcount, open, attrition,
  distribution bar) + optional metrics panel. Flat-prop schema
  avoids importing a domain `HrContent` type from the Phase 7
  agent layer.
- `marketing-dashboard` — KPI strip (spend / revenue / ROAS /
  conversions + optional extra KPI) + mode switch between channel
  bars/table and funnel bars. Same flat-prop discipline.

Both clips declare `themeSlots`: `background` → `palette.background`,
`textColor` → `palette.foreground`, `surface` → `palette.surface`.
Entry animation is a single 0..15-frame fade-in — no spring physics
(reference clips had no frame-driven entrance at all).

`ALL_BRIDGE_CLIPS` now exposes 26 clips. KNOWN_KINDS +
cdp-host-bundle clip-count test + parity fixtures + plan row all
updated. Plan row T-131f.2 marked `[in-progress]`; follow-ups
T-131f.2b (product + okr) and T-131f.2c (sales) track the remaining
three dashboards.
