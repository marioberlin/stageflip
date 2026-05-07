---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-317 — `subscribe-button` runtime-clip primitive.

Sealed-platform creator subscribe / follow CTA button serving Cluster G
presets via Zod discriminated union on `platform`: `'youtube'` (rounded
YouTube Red `#FF0000` pill with force-uppercase label, Roboto Medium
500, drop shadow, post-press gray, optional bell glyph), `'tiktok'`
(TikTok Pink `#FE2C55` rounded pill with optional `'+'` plus glyph,
outline post-press), `'instagram'` (rounded rectangle with the canonical
`linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)`
backdrop, optional `gradient?` override, outlined post-press),
`'generic'` (brand-neutral pill with theme-slot palette fallback,
`postPressLabel?`). Three sealed animation phases (`'idle'` entrance
bounce overshoot 0 → 1.10 → 1.00; `'pressing'` 1.00 → 0.95 → 1.00 dip;
`'subscribed'` static post-press settled state). Optional `showCursor`
static cursor glyph at the button's right edge in `'pressing'` phase
(animated slide-in deferred to T-317b; bell wiggle deferred to T-317a).
Brand canon dominates theme on branded platforms; theme-slot fallback
only for `'generic'`. YouTube force-uppercases the label regardless of
the `casing` prop per D-T317-8. Frame-deterministic — no `Date.now` /
`Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
`requestAnimationFrame`. `fontRequirements` registers Roboto 500 +
TikTok Sans 700 + Plus Jakarta Sans 700. Theme-slot fallback
(`background` → `palette.background`, `foreground` →
`palette.foreground`, `accent` → `palette.accent`). Bridge clip count
52 → 53. Unblocks T-369 (`youtube-subscribe-bounce`, first Cluster G
preset) and the broader Cluster G platform-button register.
