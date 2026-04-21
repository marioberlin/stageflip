---
title: Clips — Authoring Guide
id: skills/stageflip/clips/authoring
tier: clip
status: substantive
last_updated: 2026-04-21
owner_task: T-069
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/runtimes/gsap/SKILL.md
  - skills/stageflip/runtimes/lottie/SKILL.md
  - skills/stageflip/runtimes/shader/SKILL.md
  - skills/stageflip/runtimes/three/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Clips — Authoring Guide

How to add a new clip to StageFlip. This is the cross-runtime
playbook — pick your runtime first (via the runtime-specific SKILLs),
then follow this guide for the parts that stay the same everywhere.

## Quick decision tree

- Static visuals, no time dependence → **css** runtime.
- Animated via React + `useCurrentFrame()` → **frame-runtime-bridge**.
- Pre-composed by a motion designer → **lottie** runtime.
- Tight orchestration with ease variants / staggers → **gsap** runtime.
- Pixel effects / shader toys → **shader** runtime.
- 3D scenes, meshes, lights → **three** runtime.

When two options apply, pick the simpler one. Upgrade later if
needed.

## Kind naming

- Globally unique across **every** runtime. The T-083 dispatcher
  resolves kind → runtime via `findClip(kind)`; two runtimes
  claiming the same kind is a silent trap (first registered wins).
