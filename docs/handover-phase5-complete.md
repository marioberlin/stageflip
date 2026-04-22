# Handover — Phase 5 complete (2026-04-21)

Supersedes `docs/handover-phase4-complete.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` for Phase 6.

Current commit on `main`: `1c22095` (Merge T-107). Working tree
clean after merge. Every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — implementation complete. T-001..T-017 done.
- **Phase 1 (Schema + RIR + Determinism)** — ✅ **Ratified 2026-04-20**.
  T-020..T-034 done; T-035..T-039 (Firebase) deferred.
- **Phase 2 (Frame Runtime)** — implementation complete. T-040..T-055 done (16/16).
- **Phase 3 (Runtime Contract + Concrete Runtimes)** — ✅ **Ratified
  2026-04-21**. 11/11 done.
- **Phase 4 (Vendored CDP Engine + Export Dispatcher)** — ✅ **Ratified
  2026-04-21** (commit `d023b24`). 13/13 done. See
  `handover-phase4-complete.md` for the full closeout.
- **Phase 5 (Parity Harness + Pre-Render Linter)** —
  **implementation complete; awaiting human ratification** per
  CLAUDE.md §2. 6 of 8 original plan rows merged; 2 carried to
  Phase 6 (T-105 / T-106 → T-137 / T-138).

### Phase 5 tasks as shipped

The T-100 plan row expanded to five sub-tasks during implementation
(documented in `docs/implementation-plan.md` §C.10 v1.2 + v1.3 +
v1.4) because the original L-sized row bundled three independently
reviewable concerns (comparators, BeginFrame wiring, host bundle).

| ID | Task | Commit on `main` |
|---|---|---|
| T-100 | Parity harness — PSNR + SSIM comparators + scoring aggregator | `deb74a3` |
| T-100b | BeginFrame capture for `PuppeteerCdpSession` | `5c35e06` |
| T-100c | Host contract (`CdpSession.mount(doc)`) + `richPlaceholderHostHtml` | `c1a4dcb` |
| T-100d | Runtime bundle host scaffold + CSS runtime | `7971ea5` |
| T-100e | Runtime bundle — all 6 live runtimes + `bundleDoctor` | `d43759d` |
| _(cleanup)_ | Remove spurious React peerDep from renderer-cdp | `aae9344` |
| T-102 | Parity fixture format — thresholds + goldens | `349a6e1` |
| T-101 | Parity CLI — `pnpm parity [<fixture>]` | `38a51dd` |
| T-103 | Parity CI integration — path-filtered gate | `d2e5a29` |
| T-104 | Pre-render linter — 33 rules across 7 categories | `a073e42` |
| T-107 | Validation-rules auto-gen + parity-testing workflow guidance | `1c22095` |

**Carried to Phase 6** (plan v1.5): T-105 (visual diff viewer) →
T-137; T-106 (auto-fix passes) → T-138. Rationale: both depend
on surfaces that shipped this phase (T-104 `LintRule` /
`LintFinding`, T-100 `ScoreReport`) but neither blocks Phase 6's
slide-migration critical path. Scheduled as tooling follow-ups.

### Exit criteria (from plan)

> CI parity stage green on 5 fixtures × 2 backends; pre-render
> linter catches all 30+ test violations.

- **CI parity stage green on 5 fixtures × 2 backends** ✅ (with
  caveat). `pnpm parity --fixtures-dir packages/testing/fixtures`
  exits 0; 5 fixtures have `thresholds` + `goldens.dir` pre-
  populated (CSS, GSAP, Lottie, Shader, Three); 2 remain
  input-only (shader-swirl-vortex, shader-glitch). Without
  committed goldens, all fixtures report `no-goldens` /
  `no-candidates` and the gate is *structural* today —
  priming goldens is a future tooling task (handover §6). The
  "2 backends" axis (CDP screenshot vs BeginFrame) is wired
  but not yet exercised on committed goldens.
- **Pre-render linter catches 30+ violations** ✅. T-104 ships 33
  rules across 7 categories. `ALL_RULES.length >= 30` is asserted
  in the test suite + documented in the auto-generated
  `reference/validation-rules/SKILL.md`.

### No escalations this phase

Unlike T-083 in Phase 4, no task triggered a formal
`docs/escalation-*.md`. Scope carve-outs (T-100 → 5 sub-rows,
T-105+T-106 → Phase 6) were handled via plan-version bumps
inline.

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of Phase 5)

