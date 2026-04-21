# Handover — Phase 2 complete (2026-04-21)

Supersedes `docs/handover-phase2-midstream.md` (removed in this closeout).
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 3.

Current commit on `main`: `0463045` (Merge T-050) + this closeout commit.
Working tree clean (after closeout merges). Every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — ratified 2026-04-20. T-001 through T-017
  merged or covered-by-T-001. ADR-001, ADR-002 accepted.
- **Phase 1 (Schema + RIR + Determinism)** — ratified 2026-04-20.
  T-020..T-034 merged. T-035..T-039 (Firebase storage) deferred.
- **Phase 2 (Frame Runtime)** — **implementation complete; awaiting
  human ratification at the phase boundary** per CLAUDE.md §2.
  T-040..T-055 all merged including the revised numbering
  (T-043 [rev], T-055 [new]).

### Phase 2 tasks as shipped

| ID | Task | Commit on `main` |
|---|---|---|
| T-040 | FrameContext + hooks | `df62937` |
| T-041 | interpolate + 25 easings | `3596455` |
| T-042 | interpolateColors (culori) | `c8020a2` |
| T-043 [rev] | spring with validated envelope | `3596455` |
| T-044 | `<Sequence>` | `5494dd2` |
| T-045 | `<Loop>` + `<Freeze>` | `0091244` |
| T-046 | `<Series>` + `<Series.Sequence>` | `e912777` |
| T-047 | `<Composition>` + `renderFrame` | `abf9aaa` |
| T-048 | Consolidated property tests | `f8ed221` |
| T-049 | size-limit budget gate | `7a6d188` |
| T-050 | Vite dev harness | `0463045` |
| T-051 | frame-runtime SKILL.md (substantive) | `d3634bf` |
| T-052 | interpolatePath (flubber) | `96c9492` |
| T-053 | useAudioVisualizer | `f25298f` |
| T-054 | Public API freeze (react peerDep) | `e90044b` |
| T-055 [new] | useMediaSync | `caa514a` |
| chore | flubber → `/path` sub-entry (bundle fix) | `cb5fa61` |

### Exit criteria (from plan)

> Complete frame-runtime package passing property tests; dev harness
> scrubs at 60fps; `useMediaSync` keeps HTML5 media synced.

- Frame-runtime package complete ✅ — 14 source files, 13 public
  API groups, documented in the skill.
- Property tests ✅ — `packages/frame-runtime/src/properties.test.ts`
  covers monotonicity / convergence / boundary for every primitive;
  80 cases in that file, 328 total across the package.
- Dev harness scrubs at 60fps — **not measured** (see §6 follow-ups).
  Functionally complete and responsive in practice.
- `useMediaSync` keeps HTML5 media synced ✅ — T-055's
  "60-step scrub within ±1 frame" test passes.

---

## 2. Test + bundle surface

### Per-package test counts on `main` (end of Phase 2)

| Package | Cases | Change vs midstream |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | **328** | +231 (from 97) |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 2 | unchanged |
| **Total** | **509** | +231 |

### frame-runtime bundle (size-limit, gzipped, ESM)

- Main entry `@stageflip/frame-runtime`: **5.3 KB gz** (limit 10 KB)
- Sub-entry `@stageflip/frame-runtime/path`: **19.5 KB gz** (limit 25 KB)

The base bundle dropped from 24.05 KB → 5.30 KB after the chore
commit moved `interpolatePath` (and its flubber dep) to the sub-entry
(`cb5fa61`). Consumers that don't morph paths save 18.75 KB.

### CI gate surface (9 gates, all green)

| Gate | Script | Added by |
|---|---|---|
| `pnpm typecheck` | turbo + tsc | T-002 |
| `pnpm lint` | turbo + biome | T-003 |
| `pnpm test` | turbo + vitest | T-004 |
| `pnpm build` | turbo + tsup | T-001 |
| `pnpm check-licenses` | scripts/check-licenses.ts | T-010 |
| `pnpm check-remotion-imports` | scripts/check-remotion-imports.ts | T-010 |
| `pnpm check-skill-drift` | scripts/check-skill-drift.ts | T-014 |
| `pnpm check-determinism` | scripts/check-determinism.ts | T-028 |
| `pnpm skills-sync:check` | scripts/sync-skills.ts --check | T-034 |
| `pnpm size-limit` | .size-limit.json | T-049 |
| `pnpm e2e` | Playwright | T-005 |

