---
"@stageflip/runtimes-frame-runtime-bridge": minor
"@stageflip/cdp-host-bundle": minor
---

T-202b: StageFlip.Display profile clips — data tranche.

Closes out the five `DISPLAY_CLIP_KINDS` declared in T-200 with the two
data-driven clips (T-202a shipped the three attention-tranche clips):

- `price-reveal` — "before / after" price animation. Old price holds at
  full opacity for the first ~40% of the clip, then fades to 35%; new
  price slides up with a scale pop at the midpoint. Required `oldPrice`
  + `newPrice` strings; optional `oldLabel` / `newLabel` (default
  "Was" / "Now"; pass `''` to hide). Theme-slotted (accent for new price,
  foreground for labels, background for the card).
- `product-carousel` — rotates 2–5 items with a deterministic
  `(hold + crossfade) * items.length` loop. Schema-capped `holdSeconds ∈
  (0, 10]` and `crossfadeSeconds ∈ (0, 2]`. `carouselSlotsAtFrame(...)`
  is exported for tests (and for clips that want to key other animations
  off the same loop). Opacities always sum to 1, so both slots render as
  two absolutely-positioned layers with no z-fighting.

Both are deterministic (no `Date.now` / `Math.random` / timers). Bridge
clip count 40 → 42; cdp-host-bundle runtime test bumped. 32 new tests,
100% line + branch + function coverage on each.
