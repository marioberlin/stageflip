# @stageflip/runtimes-lottie

## 0.1.0

### Minor Changes

- d1dffaf: T-131d.3 — `lottie-player` clip, prop-driven Lottie playback.

  - Accepts `animationData` (object or JSON string) as a render-time
    prop, not at define time. Reuses `LottieClipHost` so the
    determinism posture (`autoplay:false` + `goToAndStop(ms, false)`)
    is identical to `lottie-logo`.
  - URL fetching is deliberately not supported inside the clip — the
    reference clip's `fetch()` path violates our determinism scope for
    `packages/runtimes/**/src/clips/**`. Deck authors resolve URLs
    outside the clip and hand the decoded JSON in.
  - Falls back to an animated placeholder (three concentric pulsing
    rings) when no data is provided. Ring scale/opacity are pure
    functions of the clip-local frame — no wall-clock APIs.
  - `themeSlots`: `backgroundColor` → `palette.background`.
  - Hand-rolled `ClipDefinition` rather than extending `defineLottieClip`
    (which bakes `animationData` at define time).
  - `LottieClipHost` now exported for advanced consumers.
  - Adds `zod@3.25.76` as a runtime dependency (for `propsSchema`).

  Registered in `cdp-host-bundle`; clip-count test + `KNOWN_KINDS` +
  parity fixture all updated.

  Closes T-131d.3.

- 141dc86: Initial lottie runtime (T-064). Second non-React animation library
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

### Patch Changes

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