| Package | Cases | Change vs Phase 4 |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | 328 | unchanged |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 26 | +16 (T-102 threshold/goldens parsing + T-107 pattern test) |
| `@stageflip/runtimes-contract` | 14 | unchanged |
| `@stageflip/runtimes-frame-runtime-bridge` | 14 | unchanged |
| `@stageflip/runtimes-css` | 13 | unchanged |
| `@stageflip/runtimes-gsap` | 12 | unchanged |
| `@stageflip/runtimes-lottie` | 13 | unchanged |
| `@stageflip/runtimes-shader` | 22 | unchanged |
| `@stageflip/runtimes-three` | 15 | unchanged |
| `@stageflip/fonts` | 23 | unchanged |
| `@stageflip/renderer-cdp` | 242 | +39 (T-100b BeginFrame + T-100c rich placeholder + T-100d builder + T-100e factory) |
| **`@stageflip/parity`** | **40** | **+40 (new T-100)** |
| **`@stageflip/cdp-host-bundle`** | **28** | **+28 (new T-100d + T-100e)** |
| **`@stageflip/parity-cli`** | **28** | **+28 (new T-101)** |
| **`@stageflip/validation`** | **42** | **+42 (new T-104 + throw-guard regression from T-104)** |
| `@stageflip/skills-sync` | 8 | +8 (T-107 generator) |
| **Total** | **1047** | **+201 vs Phase 4 complete** |

### Dependencies added in Phase 5

All MIT / Apache-2.0. `pnpm check-licenses` went 479 → 482 deps
scanned at Phase 5 exit.

| Package | Version | Install site | License |
|---|---|---|---|
| `ssim.js` | **3.5.0** | `@stageflip/parity` | MIT |
| `pngjs` | **7.0.0** | `@stageflip/parity`, `@stageflip/parity-cli` (devDep), `@stageflip/cdp-host-bundle` (devDep) | MIT |
| `@types/pngjs` | **6.0.5** | `@stageflip/parity` / `@stageflip/parity-cli` (devDep) | MIT |
| `happy-dom` | **20.9.0** | `@stageflip/renderer-cdp` (devDep, T-100c), `@stageflip/cdp-host-bundle` (devDep, T-100d) | MIT |

**Decisions**:

- **sharp → pngjs pivot (T-100)**. Sharp is pre-pinned in
  `docs/dependencies.md` §3 but its `libvips` binding is
  LGPL-3.0-or-later. Per `THIRD_PARTY.md` §1.1 + CLAUDE.md §3
  that requires a per-package ADR. `pngjs` achieves the same goal
  (PNG decode → RGBA buffer) in pure JS with zero transitive
  deps, avoiding the policy exposure at no practical cost at
  fixture sizes. Sharp's §3 entry retained as pre-pinned-but-
  uninstalled with a clarifying note.
- **Bundle size budget** (T-100d / T-100e). New size-limit entry
  for `@stageflip/cdp-host-bundle/dist/browser/bundle.js` at
  500 KB gzipped (actual at Phase 5 exit: 313.82 KB per
  size-limit). Root `pnpm size-limit` script builds the bundle
  alongside frame-runtime before invoking the gate.
- **Canvas polyfill for happy-dom test lane** (T-100e). `lottie-web`
  sets `fillStyle` on a null 2D context at module load. Added
  `cdp-host-bundle/src/test-setup.ts` that proxies
  `HTMLCanvasElement.prototype.getContext('2d')` to a no-op stub
  when happy-dom returns null. Real Chrome (the actual bundle
  consumer) is unaffected.

### New workspace packages

| Package | Private | Purpose |
|---|---|---|
| `@stageflip/parity` | yes | PSNR + SSIM comparators, scoring aggregator, threshold resolution |
| `@stageflip/cdp-host-bundle` | yes | Browser IIFE bundling React + 6 live runtimes + composition renderer |
| `@stageflip/parity-cli` | yes | `stageflip-parity` CLI binary + `scoreFixture` programmatic API |

`@stageflip/validation` existed as a stub from earlier scaffolding;
T-104 populated it.

### CI gate surface (9 gates + new parity gate, all green)

Phase 4 gates unchanged:

```
pnpm typecheck | lint | test | build
pnpm check-licenses              — 482 deps, PASS
pnpm check-remotion-imports      — 281 source files, PASS
pnpm check-skill-drift           — PASS (link-integrity + tier-coverage)
pnpm skills-sync:check           — PASS (schema + validation-rules in sync)
pnpm check-determinism           — 21 files, PASS (scope unchanged)
pnpm size-limit                  — PASS (frame-runtime 19.52 kB, bundle 313.82 kB)
pnpm e2e                          — optional browser install
```

