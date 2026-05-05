---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-355a — `magic-wall-panel` runtime-clip primitive.

Generic fullscreen layered hierarchical-data panel of N (1..56)
labeled, color-shaded region tiles at absolute-positioned bounds
(`{ x, y, width, height }` per region; canvas-pixel coordinates).
Per-region hex `color` override with theme `foreground` fallback;
optional top-of-panel `title` + `subtitle` (subtitle at 70% opacity);
`valueFormat` dispatch (`'percent'` → `${value.toFixed(1)}%`,
`'count'` → `value.toLocaleString('en-US')`, `'raw'` →
`String(value)`) with optional per-region `valueLabel` override (e.g.,
`'CALLED'` / `'Too Close'`); three entrance modes (`'stagger-rise'`
default — fade + 12 px rise / `'fade'` — fade only / `'none'`), per-
region delay `delay = i * staggerMs / (1000 / fps)`, 12-frame ramp;
`tabular-nums` on numeric-formatted cells (`'percent'` / `'count'` /
`'raw'`-numeric). Theme-slot fallback per D-T355a-6 (`background` →
`palette.background`, `foreground` → `palette.foreground`).

v1 ships placeholder rectangles via `region.bounds`; real US state
SVG path geometry / county shapes / projection helper / `us-atlas`
topology are a v2 follow-up (out of envelope per T-355 D-T355-6).
Drilldown / zoom transitions live at runtime composition
(ADR-003 §D2), not in the primitive.

Unblocks T-355 (magic-wall-drilldown, Cluster E) and the broader
Cluster A/B/C/E fullscreen-panel preset shape (msnbc-big-board,
uefa-starball-refraction, twc-retrocast-8bit / twc-immersive-mixed-
reality, future scientific heatmaps). Cluster-specific region
geometry + palettes live in `parity-cli` resolver shims, not in this
primitive.

`ALL_BRIDGE_CLIPS` 47 → 48; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
