---
"@stageflip/runtimes-frame-runtime-bridge": minor
---

T-183a: first three StageFlip.Video profile clips (overlay tranche).

Registers the static-card-ish half of the `VIDEO_CLIP_KINDS` catalog
introduced in T-180b. All three clips are deterministic — motion is
derived from `useCurrentFrame` + `useVideoConfig` via `interpolate` —
so the determinism gate stays clean.

- **`lowerThirdClip`** (`kind: 'lower-third'`) — speaker chyron that
  slides in from the left, holds, slides out to the right. Accent bar
  + name + optional subtitle line. Theme-slotted on
  primary/background/foreground.
- **`endslateLogoClip`** (`kind: 'endslate-logo'`) — closing brand
  card: centered wordmark + optional tagline with fade + scale
  entrance and fade exit. Theme-slotted on
  primary/background/foreground.
- **`testimonialCardClip`** (`kind: 'testimonial-card'`) — quote card
  with attribution name + role; subtle translate-up entrance + fade
  out. Theme-slotted on surface/accent/foreground.

Added to `ALL_BRIDGE_CLIPS` so the cdp-host-bundle picks them up for
export/parity. Tests: +23 (7 lower-third + 8 endslate-logo + 8
testimonial-card). Bridge total: 419/419 green.

Follow-up: T-183b ships the motion-heavier trio — `hook-moment`,
`product-reveal`, `beat-synced-text`.
