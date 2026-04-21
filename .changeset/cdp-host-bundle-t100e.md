---
"@stageflip/cdp-host-bundle": minor
---

Runtime bundle host — register all 6 live runtimes + bundleDoctor (T-100e).

**Completes the bundle host.** T-100d shipped the scaffold with just
the CSS runtime; T-100e wires in the remaining five — GSAP, Lottie,
Shader, Three, and frame-runtime-bridge — so every live-tier
`clip` in an RIR document can dispatch to its real runtime instead
of the labelled placeholder box T-100d's composition falls back to.

**Runtime registration**:

- CSS — `createCssRuntime([solidBackgroundClip])`
- GSAP — `createGsapRuntime([motionTextGsap])`
- Lottie — `createLottieRuntime([lottieLogo])`
- Shader — `createShaderRuntime([flashThroughWhite, swirlVortex, glitch])`
- Three — `createThreeRuntime([threeProductReveal])`
- frame-runtime-bridge — `createFrameRuntimeBridge([])` (meta-runtime;
  no demo clips, but id `frame-runtime` registers so user-defined
  React clips can bridge in at runtime)

Extracted into `registerAllLiveRuntimes()` in `src/runtimes.ts` so the
browser entry boot and the unit tests share one source of truth for
registration. The `LIVE_RUNTIME_IDS` readonly tuple is the canonical
list — length 6, insertion order matches `Phase 3 handover §4`.

**New export — `bundleDoctor({ warnAtBytes? })`**:

Diagnostic hook: reads the compiled bundle, reports `sizeBytes`,
`warnAtBytes`, `warn` flag, and a human-readable `message`.
Default warning threshold is 1.75 MB raw; current bundle is
~1.59 MB raw, leaving ~160 KB headroom. Intended for the parity
CLI (T-101) and any operator-facing doctor utility — surfaces
bundle bloat without needing a hard CI gate (size-limit covers
that). Returns `exists: false` with an actionable message if the
bundle hasn't been built yet.

**Bundle-size budget**:

`.size-limit.json` entry for `@stageflip/cdp-host-bundle` updated
from 100 KB (T-100d CSS-only) → 500 KB (T-100e all six). Current
actual is 313.82 KB gzipped per `pnpm size-limit`, leaving ~186 KB
headroom. Vite reports 1,589.28 KB raw / 441.40 KB gzipped — the
discrepancy with size-limit is because size-limit uses level-9 gzip
plus tree-shaking while Vite's dev reporter uses a faster but less
aggressive gzip path. Both paths are honest, different
measurement methodologies.

**Test-lane canvas polyfill**:

`lottie-web` calls `canvas.getContext('2d').fillStyle = …` at module
load. happy-dom returns `null` from `getContext('2d')`, crashing the
import. Added `src/test-setup.ts` that overrides
`HTMLCanvasElement.prototype.getContext` to return a Proxy-based
no-op 2D stub when happy-dom returns null. Real Chrome (the actual
bundle consumer) provides a working canvas — the polyfill only
exists for the test lane. Wired via `vitest.config.ts`
`setupFiles`.

**Tests**: 14 → 26 in cdp-host-bundle. New file
`runtimes.test.ts` (9 cases — 6 runtime-id presence + 4 specific
clip dispatches + 1 re-registration guard). `index.test.ts` grew
+3 for `bundleDoctor` (found + sizeBytes + message; above-threshold
warn; under-threshold pass).

**Scope commitment — NOT in scope**: rewiring the e2e
`reference-render.e2e.test.ts` suite from `canvasPlaceholderHostHtml`
to `createRuntimeBundleHostHtml`. That lets parity fixtures actually
exercise clip rendering end-to-end and belongs with T-102 (formal
fixture format) and T-103 (CI integration); doing it here would
duplicate work the fixture format should own.

**Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
updated — the pluggable-host section's third bullet no longer
says "T-100d registers the CSS runtime only"; all 6 runtimes are
now listed. Module-surface table adds the T-100e exports. The
deferred-work row for the remaining runtimes has been removed.