### Changesets recorded

Phase 2 post-freeze (T-054 onwards) adds four changesets in
`.changeset/`:

- `frame-runtime-api-freeze.md` — minor, peerDep flip
- `frame-runtime-use-media-sync.md` — minor, T-055
- `frame-runtime-audio-visualizer.md` — minor, T-053
- `frame-runtime-path-sub-entry.md` — major, /path split

Pre-T-054 tasks did NOT ship changesets — the package was
`private: true` and CLAUDE.md §9's rule was waived pending publish
(Phase 10). Still applies.

### Dependency growth

`pnpm check-licenses` dep count grew 402 → 463 over Phase 2.
Additions (all MIT / Apache-2.0 / BSD):
- `culori@4.0.2` (T-042)
- `@types/culori@2.1.1` (T-042)
- `flubber@0.4.2` + 6 transitive d3/earcut/svg deps (T-052)
- `@types/flubber@0.4.0` (T-052)
- `vite@5.4.21`, `@vitejs/plugin-react@4.7.0` + transitives (T-050)

All recorded in `docs/dependencies.md` §3 and audit addenda 2–4.

---

## 3. Architectural decisions that landed in Phase 2

Load-bearing decisions worth preserving. Phase 1's decisions (in the
previous handover) still apply; these layer on top.

### 3.1 `z.union` for elements + `interpolate` input-range validation

All Phase 2 primitives validate inputRange via: ≥ 2 entries, strictly
ascending, same length as outputRange. Exact validation messages are
stable strings — tests assert on them via `toThrow(/.../)`.

### 3.2 Extrapolation matrix varies by primitive

`interpolate` accepts all three modes (`clamp` / `extend` / `identity`).
`interpolateColors` rejects `identity` (input number, output string —
identity is nonsense). `interpolatePath` accepts ONLY `clamp` — `extend`
has no coherent geometric continuation, `identity` makes no sense.

This matrix is documented in `skills/stageflip/runtimes/frame-runtime/SKILL.md`.
If a future primitive adds extrapolation, the table should grow; don't
silently accept an unsupported mode.

### 3.3 We own the output formatter for colors

`interpolateColors` emits `#rrggbb` (α ≥ 1) or `rgba(R, G, B, A)` with
integer channels and 3-decimal alpha — OUR shape, not culori's.
culori's v4 formatters drift in minor versions (short-form hex for some
values, CSS Color 4 `rgb(a b c / α)` for others). Snapshot tests assert
exact strings against our shape so culori bumps don't break tests.

Same posture for `interpolatePath`: tests assert `^M` rather than exact
bytes because flubber's resampler output differs between t=0 fast-path
(input string untouched) and interior t (resampled).

### 3.4 Spring envelope is strict; substepping is adaptive

T-043 [rev] contract: `mass > 0, stiffness > 0, damping >= 0.01,
frame >= 0, fps > 0`. Outside the envelope `spring()` throws with a
useful error. Inside, adaptive substepping (stability criterion
`1 / (max(sqrt(k/m), c/m) * 8)`, capped at 1000/frame) keeps the
integrator stable.

T-048's `properties.test.ts` verifies the no-NaN-or-Infinity invariant
across the full envelope. This closes handover §6.2 risk.

### 3.5 Components compose: mount-gate plus frame-remap is the shared pattern

`<Sequence>`, `<Loop>`, `<Series.Sequence>` all: (a) compute whether
the current frame is inside a half-open window, (b) if inside, wrap
children in a nested `FrameProvider` with a remapped frame, (c) if
outside, return `null` (children are NOT mounted).

