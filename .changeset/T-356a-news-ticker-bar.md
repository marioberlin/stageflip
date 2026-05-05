---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-356a — `news-ticker-bar` runtime-clip primitive.

Generic horizontal scrolling chyron of N (1..24) symbol + price + delta
+ ▲ / ▼ / ▬ direction-arrow chips translating left at `scrollSpeed`
px/sec, looping continuously via the doubled-row marquee pattern
(modulo `rowWidth = entries.length * (chipWidth + chipGap)`). Fixed
`chipWidth` (default 220 px) keeps the wrap math fully deterministic.
Direction-driven colors (`upColor` / `downColor` / `flatColor`) with
theme-slot fallback (both `upColor` and `downColor` map to
`palette.accent` per D-T356a-6 — current `ThemePalette` exposes no
`positive` / `negative` roles; `flatColor` maps to
`palette.foreground`); band geometry (`bandHeight`, `bandPosition`:
`'top'` / `'bottom'`) and `background` / `foreground` are configurable
hex props with theme-slot fallback.

Unblocks T-356 (Bloomberg market chyron) and the broader Cluster A/B/E
ticker preset shape (CNN / Fox breaking-news lower-band, ESPN
BottomLine sports score crawl, crypto / multi-asset dashboards).
Cluster-specific palettes + entry payloads live in `parity-cli`
resolver shims, not in this primitive.

`ALL_BRIDGE_CLIPS` 44 → 45; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
