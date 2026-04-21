---
title: Frame Runtime
id: skills/stageflip/runtimes/frame-runtime
tier: runtime
status: substantive
last_updated: 2026-04-21
owner_task: T-051
related:
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
---

# Frame Runtime

`@stageflip/frame-runtime` is the React-based rendering layer. It replaces
Remotion (invariant I-6: zero `remotion` / `@remotion/*` imports) and gives
every other runtime a deterministic frame-driven foundation.

## Shape of the API

Three groups: **primitives** (pure math), **components** (mount + remap), and
**entry points** (composition registry).

### Primitives

Pure, deterministic, per-frame functions. All scanned by `check-determinism`.

| Export | Purpose |
|---|---|
| `interpolate(input, inputRange, outputRange, opts?)` | Monotonic range → numeric output with easing and extrapolation. |
| `interpolateColors(input, inputRange, outputColors, opts?)` | Range → `#rrggbb` or `rgba()` via `culori`. `colorSpace: 'rgb' \| 'hsl' \| 'oklch'`. |
| `interpolatePath(input, inputRange, outputPaths, opts?)` | Range → SVG path string via `flubber`. `clamp` only; no `extend` / `identity`. **Import path: `'@stageflip/frame-runtime/path'`** (sub-entry) — keeps flubber out of the base bundle. |
| `spring({ frame, fps, mass?, stiffness?, damping?, from?, to?, overshootClamping? })` | Spring physics at a specific frame. Adaptive substepping; validated envelope. |
| `EASINGS`, `NAMED_EASINGS`, per-easing exports (`linear`, `easeIn`, …), `cubicBezier(x1, y1, x2, y2)` | 25 named easings matching `@stageflip/schema` `namedEasingSchema`. |

### Components

Every component calls `useCurrentFrame()` or `useVideoConfig()` internally and
must be rendered inside a `FrameProvider` (or a `<Composition>` mounted via
`renderFrame`).

| Export | Purpose |
|---|---|
| `<FrameProvider frame config>` | Carries the current frame + video config through context. Throws on missing context. |
| `<Sequence from? durationInFrames? name? layout?>` | Mount gate + frame remap. Inner frame = `parentFrame - from`. Window is half-open `[from, from + duration)`. |
| `<Loop durationInFrames times? name? layout?>` | Mount gate + frame wrap. Inner frame = `parentFrame % durationInFrames`. `times` default Infinity. |
| `<Freeze frame active?>` | Remap-only (no DOM wrapper). Inner frame = `props.frame` when `active`. |
| `<Series>` + `<Series.Sequence durationInFrames offset? name? layout?>` | Auto-chained sequences; `from` computed from cumulative duration + offset. |
| Hooks: `useCurrentFrame()`, `useVideoConfig()` | Read the current frame or config. Throw outside a FrameProvider. |
| `useMediaSync(ref, { offsetMs?, durationMs? })` | Drives an `<video>` / `<audio>` `.currentTime` from the FrameClock; pauses when outside the active window. Skips seeks within half a frame of drift. |
| `useAudioVisualizer(ref, options?)` | Returns `{ frequency, waveform, volume }` from a Web Audio `AnalyserNode`. Editor / preview only — not determinism-clean. |

Shared layout types:
- `'absolute-fill'` (default on Sequence / Loop / Series.Sequence) → wraps in a
  positioned div with `top/left/right/bottom: 0` and `data-stageflip-*={name}`.
- `'none'` → renders children directly. Freeze is always layout-less.

### Entry points (registry)

| Export | Purpose |
|---|---|
| `registerComposition(def)` | Imperative registration. Duplicate `id` throws. |
| `<Composition id component width height fps durationInFrames defaultProps?>` | Declarative registration during render. Renders `null`. |
| `renderFrame(id, frame, props?)` | Looks up the registered def, validates `frame ∈ [0, durationInFrames)`, merges props, returns a `<FrameProvider>` wrapping the component. |
| `getComposition(id)`, `listCompositions()`, `unregisterComposition(id)` | Registry accessors. |
| `__clearCompositionRegistry()` | Test-only reset. Double-underscore prefix = not application surface. |

## Minimal example

```tsx
import {
  Composition,
  interpolate,
  interpolateColors,
  Sequence,
  useCurrentFrame,
} from '@stageflip/frame-runtime';

function Title() {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const color = interpolateColors(f, [0, 60], ['#ff0080', '#00d4ff']);
  return <h1 style={{ opacity, color }}>Hello</h1>;
}

function Scene() {
  return (
    <Sequence from={0} durationInFrames={90}>
      <Title />
    </Sequence>
  );
}

// Declarative registration (JSX form):
<Composition
  id="intro"
  component={Scene}
  width={1920}
  height={1080}
  fps={30}
  durationInFrames={90}
/>;

// Then render any frame:
import { renderFrame } from '@stageflip/frame-runtime';
const element = renderFrame('intro', 45);
```

## Invariants

- **I-2 Determinism**: every file in `packages/frame-runtime/src/**` is scanned
  by `pnpm check-determinism`. Forbidden APIs: `Date.now`, `Math.random`,
  `performance.now`, `fetch`, `setTimeout`, `requestAnimationFrame`, Workers.
  See `concepts/determinism/SKILL.md` for the full list and escape hatch.
- **I-6 No Remotion**: `pnpm check-remotion-imports` fails on any import from
  `remotion` or `@remotion/*`. Implementation is clean-sheet from public
  Remotion docs (CLAUDE.md §7).
