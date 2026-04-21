# Handover — Phase 3 complete (2026-04-21)

Supersedes `docs/handover-phase2-complete.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 4.

Current commit on `main`: `3c37c26` (Merge T-072) + the closeout
commit on this branch (`chore/phase-3-closeout` → merge). Working
tree clean after merge. Every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — ratified 2026-04-20. T-001..T-017 done.
- **Phase 1 (Schema + RIR + Determinism)** — ratified 2026-04-20.
  T-020..T-034 done; T-035..T-039 (Firebase) deferred.
- **Phase 2 (Frame Runtime)** — ratified-ready (per `handover-phase2-complete.md`).
  T-040..T-055 + T-049 + T-054 done (16/16).
- **Phase 3 (Runtime Contract + Concrete Runtimes)** —
  **implementation complete; awaiting human ratification** per
  CLAUDE.md §2. 11/11 tasks merged.

### Phase 3 tasks as shipped

| ID | Task | Commit on `main` |
|---|---|---|
| T-060 | ClipRuntime contract + registry | `2eeb8df` |
| T-061 | frame-runtime bridge | `daa9a76` |
| T-062 | css runtime + `solid-background` | `4cdfb55` |
| T-063 | gsap runtime + `motion-text-gsap` | `001e210` |
| T-064 | lottie runtime + `lottie-logo` | `2ba6ead` |
| T-065 | shader runtime + 3 demos | `3f64947` |
| T-066 | three runtime + `three-product-reveal` | `4bf5169` |
| T-067 | Parity fixture manifests (7) | `7741f24` |
| T-068 | Runtime SKILLs (5 flipped to substantive) | `d95afe9` |
| T-069 | clips/authoring SKILL.md | `53c993a` |
| T-072 | FontManager runtime (editor side) | `3c37c26` |
| closeout | Cross-refs + registry round-trips | _this branch_ |

### Exit criteria (from plan)

> 5 runtimes registered; each with demo clip + parity fixture;
> FontManager blocks render on font readiness.

- **5 concrete live-tier runtimes** registered via
  `@stageflip/runtimes-contract` ✅ — css, gsap, lottie, shader, three.
  Plus `frame-runtime-bridge` as the sixth live-tier runtime.
- **Each with demo clip** ✅ — 7 demo clips total (shader ships 3).
- **Parity fixture** ✅ — 7 JSON manifests under
  `packages/testing/fixtures/`. PNG reference-frame generation
  deferred to T-100 (Phase 5).
- **FontManager blocks render on font readiness** ✅ (editor side
  via `useFontLoad`). CDP pre-embedding + `@fontsource` base64
  deferred to T-084a (Phase 4).

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of Phase 3)

| Package | Cases | Change |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | 328 | unchanged |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 10 | +8 (T-067 manifest validator) |
| `@stageflip/runtimes-contract` | 14 | +14 (new T-060) |
| `@stageflip/runtimes-frame-runtime-bridge` | 14 | +14 (new T-061) |
| `@stageflip/runtimes-css` | 13 | +13 (new T-062) |
| `@stageflip/runtimes-gsap` | 12 | +12 (new T-063) |
| `@stageflip/runtimes-lottie` | 13 | +13 (new T-064) |
| `@stageflip/runtimes-shader` | 22 | +22 (new T-065) |
| `@stageflip/runtimes-three` | 15 | +15 (new T-066) |
| `@stageflip/fonts` | 23 | +23 (new T-072) |
| **Total** | **643** | +134 vs Phase 2 complete |

### Dependencies added in Phase 3

All MIT / BSD / Apache-2.0 or explicitly allowlisted. `pnpm check-licenses`
scanned 473 deps at Phase 3 exit, up from 463 after Phase 2.

| Package | Version | Package that installed it | License |
|---|---|---|---|
| gsap | 3.15.0 | `@stageflip/runtimes-gsap` | URL-form; `REVIEWED_OK` + Business Green |
| lottie-web | 5.13.0 | `@stageflip/runtimes-lottie` | MIT |
| three | 0.184.0 | `@stageflip/runtimes-three` | MIT |
| @types/three | 0.184.0 | `@stageflip/runtimes-three` (devDep) | MIT |
| zod | 3.25.76 | `@stageflip/testing` (backfill) | MIT |

`docs/dependencies.md` §4 Audits 5 + 6 record install sites + license
notes. **GSAP redistribution follow-up flagged for Phase 10**: our
Business Green license may or may not cover consumers pulling GSAP
through our npm package — needs legal review before `private: false`.

### CI gate surface (9 gates, all green)

Unchanged from Phase 2:

```
pnpm typecheck | lint | test | build
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-skill-drift
pnpm skills-sync:check
pnpm check-determinism
pnpm size-limit
pnpm e2e
```

`check-determinism` scope grew to 21 files in Phase 3 (the new
`src/clips/**` directories across gsap / lottie / shader / three).
All demo clips pass — hash-based pseudo-randomness in shaders,
timeline-seek in gsap / lottie, progress-parameterised transforms
in three.

### Changesets recorded in Phase 3

All minor bumps (`private: true` packages still don't publish):

- `runtimes-contract-t060.md`
- `runtimes-frame-runtime-bridge-t061.md`
- `runtimes-css-t062.md`
- `runtimes-gsap-t063.md`
- `runtimes-lottie-t064.md`
- `runtimes-shader-t065.md`
- `runtimes-three-t066.md`
- `testing-fixtures-t067.md`
- `fonts-t072.md` (also minors `@stageflip/runtimes-contract` for
  the `FontRequirement` field additions)

---

## 3. Architectural decisions (Phase 3)

Layered on top of the Phase 2 handover's decisions.

### 3.1 Single-hub registry, not per-runtime state

`@stageflip/runtimes-contract` owns a module-level `Map<string,
ClipRuntime>`. Every concrete runtime returns a `ClipRuntime` value;
registration is explicit via `registerRuntime(runtime)`. No decorators,
no module-init side effects — calling `createXRuntime()` does not
register. Consumers assemble their set and call `registerRuntime`
at app boot.

Rationale: decorator-style registration couples the runtime module to
its consumer's boot sequence and breaks hot-reload. An explicit
registration call is testable (the registry has a
`__clearRuntimeRegistry` test-only export) and deferred-friendly.

### 3.2 `findClip(kind)` resolves kind → (runtime, clip)

Clip kinds are globally unique across runtimes. The T-083 dispatcher
(Phase 4) walks the RIR, resolves each clip instance by kind, and
renders via the returned ClipDefinition. First-registered wins on
tie. Tests assert this explicitly.

### 3.3 Tier split (`'live' | 'bake'`)

All six Phase 3 runtimes are `tier: 'live'`. The `'bake'` tier exists
in the contract (for Blender and heavy three scenes) but no concrete
bake runtime ships in Phase 3. T-089 scaffolds bake infrastructure
in Phase 4.

### 3.4 Seek-only discipline

Every animation library wrapped as a live runtime is driven via
seek-style state updates; none are allowed to run their own ticker:

- **gsap**: `gsap.timeline({ paused: true })` + `tl.seek(seconds, false)`.
- **lottie**: `lottie.loadAnimation({ autoplay: false })` +
  `anim.goToAndStop(ms, false)`.
- **three**: never invoke `renderer.setAnimationLoop`; host calls
  `renderer.render(scene, camera)` inside a useEffect keyed on
  localFrame.
- **shader**: redraw on useEffect change; uniforms derived from
  (progress, timeSec).

Determinism depends on this. `check-determinism` doesn't scan
node_modules, so the discipline is enforced by the runtime hosts'
shapes — authors can't call `.play()` through our API surface.

### 3.5 Host layer abstracts external deps

Each runtime has a private `host.tsx` that owns the external
dependency's lifecycle:

- `GsapClipHost` — one useEffect for build (paused timeline), one for
  seek. Timeline is never played.
- `LottieClipHost` — one useEffect for loadAnimation, one for
  goToAndStop. Uses time-based seek (ms) so composition fps drift
  doesn't matter.
- `ShaderClipHost` — compiles vertex + fragment, links program,
  caches uniform locations; `glContextFactory` seam for tests.
- `ThreeClipHost` — calls the author's `setup` once, their `render`
  callback per frame, their `dispose` on unmount.

Author-facing types are narrow (no three-web types leak from the
three runtime; lottie-web types are narrowed through `LottiePlayer`).
Makes the runtimes swappable for alternative libraries without
changing the author surface.

### 3.6 Factory-seam testing pattern

Each runtime whose dependency is unfriendly to happy-dom exposes a
factory option:

- lottie: `lottieFactory?: () => LottiePlayer`. `vi.mock('lottie-web',
  () => ({ default: {} }))` stubs the module; every test passes a
  fake player.
- shader: `glContextFactory?: (canvas) => WebGLContext | null`.
  Happy-dom returns null for `getContext('webgl')`; tests inject a
  stub that records calls.
- three: `setup` callback is the dep boundary — tests pass a pure
  setup that returns a `ThreeClipHandle` with spy callbacks. No
  THREE import in tests.

Authors don't touch these options in production; they default to the
real module.

### 3.7 Explicit-precision rule for shader

Every fragment shader registered via `defineShaderClip` must declare
`precision (lowp|mediump|highp) float;`. Enforced at call time via
`validateFragmentShader` — a comment-stripped regex. We do NOT
auto-prepend a precision declaration (the plan spec allowed for
either; we chose stricter). Rationale: implicit precision drifts
between GPUs (mobile defaults to mediump, desktop effectively highp);
parity fails. Making the declaration explicit keeps the concern
visible at review time.

### 3.8 T-067 fixture format is minimal

Fixtures are JSON manifests (not `.ts`) carrying
`{ name, runtime, kind, description, composition, clip, referenceFrames }`.
Zod-validated. No PNG reference frames — those need the Phase 4 CDP
renderer. T-102 (Phase 5) may extend or supersede this schema once
the harness is live.

The validator test cross-checks against a hand-maintained
`KNOWN_KINDS` allowlist in the test file. Adding a new demo clip
requires BOTH shipping a fixture AND updating the allowlist; either
direction fails.

### 3.9 `FontRequirement` extended non-breakingly

T-072 added `subsets?: readonly string[]` and
`features?: readonly string[]` to the shared type. Both optional;
existing clip implementations unaffected. Matches the longstanding
`concepts/fonts/SKILL.md` that has described these fields since
Phase 1.

### 3.10 `useFontLoad` uses structural dep key

React hook state management footgun: consumers routinely write
`useFontLoad([{family: 'Inter'}])` — array identity changes every
render. Naive useEffect deps would refire the effect on every
setState and spin forever. Fix: `JSON.stringify(requirements)` as
the dep. O(n) per render but n < ~20 in practice. biome's
`useExhaustiveDependencies` complains; explicit biome-ignore
comments explain.

### 3.11 Per-runtime THREE-agnosticism

`@stageflip/runtimes-three`'s host code does NOT import from `three`.
The `three` dep in package.json exists only because the demo clip
uses it. Authors bring their own THREE instance inside `setup`.
Allows using the runtime with alternative three-compatible libraries
(e.g. alternative renderers).

### 3.12 Demo clip `src/clips/**` is the scanner boundary

`check-determinism` scans
`packages/runtimes/*/src/clips/**`. Demo clips go there; host code
and runtime entry points do NOT. This matters because:

- Hosts use `useEffect`, `useRef`, `useState` freely — outside
  scanner scope.
- Clips must avoid wall-clock APIs — inside scanner scope.
- All 7 Phase 3 demo clips pass the scanner.

### 3.13 Generic erasure cast pattern

Every `defineXClip<P>` returns `ClipDefinition<unknown>`, not
`ClipDefinition<P>`. React's covariance on `ComponentType` +
`GetDerivedStateFromProps` blocks a direct `<P>` → `<unknown>`
assignment. A single `as unknown as ClipDefinition<unknown>` at the
return site is the smallest honest cast; internals still see the
concrete `P` through closure.

---

## 4. Conventions established / reinforced

- **Window gating is in the adapter, not the clip.** Every
  `defineXClip` returns null outside `[clipFrom, clipFrom + duration)`.
  Clip authors never write `if (frame < from) return null`.
- **`__clearRuntimeRegistry()` between tests.** Both the module-level
  composition registry and the runtime registry are test-reset via
  `afterEach(() => __clearRuntimeRegistry())`. Leaking state between
  tests was the Phase 2 lesson; Phase 3 applied it.
- **`afterEach(cleanup)` is explicit.** vitest base config keeps
  `globals: false`; every React test file wires testing-library
  cleanup manually.
- **Author surfaces hide `ClipRenderContext` when clip time isn't
  needed.** The css runtime's render callback takes only props;
  adapter converts. Frame-driven runtimes expose clip-local frame /
  progress / timeSec separately.
- **`fontRequirements` is optional on every clip.** Demo clips omit
  it — none need custom typefaces. Consumers declaring text with
  specific families must include it so the FontManager can preload.
- **Each concrete-runtime test suite now includes a
  `contract-registry round-trip` block** (closeout). Smoke test that
  `createXRuntime` + `registerRuntime` + `findClip` resolves.
- **Skill `related:` lists are bidirectional** (closeout). Every hub
  skill links to its spokes; every spoke links back AND to siblings.

---

## 5. CI gates + dev-harness commands

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

# Dev harness — still 5 Phase 2 demos; no Phase 3 runtime demos yet.
pnpm --filter @stageflip/app-dev-harness dev
```

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — may need attention at the next relevant task

1. **Dev harness has no Phase 3 runtime demos.** The harness exercises
   the frame-runtime primitives (T-050) but never mounts a
   gsap / lottie / shader / three clip. Real visual verification of
   T-062..T-066 lives in the T-067 parity fixtures, which need the
   Phase 4 CDP renderer to actually score. A future agent debugging
   a runtime visually has no entry point. Mitigation requires T-083
   dispatcher (Phase 4); defer to then.
2. **60fps scrub exit criteria (carried from Phase 2)** still
   unmeasured.
3. **`readFrameContextValue` identity function (carried from Phase 2)**
   still public API via T-054 freeze; T-083 CDP export bridge is its
   natural consumer or retirement point.
4. **GSAP publish-gate legal review (T-072 addendum + dependencies.md
   §4 Audit 5)** — blocks `private: false` on
   `@stageflip/runtimes-gsap` at Phase 10.

### Deferred — waiting on a later phase

5. **CDP font pre-embedding** (`@fontsource` base64 + `document.fonts.check`
   verification) — T-084a asset preflight (Phase 4).
6. **Chromium `--font-render-hinting=none`** — lands with CDP
   vendor integration (T-080+).
7. **Per-package size-limit budgets** beyond frame-runtime. Currently
   only `@stageflip/frame-runtime` has a budget; the six runtime
   packages + fonts are unconstrained. Post-freeze expansion work.
8. **Parity harness PNG generation** (T-100) — scores the T-067
   fixtures against goldens.
9. **Firebase storage backend (T-035–T-039)** — still deferred from
   Phase 1; non-blocking.

### Resolved this phase

- Skill cross-reference asymmetry (closeout §1).
- Concrete-runtime registry round-trip coverage (closeout §2).
- T-072 editor-side FontManager blocking behavior.

### Low-urgency cleanups carried forward

- Auto-generated schema skill "object object object…" artifact
  (Phase 1 §6.10).
- `spawndamnit` + `gsap` in `REVIEWED_OK` allowlist.
- Turbo remote cache not enabled (ADR-002 §D2).
- `back-in` / `back-out` easings overshoot (exempt from monotonicity
  tests).

---

## 7. How to resume

### 7.1 Starter prompt for the next session

Copy-paste:

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase3-complete.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` Phase 4. Confirm your
> understanding of the current state and the next task.

Expected confirmation shape: "On `main` at `<hash>`. Phase 0+1+2
ratified. Phase 3 implementation complete; awaiting ratification.
Next task is T-080 (vendor `@hyperframes/engine` into
`packages/renderer-cdp/vendor/`). Ready."

### 7.2 Orchestrator checklist for Phase 3 ratification

Before stamping "Ratified 2026-04-xx" in
`docs/implementation-plan.md`:

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 9 gates green: `pnpm typecheck lint test check-licenses
      check-remotion-imports check-skill-drift skills-sync:check
      check-determinism size-limit`.
- [ ] `pnpm e2e` clean (optional but traditional at phase boundaries).
- [ ] `docs/implementation-plan.md` Phase 3 row gets the ✅ Ratified
      banner.
- [ ] Decide on follow-ups §1 (harness demos) and §2 / §3 (Phase 2
      carry-overs). Either defer explicitly to Phase 4 / 5, or wire
      small fixes pre-T-080.
- [ ] (Orchestrator-only) Confirm GSAP publish posture before
      un-gating T-063.

### 7.3 What Phase 4 looks like

Phase 4 is the biggest phase so far. Vendored CDP engine + export
dispatcher + FFmpeg + 3 reference renders + asset preflight. Task
headline: `T-080 Vendor @hyperframes/engine into
packages/renderer-cdp/vendor/; pin commit`.

Key complexity spots to plan for:

- **Vendored code pinning** — see `THIRD_PARTY.md` + `docs/dependencies.md`
  §5 for the pinning protocol. NOTICE file lives at
  `packages/renderer-cdp/vendor/NOTICE`.
- **Determinism under CDP** — `--font-render-hinting=none`, fixed
  device-pixel-ratio, pre-embedded fonts.
- **Asset preflight** (T-084a) — walk RIR, cache remote URLs to local
  disk by content hash, rewrite asset refs to `file://`.
- **FFmpeg integration** — system-ffmpeg-only (no WASM). `doctor`
  command validates install.
- **3 reference render tests** — first real end-to-end integration of
  T-067 fixtures. PNG goldens land here.

---

## 8. File map — Phase 3 additions

```
packages/
  runtimes/contract/                 ← T-060 types + registry
    src/index.ts                        ClipRuntime, ClipDefinition, registry
    src/index.test.ts                   14 cases
  runtimes/frame-runtime-bridge/     ← T-061 bridge
    src/{index.ts,host.tsx,*.test.tsx}  14 cases
  runtimes/css/                      ← T-062 css runtime
    src/{index.ts,*.test.tsx}           13 cases (incl. registry round-trip)
  runtimes/gsap/                     ← T-063 gsap runtime
    src/index.ts                        defineGsapClip + createGsapRuntime
    src/host.tsx                        paused-timeline React host
    src/clips/motion-text-gsap.tsx      canonical demo (scanned)
    src/*.test.tsx                      12 cases
  runtimes/lottie/                   ← T-064 lottie runtime
    src/{index.ts,host.tsx,types.ts}    + 13 test cases
    src/clips/lottie-logo.ts            hand-authored Lottie 5.7 payload
  runtimes/shader/                   ← T-065 shader runtime
    src/{index.ts,host.tsx,validate.ts,types.ts}  + 22 test cases
    src/clips/{flash-through-white,swirl-vortex,glitch}.ts
  runtimes/three/                    ← T-066 three runtime
    src/{index.ts,host.tsx,types.ts}    THREE-agnostic author surface
    src/clips/three-product-reveal.ts   canonical demo (scanned)
    src/*.test.tsx                      15 cases
  fonts/                             ← T-072 FontManager runtime
    src/aggregate.ts                    canonical dedup + sort
    src/use-font-load.ts                React hook, structural dep key
    src/index.ts                        public exports
    src/*.test.{ts,tsx}                 23 cases
  testing/                           ← T-067 fixture manifests
    src/fixture-manifest.ts             Zod schema + loader
    src/fixture-manifest.test.ts        validator (8 cases + 2 smoke = 10)
    fixtures/                           7 JSON manifests + README

.changeset/
  runtimes-contract-t060.md
  runtimes-frame-runtime-bridge-t061.md
  runtimes-css-t062.md
  runtimes-gsap-t063.md
  runtimes-lottie-t064.md
  runtimes-shader-t065.md
  runtimes-three-t066.md
  testing-fixtures-t067.md
  fonts-t072.md

skills/stageflip/
  runtimes/contract/SKILL.md           substantive
  runtimes/frame-runtime-bridge/SKILL.md  substantive
  runtimes/css/SKILL.md                substantive (T-068)
  runtimes/gsap/SKILL.md               substantive (T-068)
  runtimes/lottie/SKILL.md             substantive (T-068)
  runtimes/shader/SKILL.md             substantive (T-068)
  runtimes/three/SKILL.md              substantive (T-068)
  clips/authoring/SKILL.md             substantive (T-069)
  concepts/fonts/SKILL.md              Current-state section updated (T-072)

docs/
  dependencies.md                      §4 Audit 5 (gsap) + Audit 6 (three)
  handover-phase3-complete.md          this doc
```

---

## 9. Statistics — end of Phase 3

- **~40 commits** on `main` across Phase 3 (Merge T-060 → closeout).
- **643 test cases** across **15 packages** (+134 from Phase 2 end).
- **473 external deps** license-audited (PASS).
- **168 source files** scanned for Remotion imports (PASS).
- **21 source files** scanned for determinism (PASS) — +6 from
  Phase 2 as demo clips landed under `src/clips/**`.
- **9 CI gates** (+ e2e) wired.
- **9 changesets** pending flush to Phase 10 publish.
- **2 ADRs** accepted (ADR-001, ADR-002) — unchanged in Phase 3.
- **6 concrete runtimes** registered (css, gsap, lottie, shader,
  three, frame-runtime-bridge).
- **7 parity fixtures** seeded for T-100.

---

*End of handover. Next agent: go to §7.1 for the starter prompt.
Phase 4 starts at T-080 (vendor `@hyperframes/engine`).*
