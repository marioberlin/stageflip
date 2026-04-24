---
"@stageflip/export-html5-zip": minor
---

T-204: Fallback generator — static PNG + animated GIF from midpoint
frames. Implements the `FallbackProvider` contract from T-203a.

- **`FrameRenderer`** contract (pluggable): `renderFrame(size,
  frameIndex) → RgbaFrame`. Implementations can drive renderer-cdp,
  the frame-runtime preview, or any other path that produces RGBA.
  T-204 ships a mock `createSolidColorFrameRenderer()` for tests; a
  renderer-cdp adapter follows in a later task.
- **`encodePng(frame)`** — pngjs (MIT) sync writer. Deterministic.
- **`encodeGif(frames, opts)`** — gifenc (MIT) quantise + encode.
  Per-frame delay + palette size configurable. Deterministic for
  identical inputs. Rejects heterogeneous frame dimensions.
- **`createFallbackGenerator({ frameRenderer, resolver, durationMs,
  options? })`** — returns a `FallbackProvider` that renders the
  midpoint PNG + an N-frame GIF (default 8 frames evenly spaced
  across [0.125, 0.875] of the composition), writes both bytes into
  the supplied `InMemoryAssetResolver`, and returns a `BannerFallback`
  with deterministic refs (`asset:fallback-png-<id>` /
  `asset:fallback-gif-<id>`).
- **Midpoint math**: `midpointFrameIndex(durationMs, fps)` = `floor(
  (durationMs × fps / 1000) / 2)`. Defaults to 30 fps (the RIR
  implicit display-mode framerate).
- Skip GIF via `options.gifFrameCount = 0` — static-PNG-only fallback.
- Rejects renderer outputs that don't match the requested size.

New runtime deps: **pngjs 7.0.0 (MIT)**, **gifenc 1.0.3 (MIT)** —
both already on the license whitelist. Local `.d.ts` declared for
gifenc (upstream ships no @types).

31 new tests (4 midpoint + 5 gif-index + 6 end-to-end + 3 PNG + 6
GIF). 0.8 KB of d.ts vendored for gifenc. `check-licenses` 495 → 496
deps (new transitive: pngjs's tree; gifenc has zero deps).
