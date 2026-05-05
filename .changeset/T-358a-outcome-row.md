---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-358a — `outcome-row` runtime-clip primitive.

Generic primitive that renders a horizontal row of N (1..12)
independently color-coded chips with a staggered fade-in entrance
(`delay = i * 4` frames, 12-frame ramp). Three shape variants:
`circle` (default), `square`, `rounded`. Per-chip hex `color` is
required; theme slots map `defaultFill` → `palette.surface`,
`outlineColor` → `palette.foreground`, `background` →
`palette.background`.

Unblocks T-358 (cricket ball-by-ball dots) and the broader
Cluster B/E scorebug-family preset shape (tennis tiebreak points,
F1 sector history, soccer last-N-shots indicators). Cluster-specific
outcome → color mapping lives in `parity-cli` resolver shims, not in
this primitive.

`ALL_BRIDGE_CLIPS` 43 → 44; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