`<Freeze>` is remap-only (no mount gate, no DOM wrapper) because it's
a state-preservation tool — unmounting would break exactly the case
it's for.

Half-open window `[from, from + duration)` is the shared convention.
All boundary tests assert both ends. Any future time-windowed component
should follow the same shape.

### 3.6 Layout-wrapper pattern

`SequenceLayout = 'absolute-fill' | 'none'` is shared. `'absolute-fill'`
wraps in a positioned div with explicit `top/left/right/bottom: 0` (not
`inset: 0` — happy-dom serializes `inset` unreliably and React drops
numeric `0` there in some versions). `'none'` renders children directly.

### 3.7 `<Series>` is the Object.assign pattern

```ts
export const Series = Object.assign(SeriesFn, { Sequence: SeriesSequence });
```

Gives the ergonomic `<Series.Sequence>` JSX form with clean TS types
and no prototype tricks. `SeriesSequence` is also exported separately.

### 3.8 `registerComposition` is module-level, side-effect during render

`<Composition>` calls `registerComposition` synchronously during
render, guarded by `if (!registry.has(id))`. Matches Remotion's
bundle-time discovery pattern. StrictMode-safe because registration
is idempotent. Test-only `__clearCompositionRegistry` is exported with
the `__` prefix so consumers see "not application surface."

### 3.9 React is a peerDep with a devDep test copy

T-054 flipped `react` and `react-dom` from `dependencies` to
`peerDependencies` (`^19.0.0`) with a pinned `devDependencies` copy
(`19.2.5`). Consumers get a single React copy in their bundle.

`culori` and `flubber` stay as regular runtime `dependencies` —
implementation details whose outputs we wrap. `@types/react*` stay in
`devDependencies`.

### 3.10 `interpolatePath` lives on a sub-entry (`/path`)

After T-053 brought the base bundle to 24.05 KB gz (0.95 KB under the
25 KB limit), the chore commit `cb5fa61` moved `interpolatePath` to
`@stageflip/frame-runtime/path`. Consumers import it via the sub-entry:

```ts
import { interpolatePath } from '@stageflip/frame-runtime/path';
```

This was a deliberate reversal of T-052's placement within the main
entry; documented as a major changeset per the T-054 freeze policy
(package is still `private: true`, so version stays at 0.0.0).

### 3.11 `useMediaSync` has no setTimeout/rAF debounce

check-determinism forbids `setTimeout` and `requestAnimationFrame`
inside frame-runtime. The "debounced during rapid scrub" requirement
from the plan is satisfied by: (a) a half-frame drift threshold that
elides redundant seeks, (b) React's render batching which collapses
rapid scrubs into a handful of effect flushes.

### 3.12 `useAudioVisualizer` is NOT determinism-clean

Documented in the file header and SKILL.md. Analyser output depends on
decoder wall-clock state, so the hook is editor / preview only. The
Phase 4 CDP export pipeline will read pre-rendered audio samples via
a different code path, not this hook. check-determinism still PASSes
the file because AudioContext construction and analyser APIs aren't
in the scanner's banned identifier set.

### 3.13 `afterEach(cleanup)` is explicit in every React test

Vitest base config has `globals: false`, which means
`@testing-library/react`'s auto-cleanup is NOT wired. Every
`*.test.tsx` must call `afterEach(cleanup)` explicitly. Missing
cleanup was the #1 source of test interference during Phase 2 — T-044
hit this first and the pattern is now standard across the package.

### 3.14 `createElement` children via shorthand, not prop literal

`biome`'s `noChildrenProp` rule rejects `{ children: expr }` literals
but allows the shorthand `{ children }` when a local variable is named
`children`. The frame-runtime pattern is always:

```tsx
const children = createElement(Component, mergedProps);
return createElement(FrameProvider, { frame, config, children });
```

Don't fight the rule by renaming the variable.

### 3.15 Test harness + null-ref safety are standard

