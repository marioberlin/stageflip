---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-357a — `standings-table` runtime-clip primitive.

Generic vertical ranked table of N (1..16) rows with K (2..8) columns
of mixed kind (`rank` / `label` / `numeric` / `delta` / `total`); per-
column hex `color` tinting (medal-style gold / silver / bronze); delta-
arrow glyphs (↑ / ↓ / ▬) driven by string enum (`'up'` / `'down'` /
`'flat'`) or numeric sign (positive → up, negative → down, zero →
flat); frame-derived per-row entrance stagger (fade + slide, `delay =
i * staggerMs / (1000 / fps)`, 12-frame ramp, `translateY` `-8 → 0`
px). Numeric cells (`rank` / `numeric` / `total`) carry
`font-variant-numeric: tabular-nums` so digit columns align across
rows regardless of the fallback font's proportional digits.
Proportional column flex (default 1; per-column `flex` / fixed
`width` overrides). Theme-slot fallback per D-T357a-6 (both `upColor`
and `downColor` and `goldColor` map to `palette.accent`;
`silverColor` / `bronzeColor` / `flatColor` map to `palette.foreground`;
`background` / `foreground` to their namesakes).

Unblocks T-357 (olympic-medal-tracker, Cluster E) and the broader
Cluster A/B/E ranked-list preset shape (F1 / NBA / NCAA / golf
leaderboards, election results, crypto top-N market-cap dashboards).
Cluster-specific palettes + row payloads live in `parity-cli` resolver
shims, not in this primitive.

`ALL_BRIDGE_CLIPS` 45 → 46; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
