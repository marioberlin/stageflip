# @stageflip/runtimes-gsap

## 0.1.0

### Minor Changes

- 0b8c1c6: Initial gsap runtime (T-063). First runtime that wraps a non-React
  animation library.

  Exports:
  - `defineGsapClip<P>({ kind, render, build, fontRequirements? })` —
    adapts a GSAP-driven clip. `render(props)` returns the DOM; the
    host mounts it inside a container div. `build(props, timeline,
container)` runs once on mount with a **paused** `gsap.core.Timeline`;
    clip authors configure tweens there. The host seeks the timeline
    to `localFrame / fps` on every render — never calls `play()`, so
    the GSAP ticker never advances our animations.
  - `createGsapRuntime(clips?)` — builds the `ClipRuntime` (`id: 'gsap'`,
    `tier: 'live'`). Duplicate kinds throw.
  - `motionTextGsap` — canonical demo clip (kind `motion-text-gsap`).
    Slide-up (default) or fade entrance configurable via props; used as
    the T-067 parity fixture seed.

  Determinism: clip code under `src/clips/**` is scanned by
  `check-determinism`; GSAP is consumed exclusively via seek on a
  paused timeline, matching the deterministic-export posture required
  by Invariant I-2.

  License: GSAP ships a URL-form license; an entry in
  `REVIEWED_OK` (scripts/check-licenses.ts) pairs with the existing
  Business Green procurement. See `docs/dependencies.md` §4 Audit 5
  addendum for the follow-up flagged for Phase 10 publish gating.

### Patch Changes

- 583a58f: T-359c: fix tsx ↔ gsap ESM/CJS interop in `host.tsx`.

  Switched `import { gsap } from 'gsap'` → `import gsap from 'gsap'` in
  `packages/runtimes/gsap/src/host.tsx`. The named-import form loaded
  under plain Node but crashed under tsx 4.21.0's esbuild loader (which
  strips gsap's named re-exports — only `default` survives). gsap's
  `default` IS the gsap namespace itself (gsap publishes
  `export { gsap as default } from "gsap/gsap-core"`), so the simple
  default-alias is the correct portable form.

  Unblocks the prod-bound parity generator
  (`scripts/generate-preset-parity-fixture-prod.ts`) which transitively
  imports this runtime via `@stageflip/cdp-host-bundle`. Closes the
  T-359b parity sign-off blocker. Behavior unchanged at runtime — only
  the import form moves.

- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [36d0c5d]
  - @stageflip/runtimes-contract@0.1.0
