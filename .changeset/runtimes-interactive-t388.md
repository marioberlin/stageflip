---
"@stageflip/runtimes-interactive": minor
"@stageflip/schema": minor
---

T-388: `VoiceClip` `staticFallback` — waveform poster default. Closes
the `family: 'voice'` pair started by T-387.

`@stageflip/runtimes-interactive`:

- New `defaultVoiceStaticFallback({ width, height, posterText?,
  silhouetteSeed? })` helper at
  `@stageflip/runtimes-interactive/clips/voice` (also re-exported from
  the package root). Returns an `Element[]` of one `ImageElement`
  (SVG-waveform-silhouette `data:image/svg+xml,…` URL) plus an
  optional centred `TextElement` carrying `posterText`. **Byte-for-
  byte deterministic** (D-T388-2 + AC #4): same args → same Element
  tree across calls. No `Math.random`, no `Date.now`.
- Mount-harness static-path extension (D-T388-4): when
  `clip.family === 'voice'` AND `clip.staticFallback.length === 0`,
  the harness substitutes the generator's output. Authored fallbacks
  always win (AC #13).
- New telemetry event `voice-clip.static-fallback.rendered` emitted
  by the harness on every static-path render for `family: 'voice'`.
  Attributes: `family`, `reason` (`'permission-denied' |
  'tenant-denied' | 'pre-prompt-cancelled' | 'authored'`), `width`,
  `height`, `posterTextLength`. **Privacy posture (AC #14)**:
  `posterTextLength` is the integer length, NEVER the body.
- **PRNG primitive extraction (D-T388-3)**: `createSeededPRNG` moved
  from `clips/three-scene/prng.ts` to package-root
  `packages/runtimes/interactive/src/prng.ts`. The third application
  (T-384 three-scene + T-388 default-poster + planned future use)
  earned its place per CLAUDE.md "three similar lines beat a
  premature abstraction". The legacy import path
  `clips/three-scene/prng.js` is preserved as a re-export shim so
  T-384's call sites resolve unchanged (AC #11). Byte-for-byte
  sequences are pinned by the regression fingerprint in the new
  `prng.test.ts` (AC #10).

`@stageflip/schema`:

- `voiceClipPropsSchema` gains an optional `posterText` field
  (D-T388-1). Non-empty when present (AC #2). Existing T-387 fixtures
  without `posterText` continue to validate (AC #3). Browser-safe —
  pure Zod; no Node imports added.
