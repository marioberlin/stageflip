---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131f.2b — dashboard composites tranche 2/3. Two new clips on the
frame-runtime bridge:

- `product-dashboard` — KPI strip (shipped / in-progress / blocked) +
  four display modes driven by `reportType`: sprint_review and
  release_notes show a 2-column feature card grid; roadmap shows
  Now/Next/Later lanes; metrics_dashboard shows a right-side panel
  with optional sparklines + alert borders on threshold breach.
- `okr-dashboard` — KPI strip (avg progress, on-track, at-risk,
  behind, key-result completion) + four modes: `dashboard` /
  `objective_detail` show an `ObjectiveCard` grid (SVG circular
  progress ring + KR progress bars); `team_comparison` shows
  per-team columns; `roadmap` shows Now/Next/Later lanes with
  status-mapped objective cards. `ObjectiveCard` is inlined (not a
  separate package — the OKR dashboard is its sole consumer) and
  exported for reuse.

Both clips follow the f.2a pattern: flat Zod `propsSchema` over just
the fields rendered (no `@slidemotion/schema` domain types), shared
helpers from `_dashboard-utils.ts`, `themeSlots` for
`background` / `textColor` / `surface`, and a single 0..15-frame
fade-in entrance.

`ALL_BRIDGE_CLIPS` now exposes 28 clips. KNOWN_KINDS +
cdp-host-bundle clip-count test + parity fixtures + plan row all
updated. Plan row T-131f.2 stays `[in-progress]`; T-131f.2c (sales)
is the remaining sub-tranche.