Every hook that accepts a ref (`useMediaSync`, `useAudioVisualizer`)
has a "does nothing when ref is null" test. Consumers commonly write
`const ref = useRef<X>(null); <element ref={ref} />` where the ref is
null on first render. Hooks must silently no-op, not throw.

---

## 4. Conventions established or reinforced in Phase 2

- **Factory seam for browser globals.** `useAudioVisualizer` exposes
  `audioContextFactory` as a public option — for tests AND for
  environments where a custom context is already in play. Refusing
  the seam would force consumers to monkey-patch globalThis.
- **Snapshot returns live Uint8Array refs, not copies.** Consumers
  that want persistence copy explicitly. Matches AnalyserNode
  semantics and avoids per-frame allocation.
- **StrictMode ON in the harness.** Double-invoke catches hook
  misuse during dev; kept on deliberately (caught a useMediaSync
  bug during T-055).
- **Property-test numRuns kept modest** (30–200). Whole suite
  finishes in ~100ms. Turn up only when chasing a specific
  counter-example.
- **Commit per task, merge with `--no-ff`, long commit messages via
  heredoc file.** Every merge preserves the task boundary as a
  first-class graph node. Long messages go through
  `cat > /tmp/t-xxx-msg.txt <<'EOM' ... EOM; git commit -F /tmp/...`
  to survive zsh backtick substitution.

---

## 5. Active CI gates + dev-harness command surface

```sh
# All gates (from repo root)
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-skill-drift
pnpm skills-sync:check
pnpm check-determinism
pnpm size-limit
pnpm e2e  # optional, browser install required

# Dev harness (interactive frame scrub)
pnpm --filter @stageflip/app-dev-harness dev
# Then open http://localhost:5173 — composition picker + frame slider.
# Five demos: fade-title, bouncing-ball, series-demo, sequence-demo,
# media-hooks (useMediaSync + useAudioVisualizer instrumentation).
```

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — worth addressing soon

1. **60fps scrub exit criteria is not measured.** The plan says the
   harness "scrubs at 60fps"; in practice it does, but there's no
   instrumentation. Either add an fps readout to the harness (cheap —
   rAF loop in the UI layer is allowed there, not frame-runtime) or
   drop the claim from the exit criteria.
2. **`readFrameContextValue` is an identity function.** Public API,
   frozen under T-054, consumed by nothing. Documented as a Phase 4
   CDP-export hook; if Phase 4's actual needs differ, unfreeze-and-
   remove as part of T-083 (CDP bridge).

### Deferred — waiting on a later task (Phase 2 didn't touch)

3. **Firebase storage backend (T-035–T-039)** — still deferred;
   contract stable.
4. **Migration framework `down()`** — deferred until the first
   reversible migration.
5. **Beat timing (B4) BPM source** — wire when T-184 lands.
6. **Event timing (B5) runtime bus** — wire when T-152 Executor
   lands.
7. **Component-expand pass** — wire when T-249 defines
   `ComponentDefinition.body`.
8. **`@stageflip/export-loss-flags`** — empty package; fills at
   T-248.

### Resolved this phase

- Handover §6.2 (spring substep cap monitoring): closed by T-048's
  never-NaN-or-Infinity property.
- Handover §6.3 (React peerDep flip): closed by T-054.
- Base bundle nearing 25 KB after T-053: closed by the `/path`
  sub-entry chore (`cb5fa61`).

### Low-urgency cleanups carried forward

- Handover §6.10 (schema skill "object object object..."): unchanged.
- Handover §6.11 (REVIEWED_OK spawndamnit entry): unchanged.
- Handover §6.12 (turbo remote cache): unchanged; ADR-002 §D2 tracks.
- Handover §6.13 (back-in/back-out overshoot): unchanged; exempted in
  T-048 monotonicity properties explicitly.

---

## 7. How to resume

### 7.1 Local dev environment

Same as the Phase 1 handover (§5.1). Corepack → pnpm 9.15.0 → frozen
install → gate sweep. CONTRIBUTING.md has the details.

### 7.2 Starter prompt for the next session

