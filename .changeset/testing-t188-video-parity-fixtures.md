---
"@stageflip/testing": patch
---

T-188: six parity fixtures for the StageFlip.Video profile clips.

Adds manifest-only fixtures under `packages/testing/fixtures/` covering
every entry in `VIDEO_CLIP_KINDS` (T-180b), plus an aspect-bounce
spread so the parity harness exercises more than one aspect ratio:

| Fixture | Composition | Category |
|---|---|---|
| `frame-runtime-hook-moment.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-product-reveal.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-lower-third.json` | 1920×1080 30fps | video overlay |
| `frame-runtime-endslate-logo.json` | 1080×1920 30fps (**9:16**) | aspect-bounce |
| `frame-runtime-testimonial-card.json` | 1080×1080 30fps (**1:1**) | aspect-bounce |
| `frame-runtime-beat-synced-text.json` | 1920×1080 30fps | audio-sync (beat-driven) |

Each manifest pins reference frames at interesting points (entrance
peaks, holds, exits, beat markers) and lands the standard
`thresholds: { minPsnr: 32, minSsim: 0.95, maxFailingFrames: 0 }`
expected by the frame-runtime-bridge tier.

The **captions** parity category called out in the plan is already
covered by the existing `frame-runtime-subtitle-overlay.json` fixture
(karaoke word reveal) — T-184's caption pack hydrates the same render
surface, so no duplicate manifest is needed.

Goldens (PNG references) are not shipped in this PR; they're produced
by the CDP renderer at harness time and committed separately as each
fixture's render pipeline solidifies.

Wiring:
- `KNOWN_KINDS` in `packages/testing/src/fixture-manifest.test.ts`
  gains entries for the six video kinds.
- `packages/testing/fixtures/README.md` adds a T-188 table row.

Testing fixtures: 41 → 47. Manifest schema + uniqueness validator
green (39 tests pass across the testing package).
