---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-322 — `lyrics` runtime-clip primitive.

Line-level music-synced lyric panel with three style bundles
(`'karaoke-wipe'` — left-to-right color front sweeping across the
active line driven by per-line ms-progress; `'three-line-stack'` —
past dimmed at top / active highlighted in middle / next preview at
bottom; `'highlight-current'` — active line only, full-screen).
Frame-deterministic line visibility (`(currentTimeMs ∈ [line.startMs,
line.endMs))`); per-line entrance (`'none'` / `'fade'` default /
`'rise'`, 12-frame settle anchored on each line's `startMs` frame);
`'karaoke-wipe'` SVG `<clipPath>` fill driven by within-line
ms-progress with stable line-index-derived clipPath IDs
(`lyrics-line-clip-${i}`); optional `glow?: { color, blur }` halo on
the active line via SVG Gaussian-blur `<filter>` with stable filter
ID (`lyrics-glow-${i}`); `maxLinesVisible: 1 | 3 | 5` (default `3`;
forced to `1` under `'highlight-current'`); `lineGap` (default 80)
vertical spacing in the stack; casing transforms (`as-is` /
`uppercase` / `lowercase` / `title-case`); theme-slot fallback
(`background` → `palette.background`, `foreground` →
`palette.foreground`). `lines: { text, startMs, endMs }[]` strict
required input (1–40 entries; pre-computed beat-aligned line
timings — beat detection / audio-track parsing is a host concern,
not this primitive).

Unblocks T-367 (`karaoke-progressive-wipe`, last Cluster F preset,
6/6) and reusable for Cluster A music-show graphics + Cluster G
social-music presets. Cluster-specific palettes + canned `lines[]`
live in `parity-cli` resolver shims, not in this primitive.

`ALL_BRIDGE_CLIPS` 48 → 49; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