- Lowercase, kebab-case. Prefixes optional but useful for discovery
  (`motion-text-gsap` reads runtime-at-a-glance; `glitch` is fine
  because it's unambiguous).
- Stable. Changing a kind is a breaking change under the T-054 freeze
  policy — consumers that reference the old kind in RIR documents
  break.

## Props

Every clip is generic in `P`. Keep props:

- **Serialisable**. Props land in the RIR document (Phase 1) and
  round-trip through storage. No functions, no classes, no
  `Map` / `Set` / `Date` instances — plain objects, primitives,
  arrays.
- **Typed**. Declare an explicit interface for `P` even if it's
  `{}`. TypeScript catches prop drift; untyped clips regress
  silently.
- **Optional-friendly**. Give every non-essential prop a sensible
  default. Authors renaming a prop to optional don't break existing
  RIR documents; renaming optional to required does.

```ts
export interface MyClipProps {
  title: string;
  accent?: string;        // CSS color; default '#00d4ff'
  durationSec?: number;   // entrance duration; default 0.6
}
```

Props become runtime-validated in Phase 7 via a Zod schema attached
to each clip (wired up in T-169 auto-gen); for now keep props shapes
simple so the future schema is mechanical.

## The five runtime-specific author surfaces

Each runtime has its own `defineXClip` entry point with a purpose-
built shape:

| Runtime | Author signature |
|---|---|
| css | `{ kind, render: (props) => ReactElement, fontRequirements? }` |
| frame-runtime-bridge | `{ kind, component: ComponentType<P>, fontRequirements? }` |
| gsap | `{ kind, render: (props) => ReactElement, build: (props, timeline, container) => void, fontRequirements? }` |
| lottie | `{ kind, animationData, fontRequirements?, lottieFactory? }` |
| shader | `{ kind, fragmentShader, uniforms?, fontRequirements?, glContextFactory? }` |
| three | `{ kind, setup: ({ container, width, height, props }) => ThreeClipHandle, fontRequirements? }` |

All six return a `ClipDefinition<unknown>`; the P generic is erased
at the adapter boundary (see each runtime's SKILL for the rationale
— React covariance + variance on `GetDerivedStateFromProps`).

## Window gating is automatic

You never write `if (frame < clipFrom) return null` inside a clip.
Every `defineXClip` adapter handles the window gate internally:
outside `[clipFrom, clipFrom + duration)` the render returns `null`
and the T-083 dispatcher treats that as "clip not mounted this
frame."

Authors only think in **clip-local time**:

- `useCurrentFrame()` in a frame-runtime-bridge clip returns
  `parentFrame - clipFrom` — zero at the start of your clip.
- The gsap timeline is seeked to `localFrame / fps`.
- The lottie animation is seeked to `(localFrame / fps) * 1000` ms.
- The shader receives `u_progress = localFrame / clipDurationInFrames`.
- The three render callback receives
  `{ progress, timeSec, frame, fps, props }`.

## Determinism

Invariant **I-2**: same frame, same props → same pixels.

Inside `packages/runtimes/*/src/clips/**` the
`pnpm check-determinism` gate rejects:

- `Date.now()`, `new Date()` (no-arg), `performance.now()`
- `Math.random()`
- `fetch()`, `XMLHttpRequest`, `navigator.sendBeacon`
- `setTimeout` / `setInterval`
- `requestAnimationFrame` / `cancelAnimationFrame`
- `new Worker()` / `SharedWorker`

Practical consequences:

- "Random" needs to be deterministic. Hash a coordinate against a
  time axis: `fract(sin(v_uv.y * 120 + floor(progress * 60)) * 43758.5453)`
  in a shader; `mulberry32(seed)` in JS clips.
- "Staggered" timing comes from the frame, not a wall-clock delay.
  In the gsap runtime use `.from(targets, { duration, stagger: 0.1 })`;
  GSAP computes stagger offsets relative to the timeline.
- Frame-scheduled side effects (DOM mutations, audio cues) are
  NOT clip concerns — T-152 Executor handles those via a runtime
  event bus (Phase 7).

Escape hatch: `// determinism-safe: <reason>` on the exact line.
Reserve for cases where an API is deterministic despite the
scanner's suspicion (e.g., reading a pre-computed hash). Link an
ADR in the comment if you invoke it.

## Font requirements

Clips that render text declare fonts via `fontRequirements`:

```ts
defineGsapClip<{ text: string }>({
  kind: 'my-text',
  render: ({ text }) => <span data-tween-me>{text}</span>,
  build: () => { /* ... */ },
  fontRequirements: () => [
    { family: 'Inter', weight: 700 },
  ],
});
```

The T-072 FontManager (Phase 3) walks every registered clip's
`fontRequirements` and blocks render on `document.fonts.ready`
AND an explicit `FontFace.load()` per declared family. Export-path
CDP adds base64 `@fontsource` embedding per family.

If your clip doesn't render text, omit `fontRequirements` entirely —
the field is optional. Lottie clips with embedded text are a known
gap; per-instance font discovery is a future task.

## Testing a new clip

Pattern shared across runtimes:

1. **Unit test the clip's render in isolation.** Call
   `clip.render(ctx)` with synthetic contexts; assert on the
   returned `ReactElement` via `@testing-library/react`.
2. **Use `afterEach(cleanup)` explicitly** — vitest base config has
   `globals: false`, so auto-cleanup isn't wired. This was the
   top source of test interference during Phase 2.
3. **Stub the runtime's external dependency** where needed:
   - Lottie: `vi.mock('lottie-web', () => ({ default: {} }))` at
     module boundary; tests inject `lottieFactory` per call.
   - Shader: inject `glContextFactory` returning a stub WebGL
     context that records calls.
   - Three: pass a `setup` that returns a plain
     `ThreeClipHandle<P>` with spy callbacks — no THREE import in
     tests.
4. **Window-gating tests are canonical** — every adapter test
   suite asserts `null` before, `null` at exclusive end, renders
   at inclusive start. Mirror the pattern; it catches window-math
   regressions early.

## Parity fixture

Every demo clip ships a JSON fixture under
`packages/testing/fixtures/<runtime>-<kind>.json`. The validator in
`packages/testing/src/fixture-manifest.test.ts` enforces:

- Runtime + kind match the hand-maintained `KNOWN_KINDS` allowlist.
- `referenceFrames` length ≥ 3 (conventionally t=0, mid, end).
- Clip window fits inside the composition duration.
- Every reference frame sits inside the clip window.

When you add a new demo clip:

1. Drop a `<runtime>-<kind>.json` next to the sibling fixtures.
2. Add `['<kind>', '<runtime>']` to `KNOWN_KINDS`.
3. `pnpm test` — fixture validator enforces the catalogue.

The T-100 parity harness (Phase 5) will render each fixture's
reference frames via a headless browser and score PSNR + SSIM
against goldens. T-067 is the input seed; PNG artifacts arrive
with T-100.

## Checklist before you open a PR

- [ ] Kind is globally unique. Grep: `grep -r "kind: '<your-kind>'"
      packages/runtimes/`.
- [ ] Props interface is exported from the clip's module.
- [ ] Clip file is under `packages/runtimes/<runtime>/src/clips/**` so
      the determinism scanner sees it.
- [ ] Unit tests cover window-gating + props passthrough + at least
      one lifecycle assertion.
- [ ] `pnpm exec biome check --write` run at the package root.
- [ ] `pnpm typecheck && pnpm test && pnpm check-determinism` all
      PASS on the affected package.
- [ ] Parity fixture manifest landed in `packages/testing/fixtures/`
      and `KNOWN_KINDS` updated.
- [ ] `fontRequirements` declared if the clip renders text.
- [ ] Changeset added at `.changeset/` if you touched a publishable
      package (currently: every package outside `packages/testing`).

## Related

- Contract + registry: `runtimes/contract/SKILL.md`
- Determinism rules + escape hatch: `concepts/determinism/SKILL.md`
- Per-runtime authoring specifics:
  `runtimes/{css,frame-runtime,frame-runtime-bridge,gsap,lottie,shader,three}/SKILL.md`
- Catalog of shipped clips (auto-gen, T-220): `clips/catalog/SKILL.md`
- Owning tasks: T-069 (this doc), T-072 (FontManager), T-083 (CDP
  dispatcher consumer), T-220 (auto-gen catalog).