New in Phase 5:

```
pnpm parity                       — structural today; behavioural once
                                    goldens land. Wired into
                                    .github/workflows/ci.yml as a new
                                    `parity` job, path-filtered via
                                    dorny/paths-filter@v3.
```

The CI `parity` job runs `pnpm parity --fixtures-dir
packages/testing/fixtures` on any PR that touches
`packages/{parity,parity-cli,renderer-cdp,cdp-host-bundle,frame-runtime,rir,schema,fonts,runtimes,testing}/**`
or `.github/workflows/ci.yml`. Skips cleanly (with a visible
"Skipped" step) otherwise.

### Changesets recorded in Phase 5

All minor bumps on packages that stayed `private: true`, so no
publishes happen at Phase 5 exit. Recorded for audit trail:

- `parity-t100.md`
- `renderer-cdp-t100b.md`
- `renderer-cdp-t100c.md`
- `cdp-host-bundle-t100d.md`
- `cdp-host-bundle-t100e.md`
- `testing-t102.md`
- `parity-cli-t101.md`
- `validation-t104.md`
- `skills-sync-t107.md`

T-103 (CI integration) and the React-peerDep cleanup didn't need
changesets — neither touches a publishable package surface.

---

## 3. Architectural decisions (Phase 5)

Layered on top of Phase 4 handover §4.

### 3.1 Pure-comparator + impure-CLI separation

`@stageflip/parity` is pure: PSNR + SSIM + region crop + threshold
resolution + `scoreFrames`. Zero filesystem IO, zero process
shelling. `@stageflip/parity-cli` is the impure layer: filesystem
walks, `loadPng`, stdout/stderr, exit codes. The split keeps
scoring unit-testable in isolation and lets future consumers
(T-137 visual-diff viewer, T-138 auto-fix, a future HTTP server)
reuse the scoring core without inheriting CLI concerns.

### 3.2 Threshold fallthrough to DEFAULTS at CLI time

T-102's fixture format makes `thresholds` optional; missing fields
fall through to `@stageflip/parity.DEFAULT_THRESHOLDS` (30 dB /
0.97 / 0) at CLI resolution time. Fixtures that opt into tight
thresholds (CSS at 40 dB / 0.99) vs forgiving (Three at 30 dB /
0.95) can coexist with minimal ceremony. A fixture without
`thresholds` is implicitly asking for defaults.

### 3.3 Skip-isn't-failure posture in the CLI + CI gate

The CLI exits 0 when fixtures are scored-and-passed OR skipped
(no-goldens, no-candidates, missing-frames). Only scored-and-
FAILED exits 1. Rationale: a golden-less fixture is UNDER-
validated, but not a regression — CI should green through while
goldens are primed, not block merges on "we haven't rendered
this yet". Documented in `parity-testing/SKILL.md` + enforced
by `outcomeIsFailure(outcome)` → `status === 'scored' &&
report.passed === false`.

### 3.4 Host-builder contract carries the full `RIRDocument`

T-100c extended `CdpSession.mount(plan, config, document)` so host
builders get the full element tree, not just the dispatch plan.
Three builders now ship:

- `canvasPlaceholderHostHtml` (T-090, default) — ignores
  `document`, paints a gradient. Pipeline smoke.
- `richPlaceholderHostHtml` (T-100c) — renders text/shape/video-
  image placeholders as inline DOM with frame-reactive visibility.
- `createRuntimeBundleHostHtml(bundleSource)` (T-100d + T-100e) —
  inlines the Vite IIFE from `@stageflip/cdp-host-bundle` with
  all 6 runtimes registered.

The `document` carries through whether the builder uses it or not;
the canvas placeholder continues to ignore it (backward-compat).

### 3.5 BeginFrame protocol selection is per-session, not global

`PuppeteerCdpSession.captureMode: 'auto' | 'beginframe' | 'screenshot'`.
Auto picks BeginFrame on Linux + chrome-headless-shell + successful
runtime probe; else screenshot. Auto never throws — unsupported
environments silently downgrade so a macOS dev machine still
produces (non-deterministic) captures without extra config.
`BEGIN_FRAME_LAUNCH_ARGS` is exported as a frozen readonly tuple
so callers launching Chrome themselves can match the flag set.

### 3.6 Launch-arg gating matches the vendored engine's heuristic

