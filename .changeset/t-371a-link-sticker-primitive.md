---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-371a — `link-sticker` runtime-clip primitive.

Single-register Cluster G primitive serving the Instagram-style link-
sticker canon (`instagram-link-sticker.md`, `clipKind: socialMedia`):
a rounded-pill (~200 × 44 px native) free-form-positioned link
sticker on a Story frame with a closed-form linear shimmer / high-
light sweep across the label glyphs (3 s default cycle). Single Zod
`object().strict()` schema (NO `discriminatedUnion` — variant-
specific fields are minimal) with sealed `variant` enum (4 values:
`'white-on-dark' | 'dark-on-white' | 'frosted-glass' | 'brand-
color'`) and sealed `phase` enum (2 values: `'idle' | 'shimmering'`,
default `'shimmering'`). Required props: `label` (1–80 chars),
`variant`, `position: { x, y }` (free-form, no anchor canon).
Optional: `phase`, `width` (80–600, default 200), `height` (28–96,
default 44), `fontSize` (10–24, default 14), `brandColor`, `shimmer:
{ cycleFrames, bandWidth, highlightColor }` (defaults `ceil(fps * 3)`
/ 40 / per-variant), per-slot color overrides (`background` /
`textColor` / `shadowColor`). Closed-form shimmer math: `shimmerX(f)
= round(((f % cycleFrames) / cycleFrames) * (pillWidth + bandWidth)
- bandWidth)`. Per-variant token table: `'white-on-dark'`
(black/white/black), `'dark-on-white'` (white/black/grey), `'frosted-
glass'` (opaque `#CCCCCC` fallback — `backdrop-filter: blur` is not
deterministic across CDP versions, deferred to T-371a-blur),
`'brand-color'` (`brandColor` prop or default `#E1306C` Instagram
pink / white / black). Resolution: consumer prop > brand-color
override (when `variant === 'brand-color'` AND `brandColor` set AND
`background` unset) > variant default. Frame-deterministic — no
`Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` /
`setInterval` / `requestAnimationFrame` / `fetch` /
`addEventListener`. NO SVG instance-IDs in v1 (plain `<div>`
rendering). Inter Medium (OFL, T-307) registered as the hard
fallback font; the Instagram proprietary system font is `platform-
byo` (consumer-wired via `runtime.fonts`). Theme-slot fallback
(`background` → `palette.background`, `textColor` →
`palette.foreground`, `shadowColor` → `palette.foreground`). Bridge
clip count 55 → 56. v1 carve-outs: tap-depress to 95 % scale +
link-preview card from bottom (T-371a-followup; reference frame 90
deferred), `backdrop-filter: blur(...)` for `'frosted-glass'`
(T-371a-blur), additional sticker kinds — mention / poll / GIF /
question / slider / music (T-371a-extend), real Instagram-domain
icon SVG (T-371a-glyph). Unblocks T-371 (`instagram-link-sticker`,
Cluster G's last unsigned preset; primary v1 consumer). With
T-371a merged, all four Cluster G blocking primitives (T-317
`subscribe-button` + T-318 `follow-prompt` + T-319 `qr-code-bounce`
+ T-371a `link-sticker`) are shipped; T-371 ships next as the
consumer preset and Cluster G closes.
