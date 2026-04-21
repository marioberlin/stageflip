---
"@stageflip/testing": minor
---

Parity fixture manifests (T-067). Seeds the Phase 5 parity harness
with one JSON manifest per demo clip shipped by the Phase 3 runtimes.

Exports:

- `fixtureManifestSchema` — Zod schema for a fixture manifest.
- `parseFixtureManifest(raw)` — parse + validate a raw object.
- `FixtureManifest` — inferred type.

Ships seven manifests under `packages/testing/fixtures/`, one per
demo clip (css, gsap, lottie, shader×3, three). Each manifest
carries:

- `runtime` + `kind` — clip dispatch identity.
- `composition` — width / height / fps / durationInFrames.
- `clip` — `from`, `durationInFrames`, `props`.
- `referenceFrames` — at minimum `[t=0, mid, end]`.

No binary reference frames yet — producing those requires the CDP
renderer (Phase 4) and parity harness (T-100). T-067 is the input
seed; T-100 scores PSNR+SSIM against goldens; T-102 may extend or
supersede this schema.