`createPuppeteerBrowserFactory` appends `BEGIN_FRAME_LAUNCH_ARGS`
when `captureMode === 'beginframe'` OR
`captureMode === 'auto' && platform === 'linux'`. Without this, auto
on Linux would launch Chrome with a regular compositor and the
probe would fail, falling back to screenshot and defeating the
whole point. Matches the vendored engine's `buildChromeArgs` path.

### 3.7 Extracted test seams via exported controller functions

Several T-100c/T-100d tests couldn't evaluate serialised
`<script>` content under happy-dom (sandbox blocks on dynamic
code evaluation + innerHTML assignment). Solution: extract the
bootstrap JS as a named export (`richPlaceholderControllerScript(
doc, root)` for T-100c; `registerAllLiveRuntimes()` for T-100e)
and serialise via `.toString()` into the HTML IIFE. The same
function is imported by tests for direct DOM-level assertions.
The shared-source pattern prevents test/prod divergence.

### 3.8 Pure function + tables factored generator

`@stageflip/skills-sync`'s `generateValidationRulesSkill(pkg)` takes
a `ValidationRulesPkg` duck-typed shape (7 category arrays +
`ALL_RULES`) and emits deterministic markdown. Tests drive
hermetic synthetic pkgs rather than importing real rules — keeps
test expectations stable under rule churn. The generator handles
pipe-escape, newline-strip, and empty-category placeholders so
adding a new category won't destabilise the template.

### 3.9 Layered validation strategy — Zod, linter, parity harness

Three gates stack:

- **Zod parse** catches structural invariants (positive dimensions,
  opacity ∈ [0,1], discriminated union shape).
- **Linter (T-104)** catches invariants Zod can't express (timing vs
  composition duration, clip resolution, font coverage, codec
  hygiene) + quality issues (empty text, off-canvas, opacity=0 but
  visible). 33 rules, error/warn/info severity.
- **Parity harness (T-100/T-101/T-103)** catches pixel drift
  (PSNR/SSIM against goldens).

Each layer is defence-in-depth on the layer below. No rule
duplication — the linter explicitly does NOT re-check things Zod
already enforces (documented in T-104 changeset).

### 3.10 Auto-generated skills + drift gate

`@stageflip/skills-sync` owns two generators now (schema +
validation-rules). `scripts/sync-skills.ts` writes both;
`pnpm skills-sync:check` diffs and fails CI if either drifts from
its committed output. Adding a lint rule to
`packages/validation/src/rules/**` without running `pnpm
skills-sync` fails CI — no more hand-editing the rule catalogue.

### 3.11 Golden-priming deferred to a future operator task

No goldens are committed at Phase 5 exit. The harness is wired
end-to-end but behaviourally idle until operators render + commit
the first set of goldens for each of the 5 parity fixtures. The
priming workflow is documented in
`parity-testing/SKILL.md` §"Priming goldens".

---

## 4. Conventions established / reinforced

- **CLI exit codes**: 0 pass, 1 scored-fail, 2 usage error.
  Skipped outcomes do NOT fail. Matches standard Unix + avoids CI
  churn on incomplete fixtures.
- **Rule-id naming**: kebab-case, category-prefixed
  (`element-timing-within-composition`, `video-trim-ordered-when-
  present`). Stable ids allow include/exclude filtering without
  exposing the rule implementation.
- **`private: true` workspace packages** can still carry minor-bump
  changesets; the `changeset` gate accepts them as audit-trail
  entries without expecting a publish.
- **Auto-gen skill markers**: frontmatter `status: auto-generated`
  + a top-of-body warning. Editor-facing signal that hand edits
  will be overwritten.
- **Test-lane polyfills in `setupFiles`**: per-package
  `vitest.config.ts` `setupFiles: ['./src/test-setup.ts']` for
  shims that real browsers provide. Pattern used in
  `cdp-host-bundle` for the canvas polyfill.
- **Path-filtered CI jobs** via `dorny/paths-filter@v3`. Jobs emit
  a visible "Skipped — no <scope> files changed" step so the PR
  UI shows intent rather than silent no-op.
- **Reviewer subagent per task, confidence-ranked findings.** Same
  discipline as Phase 4. Every Phase 5 PR went through
  `feature-dev:code-reviewer` before merge; blocker/recommendation/
  nit classification drove the fix loop. Reviewer caught 3
  duplicate-ID bugs + 1 unhandled-rejection leak + 1
  replace-vs-replaceAll footgun + several other issues this phase.
- **Scope split via plan-version bumps**. v1.2 → v1.5 in one phase.
  Each scope-refinement got a changelog entry explaining WHY.
  Pattern: when an L-sized task reveals three independently-
  reviewable concerns, split into M-sized rows with suffix IDs
  (T-100 / T-100b / T-100c / T-100d / T-100e).
