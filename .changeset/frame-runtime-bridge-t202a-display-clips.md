---
"@stageflip/runtimes-frame-runtime-bridge": minor
"@stageflip/cdp-host-bundle": minor
---

T-202a: StageFlip.Display profile clips — attention tranche.

Adds the first three of five `DISPLAY_CLIP_KINDS` declared in T-200,
registered in `ALL_BRIDGE_CLIPS` and the cdp-host-bundle runtime suite:

- `click-overlay` — invisible full-canvas anchor that routes through the
  IAB `clickTag` macro (default `%%CLICK_URL_UNESC%%%%DEST_URL%%`); opens
  in `_blank` with `rel="noopener noreferrer"` by default; requires a
  non-empty `ariaLabel` for screen-reader compliance.
- `countdown` — frame-indexed deadline timer counting down from
  `startFromSeconds` via `max(0, start - frame/fps)`; supports `mm:ss`,
  `hh:mm:ss`, and `dd hh:mm:ss` formats; theme-slotted (accent / text /
  background); monospace digits for jitter-free layout.
- `cta-pulse` — call-to-action button pulsing on a deterministic
  `(1 - cos)/2` envelope (`pulseHz` reads as pulses-per-second with rest
  at period boundaries and peak at half-period); theme-slotted (accent +
  text); schema caps `pulseHz ≤ 4` and `peakScale ∈ [1, 1.5]`.

All three are deterministic (no `Date.now()` / `Math.random()` / timers).
Bridge clip count 37 → 40; cdp-host-bundle runtime test bumped. T-202b
lands `price-reveal` + `product-carousel` next.

47 new tests across the three clips, 100% line + branch + function
coverage on each.
