---
title: Runtime Contract
id: skills/stageflip/runtimes/contract
tier: runtime
status: substantive
last_updated: 2026-04-21
owner_task: T-060
related:
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
---

# Runtime Contract

`@stageflip/runtimes-contract` is the shared interface every runtime plugin
implements. It exists so clip-dispatch logic (renderer-core, Phase 4) can
stay decoupled from individual runtime implementations (css, gsap, lottie,
shader, three, blender, frame-runtime-bridge).

Zero concrete runtime code lives here — only types + the registry.

## Core types

```ts
export type RuntimeTier = 'live' | 'bake';

export interface ClipRuntime {
  readonly id: string;                               // 'css', 'gsap', 'frame-runtime', ...
  readonly tier: RuntimeTier;
  readonly clips: ReadonlyMap<string, ClipDefinition<unknown>>;
  prepare?(ctx: RuntimePrepareContext): Promise<void>;
  dispose?(): void;
}

export interface ClipDefinition<P = unknown> {
  readonly kind: string;                             // globally unique, e.g. 'motion-text-gsap'
  render(ctx: ClipRenderContext<P>): ReactElement | null;
  fontRequirements?(props: P): FontRequirement[];
}

export interface ClipRenderContext<P = unknown> {
  frame: number;
  fps: number;
  width: number;
  height: number;
  clipFrom: number;
  clipDurationInFrames: number;                      // may be Infinity
  props: P;
}

export interface FontRequirement {
  family: string;
  weight?: number | string;
  style?: 'normal' | 'italic' | 'oblique';
}
```

## Tiers

- **`live`** — runs every render tick. CSS, GSAP (timeline seek), Lottie
  (seek-by-frame), shaders (uniform update), three (scene render), the
  frame-runtime-bridge. Same render path in editor preview and CDP export,
  scrubbed against the FrameClock.
- **`bake`** — produces image or video assets offline. Blender is the
  canonical example; heavy three compositions can opt in. The export
  dispatcher swaps in the baked frames; live tier renders the placeholder
  during editing.

## Registry

```ts
registerRuntime(runtime)      // validates, throws on duplicate id or tier
getRuntime(id)                 // undefined if missing
listRuntimes()                 // snapshot, not a live view
unregisterRuntime(id)          // no-op if missing
findClip(kind)                 // cross-runtime lookup by clip kind
__clearRuntimeRegistry()       // test-only reset
```

### Validation

`registerRuntime` rejects:
- empty / non-string id
- tier other than `'live'` or `'bake'`
- duplicate id (previously registered)
- any clip map entry where the key doesn't equal the definition's `kind`

### Clip-kind uniqueness

The RIR compiler emits clip instances referencing a `kind`. The dispatcher
(T-083) resolves kind → runtime via `findClip(kind)`. Kinds are globally
unique — two runtimes claiming the same kind is a mistake. When it happens
anyway, the first registered wins (insertion-order iteration on `Map`).

### Insertion order

Both `listRuntimes()` and `findClip()` iterate runtimes in registration
order. Tests assert this explicitly — a stable tie-break matters when two
runtimes ship overlapping kinds during migration windows.

## How consumers wire up

A typical concrete runtime (Phase 3 tasks T-062..T-066) exports a value
and a register hook:

```ts
// packages/runtimes/gsap/src/index.ts
export const gsapRuntime: ClipRuntime = {
  id: 'gsap',
  tier: 'live',
  clips: new Map([...]),
};

export function register(): void {
  registerRuntime(gsapRuntime);
}
```

Applications (editor, exporter) call `register()` during boot. The
renderer-core dispatcher walks the registry every render; there is no
module-init side effect.

## Relationship to frame-runtime

`frame-runtime` is not itself a ClipRuntime — it's the React frame-driven
layer. T-061 ships `@stageflip/runtimes-frame-runtime-bridge` which wraps
frame-runtime as a `ClipRuntime` so clips written against
`useCurrentFrame()` + `<Sequence>` etc. are addressable uniformly with
CSS / GSAP / Lottie / etc.

## Future extension points

Reserved but intentionally empty in T-060:

- `RuntimePrepareContext` is `{ [key: string]: unknown }` — T-084a (asset
  preflight) will populate it with asset-resolution hooks.
- `FontRequirement` consumed by T-072 (FontManager).
- `propsSchema` NOT in the interface. When Zod schemas are wired through
  the registry for agent tool calls (Phase 7), a `propsSchema?: ZodType<P>`
  field gets added without breaking existing runtimes.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/index.ts` | T-060 | Contract + registry + types |
| `src/index.test.ts` | T-060 | Registry behaviour + validation |

## Related

- Determinism scope (frame-runtime + clip/runtime source trees):
  `concepts/determinism/SKILL.md`
- Frame-runtime surface (consumed via T-061 bridge):
  `runtimes/frame-runtime/SKILL.md`
- Owning tasks: T-060 (this), T-061 (bridge), T-062..T-066 (concrete
  runtimes), T-072 (FontManager), T-083 (CDP dispatcher).
