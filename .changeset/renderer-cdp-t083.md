---
"@stageflip/renderer-cdp": minor
---

Live-tier CDP adapter + dispatcher (T-083).

Phase 4's first substantive wiring task. Per the resolved escalation
(`docs/escalation-T-083.md`):

- **B1 accepted** — two-pass bake orchestration moved out of T-083 and
  into T-089 [rev]. No bake code here.
- **B2 accepted** — "one mapping per runtime kind" replaced with
  "single live-tier adapter backed by the shared registry". All 6
  registered live runtimes (css, gsap, lottie, shader, three,
  frame-runtime-bridge) share one code path through this adapter; no
  per-kind branching.
- **B3 option (a) accepted** — reimplemented `quantizeTimeToFrame` and
  `MEDIA_VISUAL_STYLE_PROPERTIES` in
  `src/vendor-core-helpers.ts`. Patched three vendored engine files
  (`vendor/engine/src/index.ts`, `services/frameCapture.ts`,
  `services/screenshotService.ts`) with "Modified by StageFlip,
  2026-04-21" headers so the engine's `@hyperframes/core` imports now
  resolve to our reimpl. First real exercise of the T-081
  modification protocol; modification entry appended to
  `vendor/NOTICE`.

New modules (all under `packages/renderer-cdp/src/`):

- `vendor-core-helpers.ts` — the two reimplemented symbols.
- `dispatch.ts` — `dispatchClips(document) → DispatchPlan`. Walks the
  RIR document (recursing into groups), resolves each clip-content
  element via `findClip(kind)`, returns resolved + unresolved lists.
  Unresolved reasons: `'unknown-kind'` and `'runtime-mismatch'`.
- `adapter.ts` — `LiveTierAdapter` + `CdpSession` integration seam +
  `DispatchUnresolvedError`. `mount(document)` produces a dispatch
  plan then calls `session.mount`; `renderFrame(mounted, frame)` runs
  `session.seek` + `session.capture`; `close` delegates. Fail-loud on
  unresolved clips (never silently renders a degraded document).

`CdpSession` is the integration seam — tests inject a fake session;
the real Puppeteer-backed implementation lands in T-084+, using the
now-patched vendored engine.

Package deps added: `@stageflip/rir`, `@stageflip/runtimes-contract`.

Test surface: 36 cases across 4 files (12 integrity + 10 helpers +
8 dispatch + 6 adapter).
