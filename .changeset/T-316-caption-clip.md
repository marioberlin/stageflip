---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-316 — `caption` runtime-clip primitive.

Word-level timed text with six built-in visual styles (`hormozi`,
`mrbeast`, `tiktok`, `ali-abdaal`, `netflix`, `karaoke-wipe`). Frame-
deterministic word visibility (`(currentTimeMs ∈ [word.startMs,
word.endMs))`); per-word entrance stagger anchored on each word's
`startMs` minus `i * staggerMs` (`none` / `bounce` / `rise` /
`slide-from-top` / `slide-from-bottom`, 12-frame settle); SVG `<text>`
with `stroke` + `paint-order: stroke fill` when `strokeWidth > 0`
(Hormozi 6 px black, MrBeast 5 px); per-word `<rect>` pill backdrops
(TikTok rounded box) or single bounding-box rect (Netflix letterbox);
`karaoke-wipe` style fills each word left-to-right via SVG `<clipPath>`
driven by within-word ms-progress; casing transforms (`as-is` /
`uppercase` / `lowercase` / `title-case`); MrBeast cycling highlight
via `highlightColor: string[]` (i-th highlighted word picks
`colors[i % len]`); theme-slot fallback (`background` →
`palette.background`, `foreground` → `palette.foreground`,
`highlightColor` → `palette.accent`, `muteColor` → `palette.foreground`,
`strokeColor` → `palette.background`).

Unblocks Cluster F captions (T-362 hormozi-montserrat-black, T-363
mrbeast-komika-axis, T-364 tiktok-rounded-box, T-365
ali-abdaal-opacity-karaoke, T-366 netflix-invisible, T-367
karaoke-progressive-wipe) plus Cluster A breaking-news word reveals,
Cluster B sports score callouts, and Cluster G CTA word emphasis.
Cluster-specific palettes + canned `words[]` live in `parity-cli`
resolver shims, not in this primitive.

`ALL_BRIDGE_CLIPS` 46 → 47; `cdp-host-bundle` clip-count test and
`@stageflip/skills-sync` `LIVE_RUNTIME_MANIFEST` updated alongside.
