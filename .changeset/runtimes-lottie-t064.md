---
"@stageflip/runtimes-lottie": minor
---

Initial lottie runtime (T-064). Second non-React animation library
wrapped; same seek-based determinism posture as the gsap runtime.

Exports:

- `defineLottieClip({ kind, animationData, fontRequirements?, lottieFactory? })` —
  wraps a Lottie JSON payload. The produced render gates on the clip
  window, then mounts a `LottieClipHost` that loads the animation with
  `autoplay: false` and drives it via `goToAndStop(ms, false)` —
  time-based seek, independent of the Lottie JSON's internal `fr`.
  `lottieFactory` is the test seam; real consumers get the pinned
  `lottie-web` import by default. Player resolution is lazy —
  factory isn't invoked until first render.
- `createLottieRuntime(clips?)` — builds the `ClipRuntime`
  (`id: 'lottie'`, `tier: 'live'`). Duplicate kinds throw.
- `lottieLogo` — canonical demo clip (kind `lottie-logo`). A rounded
  pink square rotating 360° over 60 frames; hand-authored Lottie 5.7
  payload to keep the source tree small. Used as the T-067 parity
  fixture seed.

Determinism: clip code under `src/clips/**` is scanned; the demo
clip's data is a plain JSON object literal with no wall-clock APIs.