- **Documentation must follow the code in the same PR.** When
  reviewer pressure revealed drift between a rule's `description`
  string and the SKILL.md catalogue entry (T-104 reviewer #2),
  the fix updated both in one commit. Drift gate catches
  auto-gen skills; hand-curated skills rely on reviewer vigilance.

---

## 5. CI gates + dev-harness commands

```sh
# All 10 required gates (from repo root)
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses
pnpm check-remotion-imports
pnpm check-skill-drift
pnpm skills-sync:check
pnpm check-determinism
pnpm size-limit
pnpm parity --fixtures-dir packages/testing/fixtures

# Optional (requires browser install)
pnpm e2e

# Phase 5 end-to-end smoke
pnpm parity packages/testing/fixtures/css-solid-background.json

# Linter against an arbitrary RIR doc (programmatic only)
# — CLI not shipped; consumers import from @stageflip/validation directly
```

Dev harness (still 5 Phase 2 demos; no Phase 3/4/5 runtime demos
yet — same flag carried from Phase 4 §6.4):

```sh
pnpm --filter @stageflip/app-dev-harness dev
```

---

## 6. Flagged risks + follow-ups (by urgency)

### Active — may need attention at the next relevant task

1. **Goldens not primed.** The parity harness is structurally
   correct but behaviourally idle until operators render + commit
   the first set of goldens for each of the 5 parity fixtures
   (css-solid-background, gsap-motion-text-gsap, lottie-lottie-
   logo, shader-flash-through-white, three-three-product-reveal).
   Priming workflow in `parity-testing/SKILL.md` §"Priming
   goldens". No plan-row owns this today — natural fit for a
   Phase 6 tooling task or a dedicated "T-100f" priming pass.
2. **No CI infra for Chrome + ffmpeg.** Same flag as Phase 4 §6.3.
   The e2e suite still auto-skips on bare CI. The parity gate
   runs against committed goldens (none yet), so CI is
   structurally green without actually rendering anything.
   Wiring a dedicated e2e job with Chrome + ffmpeg installed is
   the prerequisite for operators to prime goldens in CI.
3. **Dev harness still has no Phase 3/4/5 demos.** Carried from
   Phase 4 §6.4. Phase 6 migration will likely land the first
   real runtime demos in the new slide editor.
4. **Video codec threshold rows in `parity-testing/SKILL.md` are
   marked `(TBD)`.** The tuning-table numbers for h264/prores
   are plausible defaults, not measured baselines. Calibrate when
   the first codec parity fixture lands (likely with the goldens-
   priming work above).
5. **60fps scrub exit criterion** (carried from Phase 2) still
   unmeasured.
6. **`readFrameContextValue` identity function** (carried from
   Phase 2) still public API. T-100d's real runtime host would
   be its natural retirement point but the bundle entry doesn't
   use it.
7. **GSAP publish-gate legal review** (carried from Phase 3).
   Blocks `private: false` on `@stageflip/runtimes-gsap` at
   Phase 10. Same block now extends to `@stageflip/cdp-host-bundle`
   which inlines GSAP into its IIFE.

### Deferred — waiting on a later phase

8. **T-137 (visual diff viewer)** — carried from T-105. HTML
   artifact consuming `FixtureScoreOutcome` / `ScoreReport`.
9. **T-138 (auto-fix passes)** — carried from T-106. Extends
   T-104's `LintRule` surface with optional `fix(document)`
   methods.
10. **CDP font pre-embedding** (carried Phase 4 §6.9).
11. **Chromium `--font-render-hinting=none`** (carried Phase 4 §6.10).
12. **Per-package size-limit budgets** beyond frame-runtime +
    cdp-host-bundle. `@stageflip/renderer-cdp`,
    `@stageflip/parity-cli`, `@stageflip/validation` are
    unconstrained.
13. **Firebase storage backend** (carried from Phase 1).
14. **Concrete bake runtime** (Phase 12).
15. **`stageflip doctor` CLI subcommand.** Currently consumers
    call `doctor()` programmatically. `bundleDoctor()` from
    `@stageflip/cdp-host-bundle` is the other consumer.
16. **Puppeteer-screenshot rasterization for unsupported embeds**
    (carried Phase 4 §6.16).
17. **Auto-gen `skills/stageflip/reference/cli/SKILL.md`**. Slot
    exists but `cli/` is still a placeholder — waits for the
    dedicated CLI task (parity-cli's surface could be a first
    entry).

### Resolved this phase

- T-100 license posture (sharp LGPL → pngjs MIT pivot). Recorded
  in `docs/dependencies.md` Audit 8.
- T-100b unhandled-rejection in `probeBeginFrameSupport`. Reviewer
  caught; fixed with `.catch(() => undefined)` before the race.
- T-100b ordering test for `close(handle)` — strengthened from
  "both happened" to structural order via shared log.
- T-100b launch-arg gating on auto+linux. Reviewer caught the
  silent-fallback defeat; fix matches vendored engine heuristic.
- T-100c duplicate `id="__sf_root"` between outer mount wrapper
  and inner React root. Reviewer caught real DOM bug masked by
  RTL's detached container; replaced inner ID with
  `data-sf-composition` attribute + regression test.
- T-100c `</script` + U+2028/U+2029 injection defence in the
  document-JSON script tag.
- T-100c test for `ssimOptions.region` fallback path (was
  untested).
- T-100d `noExternal: ['@stageflip/testing']` in tsup config —
  testing package exports raw `.ts` so it must inline.
- T-100e canvas polyfill for happy-dom test lane.
- T-100e `bundleDoctor` SI unit consistency (was mixed SI cutoff
  + binary divisor).
- T-102 `pattern.replace` → `pattern.replaceAll` (multi-token
  `${frame}` footgun).
- T-102 `DEFAULT_GOLDEN_PATTERN` TSDoc said "zero-padded" but
  implementation emits unpadded — fixed the docs.
- T-101 dead `beforeEach` imports removed; added test for
  `parseArgs --candidates` throw + `runCli` exit 2 on missing
  fixture path.
- T-103 path-filter coverage widened to include
  `packages/schema/**` + `packages/fonts/**` (both rendering-
  adjacent). `packages/renderer-core/**` exclusion documented.
- T-104 `element-timing-within-composition` description / code
  mismatch on endFrame boundary. Code was correct; description
  now reads `endFrame <= durationFrames (endFrame is exclusive,
  so equality is legal)`.
- T-104 runner throw-guard for non-Error values.
- T-107 dead ternary + identity function in the generator.

### Low-urgency cleanups carried forward

- Auto-generated schema skill "object object object…" artifact
  (Phase 1 §6.10).
- Turbo remote cache not enabled.
- `back-in` / `back-out` easings overshoot.

---

## 7. How to resume

### 7.1 Starter prompt for the next session

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase5-complete.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` for Phase 6. Confirm your
> understanding of the current state and the next task.

Expected confirmation shape: "On `main` at `<hash>`. Phases 1+3+4
ratified; Phases 0+2 implementation complete. Phase 5 implementation
complete; awaiting ratification. Phase 6 starts at T-120 (Audit
existing SlideMotion editor). Ready."

### 7.2 Orchestrator checklist for Phase 5 ratification

Before stamping "Ratified 2026-04-xx" in
`docs/implementation-plan.md`:

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 10 gates green: `pnpm typecheck lint test check-licenses
      check-remotion-imports check-skill-drift skills-sync:check
      check-determinism size-limit parity`.
- [ ] `docs/implementation-plan.md` Phase 5 row gets the ✅
      Ratified banner.
- [ ] Confirm plan v1.5 carry-over to Phase 6 is acceptable (T-105
      → T-137, T-106 → T-138).
- [ ] Decide on follow-up §1 (goldens priming) — assign an owner
      task or schedule as Phase 5 post-ratification cleanup.
- [ ] Decide on follow-up §2 (CI Chrome/ffmpeg infra) — prerequisite
      for §1.

### 7.3 What Phase 6 looks like

Phase 6 is the Slide Migration. T-120 audits the existing
SlideMotion editor; T-121 builds the greenfield `editor-shell`
package against the new RIR + frame-runtime + storage contract;
T-122 stands up a walking-skeleton `apps/stageflip-slide`. Then
T-123..T-129 port UI components one at a time; T-130..T-136 wire
the legacy-to-RIR importer, clip porting, Jotai atoms, branding,
and E2E regression.

**Plus the two carried tasks** at the end of the phase:

- **T-137** (ex-T-105) — visual-diff viewer consuming
  `FixtureScoreOutcome` / `ScoreReport`. HTML artifact; likely
  lives in a new `apps/parity-viewer` or similar. Unblocked by
  T-100 + T-101.
- **T-138** (ex-T-106) — auto-fix passes. Extends T-104's
  `LintRule` with optional `fix(document) → RIRDocument`;
  orchestrator runs up to 10 passes until convergence. Unblocked
  by T-104.

Phase 6 doesn't require either before its core migration work
completes — they're tooling that rounds out parity + linter
ergonomics for humans.

**Complexity spots to plan for**:

- **Golden-priming pipeline**. Even before T-120, somebody needs
  to render the 5 parity fixtures through the real bundle host
  (T-100d/e) and commit the PNGs. Without this, the parity gate
  is structural and T-137 has nothing to visualise.
- **SlideMotion import compatibility**. T-130 owns one-way
  conversion; expect surprises in clip-prop naming drift.
- **Abyssal Clarity brand parity**. T-134 wants the StageFlip.Slide
  branded editor to match the current SlideMotion "Abyssal
  Clarity" aesthetic. Will need CSS-var work tied to the
  theme-slots concept.

---

## 8. File map — Phase 5 additions

```
packages/parity/                              [NEW — T-100]
  package.json
  src/
    image-data.ts                             RGBA container + pngjs loadPng + crop + assertSameDimensions
    psnr.ts                                   Pure PSNR in dB; includeAlpha option; Infinity for identical
    ssim.ts                                   ssim.js wrapper; optional region crop
    thresholds.ts                             ParityThresholds + DEFAULT_THRESHOLDS + resolveThresholds
    score.ts                                  scoreFrames(inputs, opts?) + FrameScore + ScoreReport
    index.ts                                  Public surface
    {*.test.ts}                               40 cases across 5 files

packages/cdp-host-bundle/                     [NEW — T-100d + T-100e]
  package.json                                Vite IIFE + tsup ESM; deps on runtimes-{css,gsap,lottie,shader,three,frame-runtime-bridge}
  vite.config.ts                              format: 'iife', noExternal for workspace runtimes
  tsup.config.ts                              Node-side loader build
  src/
    browser/entry.tsx                         IIFE boot: registerAllLiveRuntimes + BootedComposition + setFrame
    composition.tsx                           React renderer: text/shape/clip dispatch/placeholder
    runtimes.ts                               LIVE_RUNTIME_IDS + registerAllLiveRuntimes()
    test-setup.ts                             happy-dom canvas polyfill for lottie-web
    index.ts                                  Node-side loadBundleSource / bundlePath / bundleDoctor
    {*.test.ts + *.test.tsx}                  28 cases

packages/parity-cli/                          [NEW — T-101]
  package.json                                bin: stageflip-parity; workspace deps on parity + testing
  bin/parity.js                               #!/usr/bin/env node shim
  tsup.config.ts                              noExternal @stageflip/testing
  src/
    score-fixture.ts                          scoreFixture(path, opts?) → FixtureScoreOutcome
    cli.ts                                    parseArgs + runCli + formatOutcome + formatSummary
    index.ts                                  Public surface
    {*.test.ts}                               28 cases

packages/validation/src/                      [POPULATED — T-104]
  types.ts                                    LintRule / LintFinding / LintReport / LintContext / LintSeverity
  runner.ts                                   lintDocument(doc, opts?) + include/exclude + throw-guard
  rules/
    index.ts                                  ALL_RULES + 7 category exports
    timing.ts                                 5 rules (timing window, ids, animation timing)
    transform.ts                              4 rules (bounds, tiny, opacity, rotation)
    content.ts                                12 rules (text/shape/video/embed/chart/table)
    composition.ts                            5 rules (codec hygiene, fps, duration, digest)
    fonts.ts                                  2 rules (family + weight coverage)
    stacking.ts                               3 rules (map-covers, value-match, zIndex-unique)
    clips.ts                                  2 rules (kind-resolvable, runtime-matches)
  runner.test.ts                              42 cases (runner + every rule positive case)
  index.ts                                    Public surface

packages/renderer-cdp/src/
  puppeteer-session.ts                        [MOD] T-100b BeginFrame protocol selection + CaptureMode
                                              + probeBeginFrameSupport + BEGIN_FRAME_LAUNCH_ARGS.
                                              [MOD] T-100c HostHtmlBuilder now receives `document`;
                                              CdpSession.mount(plan, config, document); added
                                              richPlaceholderHostHtml + richPlaceholderControllerScript.
                                              [MOD] T-100d createRuntimeBundleHostHtml builder.
  adapter.ts                                  [MOD] T-100c CdpSession.mount signature extension
  puppeteer-session.test.ts                   [MOD] +39 cases net (T-100b + T-100c + T-100d)
  rich-placeholder-dom.test.ts                [NEW T-100c] happy-dom DOM-level tests for controller
  package.json                                [MOD] React peerDep + devDeps removed (PR #17 cleanup)

packages/testing/                             [MOD — T-102]
  src/fixture-manifest.ts                     +thresholds + goldens + resolveGoldenPath +
                                              DEFAULT_GOLDEN_PATTERN (backward-compat with T-067 seed)
  src/index.ts                                +T-102 exports
  src/fixture-manifest.test.ts                +16 cases
  fixtures/{5 upgraded JSONs}                 thresholds + goldens.dir pre-populated

packages/skills-sync/src/                     [MOD — T-107]
  index.ts                                    +validation-rules-gen exports
  validation-rules-gen.ts                     generateValidationRulesSkill(pkg) + buildValidationRuleGroups
  validation-rules-gen.test.ts                8 cases (hermetic synthetic pkg)
  package.json                                +workspace dep on @stageflip/validation

scripts/sync-skills.ts                        [MOD — T-107] +reference/validation-rules job

skills/stageflip/
  reference/validation-rules/SKILL.md         [REGEN T-104 → T-107 auto-gen] status: auto-generated
  workflows/parity-testing/SKILL.md           [MOD] substantive workflow guidance per T-107 plan row:
                                              when-to-update-a-golden, triage playbook, threshold tuning,
                                              priming workflow; CI section; CLI section

.github/workflows/ci.yml                      [MOD — T-103] +parity job, path-filtered via dorny
package.json                                  [MOD — T-101 + T-100d] +pnpm parity + pnpm size-limit
                                              now also builds cdp-host-bundle
.size-limit.json                              [MOD — T-100d + T-100e] +cdp-host-bundle entry (500 KB gzipped)

.changeset/
  parity-t100.md                              [NEW]
  renderer-cdp-t100b.md                       [NEW]
  renderer-cdp-t100c.md                       [NEW]
  cdp-host-bundle-t100d.md                    [NEW]
  cdp-host-bundle-t100e.md                    [NEW]
  testing-t102.md                             [NEW]
  parity-cli-t101.md                          [NEW]
  validation-t104.md                          [NEW]
  skills-sync-t107.md                         [NEW]

docs/
  implementation-plan.md                      [MOD] v1.2 → v1.3 → v1.4 → v1.5; T-100 split into 5 sub-rows;
                                              T-105 + T-106 carried to Phase 6 as T-137 + T-138
  dependencies.md                             [MOD] Audit 8 — ssim.js + pngjs install sites;
                                              sharp §3 entry annotated as pre-pinned-but-uninstalled
                                              (libvips LGPL dodged via pngjs pivot)
  handover-phase5-complete.md                 [NEW] this doc
```

---

## 9. Statistics — end of Phase 5

- **~40 commits** on `main` across Phase 5 (Merge T-100 → Merge
  T-107). 11 plan rows merged (T-100 family × 5, T-101, T-102,
  T-103, T-104, T-107) + 1 cleanup (React peerDep).
- **1047 test cases** across **21 test-active packages** (+201 from
  Phase 4).
- **482 external deps** license-audited (PASS) — +3 vs Phase 4
  (ssim.js, pngjs, @types/pngjs).
- **281 source files** scanned for Remotion imports (PASS).
- **21 source files** scanned for determinism (PASS) — scope
  unchanged; new Phase 5 packages (parity, parity-cli,
  cdp-host-bundle, validation) intentionally outside the globs
  (none contain clip / runtime code).
- **10 CI gates** (+ optional e2e + the guarded e2e-reference
  suite from T-090) — 1 new gate this phase (`pnpm parity`).
- **9 changesets** added this phase across 7 packages (including
  the 3 new ones — parity, cdp-host-bundle, parity-cli). All
  `private: true` at this point; recorded for audit trail and will
  flush at Phase 10 publish. Cumulative unreleased changeset count
  on `main` unchanged from the Phase 4 handover baseline.
- **0 ADRs** accepted this phase. ADR-001 + ADR-002 unchanged.
- **33 lint rules** across 7 categories shipped in
  `@stageflip/validation`.
- **5 parity fixtures** primed with thresholds + goldens config
  (awaiting actual golden PNGs).
- **2 auto-generated SKILL.md files** now enforced by
  `skills-sync:check` (schema + validation-rules).
- **0 escalations** raised this phase (vs 1 in Phase 4 — T-083).

---

*End of handover. Next agent: go to §7.1 for the starter prompt.
Phase 6 starts at T-120 (SlideMotion editor audit).*