Copy-paste:

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase2-complete.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` Phase 3. Confirm your
> understanding of the current state (commit `0463045` + closeout,
> Phase 2 implementation complete awaiting ratification) and the
> next task.

Expected confirmation shape: "On `main` at `<hash>`. Phase 0+1
ratified. Phase 2 implementation complete (16/16); awaiting human
ratification. Next task is T-060 (ClipRuntime contract + registry).
Ready."

### 7.3 Orchestrator checklist for Phase 2 ratification

Before stamping "Ratified 2026-04-xx" in `docs/implementation-plan.md`:

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 9 gates green: `pnpm typecheck lint test check-licenses
      check-remotion-imports check-skill-drift skills-sync:check
      check-determinism size-limit`.
- [ ] `pnpm e2e` clean (optional but traditional at phase boundaries).
- [ ] `docs/implementation-plan.md` Phase 2 row gets the ✅ Ratified
      banner.
- [ ] Decide on follow-ups §1 (fps measurement) and §2
      (`readFrameContextValue`). Either defer explicitly to Phase 4
      or wire small fixes pre-T-060.

---

## 8. File map — Phase 2 additions

```
packages/frame-runtime/src/
  frame-context.ts            — T-040: FrameProvider + hooks
  easings.ts                  — T-041: 25 named + cubicBezier
  interpolate.ts              — T-041: numeric interpolate
  interpolate-colors.ts       — T-042: color interpolate (culori)
  interpolate-path.ts         — T-052: path morph (flubber)
  path.ts                     — chore: sub-entry re-export (flubber split)
  spring.ts                   — T-043: physics
  sequence.tsx                — T-044: mount gate + remap
  loop.tsx                    — T-045: mount gate + frame wrap
  freeze.tsx                  — T-045: remap-only
  series.tsx                  — T-046: auto-chained sequences
  composition.ts              — T-047: registry + renderFrame
  use-media-sync.ts           — T-055: HTML5 media sync
  use-audio-visualizer.ts     — T-053: Web Audio analyser hook
  properties.test.ts          — T-048: consolidated fast-check suite
  + per-file *.test.ts(x) unit suites

apps/dev-harness/
  index.html, vite.config.ts, tsconfig.json, package.json
  src/main.tsx                — React entry, StrictMode
  src/harness.tsx             — scrub UI
  src/compositions.tsx        — 5 demo compositions

.changeset/
  frame-runtime-api-freeze.md          — minor (T-054)
  frame-runtime-use-media-sync.md      — minor (T-055)
  frame-runtime-audio-visualizer.md    — minor (T-053)
  frame-runtime-path-sub-entry.md      — major (chore: flubber split)

skills/stageflip/
  runtimes/frame-runtime/SKILL.md      — substantive as of T-051 (T-054, T-055, T-053 + chore extended it)
  concepts/determinism/SKILL.md        — `related:` now links back to frame-runtime (closeout)

docs/
  dependencies.md                       — §3 + Audit 2/3/4 addenda
  handover-phase2-complete.md           — this doc (closeout)
  handover-phase2-midstream.md          — REMOVED in this closeout

.size-limit.json                        — two-entry budget
.github/workflows/ci.yml                — size-limit gate added (T-049)
```

---

## 9. Statistics — where we stand at end of Phase 2

- **80-ish commits** on `main` across three phases + closeouts.
- **509 test cases** across 7 packages (+231 from Phase 1 end).
- **463 external deps** license-audited (PASS).
- **128 source files** scanned for Remotion imports (PASS).
- **15 source files** scanned for determinism (PASS).
- **59 SKILL.md files** in the skills tree; frame-runtime now
  substantive.
- **9 CI gates** (+ e2e) wired in GitHub Actions.
- **2 ADRs** accepted (ADR-001, ADR-002) — unchanged in Phase 2.
- **4 changesets** pending flush to Phase 10 publish.
- **2 bundle entries** with separate size budgets.

---

*End of handover. Next agent: go to §7.2 for the starter prompt.
Phase 3 starts at T-060 (ClipRuntime contract + registry).*
