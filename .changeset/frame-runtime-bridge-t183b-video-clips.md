---
"@stageflip/runtimes-frame-runtime-bridge": minor
"@stageflip/cdp-host-bundle": patch
---

T-183b: remaining three StageFlip.Video profile clips (motion tranche).

Closes out the six `VIDEO_CLIP_KINDS` declared in T-180b:

- **`hookMomentClip`** (`kind: 'hook-moment'`) — opening attention-grabber:
  claim text zooms in with a brightness pulse, supporting tagline slides
  up after. Theme slots: `foreground` / `accent` / `background`.
- **`productRevealClip`** (`kind: 'product-reveal'`) — product-hero card:
  image slides up + zooms in; name + price strip in from the right.
  Theme slots: `foreground` / `accent` / `background`.
- **`beatSyncedTextClip`** (`kind: 'beat-synced-text'`) — cycles phrases
  on each beat-frame, pulses a scale bump + glow at each beat; exports
  a `currentBeatIndex` helper for consumers wanting to reason about the
  active beat without mounting. Theme slots: `foreground` / `accent` /
  `background`.

All deterministic (motion derived from `useCurrentFrame`); all registered
in `ALL_BRIDGE_CLIPS`. Tests: +22 across the three clips. Bridge total:
425/425 green. `cdp-host-bundle` clip-count test bumped to reflect the
three new kinds.

Pairs with T-183a (overlay tranche). If both PRs land, expect the
cdp-host-bundle count to settle at 37.
