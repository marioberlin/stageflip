---
title: Determinism
id: skills/stageflip/concepts/determinism
tier: concept
status: substantive
last_updated: 2026-04-21
owner_task: T-027
related:
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/reference/export-formats/SKILL.md
---

# Determinism

**Invariant I-2.** Rendering is byte-identical across runs. Same RIR + same
runtime + same frame = same pixels. Parity depends on this; imports depend on
this; exports depend on this.

## Forbidden APIs in clip/runtime code

Inside `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, and
`packages/renderer-core/src/clips/**`:

- `Date.now()`, `new Date()` (no-arg), `Date()`
- `performance.now()`
- `Math.random()`
- `fetch()`, `XMLHttpRequest`, `navigator.sendBeacon`
- `setTimeout`, `setInterval`
- `requestAnimationFrame`, `cancelAnimationFrame` (the shim overrides these)
- `new Worker()`, `SharedWorker`

CI gate: `pnpm check-determinism` (ESLint plugin, scoped to the paths above).

## How rendering advances

Every clip/runtime receives **frame** (integer) from the `FrameContext`. The
same `frame` always produces the same output. Wall clock is invisible.

```ts
// OK
export function Fade({ opacity }: { opacity: number }) {
  const f = useCurrentFrame();
  return <div style={{ opacity: opacity * (f / 60) }} />;
}

// Forbidden — Math.random in clip code
export function Noise() {
  return <div style={{ opacity: Math.random() }} />; // CI fails
}
```

## The determinism shim

At runtime the shim (T-027) intercepts `requestAnimationFrame`, `setTimeout`,
`setInterval`, and `Date.now`. In dev it `console.warn`s when intercepting a
call that passed source-lint (indicates a gap in the gate). In prod it emits
a telemetry event.

## Escape hatch — `// determinism-safe: <reason>`

Rare cases (e.g. reading a deterministic crypto hash to seed a shuffle) can
opt out on an exact line:

```ts
// determinism-safe: crypto.subtle.digest is pure; inputs are RIR content only
const hash = await crypto.subtle.digest('SHA-256', bytes);
```

Every escape hatch should link to an ADR explaining why.

## Why this matters

- Parity fixtures (T-100) compare PSNR+SSIM against goldens. Non-determinism
  = flakiness = broken CI.
- Imports must be deterministic: same PPTX → same canonical doc.
- Export → web preview → export again must produce the same bytes.

## Implementation

- **Runtime shim**: `@stageflip/determinism` (T-027). `installShim(opts)` returns
  an uninstall function. Intercepts 9 APIs with a seeded mulberry32 PRNG for
  `Math.random`; uninstall restores originals. See
  `packages/determinism/src/shim.ts`.
- **Source-lint gate**: `scripts/check-determinism.ts` (T-028). Uses the
  TypeScript compiler API (ADR-002 §D5 revision — not ESLint) to walk
  `packages/frame-runtime/src/**`, `packages/runtimes/*/src/clips/**`, and
  `packages/renderer-core/src/clips/**`. 8 rule categories; `// determinism-safe`
  escape-hatch honored.
- **CI wiring**: `pnpm check-determinism` in `.github/workflows/ci.yml`.

## Related

- Shim impl: T-027
- Source-lint gate: T-028
- Parity harness: T-100 (Phase 5)
- ADR-002 §D5: tool choice rationale for the source-lint