- **I-14 Bundle budget**: enforced by `pnpm size-limit` (T-049). Two
  separately budgeted entry points:
  - `@stageflip/frame-runtime` main: ≤ **10 KB gz** (measures
    ~5.3 KB). `react`, `react-dom`, `culori` ignored.
  - `@stageflip/frame-runtime/path` sub-entry: ≤ **25 KB gz**
    (measures ~19.5 KB). `react`, `react-dom` ignored; flubber
    counted here. Consumers who don't morph paths never import
    this chunk.

## Extrapolation modes

Summary of which modes are valid for which primitive:

| Primitive | `clamp` | `extend` | `identity` |
|---|---|---|---|
| `interpolate` | ✓ | ✓ (default) | ✓ (returns input as-is) |
| `interpolateColors` | ✓ | ✓ (default) | ✗ (input is number, output is string) |
| `interpolatePath` | ✓ (default) | ✗ | ✗ |

Any unsupported combination throws a descriptive error at call time.

## Output formats

- `interpolate` → `number`
- `interpolateColors` → `#rrggbb` when alpha ≥ 1, else `rgba(R, G, B, A)` with
  integer channels and 3-decimal alpha. The formatter is owned by this package
  (not culori) so snapshot tests are stable across culori minor versions.
- `interpolatePath` → SVG path string. At `t=0` flubber's fast path may
  return the input string untouched; at intermediate `t` the path is
  resampled and normalized. Tests assert shape (`^M`), not exact bytes.

## Validation

All primitives validate:
- `inputRange.length === outputRange.length` and ≥ 2
- `inputRange` strictly ascending
- `input` not `NaN`
- Type-specific constraints (positive integers for frame/fps/duration,
  integer `from` for Sequence, power-of-two fftSize when T-053 adds audio-utils, etc.)

Component validators throw at mount time. Primitive validators throw at call
time. Either way, mis-use fails loudly.

## Spring physics envelope

T-043 [rev] defined the validated parameter space:
- `mass > 0`
- `stiffness > 0`
- `damping >= 0.01`
- `frame >= 0` (integer)
- `fps > 0`

Outside this envelope `spring()` throws. Inside, adaptive substepping (stability
criterion `1 / (max(sqrt(k/m), c/m) * 8)`, capped at 1000 substeps/frame) keeps
the integrator stable. Default config (`mass=1`, `stiffness=100`, `damping=10`)
substeps 1–3 times per outer frame. Pathological configs approach the cap; a
final NaN defense-in-depth throw catches any remaining divergence.

The property suite in `properties.test.ts` asserts: frame=0 returns `from`
exactly; heavy damping converges to `to` within `1e-2` by frame 600; no NaN
or Infinity across the envelope.

## Implementation map

| File | Task | Purpose |
|---|---|---|
| `src/frame-context.ts` | T-040 | `FrameContext`, `FrameProvider`, hooks |
| `src/easings.ts` | T-041 | 25 named easings + `cubicBezier` |
| `src/interpolate.ts` | T-041 | Numeric interpolate |
| `src/interpolate-colors.ts` | T-042 | Color interpolate (culori) |
| `src/spring.ts` | T-043 | Spring physics |
| `src/sequence.tsx` | T-044 | Mount gate + frame remap |
| `src/loop.tsx` | T-045 | Mount gate + frame wrap |
| `src/freeze.tsx` | T-045 | Remap-only |
| `src/series.tsx` | T-046 | Auto-chained sequences |
| `src/composition.ts` | T-047 | Registry + `renderFrame` |
| `src/interpolate-path.ts` | T-052 | SVG path morph (flubber) — exported via `src/path.ts` sub-entry |
| `src/path.ts` | chore/flubber-sub-entry | Sub-entry re-export so flubber stays out of base |
| `src/use-media-sync.ts` | T-055 | `<video>` / `<audio>` sync hook |
| `src/use-audio-visualizer.ts` | T-053 | Web Audio analyser hook (editor-only) |
| `src/properties.test.ts` | T-048 | Cross-primitive property suite |

## Dev harness

`apps/stageflip-app-dev-harness` (T-050) is a Vite + React single-page app
that mounts the primitives behind a frame slider. Run it from the repo root:

```
pnpm --filter @stageflip/app-dev-harness dev
```

Demo compositions (see `apps/dev-harness/src/compositions.tsx`) cover
`interpolate`, `interpolateColors`, `spring`, `<Sequence>`, `<Loop>`, and
`<Series>`. Use this as the quickest sanity check when adding or changing a
primitive — drive the slider and watch the preview update.

## Test suite

- Unit tests co-located with each source file.
- `properties.test.ts` gathers wider fast-check sweeps (monotonicity,
  convergence, boundary).
- `frame-runtime` total: 328 cases across 14 files (as of T-053).
- Environment: `happy-dom` (see `vitest.config.ts`); faster than jsdom and
  sufficient for React rendering.
- Auto-cleanup is NOT globally enabled — every React test calls
  `afterEach(cleanup)` explicitly. Missing cleanup is the #1 source of
  test interference.

## Public-API freeze (T-054)

Landed. `@stageflip/frame-runtime`:

- `react` + `react-dom` are `peerDependencies` (`^19.0.0`) with a pinned
  `devDependencies` copy for tests. Consumers get a single React copy.
- `culori` and `flubber` stay regular runtime `dependencies`; their output
  is wrapped by this package's own formatter and not re-exposed.
- Surface is frozen against the exports listed above. Additions ship as a
  minor bump per Changesets; removals / breaking signatures require a
  major.

## Related

- Determinism rules + shim: `concepts/determinism/SKILL.md`
- Document shape the runtime consumes: `concepts/rir/SKILL.md`
- How other runtimes plug into the frame clock: `runtimes/contract/SKILL.md`
- Owning tasks: T-040, T-041, T-042, T-043, T-044, T-045, T-046, T-047,
  T-048, T-049, T-052, T-053, T-054, T-055
