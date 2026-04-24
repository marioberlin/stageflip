# StageFlip — Implementation Plan v1.18

**Audience**: AI coding agents executing autonomously; human product owners ratifying at phase boundaries.
**Scope**: 390+ tasks across 13 phases, from empty repo to premium motion library + frontier runtime.
**Format**: Every task is self-contained with references, prompts, acceptance criteria, and verification commands.
**Last updated**: 2026-04-25 — **Phase 13 ADRs ratified** (ADR-003 / 004 / 005, 2026-04-25); α primitives unblocked. Phase 10 (T-220–T-231) all merged; closeout handover at `docs/handover-phase10-complete.md`, ratification pending at **Phase 11 start**. **Phase 11 — Importers** is the active phase. Phase 13 runs structurally parallel but P11 takes capacity priority. Preset count is now **50** (added `espn-bottomline-flipper` as T-339a). All 10 in-scope tasks merged (T-200–T-209) across 12 PRs (T-202 + T-203 each split a/b); `main` at `ec62013`. 2 new packages (`@stageflip/profiles-display`, `@stageflip/export-html5-zip`); canonical tool bundles 15 → 16 (`display-mode` added); 109 → 111 tools registered (`optimize_for_file_size` + `preview_at_sizes`); bridge clips 37 → 42 (5 display-profile clips: attention tranche `click-overlay` / `countdown` / `cta-pulse` + data tranche `price-reveal` / `product-carousel`). Parity fixtures unchanged at 47 (display manifests deferred to a non-blocking priming follow-up). All gates green. Next work: Phase 10 — Skills + MCP + Distribution. See `docs/handover-phase9-complete.md` + §C.10 changelog (v1.16).

---

# PART A — Execution Framework

## A.1 Agent Roles

Three agents run concurrently for each task. Separate agent instances — do not let the same agent play multiple roles for one task.

| Role | Input | Output | Bar for approval |
|---|---|---|---|
| **Implementer** | Task spec + referenced skills | Working code + tests + passing CI in a PR | Self-assessment that all acceptance criteria pass |
| **Reviewer** | Same task spec + the PR diff | Either approval comment or a specific diff list of required changes | Reviewer has *read the skill files cited in the task* and compared the PR against them |
| **Verifier** | The PR branch | Pass/fail report from running the exact verification commands | All verification commands exit 0 |

**Orchestrator** (higher-capability agent or human-in-loop):
- Assigns tasks to Implementers based on dependency graph
- Routes PRs to Reviewers once CI green
- Escalates stuck tasks (3+ revision cycles, or time exceeded 3× estimate)
- Runs phase-boundary ratification with human

## A.2 Canonical Task Specification Format

```
### T-XXX: <Title>  (Size: S/M/L, Deps: T-YYY)

**Goal**: One sentence describing the target state.

**Context / References**:
- Skills to read first: <paths to SKILL.md>
- Existing files to study: <paths>
- External specs / docs: <URLs>
- Similar prior art (DO NOT COPY): <URLs with note>

**Implementer Prompt**: [Verbatim prompt to give the agent]

**Output Artifacts**: Files this task creates or modifies.

**Acceptance Criteria**: Testable properties. Not judgment.

**Verify**: Exact shell commands. All must exit 0.
```

**Size key**: S = <2h agent time. M = 2–8h. L = 8–24h (split if possible).

## A.3 Implementer Prompt Template

Every Implementer gets this wrapper around the task-specific prompt:

```
You are implementing task {T-XXX} for StageFlip.

Before you start:
1. Read CLAUDE.md at repo root.
2. Read every SKILL.md listed in "Context / References".
3. Read every file listed in "Existing files to study".
4. Verify dependencies {T-YYY, T-ZZZ} are merged to main.

Rules (condensed from CLAUDE.md):
- No imports from `remotion` or `@remotion/*`. Ever.
- No `Date.now()` / `Math.random()` / `performance.now()` / `fetch()` /
  `requestAnimationFrame` / `setTimeout` / `setInterval` in
  packages/runtimes/** or packages/frame-runtime/** or clip code.
- No copying from sources listed in "Similar prior art". Read for understanding;
  reimplement in your own structure.
- TypeScript strict; no `any`; no `@ts-ignore` without reason.
- Every new public function has TSDoc.
- Every new file has a 1-line header comment.
- Biome formatting; run `pnpm lint:fix` before commit.

Workflow:
1. Create branch `task/T-XXX-<short-slug>`.
2. Write tests FIRST matching the Acceptance Criteria.
3. Implement the minimum code to make tests pass.
4. Run all commands in "Verify". All must exit 0.
5. Open a PR using the template at .github/pr-templates/{phase}.md.
6. Fill PR checklist completely — no unchecked boxes.

If blocked >2h:
- Post a comment on the task issue stating exactly what is blocking you.
- Do not guess on architectural decisions; escalate instead.

<<TASK-SPECIFIC PROMPT HERE>>
```

## A.4 Reviewer Prompt Template

```
You are reviewing PR #{N} which implements task {T-XXX}.

Your job:
1. Read the task spec in this document.
2. Read every SKILL.md file the task references.
3. Read the PR diff.
4. Check: does the implementation match the task's stated goal, follow the skill
   files' conventions, and satisfy every acceptance criterion?
5. Check: is there any code that looks copy-pasted from a third-party source? Run
   `git diff main...HEAD | grep -i "<distinctive-phrases-from-prior-art>"` to
   spot-check.
6. Check: do tests actually test what they claim? Can you construct a small
   mutation that would break the intent but pass the tests?
7. Check: any determinism risks (timers, random, clock, network)?

Output:
- If everything passes: approve with a comment listing which skill files you
  verified the implementation against.
- If anything fails: leave review comments with specific line refs and the exact
  change required. Do not say "consider refactoring"; say "change line 42
  from X to Y".

Do not implement changes yourself. The Implementer revises.
```

## A.5 Verifier Prompt Template

```
You are verifying PR #{N}. Run exactly these commands from the PR branch:

  pnpm install
  pnpm turbo run typecheck --filter=...{affected}
  pnpm turbo run lint     --filter=...{affected}
  pnpm turbo run test     --filter=...{affected}
  pnpm check-licenses
  pnpm check-remotion-imports
  pnpm check-determinism
  pnpm check-skill-drift
  <<TASK-SPECIFIC VERIFY COMMANDS>>

Report exit code and stderr of each command. Do not interpret results.
Do not suggest fixes. Orchestrator handles routing on failure.
```

## A.6 Hard Quality Gates (Every PR)

| Gate | Script | Fails on |
|---|---|---|
| Types | `pnpm typecheck` | Any TS error |
| Lint | `pnpm lint` | Any Biome violation |
| Tests | `pnpm test` | Any test failure |
| Coverage | `pnpm test:coverage` | <85% line coverage on changed files |
| Licenses | `pnpm check-licenses` | Any non-whitelist license in deps tree |
| Remotion ban | `pnpm check-remotion-imports` | Any match for `from "remotion"` or `from "@remotion/` |
| Determinism | ESLint plugin | Non-deterministic API in clip/runtime code |
| Skill drift | `pnpm check-skill-drift` | Auto-generated skill file out of sync |
| Bundle size | `size-limit` | Editor > 500 KB gz; runtime > declared budget |
| Parity | `pnpm parity` | PSNR < threshold OR SSIM < 0.97 on affected fixtures |

## A.7 Conventions

**Commits** — Conventional Commits:
```
feat(schema): add VideoContent discriminated type (T-022)
fix(frame-runtime): handle frame=0 edge case (T-041)
chore(deps): bump vitest (ADR-007)
```

**PR title**: `[T-XXX] <short description>`.

**File headers**: one-line filename + purpose comment at top of every source file.

**No**: commented-out code; `// TODO` without linked issue; `console.log` outside scripts; default exports except Next.js pages; barrel files deeper than package root.

## A.8 External Reference Lock

Versions audited at Phase 0 / T-001a via `latest-stable` query; locked in `docs/dependencies.md`. Values in §4 of `docs/architecture.md` are minimum floors, not targets.

## A.9 Forbidden Prior Art (Read-Only, No Copy)

When a task references these, treat as **API specs only**. Read docs; do not copy code, comments, or distinctive structural choices.

- `remotion` / `@remotion/*` (proprietary; zero imports allowed)
- Any closed-source rendering frameworks

## A.10 Permitted Reuse

- `@hyperframes/*` packages (Apache 2.0) — vendoring allowed with NOTICE preserved
- All MIT / Apache 2.0 / BSD / ISC / LGPL (dynamic link) packages per whitelist

---

# PART B — Phase-by-Phase Tasks

## Phase 0 — Bootstrap (Week 1–3)

**Goal**: All conventions, gates, and scaffolding in place before any real code is written.
**Exit criteria**: `pnpm install && pnpm build && pnpm test` green on empty packages; CI enforces all gates in A.6.

| ID | Task | Size |
|---|---|---|
| T-001 | Initialize pnpm monorepo + Turborepo; scaffold all package dirs per architecture §12 | S |
| **T-001a [new]** | **Version audit**: query npm for latest-stable of each dep in architecture §4; lock in `docs/dependencies.md`; install; build; commit with ADR-001 | S |
| T-002 | ~~TypeScript strict base config~~ — **covered-by-T-001** (`tsconfig.base.json` shipped with `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` in the scaffold commit) | S |
| T-003 | ~~Biome config~~ — **covered-by-T-001** (`biome.json` shipped with format + lint rules in the scaffold commit) | S |
| T-004 | Vitest workspace + coverage thresholds | S |
| T-005 | Playwright setup (smoke test) | S |
| T-006 | GitHub Actions CI with all gates from A.6 | M |
| T-007 | `CLAUDE.md` — agent conventions (already drafted) | M |
| T-008 | `LICENSE` per ADR-001 decision | S |
| T-009 | `THIRD_PARTY.md` + `NOTICE` | S |
| T-010 | `scripts/check-licenses.ts` + `scripts/check-remotion-imports.ts` | M |
| T-011 | Package scaffolding with correct package.json, tsconfig, index.ts | M |
| T-012 | Master skill files — all `skills/stageflip/concepts/` written substantively; all other SKILL.md placeholders with frontmatter | L |
| T-013 | `@stageflip/skills-core` — parseSkillFile, validateSkill, loadSkillTree | M |
| T-014 | `scripts/check-skill-drift.ts` — initial (link integrity); extensible for future generators | M |
| T-015 | PR templates per phase (13 files) | S |
| T-016 | Changesets setup | S |
| T-017 | Vercel preview deployments | S |

---

## Phase 1 — Schema + RIR + Determinism Foundation (Week 4–8)

**Status**: ✅ **Ratified 2026-04-20.** Core tasks T-020–T-034 merged (T-035–T-039 Firebase storage deferred; non-blocking). Exit criteria met: RIR handles all 11 element types; determinism shim intercepts rAF + timers; storage contract supports snapshot + patch + delta.
**Goal**: Typed core. Everything downstream depends on this being rock-solid.
**Exit criteria**: RIR handles all 11 element types; determinism shim intercepts rAF + timers; storage contract supports snapshot + patch + delta.

| ID | Task | Size |
|---|---|---|
| T-020 | Schema: base element types (11 discriminated) | L |
| T-021 | Schema: mode-specific content types (Slide/Video/Display). **[rev]** `DisplayContent.budget` explicit shape: `{ totalZipKb, externalFontsAllowed, externalFontsKbCap, assetsInlined }` | L |
| T-022 | Schema: animations + timing primitives (B1–B5) | M |
| T-023 | Schema: versioning + migrations framework | M |
| T-024 | Schema: exhaustive round-trip tests (all 11 types × all animations × all timings) | M |
| **T-025 [rev]** | **Storage contract** — 3-method interface: `getSnapshot`/`putSnapshot`, `applyUpdate`/`subscribeUpdates` (delta, Uint8Array), `applyPatch`/`getHistory` (ChangeSet). In-memory adapter implements all three | M |
| T-026 | In-memory storage adapter (tests + dev) | M |
| **T-027 [rev]** | **Determinism runtime shim**: intercepts `Date.now`, `new Date()`, `performance.now`, `Math.random`, **`requestAnimationFrame`**, **`cancelAnimationFrame`**, **`setTimeout`**, **`setInterval`**; `fetch` throws. `console.warn` in dev / telemetry event in prod when shim intercepts call that passed source lint | M |
| T-028 | Determinism ESLint plugin + CI wiring | M |
| T-029 | RIR types | M |
| T-030 | RIR compiler — theme + variables + components + bindings | L |
| **T-031 [rev]** | **RIR compiler — timing flattening + stacking contexts**: assign explicit `zIndex = arrayIndex * 10`; wrap `three`/`shader`/`embed` runtimes in `isolation: isolate` containers; emit `StackingMap` for verifier | L |
| T-032 | RIR golden fixture tests | M |
| T-033 | Skills — concepts final pass | M |
| T-034 | `reference/schema/SKILL.md` auto-generation | M |
| T-035 | Storage Firebase adapter scaffolding | M |
| T-036 | Storage Firebase adapter — document store (snapshot + patch) | L |
| T-037 | Storage Firebase adapter — asset store | M |
| T-038 | Firestore security rules | M |
| T-039 | Firebase MCP integration for dev-time scaffolding/seeding | S |

---

## Phase 2 — Frame Runtime (Week 9–14)

**Status**: ✅ **Ratified 2026-04-24** (back-stamped; agent-ratified per orchestrator directive, not a human phase-boundary ratification — CLAUDE.md §2's human-ratification default was explicitly waived for this back-stamp). Implementation complete on `0463045` (`main`) since 2026-04-21 per `docs/handover-phase2-complete.md`; all 16 in-scope tasks merged (T-040–T-055 including T-043 [rev] + T-055 [new]). Exit criteria met with one documented caveat: frame-runtime package complete (14 source files, 13 public API groups, 328 cases across the package including property tests for monotonicity / convergence / boundary); `useMediaSync` keeps HTML5 media synced (T-055 60-step scrub within ±1 frame verified); **dev-harness 60fps scrub is not formally measured** — functionally complete and responsive per handover §6 but the numerical FPS assertion was never wired. Bundle budgets green (main entry 5.3 KB gz / limit 10 KB; `/path` sub-entry 19.5 KB gz / limit 25 KB). Zero escalations raised.

**Goal**: Own the React frame-driven rendering layer. Zero Remotion imports.
**Exit criteria**: Complete frame-runtime package passing property tests; dev harness scrubs at 60fps; `useMediaSync` keeps HTML5 media synced.

| ID | Task | Size |
|---|---|---|
| T-040 | `FrameContext` + `useCurrentFrame()` + `useVideoConfig()` | M |
| T-041 | `interpolate()` + 25 named easings (linear, quad, cubic, quart, quint, expo, circ, back, cubic-bezier) | M |
| T-042 | `interpolateColors()` — RGB + HSL + alpha paths (via `culori` MIT) | M |
| **T-043 [rev]** | `spring()` physics. **Add input validation: `damping ≥ 0.01`, `mass > 0`, `stiffness > 0`, `frame ≥ 0`. Reject with useful error; never return NaN.** | M |
| T-044 | `<Sequence>` component (mount gate + frame remap) | M |
| T-045 | `<Loop>` + `<Freeze>` | S |
| T-046 | `<Series>` + `<Series.Sequence>` | M |
| T-047 | `<Composition>` + `renderFrame(compId, frame, props)` entry | M |
| T-048 | Property-based tests (`fast-check`): monotonicity, convergence, boundary | M |
| T-049 | Bundle size budget (≤ 25 KB gz) via `size-limit` | S |
| T-050 | Dev harness app (Vite + interactive scrub) | M |
| T-051 | `skills/stageflip/runtimes/frame-runtime/SKILL.md` | M |
| T-052 | `interpolatePath` via `flubber` (MIT) for SVG path morph | M |
| T-053 | Audio-utils — `audioVisualizer` hook (Web Audio, lazy-loaded) | M |
| T-054 | Public API audit + freeze before Phase 3 | S |
| **T-055 [new]** | **`useMediaSync(ref, { offsetMs, durationMs })`** — imperatively drives `<video>`/`<audio>` `.currentTime` to match `FrameClock` during scrub. Debounced during rapid scrub; play/pause lifecycle based on whether mediaWindow contains currentFrame. Tests: 60-step scrub; media time tracks within ±1 frame | M |

---

## Phase 3 — Runtime Contract + Core Live Runtimes (Week 15–18)

**Status**: ✅ **Ratified 2026-04-21.** All 11 tasks merged (T-060–T-069, T-072). Exit criteria met: 5 concrete live-tier runtimes registered via `@stageflip/runtimes-contract` (css, gsap, lottie, shader, three) plus `frame-runtime-bridge`; 7 demo clips with JSON parity-fixture manifests under `packages/testing/fixtures/`; FontManager blocks editor render on font readiness via `useFontLoad`. CDP-side font pre-embedding + `--font-render-hinting=none` deferred to T-084a (Phase 4); PNG reference-frame generation deferred to T-100 (Phase 5).
**Goal**: Open the creative ceiling via pluggable runtimes.
**Exit criteria**: 5 runtimes registered; each with demo clip + parity fixture; FontManager blocks render on font readiness.

| ID | Task | Size |
|---|---|---|
| T-060 | `ClipRuntime` contract + registry (tier: live/bake) | M |
| T-061 | `frame-runtime-bridge` — wraps frame-runtime as ClipRuntime | M |
| T-062 | `css` runtime (static, no animation) | S |
| T-063 | `gsap` runtime — timeline seek, pause-on-init; demo clip `motion-text-gsap` | L |
| T-064 | `lottie` runtime (lottie-web MIT); demo clip `lottie-logo` | M |
| T-065 | `shader` runtime — WebGL fragment shaders. **All shader wrappers prepend `precision highp float;` — lint rule rejects shaders without explicit precision declaration.** Demo: `flash-through-white`, `swirl-vortex`, `glitch` | L |
| T-066 | `three` runtime; demo clip `three-product-reveal` | L |
| T-067 | One parity fixture per runtime's demo clip (reference frames at t=0, mid, end) | L |
| T-068 | `skills/stageflip/runtimes/{css,gsap,lottie,three,shader}/SKILL.md` | L |
| T-069 | `skills/stageflip/clips/authoring/SKILL.md` | M |
| **T-072 [new]** | **`FontManager` subsystem**: `@stageflip/runtimes/contract` declares `FontRequirement[]`; RIR compiler aggregates across document; editor runtime blocks canvas render on `document.fonts.ready` AND explicit `FontFace.load()` per declared family; CDP export runtime pre-embeds via `@fontsource` base64 and verifies via `document.fonts.check`. `--font-render-hinting=none` for consistency | M |

---

## Phase 4 — Vendored CDP Engine + Export Dispatcher (Week 19–22)

**Status**: ✅ **Ratified 2026-04-21.** All 13 tasks merged (T-080–T-091, including T-084a [new] and T-083/T-088/T-089 [rev]). Exit criteria met: 3 reference fixtures render end-to-end through real puppeteer-core + real ffmpeg + ffprobe (see `@stageflip/renderer-cdp` `reference-render.e2e.test.ts`; 203 tests total in the package); zero Remotion imports (237 files scanned); asset preflight rewrites remote URLs to `file://` with loss-flag fallback for refs the resolver refuses. T-083 escalation (`docs/escalation-T-083.md`) resolved in-phase — B1+B2+B3(a). Deferred to Phase 5/12: BeginFrame-based deterministic capture (T-100), real host HTML bundle (T-100), concrete bake runtime (Phase 12), Firebase Storage `ArtifactStore` adapter, CDP font pre-embedding. See `docs/handover-phase4-complete.md` for the full closeout.
**Goal**: Deterministic headless render to MP4/MOV/WebM.
**Exit criteria**: `stageflip render` produces valid MP4 from a fixture document; no Remotion imports; asset preflight resolves all remote URLs to `file://` before capture.

| ID | Task | Size |
|---|---|---|
| T-080 | Vendor `@hyperframes/engine` into `packages/renderer-cdp/vendor/`; pin commit | M |
| T-081 | `NOTICE` file (Apache-2.0 attributions) | S |
| T-082 | `packages/renderer-cdp/vendor/README.md` — what's vendored, why, modifications | S |
| **T-083 [rev]** | **Live-tier CDP adapter** — single adapter module consuming `findClip(kind)` from `@stageflip/runtimes-contract`; wraps a CDP-controlled browser session; exposes `renderFrame(compositionId, frame) → Buffer` via `BeginFrame`. All 6 registered live runtimes share this single code path (no per-kind branching in the adapter). Two-pass bake orchestration moved into T-089. Resolves the vendored engine's `@hyperframes/core` transitive dep by reimplementing the two helpers (`quantizeTimeToFrame`, `MEDIA_VISUAL_STYLE_PROPERTIES`) in `renderer-cdp/src/` and patching the engine's `src/index.ts` with a `// Modified by StageFlip` header (first exercise of the T-081 modification protocol). See `docs/escalation-T-083.md` | L |
| T-084 | Export dispatcher — reads RIR, orchestrates capture loop, handles async bake jobs in preflight phase | L |
| **T-084a [new]** | **Asset preflight** — before capture loop: walk RIR, collect all `AssetRef`s (images, videos, audio, fonts, Lottie JSON); download/cache all to local disk keyed by content hash; rewrite RIR URLs to `file://` paths. Unsupported sources (YouTube embeds, arbitrary iframes): rasterize at preflight via Puppeteer screenshot, OR fail fast with loss-flag | M |
| T-085 | FFmpeg integration: H.264, H.265, VP9, ProRes 4444 (alpha); CRF knobs. System FFmpeg via child_process; `doctor` command validates install | L |
| T-086 | Video-frame pre-extraction at export time (adapted from vendored engine) | M |
| T-087 | Audio mixer wiring (parse tracks, mix via FFmpeg filters, mux) | M |
| **T-088 [rev]** | **Export artifact storage** — `ArtifactStore` interface + `InMemoryArtifactStore` + `LocalFsArtifactStore` (this PR). Firebase Storage adapter deferred (mirrors the T-035..T-039 Firebase deferral from Phase 1); non-blocking. | M |
| **T-089 [rev]** | **Bake-runtime scaffolding** — queue/cache interfaces **+ two-pass bake orchestration interface** (offline bake → cached artifact → live-tier playback); no concrete implementation (Phase 12 fills). Two-pass moved here from T-083 per `docs/escalation-T-083.md`. | M |
| T-090 | Reference render tests: 3 fixture documents → MP4; ffprobe verifies | M |
| T-091 | `skills/stageflip/reference/export-formats/SKILL.md` | M |

---

## Phase 5 — Parity Harness + Pre-Render Linter (Week 23–25)

**Status**: ✅ **Ratified 2026-04-22.** All 11 tasks merged (T-100 family × 5, T-101, T-102, T-103, T-104, T-107; T-105 + T-106 carried to Phase 6 as T-137 + T-138 per v1.5 changelog). Exit criteria met on the core harness + linter + CI gate work: `pnpm parity --fixtures-dir packages/testing/fixtures` exits 0 across all 5 fixtures (structural today — skipped `no-candidates` / `no-goldens`; priming deferred to a future tooling task); `@stageflip/validation` ships 33 lint rules across 7 categories with `ALL_RULES.length >= 30` asserted in the runner suite. All 10 gates green on `main` at `75defb4`: typecheck, lint, test (1047 cases across 21 test-active packages), check-licenses (482 deps), check-remotion-imports (281 files), check-skill-drift, skills-sync:check, check-determinism (21 files), size-limit (frame-runtime 19.52 kB, cdp-host-bundle 313.82 kB / 500 kB budget), parity. Zero escalations raised this phase. See `docs/handover-phase5-complete.md` for the full closeout.

**Goal**: Quality enforced, not aspirational.
**Exit criteria**: CI parity stage green on 5 fixtures × 2 backends; pre-render linter catches all 30+ test violations.

| ID | Task | Size |
|---|---|---|
| **T-100 [rev]** | **Parity harness** — **PSNR + SSIM** (via `ssim.js` MIT). Per-fixture thresholds: PSNR ≥ configured, SSIM ≥ 0.97 on text-heavy regions. Max frame-failure budget | M |
| **T-100b** | **BeginFrame capture** — wire `HeadlessExperimental.beginFrame` into `PuppeteerCdpSession`. Closes the screenshot→non-determinism gap from handover §6.1. `captureMode: 'auto' \| 'beginframe' \| 'screenshot'`, auto selects BeginFrame on Linux + chrome-headless-shell + successful probe, falls back silently otherwise. Reimpl (not import) of the narrow BeginFrame call so the test-fake seam stays cheap; matches T-083 B3a pattern. Split out from T-100 post-review on PR #13 | M |
| **T-100c** | **Host contract + smart placeholder** — extend `CdpSession.mount` to carry the `RIRDocument`; extend `HostHtmlBuilder` context with `document`; add `richPlaceholderHostHtml` that renders non-clip RIR elements (text, shape) with frame-reactive visibility via inline DOM. No React bundle, no runtime registration — clips still render as labelled placeholders. Foundation for T-100d | M |
| **T-100d** | **Runtime bundle host — scaffold + CSS runtime** — new `@stageflip/cdp-host-bundle` package: Vite-emitted browser IIFE bundling React + `runtimes-css` + a composition renderer. Proves the pattern; clip kinds from CSS render correctly; other runtime kinds degrade to a labelled placeholder box | M |
| **T-100e** | **Runtime bundle host — add GSAP / Lottie / Shader / Three / frame-runtime-bridge** — extends the T-100d bundle to register all 6 live runtimes. Bundle size balloons past 1 MB; packaged with a doctor check that flags oversized bundles | M |
| T-101 | Parity CLI: `pnpm parity [<fixture>]` | M |
| T-102 | Define fixture format + 5 starter fixtures (one per runtime tier) | M |
| T-103 | Parity CI integration (runs on PRs touching rendering code) | M |
| T-104 | Pre-render linter — 30+ rules (timing, duration, theme slots, raw hex, stale bindings, etc.) adapted from Hyperframes linter | L |
| T-107 | `skills/stageflip/workflows/parity-testing/SKILL.md` + `reference/validation-rules/SKILL.md` (auto-gen) | M |

**Carried over to Phase 6** (handover 2026-04-21): T-105 (visual-diff
viewer) + T-106 (auto-fix passes). Both depend on T-104's rule
surface + T-100's `ScoreReport` shape, both of which shipped this
phase. They were deferred because Phase 5's core (parity harness,
bundle host, linter, CI gate) was complete without them — shipping
T-105/T-106 rounds out tooling but doesn't unblock any downstream
phase. Renumbered / carried as T-137 / T-138 in Phase 6.

---

## Phase 6 — Slide Migration (Greenfield Shell + Component Port) (Week 26–33)

**[rev]** Approach changed from copy-and-rip to greenfield-shell-and-port. This is safer and more reviewable.

**Status**: ✅ **Ratified 2026-04-24.** All 41 in-scope tasks merged (T-119 render-e2e family + T-120–T-138 + T-139a/b/c + T-140 hygiene sweep). Exit criteria met: (1) `@stageflip/import-slidemotion-legacy` ships a 34-case converter with structured warnings + final `documentSchema.parse()` gate (T-130); (2) `apps/stageflip-slide` reaches SlideMotion parity via the greenfield shell (T-121–T-128 + T-133) + remaining-component ports (T-129 first tranche + T-139a/b/c's nine deferred surfaces). All 9 gates green on `main` at `85d632a`: typecheck, lint, test (~2218 cases across 24 test-active packages + `app-slide`'s 11 Playwright specs), check-licenses (490 deps), check-remotion-imports (535 files / 0 matches), check-determinism (57 files), check-skill-drift, skills-sync:check, size-limit (frame-runtime 19.52 kB, cdp-host-bundle 367.33 kB); parity structural green (goldens still deferred). Zero escalations raised this phase. Parity goldens (§5.2), bake-tier dispatcher (§5.3), small follow-ups (§5.5) carry forward to Phase 7 as tooling work per `docs/handover-phase6-complete.md` — non-blocking for exit criteria.

**Goal**: Build new shell against new RIR/frame-runtime greenfield; port SlideMotion UI components one at a time.
**Exit criteria**: `apps/stageflip-slide` achieves parity with current SlideMotion editor; existing SlideMotion documents migrate via `@stageflip/import-slidemotion-legacy`.

| ID | Task | Size |
|---|---|---|
| **T-120 [rev]** | **Audit existing SlideMotion editor** at `reference/slidemotion/apps/editor/` — inventory of components, hooks, atoms, shortcuts. Output: `docs/migration/editor-audit.md` listing every component + port priority | M |
| **T-121a [new]** | **Shortcut registry + `ShortcutRegistryProvider`** in `packages/editor-shell`. `Shortcut` + `KeyCombo` types, `matchesKeyCombo(event, combo)` matcher (Mod→Cmd/Ctrl, platform detection, modifier parsing), `useRegisterShortcuts(list)` + `useAllShortcuts()` hooks, one global keydown listener with input-target suppression for bare-key combos. API-compatible port of the SlideMotion ShortcutRegistry (`reference/slidemotion/apps/editor/src/shortcuts/`, our IP). Tests-first. Zero UI; pure framework. Unblocks every port that registers shortcuts | M |
| **T-121b [new]** | **Jotai atoms + DocumentContext/AuthContext shells** in `packages/editor-shell`. 11 atoms per T-120 audit §2 (`documentAtom`, `slideByIdAtom(id)`, `elementByIdAtom(id)`, `activeSlideIdAtom`, `selectedElementIdsAtom`, `selectedSlideIdsAtom`, `selectedElementIdAtom`, `undoStackAtom`, `redoStackAtom`, `canUndoAtom`, `canRedoAtom`) written against the new RIR document shape. Hand-rolled Map-cache memoized factories (no `atomFamily`). Thin `DocumentProvider`/`useDocument()` adapter (20+ actions) + `AuthProvider`/`useAuth()` shell (no Firebase yet; interface-only). **Subsumes T-132** — T-132 removed. Tests-first | M |
| **T-121c [new]** | **Shell composition** in `packages/editor-shell` — `<EditorShell>` root composing ShortcutRegistryProvider + DocumentProvider + AuthProvider; `localStorage` persistence adapter (load/save document JSON by docId, autosave debounce hook); i18n catalog scaffold (`en` + `pseudo` locales, `t(key)` helper) seeded with the ~170 keys from `reference/slidemotion/apps/editor/src/i18n/catalog.ts`. No Next.js; consumable by any React 19 host. Zero UI beyond provider tree. Tests-first | M |
| **T-122 [rev]** | **Walking skeleton `apps/stageflip-slide`** — Next.js 15 app that mounts editor-shell, renders blank canvas, wires agent. Minimal but end-to-end working | L |
| **T-123a [new]** | **SlideCanvas viewport** — port the main canvas viewport: scale-to-fit against a fixed 1920×1080 reference, scroll/pan container, read-only render of `Element[]` for the active slide (no selection overlay, no drag/resize, no text editing yet). Consumes atoms from T-121b (`activeSlideIdAtom`, `slideByIdAtom`). Renders each element's `transform` into a positioned `<div>`; per-type content renderers are minimal (text → span, shape → SVG, image → `<img>`, others → placeholder). Replaces the `reference/slidemotion/apps/editor/src/components/SlideCanvas.tsx` viewport shell. Wires into `apps/stageflip-slide` by swapping the walking-skeleton blank SVG for `<SlideCanvas />`. Tests-first | M |
| **T-123b [new]** | **SelectionOverlay + transform handles** — port the bounding-box overlay that tracks selected elements: 8 drag handles (4 corners, 4 edges), a rotation handle above the top edge, and a move-cursor in the center. Commits mutations via `useDocument().updateDocument`. Ports `reference/.../SelectionOverlay.tsx`. Interactions produce per-frame `transform` updates on the element; history capture is deferred to T-133. Tests exercise a headless happy-dom pointer-drag → assert the element's transform in the atom. Tests-first | M |
| **T-123c [new]** | **InlineTextEditor + TextSelectionToolbar** — port the contenteditable overlay that replaces a selected text element's static render on double-click + commits on blur/Enter; floats the `TextSelectionToolbar` (bold/italic/underline/link) above the caret while editing. Ports `reference/.../InlineTextEditor.tsx` + `reference/.../TextSelectionToolbar.tsx`. Toolbar buttons write via `updateDocument` against the element's `runs[]` (T-120 audit §1). Tests-first | M |
| **T-123d [new]** | **`<SlidePlayer>` for in-canvas preview** — reimplement the Remotion-based `SingleSlidePreview` / `PlayerPreview` from `reference/slidemotion/` via `@stageflip/frame-runtime` + the `@stageflip/runtimes-contract` registry. **Zero Remotion imports** (CLAUDE.md §3). Renders the compiled RIR document at a given `currentFrame`, plays/pauses against `requestAnimationFrame`, and exposes a scrubber prop for the timeline panel (T-126) to drive. Integration test mounts the player against a 3-slide fixture and asserts frame=0 vs frame=mid PSNR > threshold. Tests-first; biggest reimplementation lift in the T-123 family | M |
| **T-124 [rev]** | Port UI component 2: Filmstrip | M |
| **T-125a [new]** | **PropertiesPanel router + `SelectedElementProperties` + `SlideProperties` stubs** — the "nothing selected / element selected / slide selected" branching shell with element-type-routed child dispatch. Renders position/size/opacity fields for any selected element (no Zod introspection yet — hand-rolled inputs for the ~6 universal fields on `ElementBase`); SlideProperties shows id, background, duration, notes read-only. Ports the outer shell of `reference/slidemotion/apps/editor/src/components/PropertiesPanel.tsx`. Unblocks T-125b/c by providing the mount point and the router contract. Tests-first. Does NOT ship ZodForm, ChartEditor, TableEditor, AnimationPicker | M |
| **T-125b [new]** | **ZodForm auto-inspector + introspect module** — reflective form generator: walks a Zod schema and emits inputs for primitives (string, number, boolean, enum), nested objects, arrays, discriminated unions. Ports `reference/slidemotion/apps/editor/src/components/zodform/` (~800 lines). Separate introspect module because Zod's `_def` structure is nontrivial to walk safely; isolating it makes the form-rendering side trivially testable against synthetic schemas. Slots into the PropertiesPanel router from T-125a under `ClipElementProperties` so clips auto-inspect from `ClipDefinition.propsSchema`. Tests-first. Biggest lift in the T-125 family | M |
| **T-125c [new]** | **ChartEditor + TableEditor + AnimationPicker** — three domain editors slotted into the PropertiesPanel router from T-125a for their specific element types. ChartEditor renders series rows with label + values + color; TableEditor renders a cell grid with row/column add/remove; AnimationPicker presents a preset gallery over `@stageflip/schema`'s animation union. Ports the three corresponding files from `reference/slidemotion/apps/editor/src/components/` (~400 LOC each). Tests-first. Could L-split further if scope balloons at the end | M |
| **T-126 [rev]** | Port UI component 4: TimelinePanel | M |
| **T-127 [rev]** | Port UI component 5: Command palette + tool search | M |
| **T-128 [rev]** | Port UI component 6: AI copilot sidebar + streaming | M |
| **T-129 [rev]** | Port remaining components. **First tranche shipped**: searchable `<ShortcutCheatSheet>` (keyed on `useAllShortcuts`, `?` shortcut), `<StatusBar>` (slide + element counts). **Deferred tranches** now tracked under **T-139a/b/c** (spawned 2026-04-23, see v1.11 changelog) rather than as post-Phase-6 follow-ups — orchestrator review ruled them load-bearing for the Phase 6 parity exit criterion. Collaboration UI remains a Phase 7+ concern once `@stageflip/collab` lands | L |
| T-130 | `@stageflip/import-slidemotion-legacy` — one-way converter old schema → new schema with mode='slide' | M |
| **T-131 [split]** | 33 SlideMotion clips ported to new ClipRuntime (with themeSlots); each clip registered + parity fixture. Pre-split into a/b/c/d/e by runtime tier per `docs/handover-phase6-mid-3.md` §5.2 — single-PR scope was prohibitive. **Discovery during T-131a**: every reference clip uses `useCurrentFrame` / `interpolate` / `spring`, so the css tier ships fresh demonstrator clips rather than reference ports; reference clips move to T-131b (frame-runtime-bridge) and downstream tiers | L |
| **T-131a [new]** | **`runtimes-css` tier + `themeSlots` contract addition**. Add `ThemeSlot` type + `themeSlots?` field to `ClipDefinition` and `resolveClipDefaultsForTheme(clip, theme, props)` helper in `@stageflip/runtimes-contract`. Ship `gradient-background` as a fresh demonstrator clip in `@stageflip/runtimes-css` exercising `propsSchema` + `themeSlots` (`from → palette.primary`, `to → palette.background`). Parity fixture `css-gradient-background.json` registered. Reference-port descope documented above; no SlideMotion clips ported in this sub-task | M |
| **T-131b [split]** | **`runtimes-frame-runtime-bridge` tier — 14 clips total, sub-split into b.1/b.2/b.3 by clip complexity per the same multi-tranche pattern as T-129**. Each clip rewritten against `@stageflip/frame-runtime` (no Remotion imports), registered, parity fixture | L |
| **T-131b.1 [new]** | **Light tranche — 5 clips**: counter, kinetic-text, typewriter, logo-intro, chart-build. Each ported file ≤ ~150 LOC of source; pure interpolate + cubicBezier (no spring). Includes `defineFrameClip` extension to forward `propsSchema` + `themeSlots` (mirroring T-131a's `defineCssClip` change), an `ALL_BRIDGE_CLIPS` barrel constant, parity fixtures, KNOWN_KINDS allowlist updates, and cdp-host-bundle registration | M |
| **T-131b.2 [new]** | **Medium tranche — 5 clips**: subtitle-overlay, light-leak, pie-chart-build, stock-ticker, line-chart-draw. SVG-heavy; karaoke-style word stagger (subtitle-overlay), seeded sin/cos animated blobs (light-leak — off-palette by design, no themeSlots), per-segment SVG stroke-dasharray reveal (pie + line), candlestick rendering with per-bar stagger (stock-ticker). Extends `ALL_BRIDGE_CLIPS` | M |
| **T-131b.3 [new]** | **Heavy tranche — 4 clips**: animated-value (spring count-up primitive + non-clip `AnimatedProgressBar` / `AnimatedProgressRing` building blocks), kpi-grid (composes `AnimatedValue` with per-card spring stagger + trend markers), pull-quote (spring-scaled mark + typewriter + attribution slide-in), comparison-table (two-column slide-in rows). Closes T-131b — `ALL_BRIDGE_CLIPS` now exposes 14 clips across b.1/b.2/b.3 | M |
| **T-131c [scope-zero]** | **`runtimes-gsap` tier — confirmed scope-zero**. Exhaustive grep across the entire `reference/slidemotion/` tree (not just `clips/`) found zero `import` from `gsap` / `@gsap/*` / `TweenLite` / `TweenMax`. Every reference clip ports to the bridge (T-131b family) instead. The runtime exists (`@stageflip/runtimes-gsap`) and ships `motion-text-gsap` as the canonical demo (T-067) — it remains available for future hand-authored clips that benefit from GSAP timelines / SplitText / MotionPath, but no SlideMotion reference clip uses it. Plan row kept (vs deleted) to preserve the audit trail | S |
| **T-131d [split]** | **lottie/three/shader tier — 5 clips originally; mid-task discovery rerouted scope**. Survey of the 5 reference clips found the tier label was named-driven, not deps-driven: `scene-3d` is pure CSS-3D with no three.js, `particles` is seeded RNG with no special libs, `shader-bg` is an escape-hatch that takes GLSL via props, `lottie-player` imports `@remotion/lottie` (forbidden), `animated-map` imports `mapbox-gl` (license + heavyweight dep). Sub-split below. | M |
| **T-131d.1 [new]** | **Bridge-eligible portion — 2 clips**: `scene-3d` (CSS-3D transforms — cube/sphere/torus/pyramid) + `particles` (confetti/sparkles/snow/rain/bokeh, seeded LCG, no `Math.random`). Both land in `runtimes-frame-runtime-bridge` rather than the originally-named tiers. `ALL_BRIDGE_CLIPS` now exposes 16 clips total. Parity fixtures + KNOWN_KINDS extension included | M |
| **T-131d.2 [shipped]** | **`shader-bg` (escape-hatch GLSL clip)**. `defineShaderClip`'s `fragmentShader` field now accepts `string | ((props) => string)` — the function form is the user-shader variant and defers validation to render-time. `ShaderClipHost` silent-fallbacks on compile/link failure so a malformed deck prop doesn't crash the slide. Also adds `propsSchema` + `themeSlots` passthrough to `defineShaderClip` (matching the T-125b + T-131a pattern established on `defineCssClip` / `defineFrameClip`) | M |
| **T-131d.3 [shipped]** | **`lottie-player`** — prop-driven Lottie playback via the already-pinned `lottie-web` (MIT). Reuses `LottieClipHost` (`autoplay:false` + `goToAndStop(ms, false)`) for the determinism posture. Deliberately accepts **inline** `animationData` only (object or JSON string) — URL fetching lives outside the clip to keep the determinism scope clean. Falls back to an animated placeholder (three concentric pulsing rings) when no data is provided. Hand-rolled `ClipDefinition` rather than extending `defineLottieClip`, because that factory bakes `animationData` at define time and this clip needs it at render time | M |
| **T-131d.4 [shipped]** | **`animated-map`** — ported as the **SVG-fallback path only**. Reference's `mapbox-gl` real-tiles branch deliberately omitted: network tile fetches + imperative `useEffect` DOM mutation violate frame-runtime determinism invariants; gating a deck on a Mapbox account token is also the wrong posture for a bridge-tier preview clip. The SVG fallback is what the reference itself renders whenever no token is supplied — grid + animated dashed route line + eased camera center/zoom pan + pulse ring around the advancing dot. Zero new deps → no `THIRD_PARTY.md` change. Real Mapbox stays a Phase 7+ bake-tier question (a separate `animated-map-real` clip that pre-renders tiles during export), explicitly out of scope here. Closes reference-clip coverage at 32/32; `ALL_BRIDGE_CLIPS` → 31 | M |
| **T-131e [split]** | **bake tier — 4 clips**: video-background, gif-player, audio-visualizer-reactive, voiceover-narration. Sub-split into e.0/e.1/e.2 following the multi-tranche pattern from T-131b/d/f once the media-host prerequisite surfaced (handover-phase6-mid-4 §5.1). Wiring a concrete `BakeRuntime` + app-slide dispatcher tracked separately; the four clips themselves render bridge-style via `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>` with the bake path swapping in pre-rendered artifacts during export | L |
| **T-131e.0 [new]** | **Media-host prerequisite** — `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>` wrappers in `@stageflip/frame-runtime` backed by existing `useMediaSync`. Video / audio wrappers delegate playback-clock sync to the hook; the image wrapper is a window-gated mount (no `.currentTime` on `<img>`). Unblocks T-131f.4 (audio-visualizer real-audio variant) as a side-effect | S |
| **T-131e.1 [shipped]** | **Video / image tranche — 2 clips**: `video-background` + `gif-player`. Both port against the `<FrameVideo>` / `<FrameImage>` surface from T-131e.0. `ALL_BRIDGE_CLIPS` now exposes 22 clips. Parity fixtures + KNOWN_KINDS extension + cdp-host-bundle clip-count test updated. Deterministic export still blocks on the bake-tier dispatcher (tracked separately) — this PR only ships the bridge-style preview path | M |
| **T-131e.2 [shipped]** | **Audio tranche — 2 clips**: `voiceover-narration` (text+SVG viz with an **optional** `audioUrl` prop that mounts a hidden `<FrameAudio>` — extends the reference which had no `<Audio>`) + `audio-visualizer-reactive` (real-audio variant of T-131f.1's simulated viz; drives bars from `useAudioVisualizer`'s live AnalyserNode on a FrameClock-synced `<audio>` element). Mid-task discovery: `useAudioVisualizer` already exists in `@stageflip/frame-runtime` and is sufficient for the bridge preview path — no `useWindowedAudioData` analogue needed in this tranche; adding one is a follow-up only if the bake path ever needs pre-decoded window samples. Sub-exports of `BarsViz` / `WaveViz` / `CircularViz` added to T-131f.1's `audio-visualizer.tsx` for reuse. `ALL_BRIDGE_CLIPS` now exposes 24 clips | M |
| **T-131f [split]** | **Bridge-eligible clips not covered by T-131b**. Mid-task discovery during T-131c confirmation: of the 32 clips in `reference/.../clips/registry.ts`, T-131b family covers 14, T-131d.1 covers 2, the deferred T-131d.2/.3/.4 + T-131e cover 7 — leaving **9 clips** un-planned. Audit-driven catch-up; sub-split below. | L |
| **T-131f.1 [new]** | **Bridge standalones — 4 clips**: `code-block` (own minimal tokenizer; intentionally fixed editor look, no themeSlots), `image-gallery` (crossfade slideshow), `timeline-milestones` (sweeping progress dot + per-milestone spring pop), `audio-visualizer` (simulated bar/wave/circular viz; **no-audio path only** — real-audio variant defers to T-131f.4 because reference imports Remotion's `<Audio>`). `ALL_BRIDGE_CLIPS` exposes 20 clips after this lands | M |
| **T-131f.2 [shipped]** | **Dashboard composites — 5 clips** chosen Option B (flat-prop interface per clip). **f.2a** shipped `hr-dashboard` + `marketing-dashboard`. **f.2b** shipped `product-dashboard` (4 modes: sprint_review/release_notes/roadmap/metrics_dashboard; inline Sparkline helper) + `okr-dashboard` (4 modes: dashboard/objective_detail/team_comparison/roadmap; `ObjectiveCard` sub-component inlined with SVG circular progress ring). **f.2c** shipped `sales-dashboard` — composite with inlined private `PipelineFunnel` / `ForecastChart` / `DealCard` sub-components, 5 `pipelineType` modes (funnel / forecast / deal_review / quarterly_review / win_loss); sort/density/show-deal-cards controls via optional `settings`. `ALL_BRIDGE_CLIPS` now exposes 29 clips | M |
| **T-131f.3 [shipped]** | **Financial statement composite**: `financial-statement` clip. Three sub-components (KpiStrip / StatementTable / CommentsRail) inlined as module-private helpers since single-consumer. Flat-prop Zod schema over `periods[]` + `rows[]` + optional `comments[]` + `settings`. Supports three `statementType` archetypes (pnl / balance_sheet / cash_flow), density-aware row heights + comment caps, negative-number rendering (parentheses / red / minus), variance columns (absolute + percent), and semantic-role-keyed KPI extraction. `toLocaleString('en-US', …)` used with the locale argument explicitly pinned — deterministic. `ALL_BRIDGE_CLIPS` now exposes 30 clips | M |
| **T-131f.4 [folded-into-e.2]** | **`audio-visualizer` real-audio reactive variant** — shipped as the `audio-visualizer-reactive` kind in T-131e.2 (#73). Row retained for audit trail. The plan originally held this as a separate follow-up because it needed a non-Remotion `<Audio>` wrapper — that wrapper landed in T-131e.0 (`<FrameAudio>`); T-131e.2 then built the reactive clip on top of `useAudioVisualizer` (already in frame-runtime from T-053) rather than the `useWindowedAudioData` analogue the plan anticipated | M |
| T-133 | Undo/redo via fast-json-patch | M |
| T-134 | Branding pass: StageFlip.Slide logo, copy, CSS vars. Abyssal Clarity preserved | M |
| T-135 | `skills/stageflip/modes/stageflip-slide/SKILL.md` final | M |
| T-136 | E2E Playwright regression: new deck / add slide / edit text / preview / undo+redo chain / element delete. **Export PNG descoped** — no export button exists in app-slide today; `@stageflip/renderer-cdp` has its own PNG e2e via the T-119 reference-render suite, which covers the render path at the package boundary. Wiring a full Export-PNG UI flow would balloon T-136; tracked as a follow-up on the Phase 6 post-exit list | M |
| **T-137 [shipped]** | **Visual diff viewer** — `stageflip-parity report` subcommand on `@stageflip/parity-cli`. Renders a self-contained HTML artifact with three view modes per frame (side-by-side / slider / CSS `mix-blend-mode: difference` overlay), per-frame PSNR/SSIM readouts, threshold recap, and skip banners for `no-goldens` / `no-candidates` / `missing-frames` fixtures. Pure `renderViewerHtml` generator (no IO) + `buildViewerInput` orchestrator (injectable `PngReader` port) + `runReport` CLI wrapper dispatched via `stageflip-parity report`. PNGs are base64-embedded → the HTML file is portable (emailable, PR-attachable). Pixel-level PSNR/SSIM heatmaps deferred — the handover mentioned them as aspirational but the plan row's "side-by-side / slider / overlay" is what shipped; per-pixel heatmaps require block-level SSIM access in `@stageflip/parity` (future follow-up) | M |
| **T-139 [split]** | **T-129 deferred tranches — ported from `reference/slidemotion/` to `packages/editor-shell` / `apps/stageflip-slide`**. Spawned 2026-04-23 after orchestrator review of the draft Phase 6 closeout ruled the nine deferred UI surfaces load-bearing for the Phase 6 parity exit criterion. Pre-split into three M-sized rows (T-139a/b/c) following the v1.8/v1.9/v1.10 L-split convention — single-PR scope covering all nine surfaces would be prohibitive. Parallelizable after T-139a lands (its context-menu primitive is the only cross-row dependency, consumed by T-139b's asset-browser right-click + T-139c's find-replace match navigation). Each sub-row ships skill updates (`skills/stageflip/modes/slide/` surface docs) + tests-first + i18n strings via the T-121c catalog + shortcut registrations via T-121a | L |
| **T-139a [new]** | **Context-menu framework + contextual/persistent toolbars**. Three-part UI-primitive foundation: (1) `<ContextMenuProvider>` + `useContextMenu()` hook in `packages/editor-shell/src/context-menu/` — right-click dispatch keyed on a registry pattern analogous to `useRegisterShortcuts` (T-121a), supports nested submenus + keyboard navigation + i18n labels via the T-121c catalog; (2) `<PersistentToolbar>` — top-of-canvas toolbar always mounted, shows global actions (new slide, undo/redo, zoom, present) keyed on selection state from T-121b atoms; (3) `<ContextualToolbar>` — element-type-routed toolbar that floats near selection (text: font/size/align; shape: fill/stroke; image: crop/filter) and routes via the same dispatch pattern as T-125a's PropertiesPanel. Reference sources: `reference/slidemotion/apps/editor/src/components/{ContextMenu,PersistentToolbar,ContextualToolbar}.tsx` + their subdirectories. Tests-first; unblocks T-139b/c's right-click + selection-toolbar entry points | M |
| **T-139b [new]** | **Asset browser + import dialogs (Google Slides / PPTX / image upload) + export dialog**. Media-I/O cluster sharing file-picker + thumbnail + modal-shell plumbing: (1) `<AssetBrowser>` panel in `packages/editor-shell/src/assets/` — browsable grid of images/videos/audio keyed on a Jotai `assetsAtom` (new, lives alongside T-121b atoms), drag-to-canvas wire-up via the existing canvas-drop handler, right-click uses T-139a's context menu. (2) Three import dialogs under `packages/editor-shell/src/dialogs/import/`: `GoogleSlidesImport` (OAuth token + deck-ID input → `@stageflip/import-slidemotion-legacy`-style converter, T-130 extended or new package if scope argues), `PptxImport` (file picker → PPTX parser → RIRDocument; likely a new `@stageflip/import-pptx` package), `ImageUpload` (file picker → `assetsAtom` append). (3) `ExportDialog` — triggers the existing render pipeline from inside the editor (resolution + format + range selectors wired to `@stageflip/renderer-cdp`). Reference sources: `reference/slidemotion/apps/editor/src/components/{AssetBrowser,ImportDialog,ExportDialog}/`. Tests-first. Depends on T-139a for right-click entry; otherwise independent of T-139c | M |
| **T-139c [new]** | **Find/replace + onboarding + cloud-save panel + presentation mode**. Remaining surfaces — independent modals + app-lifecycle: (1) `<FindReplace>` dialog in `packages/editor-shell/src/dialogs/find-replace/` — searches across every text element in the document atom, highlights matches via a new `findHighlightsAtom` layered on the canvas, navigation arrows scroll + select next/prev match, replace-all walks the document through `fast-json-patch` (reusing T-133's undo infra). (2) `<Onboarding>` flow — first-run detection via T-121c's localStorage adapter, guided tooltip sequence over the core shell. (3) `<CloudSavePanel>` — status indicator + manual-save + conflict-resolution UI; backend is a stub `CloudSaveAdapter` interface (real impl is Phase 12's `@stageflip/collab`). (4) `<PresentationMode>` — full-screen player using T-123d's `<SlidePlayer>`, keyboard nav (arrows + esc), speaker-notes side panel. Reference sources: `reference/slidemotion/apps/editor/src/components/{FindReplace,Onboarding,CloudSave,Presentation}/`. Tests-first. Depends on T-139a (find-replace uses context-menu for match actions); otherwise independent of T-139b | M |
| **T-138 [shipped]** | **Auto-fix passes (10) with iterative convergence** — `LintRule` gains optional `fix(document, findings): RIRDocument \| null` method. New `autoFixDocument(doc, opts)` orchestrator in `@stageflip/validation` runs up to 10 passes (default), each pass = lint → fix-all-applicable-rules → re-lint. Stops when `converged` (no rule produced a change) or `hitMaxPasses`. Initial + final `LintReport` both exposed on the result for diffing. 10 rules gained fixes: `element-rotation-within-reasonable-range` (normalise into (-360, 360]), `composition-dimensions-even-for-video` (round up to even), `stacking-map-covers-all-elements` (populate from element.stacking), `stacking-value-matches-element` (sync map to element), `text-font-size-reasonable` (clamp to [1, 2000]), `video-playback-rate-reasonable` (clamp to [0.25, 4]), `video-trim-ordered-when-present` (swap start/end), `embed-src-uses-https` (rewrite `http://` → `https://`), `font-requirement-covers-text-families` (add family), `font-requirement-weights-cover-text-weights` (add weight). Rules without a deterministic safe repair (e.g. `text-color-is-valid-css`, `shape-custom-path-has-path`) intentionally omit `fix` — their findings persist to the final report. `skills-sync` validation-rules generator updated to surface an Auto-fix column. Carried from Phase 5 (was T-106) | L |
| **T-119 [new]** | **CI render-e2e job** — new `render-e2e` job on `ubuntu-latest` behind the existing `dorny/paths-filter` rendering scope. Installs `chrome-headless-shell` via Puppeteer's browser cache + `ffmpeg`/`ffprobe` via `apt-get`. Flips `@stageflip/renderer-cdp`'s `reference-render.e2e.test.ts` from silent-skip to green on CI (3 fixtures × real Puppeteer + real ffmpeg + real ffprobe, already passing locally). Uploads the 3 MP4s as artifacts for operator inspection. Structurally resolves handover-phase5 §6.2. No new package, no new CLI — just `.github/workflows/ci.yml` + minor docs | M |
| **T-119b [rev]** | **`stageflip-parity prime` subcommand — orchestrator + REFERENCE_FIXTURES render path.** Pure `primeFixture(path, renderFn, fsOps)` orchestrator in `@stageflip/parity-cli` with a `PrimeRenderFn` port (unit-tested against a fake render + in-memory fs). CLI subcommand `stageflip-parity prime` wires up a real Puppeteer-backed renderer using `PuppeteerCdpSession` + `createRuntimeBundleHostHtml` from `@stageflip/cdp-host-bundle`, rendering the 3 hand-coded `RIRDocument` fixtures from `@stageflip/renderer-cdp`'s `REFERENCE_FIXTURES` to PNGs on disk. Proves the full render-to-PNG pipeline end-to-end; **does not** render the 5 parity fixtures in `packages/testing/fixtures/` because no `FixtureManifest` → `RIRDocument` converter exists yet (see T-119d). Scope narrowed from the v1.6 entry after mid-task discovery that the shape gap is real — v1.6 implicitly assumed a converter that doesn't exist | M |
| **T-119c [new]** | **Wire `stageflip-parity prime` into CI as artifact step + operator workflow docs** — extends the T-119 job with a post-render step that invokes the prime subcommand against `REFERENCE_FIXTURES`, uploads the generated PNG set as a `parity-goldens-reference-<sha>` artifact, and never commits. Operators download, inspect, and commit via a normal PR. Updates `parity-testing/SKILL.md` with the "priming in CI" section. Unblocks handover-phase5 §6.1 **for the reference set**; the parity-fixture set waits on T-119d | S |
| **T-119d [new]** | **`manifestToDocument(manifest)` converter** — new pure function in `@stageflip/testing` (or a new `@stageflip/fixture-compile` package if scope argues for it) that takes a `FixtureManifest` + returns a `RIRDocument` suitable for `PuppeteerCdpSession.mount`. Hand-assembles a single-clip document: composition → doc-level fields, `{runtime, kind, props}` + clip window → one `clip`-content element with deterministic id + transform + timing. Zod-validates via `rirDocumentSchema`; parity fixtures then become renderable via T-119b's orchestrator. Once this lands, T-119b's CLI gains a `--parity` flag that renders the 5 parity fixtures in addition to REFERENCE_FIXTURES, and T-119c's CI artifact grows to include the parity-golden set. **This is the piece that actually unblocks §6.1 for parity goldens** — T-119b/c unblock it only for the reference set | M |

---

## Phase 7 — Agent + Semantic Tools (Week 34–38)

**Status**: ✅ **Ratified 2026-04-24.** All 21 in-scope tasks merged (T-150–T-170). Exit criteria met: (1) `create_deck_from_prompt` wired end-to-end — `POST /api/agent/execute` runs Planner → Executor → Validator and returns `{ plan, events, finalDocument, validation }` when `ANTHROPIC_API_KEY` is set (503 `not_configured` otherwise); (2) 108 tools registered across 14 handler bundles (target ≥80); (3) I-9 (≤30 tools per loaded context) enforced by `BundleLoader` at runtime + a drift-gate test per bundle. All 10 gates green on `main` at `7f02b50`. Engine: 32 test files / 340 tests. Agent: 8 test files / 67 tests. App-slide: 40 test files / 322 tests. Zero escalations raised. Carry-forward follow-ups (non-blocking for exit criteria) per `docs/handover-phase7-complete.md`: streaming events from `/api/agent/execute` (blocks fully live copilot UX), copilot `document` plumbing (currently 400s until submitted with a document), bake-tier dispatcher (§5.3 from Phase 6), parity-goldens priming (§5.2).

**Goal**: AI plane — Planner + Executor + Validator over hierarchical tool bundles.
**Exit criteria**: `create_deck_from_prompt` end-to-end; 80+ tools registered; ≤30 tools in any agent context.

| ID | Task | Size |
|---|---|---|
| T-150 | `@stageflip/llm-abstraction` — providers (Claude primary, Gemini, OpenAI); streaming; function-calling | M |
| T-151 | Planner agent — emits PlanStep[]; selects required bundles | L |
| **T-151a [new]** | **Hierarchical tool-bundle loader** — meta-tools `list_bundles`, `load_bundle(name)`, `expand_scope(bundle)`. Planner reasons over bundles (~14, each 5–10 tools). Executor runs with only loaded bundles. Enforces I-9: ≤30 tools in context. Skill: `concepts/tool-bundles/SKILL.md` | M |
| T-152 | Executor agent — tool-call loop, streaming events, AbortController | L |
| **T-153 [rev]** | Validator agent — **programmatic PSNR+SSIM diff gates quality tier**; LLM used only for qualitative checks (brand voice, aesthetics, claim verification, reading level). Skill: `concepts/agent-validator/SKILL.md` documents the boundary | L |
| T-154 | `@stageflip/engine/tool-router` — dispatch by name; Zod-validate I/O | M |
| T-155 | Handler bundle 1: read (5 tools) | M |
| T-156 | Handler bundle 2: create/mutate (8) | M |
| T-157 | Handler bundle 3: timing (4) | M |
| T-158 | Handler bundle 4: layout (5) | M |
| T-159 | Handler bundle 5: validate (4) | M |
| T-160 | Handler bundle 6: clip/animation (14) | L |
| T-161 | Handler bundle 7: element CM1 (12) | L |
| T-162 | Handler bundle 8: slide CM1 + accessibility (6) | M |
| T-163 | Handler bundle 9: table CM1 (6) | M |
| T-164 | Handler bundle 10: QC/export/bulk (9) | M |
| T-165 | Handler bundle 11: fact-check (2) | M |
| T-166 | Handler bundle 12: domain finance/sales/OKR (27) | L |
| T-167 | Handler bundle 13: data-source bindings (2) | M |
| T-168 | Handler bundle 14: semantic layout (4) | M |
| T-169 | Auto-gen `skills/stageflip/tools/*/SKILL.md` from registry | M |
| T-170 | Wire orchestrator into `apps/stageflip-slide` AI copilot | S |

---

## Phase 8 — StageFlip.Video (Week 39–46)

**Status**: ✅ **Ratified 2026-04-24.** All 10 in-scope tasks merged (T-180–T-189) across 20 PRs (split into a/b/c where appropriate); `main` at `b9b15bf`. Exit criteria met: (1) prompt → 3-aspect render wired end-to-end — `/api/agent/execute` in `apps/stageflip-video` runs the shared `runAgent` from the new `@stageflip/app-agent` package (T-187b/c); `bounce_to_aspect_ratios` (T-185) plans the variants and `exportMultiAspectInParallel` (T-186) renders them with collect-all error handling and configurable concurrency; (2) captions pipeline — `@stageflip/captions` (T-184a/b) ships both the `TranscriptionProvider` contract + mock and the real OpenAI Whisper provider, with deterministic SHA-256 content-hash caching and word→segment packing. 3 new packages (`@stageflip/captions`, `@stageflip/export-video`, `@stageflip/app-agent`); canonical tool bundles 14 → 15 (`video-mode` added); 108 → 109 registered tools; parity fixtures 41 → 47 (6 new T-188 video manifests); bridge clips 31 → 37 (3 overlay + 3 motion video-profile clips via T-183a/b). All 10 gates green: typecheck · lint · test, parity, render-e2e, e2e (Playwright smoke), check-licenses, check-remotion-imports, check-determinism, check-skill-drift, skills-sync:check, gen:tool-skills:check. Zero escalations raised. Carries forward to Phase 9 (non-blocking for exit criteria per `docs/handover-phase8-complete.md`): video-app UI completeness (timeline panel + aspect-bouncer mount + AI copilot port), T-188 goldens priming, bake-tier dispatcher (§5.3 from Phase 6), streaming events from `/api/agent/execute`, captions ±100 ms CI gate (methodology in place; goldens-level measurement deferred).

**Goal**: Video ad + social video product.
**Exit criteria**: Render 30s ad across 3 aspect ratios from prompt; captions sync ±100ms.

| ID | Task | Size |
|---|---|---|
| T-180 | `@stageflip/profiles/video` — element types, clips, tools, validation rules | L |
| T-181 | Editor-shell: horizontal timeline with tracks (visual/audio/caption/overlay) | L |
| T-182 | Aspect-ratio bouncer UI (preview 9:16 / 1:1 / 16:9 simultaneously) | M |
| T-183 | Video clips: hook-moment, product-reveal, endslate-logo, lower-third, beat-synced-text, testimonial-card | L |
| T-184 | `@stageflip/captions` — Whisper API integration | L |
| T-185 | Mode tool: `bounce_to_aspect_ratios` | M |
| T-186 | Export multi-aspect variants in parallel | M |
| T-187 | `apps/stageflip-video` Next.js app | L |
| T-188 | 5+ parity fixtures (audio-sync, captions, video overlays, aspect-bounce) | M |
| T-189 | `skills/stageflip/modes/stageflip-video/SKILL.md` | M |

---

## Phase 9 — StageFlip.Display (Week 47–52)

**Status**: ✅ **Ratified 2026-04-24.** All 10 in-scope tasks merged (T-200–T-209) across 12 PRs (T-202 + T-203 each split a/b); `main` at `ec62013`. Exit criteria met: (1) three canonical IAB sizes (300×250 + 728×90 + 160×600) planned from a single display document — `DISPLAY_CANONICAL_SIZES` in `@stageflip/profiles-display` (T-200) enumerates; `<BannerSizeGrid>` in editor-shell (T-201) renders synced previews; `exportHtml5Zip` (T-203b) emits one ZIP per size; (2) 150 KB cap enforced per ZIP via `DISPLAY_FILE_SIZE_BUDGETS_KB.iabInitialLoadKb` and the T-203b budget gate after T-205 optimizer passes (unused-CSS + inline-JS + image-plugin seam); (3) IAB/GDN validator (T-208) asserts clickTag, HTTPS asset URLs, ad.size meta, backup image, initial-load cap; (4) fallback assets (T-204 midpoint-frame PNG + animated GIF via `gifenc`) embedded in the ZIP. 2 new packages (`@stageflip/profiles-display`, `@stageflip/export-html5-zip`); canonical tool bundles 15 → 16 (`display-mode` added: `optimize_for_file_size` + `preview_at_sizes`); 109 → 111 registered tools; bridge clips 37 → 42 (3 attention-tranche + 2 data-tranche display clips). Parity fixtures unchanged at 47 (display-mode manifests deferred — carry-forward). All gates green: typecheck · lint · test, parity, render-e2e, e2e (Playwright smoke), check-licenses, check-remotion-imports, check-determinism, check-skill-drift, skills-sync:check, gen:tool-skills:check. Zero escalations raised. Carries forward to Phase 10 (non-blocking for exit criteria per `docs/handover-phase9-complete.md`): display-app UI completeness (AI copilot port + Playwright smoke on port 3300 + `lintDocument` mount), display parity-fixture priming, image-optimizer plug-in licensing decision (sharp is LGPL-3.0), bake-tier dispatcher (§5.3 from Phase 6), streaming events from `/api/agent/execute`, captions ±100 ms CI gate, T-188 video goldens, IAB polite-load enforcement.

**Goal**: IAB/GDN-compliant HTML5 banners.
**Exit criteria**: 300×250 + 728×90 + 160×600 from one template; each <150 KB; IAB/GDN validators green.

| ID | Task | Size |
|---|---|---|
| T-200 | `@stageflip/profiles/display` — dimensions, click-tags, fallback, budgets | L |
| T-201 | Editor-shell: multi-size canvas grid (synced scrub across sizes) | M |
| T-202 | Display clips: click-overlay, countdown, product-carousel, price-reveal, cta-pulse | L |
| T-203 | `@stageflip/export-html5-zip` — IAB-compliant ZIP + clickTag + fallback inlined | L |
| T-204 | Fallback generator (static PNG + animated GIF from midpoint frame) | M |
| T-205 | File-size optimizer (strip unused CSS, minify JS, sharp optimize images) | M |
| T-206 | Mode tools: `optimize_for_file_size`, `preview_at_sizes` | M |
| T-207 | `apps/stageflip-display` Next.js app | L |
| T-208 | IAB/GDN compliance validator rules | M |
| T-209 | `skills/stageflip/modes/stageflip-display/SKILL.md` | M |

---

## Phase 10 — Skills + MCP + Distribution (Week 53–56)

**Goal**: Publishable agent plugin.
**Exit criteria**: `claude plugin install stageflip` installs + connects + usable.
**Status**: ✅ **All 12 tasks merged** (T-220 → T-231) as of 2026-04-25, `main` at `e40ee8c`. Closeout handover at `docs/handover-phase10-complete.md`. Ratification pending at P11 start per CLAUDE.md §2 + memory:phase_closeout_timing.

| ID | Task | Size |
|---|---|---|
| T-220 | `@stageflip/skills-sync` — all generators (clips catalog, tools index, runtimes index, validation rules, CLI reference) | L |
| T-221 | Skills review pass — every SKILL.md against four non-negotiables (one-screen, examples-over-prose, cross-linked, single-source-of-truth) | L |
| T-222 | `@stageflip/mcp-server` wraps semantic tools via `@modelcontextprotocol/sdk` | L |
| T-223 | MCP auth flow (OAuth → JWT → local config) | M |
| T-224 | `@stageflip/plugin` manifest bundling skills + MCP registration | M |
| T-225 | `apps/cli` — all commands in user manual §4 | L |
| T-226 | Auto-generate `reference/cli/SKILL.md` from CLI command registry | S |
| T-227 | npm publish `@stageflip/{plugin,mcp-server,cli}` via Changesets | S |
| T-228 | Docs site (mdx over skills tree) + quickstart | M |
| T-229 | API Admin SDK integration + auth middleware | M |
| T-230 | Firebase hosting rules per app | S |
| T-231 | Cloud Run render worker deployment | M |

---

## Phase 11 — Importers (Week 57–62)

| ID | Task | Size |
|---|---|---|
| T-240 | `@stageflip/import-pptx` — ZIP + PresentationML parser | L |
| **T-241a [new]** | **PPTX nested group transform accumulator** — walk group tree accumulating transforms; apply to leaf children. #1 source of OOXML parse failures | M |
| T-242 | 50+ preset geometries + custom SVG paths | L |
| T-243 | PPTX asset extraction (images, videos, fonts) → Firebase Storage | M |
| T-244 | `@stageflip/import-google-slides` — OAuth + Slides API v1 | L |
| T-245 | Shape rasterization (crop from thumbnails for unsupported shapes) | M |
| T-246 | AI-QC loop (Gemini multimodal convergence) | L |
| T-247 | `@stageflip/import-hyperframes-html` — parse data-* → canonical; reverse direction too | M |
| T-248 | Loss-flag reporter — every import emits flags; editor surfaces UI | M |
| T-249 | `@stageflip/design-system` — 8-step theme learning pipeline | L |
| T-250 | `skills/stageflip/workflows/import-*/SKILL.md` | M |

---

## Phase 12 — Collab + Hardening + Blender (Ongoing)

| ID | Task | Size |
|---|---|---|
| T-260 | ChangeSets + CRDT (Yjs) sync layer. Storage delta methods (T-025) finally exercised in prod | L |
| T-261 | Presence (cursors, selection) via Realtime Database | M |
| T-262 | Auth + org tenancy | L |
| T-263 | API rate limiting per user / org / key | M |
| T-264 | OpenTelemetry + Sentry observability | M |
| T-265 | `@stageflip/runtimes/blender` — bake-tier ClipRuntime; worker Docker + GPU drivers; BullMQ queue | L |
| T-266 | Render farm deployment (CoreWeave/Paperspace/self-host) | L |
| T-267 | Stripe billing + usage metering | L |
| T-268 | Security review + pentest | L |
| T-269 | Load testing (K6) | M |
| T-270 | `@stageflip/storage-postgres` — proves abstraction holds (Supabase) | M |
| T-271 | EU Firestore region for GDPR data residency | M |
| T-272 | Backup + point-in-time recovery | M |
| T-273 | BigQuery telemetry export | M |

## Phase 13 — Premium Motion Library & Frontier Runtime (Three Parallel Tracks)

115 tasks across three parallel tracks. Reference ADRs: ADR-003 (interactive runtime tier), ADR-004 (preset system), ADR-005 (frontier clip catalogue) — **all three ratified 2026-04-25**. PR template: `.github/pr-templates/phase-13.md`.

**Capacity priority**: Phase 11 (Importers) takes precedence for active capacity. Phase 13 is structurally parallel but should not starve P11; Implementer agents picking up T-304+ should confirm with the Orchestrator that P11 is not blocked.

**Hard gate**: T-301 / T-302 / T-303 (the three ADRs) — ratified 2026-04-25. After the ADR PRs merge to `main`, three tracks (A: frontier runtime, B: preset library, C: supporting plumbing) run in parallel.

**Sign-off changes**: parity fixtures ship per cluster batch with **product-owner sign-off** (not Reviewer-only). Type-design-consultant agent (`skills/stageflip/agents/type-design-consultant/SKILL.md`) batch-reviews Clusters A / B / D / F / G fallback fonts; preset PRs in those clusters link to the batch.

### Phase α — Primitives (Hard Gate)

| ID | Task | Size |
|---|---|---|
| T-301 | ADR-003: Interactive Runtime Tier | S |
| T-302 | ADR-004: Preset System | S |
| T-303 | ADR-005: Frontier Clip Catalogue | S |
| T-304 | `packages/schema/src/presets/` — preset schema primitive (loader + validator + frontmatter parser) | M |
| T-305 | Interactive-clip contract — `staticFallback` + `liveMount` schema; export-matrix hooks | M |
| T-306 | `packages/runtimes/interactive/` — runtime tier skeleton + permission shim + contract tests | M |
| T-307 | Font-license registry — `packages/schema/src/presets/font-registry.ts` + `check-licenses` extension | M |
| T-308 | `scripts/check-preset-integrity.ts` — new CI gate; green on main before any preset PR | M |
| T-309 | Extended `check-determinism` — exempt interactive tier; add shader-uniform sub-rule | M |
| T-310 | Extended `check-skill-drift` — covers presets + cluster skills | S |
| T-311 | Type-design-consultant agent invocation tooling (Orchestrator-side) | M |
| T-312 | CLAUDE.md §6 amendment — preset interpretation + type-design escalation paths (already landed in scaffold; this task verifies + adds tests) | S |
| T-313 | Parity-fixture auto-generation pipeline + reviewer / user sign-off workflow | M |

### Phase β — Preset Library (Track B, parallel with γ after α)

**β-core (loader + ingest tooling)**

| ID | Task | Size |
|---|---|---|
| T-314 | Compass ingest tooling (markdown → preset frontmatter generator) | S |
| T-315 | Cluster-skill template + generator | S |

**β-gap-clips (block dependent clusters; T-321 starts as soon as α4 (T-304) is done)**

| ID | Task | Size | Blocks |
|---|---|---|---|
| T-316 | `CaptionClip` (word-level timed; highlight / stroke / bounce) | L | Cluster F presets |
| T-317 | `SubscribeButton` | M | Cluster G |
| T-318 | `FollowPrompt` | M | Cluster G |
| T-319 | `QRCodeBounce` | M | Cluster G |
| T-320 | `VARBanner` (sports breaking sub-type) | M | Cluster B sports presets |
| T-321 | `TitleSequenceClip` (multi-shot compositor) — start at α4 done | L | Cluster D presets |
| T-322 | `LyricsClip` (music-synced, distinct from caption) | M | Cluster F karaoke |

**β-cluster-A (News, 8 presets + skill)**

| ID | Task | Size |
|---|---|---|
| T-323 | Preset: `cnn-classic` (lowerThird) | M |
| T-324 | Preset: `cnn-breaking` (breakingBanner, red block wipe) | M |
| T-325 | Preset: `bbc-reith-dark` (lowerThird) | M |
| T-326 | Preset: `al-jazeera-orange` (lowerThird, bilingual) | M |
| T-327 | Preset: `fox-news-alert` (breakingBanner, vertical slide) | M |
| T-328 | Preset: `msnbc-big-board` (fullScreen interactive) | L |
| T-329 | Preset: `netflix-doc-lt` (no-bg lowerThird) | S |
| T-330 | Preset: `apple-tv-lt` (minimalist lowerThird) | S |
| T-331 | Cluster-A skill + `compose_breaking_news` / `compose_ongoing_update` / `compose_guest_intro` / `compose_documentary_title_card` | M |

**β-cluster-B (Sports, 8 presets + skill)**

| ID | Task | Size |
|---|---|---|
| T-332 | Preset: `f1-timing-tower` (scoreBug vertical) | L |
| T-333 | Preset: `premier-league-field-of-play` (scoreBug) | M |
| T-334 | Preset: `fox-nfl-no-chrome` (scoreBug) | M |
| T-335 | Preset: `nbc-snf-possession-illuminated` (scoreBug) | M |
| T-336 | Preset: `cricket-scorebug` (top scoreBug) | L |
| T-337 | Preset: `wimbledon-green-purple` (scoreBug) | M |
| T-338 | Preset: `masters-red-under-par` (standings) | M |
| T-339 | Preset: `uefa-starball-refraction` (fullScreen) | L |
| T-339a | Preset: `espn-bottomline-flipper` (newsTicker, persistent two-line flipper) — added v1.18 to bring cluster B to 9 presets and total to 50 | M |
| T-340 | Cluster-B skill + `compose_sports_score` / `compose_player_intro` / `compose_var_call` / `compose_standings_table` | M |

**β-cluster-C (Weather, 6 presets + skill)**

| ID | Task | Size |
|---|---|---|
| T-341 | Preset: `twc-immersive-mixed-reality` (fullScreen, ThreeSceneClip) | L |
| T-342 | Preset: `twc-retrocast-8bit` (fullScreen) | M |
| T-343 | Preset: `bbc-mark-allen-clouds` (weatherMap) | M |
| T-344 | Preset: `nhc-cone-of-uncertainty` (stormTracker, mandatory disclaimer) | M |
| T-345 | Preset: `doppler-dbz-standard` (weatherMap) | M |
| T-346 | Preset: `heat-map-cool-to-warm` (weatherMap) | M |
| T-347 | Cluster-C skill + `compose_weather_alert` / `compose_forecast_map` / `compose_storm_track` / `compose_temperature_map` | M |

**β-cluster-D (Titles, 6 presets + skill; depends on T-321)**

| ID | Task | Size |
|---|---|---|
| T-348 | Preset: `stranger-things-benguiat` (titleSequence) | L |
| T-349 | Preset: `got-trajan-clockwork` (titleSequence, ThreeSceneClip) | L |
| T-350 | Preset: `squid-game-geometric` (titleSequence) | M |
| T-351 | Preset: `true-detective-double-exposure` (titleSequence) | L |
| T-352 | Preset: `succession-home-video` (titleSequence) | L |
| T-353 | Preset: `severance-surreal-3d` (titleSequence, ThreeSceneClip) | L |
| T-354 | Cluster-D skill + `compose_title_sequence` / `compose_segment_open` / `compose_end_credits` | M |

**β-cluster-E (Data, 6 presets + skill; depends on T-406 chart family)**

| ID | Task | Size |
|---|---|---|
| T-355 | Preset: `magic-wall-drilldown` (fullScreen, LiveDataClip) | L |
| T-356 | Preset: `bloomberg-ticker` (newsTicker, LiveDataClip) | M |
| T-357 | Preset: `olympic-medal-tracker` (standings, LiveDataClip) | M |
| T-358 | Preset: `cricket-ball-by-ball-dots` (scoreBug annex) | S |
| T-359 | Preset: `f1-sector-purple-green` (bigNumber) | S |
| T-360 | Preset: `big-number-stat-impact` (bigNumber count-up) | M |
| T-361 | Cluster-E skill + `compose_live_data` / `compose_market_ticker` / `compose_election_board` / `compose_big_number` / `compose_stat_callout` | M |

**β-cluster-F (Captions, 6 presets + skill; depends on T-316 + T-322)**

| ID | Task | Size |
|---|---|---|
| T-362 | Preset: `hormozi-montserrat-black` (caption) | M |
| T-363 | Preset: `mrbeast-komika-axis` (caption) | M |
| T-364 | Preset: `tiktok-rounded-box` (caption) | M |
| T-365 | Preset: `ali-abdaal-opacity-karaoke` (caption) | M |
| T-366 | Preset: `netflix-invisible` (caption, strict accessibility) | M |
| T-367 | Preset: `karaoke-progressive-wipe` (lyrics; depends on T-322) | M |
| T-368 | Cluster-F skill + `compose_creator_caption` / `compose_subtitle` / `compose_lyric_video` / `compose_keyword_highlight` | M |

**β-cluster-G (CTAs, 5 presets + skill; depends on T-317 / T-318 / T-319)**

| ID | Task | Size |
|---|---|---|
| T-369 | Preset: `youtube-subscribe-bounce` (subscribeButton) | M |
| T-370 | Preset: `tiktok-follow-pulse` (followPrompt) | M |
| T-371 | Preset: `instagram-link-sticker` (socialMedia) | M |
| T-372 | Preset: `coinbase-dvd-qr` (qrCodeBounce) | M |
| T-373 | Preset: `social-handle-lower-third` (lowerThird) | S |
| T-374 | Cluster-G skill + `compose_cta` / `compose_subscribe_prompt` / `compose_social_handle` / `compose_qr_bounce` | M |

**β-cluster-H (AR, 4 presets + skill; depends on `ThreeSceneClip` (T-384))**

| ID | Task | Size |
|---|---|---|
| T-375 | Preset: `sky-sports-ar-formations` (arOverlay) | L |
| T-376 | Preset: `hawkeye-var-3d-skeletal` (arOverlay) | L |
| T-377 | Preset: `olympic-swim-lane-track` (arOverlay) | L |
| T-378 | Preset: `nba-ar-replay` (arOverlay) | L |
| T-379 | Cluster-H skill + `compose_ar_overlay` / `compose_var_skeletal` / `compose_swim_lane_track` | M |

**β-closers (parity + type-design sign-off)**

| ID | Task | Size |
|---|---|---|
| T-380 | Parity fixtures generated + signed off — Clusters A / B / C / D (user sign-off per cluster) | L |
| T-381 | Parity fixtures generated + signed off — Clusters E / F / G / H (user sign-off per cluster) | L |
| T-382 | Type-design-consultant batch reviews merged for Clusters A / B / D / F / G | M |

### Phase γ — Frontier Runtime (Track A, parallel with β after α)

**γ-core (shaders + 3D + permission + variant)**

| ID | Task | Size |
|---|---|---|
| T-383 | `ShaderClip` primitive + uniform-updater determinism sub-rule | L |
| T-384 | `ThreeSceneClip` wrapper (seeded PRNG, frame-tick, `rAF` shim) | L |
| T-385 | Permission envelope (mic / network / camera UX + enforcement) | M |
| T-386 | Fast variant-generation mode (size × message × locale matrix over RIR) | L |

**γ-live (live clip pairs: liveMount + staticFallback per clip type)**

| ID | Task | Size |
|---|---|---|
| T-387 | `VoiceClip` — `liveMount` (Web Audio + MediaRecorder + transcript) | M |
| T-388 | `VoiceClip` — `staticFallback` (waveform poster) | S |
| T-389 | `AiChatClip` — `liveMount` (scoped LLM) | M |
| T-390 | `AiChatClip` — `staticFallback` (captured transcript) | S |
| T-391 | `LiveDataClip` — `liveMount` (endpoint fetch + chart) | M |
| T-392 | `LiveDataClip` — `staticFallback` (cached value via chart) | S |
| T-393 | `WebEmbedClip` — `liveMount` (sandboxed iframe + allowlist) | M |
| T-394 | `WebEmbedClip` — `staticFallback` (poster screenshot) | S |
| T-395 | `AiGenerativeClip` — `liveMount` (playback-time prompt slot) | M |
| T-396 | `AiGenerativeClip` — `staticFallback` (curated example) | S |

**γ-deploy (three deployment targets)**

| ID | Task | Size |
|---|---|---|
| T-397 | `renderer-cdp` interactive hosting | M |
| T-398 | Browser live-preview integration | M |
| T-399 | On-device display player — runtime shim | L |
| T-400 | On-device display player — packaging + distribution | L |
| T-401 | On-device display player — ops + telemetry | M |

**γ-gating (flag + security)**

| ID | Task | Size |
|---|---|---|
| T-402 | Feature flag + admin toggle (`features.interactive: disabled / preview / ga`) | M |
| T-403 | Pre-preview security review (covers all of Track A) | L |
| T-404 | Security hardening pass (response to T-403 findings) | L |
| T-405 | Security sign-off for GA (recorded on ADR-005 ratification block) | S |

### Phase γ-supporting (Track C, parallel)

| ID | Task | Size |
|---|---|---|
| T-406 | Chart clip family (deterministic SVG, frame-driven) — blocks Cluster E | L |
| T-407 | `arrange_reveal` semantic tool (staggered headline → body → media) | M |
| T-408 | Export matrix routing — MP4 / PPTX → static; HTML / display-interactive → live | M |
| T-409 | CI: preset × export parity job (cross-product matrix) | M |

### Phase δ — Lock-in

| ID | Task | Size |
|---|---|---|
| T-410 | GA readiness checklist pass | M |
| T-411 | Enterprise admin flows (tenant-level frontier enablement) | M |
| T-412 | Documentation pass (user-manual + skill index) | M |
| T-413 | Phase 13 closeout handover (per memory: write at P14 start) | S |
| T-414 | Phase 13 ratification checkpoint | S |

### Dependency Gates (Phase 13)

- **T-301 / T-302 / T-303** → block all of T-304+
- **T-304** → T-321 (TitleSequenceClip)
- **T-305** → all `liveMount` tasks (T-387 / T-389 / T-391 / T-393 / T-395)
- **T-316** → T-362 → T-367 (Cluster F presets)
- **T-320** → relevant Cluster B sports presets needing VAR sub-type
- **T-321** → T-348 → T-353 (Cluster D presets)
- **T-322** → T-367 (karaoke-progressive-wipe)
- **T-384** → Cluster H presets (T-375 → T-378)
- **T-406** → Cluster E presets (T-355 → T-360)
- **T-403** → T-402 GA mode (preview mode does not gate on security review)
- **T-380 / T-381** → cluster merge (user sign-off required)
- **T-382** → preset PRs in Clusters A / B / D / F / G (PR fails `check-preset-integrity` without batch review link)

---

# PART C — Reference Material

## C.1 Starter `package.json` Template

```jsonc
{
  "name": "@stageflip/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --dts --format esm,cjs",
    "dev": "tsup src/index.ts --dts --format esm,cjs --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check src"
  }
}
```

## C.2 Starter `tsconfig.json` Template

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

## C.3 PR Template

```markdown
## Task
T-XXX — [title]

## Summary
One-paragraph description.

## Skills Read (Reviewer verifies)
- [ ] skills/stageflip/…
- [ ] skills/stageflip/…

## Acceptance Criteria
- [ ] [copied from task spec]

## Quality Gates
- [ ] `pnpm typecheck` green
- [ ] `pnpm lint` green
- [ ] `pnpm test` green; coverage ≥ 85% on new code
- [ ] `pnpm check-licenses` green
- [ ] `pnpm check-remotion-imports` green
- [ ] `pnpm check-determinism` green
- [ ] `pnpm check-skill-drift` green
- [ ] Bundle size within budget (if applicable)
- [ ] Parity harness passes (if applicable)

## Determinism Audit
- Any `Date.now()` / `Math.random()` / `performance.now()` / `fetch()` / `requestAnimationFrame` / timers in runtime/clip code? **No / Yes (explain)**

## License Audit
- New dependencies? List with license.

## Prior Art Read
- URLs/paths read; confirm no code copied.

## Linked Issues
Closes #...
```

## C.4 Orchestrator Kickoff Prompt (Phase-Start)

```
You are the Orchestrator for Phase {N} of StageFlip.

1. Open docs/implementation-plan.md. Locate Phase {N}.
2. For each task, verify dependencies are merged to main.
3. Build dependency graph; identify parallelizable batches.
4. For each batch:
   a. Assign each task to an Implementer using Implementer Prompt Template (A.3)
      wrapping the task-specific prompt.
   b. When CI green, assign Reviewer using A.4.
   c. When Reviewer approves, assign Verifier using A.5.
   d. On verify pass, merge to main.
5. If task exceeds 3× estimate OR two Implementer↔Reviewer cycles without
   converging, escalate to human with: summary, exact sticking point, options
   considered, recommended decision.
6. At phase end, run exit-criteria checks; present to human for ratification
   before starting Phase {N+1}.

Rules:
- Never skip dependencies.
- Never assign the same agent instance as Implementer + Reviewer for one task.
- Never merge PR with failing CI or unaddressed Reviewer comments.
- Changeset on every PR touching a publishable package.
```

## C.5 Decision Log

`docs/decisions/` — one ADR per major decision. Mandatory ADR for:
- Choice of storage backend / adapter
- Runtime kind additions
- Export format additions
- Schema breaking changes
- License additions requiring review
- New external dep >100 KB bundle impact

## C.6 License Whitelist

See `THIRD_PARTY.md`.

## C.7 Parity Fixture Format

```
tests/fixtures/<category>/<name>/
├── document.json             # CanonicalDocument input
├── fixture.parity.json       # { psnrThreshold, ssimThreshold, maxFrameFailures, frames[] }
├── meta.json                 # { category, tags, description, owner }
├── expected/frame-NNNN.png
└── expected-artifacts/       # optional: pptx, pdf, video outputs
```

## C.8 Dependency Graph (Critical Path)

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──┬──► Phase 4 ──► Phase 5
                │                             │                   │
                └──► Storage (T-025+) ────────┘                   │
                                                                   ▼
                                              Phase 6 ◄──── (uses Phase 5)
                                                │
                                                ▼
                                              Phase 7 ──► Phase 8 ──► Phase 9
                                                          │
                                                          └──► Phase 11
                                                                 │
                                                                 ▼
                                                              Phase 10
                                                                 │
                                                                 ▼
                                                              Phase 12
```

## C.9 Success Metrics (End of Phase 10, First Beta)

| Metric | Target |
|---|---|
| Remotion imports | 0 |
| `pnpm check-licenses` | Green |
| Skills ↔ source drift | 0 |
| Parity fixtures | ≥ 20 green |
| Export formats | video × 5 codecs, PPTX, PDF raster+vector, HTML5 ZIP, PNG, Marp |
| Test coverage | ≥ 85% per non-app package |
| Editor bundle | ≤ 500 KB gz |
| Frame-runtime bundle | ≤ 25 KB gz |
| `stageflip doctor` | Green on macOS / Linux / WSL |
| End-to-end prompt → rendered video | < 3 min for 30s ad on reference HW |
| `claude plugin install stageflip` | Works |

## C.10 Changelog

- **v1.18** (2026-04-25): **Phase 13 ADRs ratified.** ADR-003 (Interactive Runtime Tier), ADR-004 (Preset System), ADR-005 (Frontier Clip Catalogue) all ratified by product owner 2026-04-25; product-owner sign-off recorded on each. Engineering signoffs deferred to their respective implementation tasks (T-304 / T-308 for ADR-004; T-306 / T-309 for ADR-003; T-383 → T-401 for ADR-005). Security review (T-403) gates ADR-005 GA promotion only; preview enablement is unblocked. Hard-gate cleared — α primitives may proceed once the ADR PRs land on `main`. **ESPN BottomLine added** as `espn-bottomline-flipper` preset under Cluster B (newsTicker clip kind, T-339a), bringing cluster B to 9 presets and total to 50 (closing the v1.17 49-vs-50 gap). **Phase 10 (Skills + MCP + Distribution) closeout** at `docs/handover-phase10-complete.md`; all 12 in-scope tasks (T-220 → T-231) merged on `main` at `e40ee8c`. Phase 11 ratification of Phase 10 pending per CLAUDE.md §2 + memory:phase_closeout_timing. Phase 13 marked as structurally parallel but Phase 11 takes capacity priority — added inline comment in the Phase 13 section header to prevent P11 starvation.
- **v1.17** (2026-04-25): **Phase 13 scaffolded** (`plan/P13-scaffold` branch). 114 new tasks (T-301 → T-414) across three parallel tracks (A: frontier runtime, B: preset library 49 presets across 8 clusters + 7 gap clips, C: supporting plumbing). Three new ADRs proposed (ADR-003 Interactive Runtime Tier, ADR-004 Preset System, ADR-005 Frontier Clip Catalogue) form a hard gate before any code lands. New phase-13 PR template in `.github/pr-templates/`. New skill tree `skills/stageflip/presets/{news,sports,weather,titles,data,captions,ctas,ar}/` co-locating cluster `SKILL.md` + 49 preset stubs (frontmatter + compass-distilled bodies). New agent skill `skills/stageflip/agents/type-design-consultant/SKILL.md` batch-reviews font fallbacks for clusters A / B / D / F / G. CLAUDE.md §6 amended with two new escalation paths (preset compass disputes + "no adequate fallback"). Parity-fixture sign-off authority is the **product owner per cluster batch**, not Reviewer. Preset count is 49 (not 50 as initially scoped — A:8, B:8, C:6, D:6, E:6, F:6, G:5, H:4); discrepancy noted; can add a 50th in a follow-up if desired. No clip / runtime code lands in this scaffold; iteration 6 was scaffold-only. ADR ratification + Phase 13 implementation are separate PRs (one per ADR, then per-task as the standard three-agent workflow proceeds).
- **v1.16** (2026-04-24): **Phase 9 ratified.** All 10 in-scope tasks merged (T-200–T-209) across 12 PRs (T-202 + T-203 each split a/b) per `docs/handover-phase9-complete.md`; `main` at `ec62013`. Exit criteria met: (1) three canonical IAB banner sizes planned from a single display document (`@stageflip/profiles-display` `DISPLAY_CANONICAL_SIZES` + editor-shell `<BannerSizeGrid>` + `@stageflip/export-html5-zip` one-ZIP-per-size emission); (2) 150 KB initial-load cap enforced per ZIP via `DISPLAY_FILE_SIZE_BUDGETS_KB` + the T-203b budget gate applied after the T-205 optimizer pipeline (unused-CSS stripper + inline-JS minifier + image-optimizer plug-in seam); (3) IAB/GDN validator (T-208) asserts clickTag, HTTPS-only asset URLs, ad.size meta, backup image, initial-load cap; (4) fallback assets (T-204 midpoint-frame PNG + deterministic animated GIF via `gifenc` with pre-computed palette) embedded in the ZIP. 2 new packages (`@stageflip/profiles-display`, `@stageflip/export-html5-zip`); canonical tool bundles 15 → 16 (`display-mode` added with `optimize_for_file_size` + `preview_at_sizes`); 109 → 111 registered tools; bridge clips 37 → 42 (`click-overlay`, `countdown`, `cta-pulse`, `price-reveal`, `product-carousel`). Parity fixture catalog unchanged at 47 — display-mode manifests deferred to a non-blocking priming follow-up shared with the Phase 7/8 goldens carry. All gates green. Zero escalations raised. Next work: Phase 10 — Skills + MCP + Distribution (T-220–T-231); T-220 (`@stageflip/skills-sync` generator set) is foundational.
- **v1.15** (2026-04-24): **Phase 8 ratified** + **Phase 2 back-stamped.** Phase 8 (T-180–T-189) status flipped from implementation-complete per `docs/handover-phase8-complete.md` → ✅ Ratified 2026-04-24 after orchestrator verification: all 10 gates green on `main` at `b9b15bf`, prompt → 3-aspect render end-to-end, deterministic captions cache, 3 new packages (`@stageflip/captions` / `@stageflip/export-video` / `@stageflip/app-agent`), 15th canonical tool bundle (`video-mode`), 6 new video-profile clips + 6 new parity fixtures. Captions ±100 ms is methodology-complete (deterministic packing + SHA-256 cache); frame-by-frame CI measurement deferred to a non-blocking goldens-priming follow-up. **Phase 2 (Frame Runtime) back-stamp**: the ratification banner was never landed in the plan body despite `docs/handover-phase2-complete.md` documenting closeout + test + bundle evidence on `0463045` since 2026-04-21. Orchestrator directive (2026-04-24) explicitly waived the CLAUDE.md §2 human-ratification default for this single back-stamp; the banner is marked agent-ratified. Exit criteria confirmed with one documented caveat — dev-harness 60fps scrub is functionally complete but was never numerically measured (the FPS assertion was never wired). All 16 Phase 2 tasks (T-040–T-055, including T-043 [rev] + T-055 [new]) are on `main` and have been for three weeks of subsequent work; every downstream phase (3–8) treated Phase 2 as load-bearing with zero regressions. Phase 6's banner was stamped in v1.13 and is unchanged. Next work: Phase 9 — StageFlip.Display (T-200–T-209); T-200 in flight on PR #136.
- **v1.14** (2026-04-24): **Phase 7 ratified.** All 21 in-scope tasks merged (T-150–T-170). Three-agent triad (Planner + Executor + Validator) runs end-to-end through `/api/agent/execute`; all 14 handler bundles populated for a total of 108 registered tools (target ≥80); I-9 (≤30 tools per loaded context) enforced by `BundleLoader` at runtime with a per-bundle drift-gate test. All 10 gates green on `main` at `7f02b50` — typecheck · lint · test, parity, render-e2e, e2e Playwright, check-licenses (495 deps), check-remotion-imports (637 files / 0 matches), check-determinism (57 files), check-skill-drift, skills-sync:check, **gen:tool-skills:check (new — T-169)**, size-limit (frame-runtime 19.52 kB, cdp-host-bundle 367.33 kB). Engine tests: 32 files / 340 cases. Agent tests: 8 / 67. App-slide tests: 40 / 322. Monorepo-wide: ~2678 tests across 224 test files. Zero escalations raised. Notable additions beyond the handover's mid-phase plan: `scripts/gen-tool-skills.ts` auto-generates every per-bundle SKILL.md from the registry (T-169 became stricter — now the canonical source rather than a migration); `orchestrator.ts` in `apps/stageflip-slide/src/app/api/agent/execute/` wires the full triad with an env-guarded provider factory (`buildProviderFromEnv` → 503 `not_configured` when `ANTHROPIC_API_KEY` is unset). Carries to Phase 8 (non-blocking for exit criteria per `docs/handover-phase7-complete.md`): streaming events from `/api/agent/execute`, copilot `document` plumbing, bake-tier dispatcher (§5.3 from Phase 6), parity-goldens priming (§5.2). Next work: Phase 8 — StageFlip.Video.
- **v1.13** (2026-04-24): **Phase 6 ratified.** Status flipped from "⏳ Awaiting ratification 2026-04-23" → "✅ Ratified 2026-04-24" after orchestrator verification: all 9 gates green on `main` at `85d632a` (local re-run of licenses (490 deps) / remotion-imports (535 files / 0 matches) / determinism (57 files) / skill-drift / skills-sync; CI green on the T-140 merge for typecheck · lint · test · gates bundle + parity + render-e2e + e2e Playwright). Exit criteria confirmed met: legacy-import converter (T-130) and SlideMotion-parity editor (T-121–T-129 + T-139a/b/c + T-133 + T-140). Zero escalations raised. Follow-ups carried to Phase 7: §5.2 parity-goldens priming (tooling), §5.3 bake-tier dispatcher, §5.5 small cleanups — all non-blocking for exit criteria per `docs/handover-phase6-complete.md`. Next work: Phase 7 — Agent + Semantic Tools.
- **v1.12** (2026-04-23): Phase 6 implementation complete — T-139a/b/c all merged (#86 / #87 / #88) plus T-140 code-hygiene sweep (this PR). Phase 6 status flipped from "⏳ Blocked on T-139" → "⏳ Awaiting ratification 2026-04-23". The nine T-129 deferred surfaces now ship: context-menu framework + persistent/contextual toolbars (T-139a), asset browser + import/export dialogs (T-139b), find-replace + onboarding + cloud-save + presentation mode (T-139c). T-140 sweep addresses the seven hygiene follow-ups surfaced by the T-139a + T-139c reviewers (context-menu Escape consolidation, bare aria-label migration, monotonic slide-id counter, context-menu SKILL.md invariant doc, raw-addEventListener refactor across presentation-mode / modal-shell / context-menu-provider, find-replace context-menu key cleanup). `docs/handover-phase6-complete.md` updated; ratification pending orchestrator sign-off.
- **v1.11** (2026-04-23): **T-139 spawned** (L, pre-split into T-139a/b/c) to pick up the nine T-129 deferred tranches — asset browser, context-menu framework, contextual/persistent toolbars, export dialog, import dialogs (Google / PPTX / image upload), find/replace, onboarding, cloud-save panel, presentation mode. Orchestrator review of the draft Phase 6 closeout handover ruled these load-bearing for exit criterion 2 (`apps/stageflip-slide` parity with SlideMotion) rather than post-Phase-6 follow-ups. Phase 6 status flipped from "⏳ Awaiting ratification" → "⏳ Blocked on T-139". PR #84 (handover closeout) closed without merge; re-opens as a fresh closeout PR once T-139a–c land. **Split rationale**: one L-sized row covering nine surfaces would be PR-unreviewable. T-139a (context-menu framework + contextual/persistent toolbars) ships the UI-primitive foundation the other two consume. T-139b (asset browser + three import dialogs + export dialog) groups the media-I/O cluster sharing file-picker + thumbnail + modal-shell plumbing. T-139c (find/replace + onboarding + cloud-save panel + presentation mode) groups the remaining independent modals + app-lifecycle surfaces. T-139b and T-139c parallelizable after T-139a merges. Matches the v1.4 / v1.6–v1.10 split pattern; pre-empting mid-implementation rather than splitting reactively.
- **v1.10** (2026-04-22): T-125 pre-split into **T-125a / T-125b / T-125c** following the established Phase 6 L/M-split convention. Editor audit (T-120, `docs/migration/editor-audit.md` §1) identified six components under the PropertiesPanel port tier: PropertiesPanel (router), ZodForm (auto-inspector), ZodForm introspect module, ChartEditor, TableEditor, AnimationPicker. One row marked M was optimistic for six interacting components whose reflection-heavy introspection alone is ~800 LOC of reference code. Split gives three M-sized rows with clear ownership: T-125a ships the outer router shell + stubs (smallest; unblocks visible "selected element" properties in the editor on day 1), T-125b adds the ZodForm reflection engine (biggest lift; depends on T-125a's mount point), T-125c adds the three domain editors (Chart / Table / Animation). T-125b and T-125c can parallelize after T-125a merges. Pre-empting the split rather than hitting it mid-implementation matches the v1.4 / v1.6–v1.9 pattern; handover-phase6-mid §5.2 predicted this split.
- **v1.9** (2026-04-22): T-123 pre-split into **T-123a / T-123b / T-123c / T-123d** following the Phase 5 L-split convention. Editor audit (T-120, `docs/migration/editor-audit.md` §1) identified 5 components under the CanvasWorkspace port tier: `SlideCanvas`, `SelectionOverlay`, `InlineTextEditor`, `TextSelectionToolbar`, `SingleSlidePreview` (+ `PlayerPreview`). One row marked M was optimistic for 5 interacting components touching the banned-Remotion boundary. Split gives four M-sized rows with clear ownership: T-123a ships a read-only viewport (most standalone, unblocks visible progress), T-123b adds interactive selection/transform, T-123c adds text editing, T-123d reimplements the player via `@stageflip/frame-runtime` (the biggest lift — zero Remotion imports per CLAUDE.md §3). T-123b/c/d can parallelize after T-123a merges. Matches v1.4/v1.6/v1.7/v1.8 split pattern.
- **v1.8** (2026-04-22): T-121 pre-split into **T-121a / T-121b / T-121c** following the Phase 5 L-split convention. Editor audit (T-120, `docs/migration/editor-audit.md`) surfaced three independently-reviewable concerns inside the original L-sized "greenfield editor-shell" row: (1) shortcut registry framework (T-121a), (2) Jotai atoms + context shells (T-121b), (3) shell composition + persistence + i18n scaffold (T-121c). **T-132 is folded into T-121b** — the atoms port it described overlaps 1:1 with T-121b's atoms work. Component ports T-123..T-129 (which the original T-121 row also listed) were already their own tasks in the plan; the split clarifies that T-121 was the framework foundation, not the UI. Each new row is M-sized. Unblocks T-122 (walking skeleton) + T-123..T-129 (component ports) in parallel once T-121a+b+c land. Handover-phase6 §7.2 predicted this split; pre-empting it here rather than mid-implementation matches v1.4/v1.6/v1.7 pattern.
- **v1.7** (2026-04-22): T-119b narrowed + T-119d added. Mid-task exploration on T-119b surfaced a gap: the 5 parity fixtures in `packages/testing/fixtures/` carry `FixtureManifest` metadata (composition + clip + {runtime, kind, props}) but `PuppeteerCdpSession.mount` requires a full `RIRDocument`, and no converter exists in the repo today. The v1.6 entry for T-119b implicitly assumed one. Corrections: T-119b narrows its render-target to the 3 hand-coded `REFERENCE_FIXTURES` in `@stageflip/renderer-cdp` (which ARE real `RIRDocument`s) so it proves the orchestrator + render-to-PNG pipeline end-to-end, and T-119d is added for the `manifestToDocument(manifest)` converter. §6.1 goldens-priming splits accordingly — reference set unblocked by T-119b + T-119c; parity fixtures unblocked by T-119d extending T-119b's CLI. Net: one extra PR, but each PR ships working behaviour rather than an ad-hoc converter under time pressure. Matches the Phase 5 "each PR delivers standalone value" pattern.
- **v1.6** (2026-04-22): Added T-119 / T-119b / T-119c to Phase 6, resolving the two open follow-ups from Phase 5 ratification (handover-phase5 §6.1 goldens priming + §6.2 CI Chrome/ffmpeg infra). Split into three M/M/S rows rather than one L row per the Phase 5 convention (see T-100's split in v1.2–v1.4): T-119 ships the CI job + unlocks the e2e reference-render suite; T-119b ships the `parity:prime` CLI; T-119c wires them together + documents the operator priming flow. None block Phase 6's slide-migration critical path (T-120–T-136); schedulable in parallel as tooling infra.
- **v1.5** (2026-04-21): Phase 5 closeout. T-105 (visual diff viewer) and T-106 (auto-fix passes) carried from Phase 5 to Phase 6 as T-137 + T-138. Both depend on surfaces that shipped this phase (T-104 linter rules, T-100 ScoreReport) but neither blocks Phase 6's slide-migration critical path, so they're scheduled as tooling follow-ups. Phase 5 exit criterion met on the core parity harness + linter + CI gate work.
- **v1.4** (2026-04-21): T-100d narrowed to scaffold + CSS runtime (M); T-100e added for the remaining 5 live runtimes (M). Splits the L-sized T-100d into two reviewable pieces rather than landing React + 6 runtimes + their transitive deps in one PR.
- **v1.3** (2026-04-21): T-100c narrowed to contract + smart placeholder (M); T-100d added for the actual runtime-bundle host (L). Split keeps each PR reviewable and defers the Vite-bundled runtime-registration work to its own task rather than trying to land it alongside the contract change.
- **v1.2** (2026-04-21): T-100 split into three rows post-scope-review on PR #13. T-100 stays comparators-only; T-100b adds BeginFrame capture; T-100c adds the real host HTML bundle. Prevents T-100 from silently bundling three tasks and gives reviewers independent pass-fail targets.
- **v1.1**: review feedback integrated. New: T-001a, T-055, T-072, T-084a, T-151a, T-241a, I-9. Revised: T-021, T-025, T-027, T-031, T-043, T-065, T-100, T-120–T-129, T-153. Phase 6 strategy changed to greenfield-shell + port.
- **v1.0**: initial plan covering 12 phases, ~270 tasks.

---

**End of plan v1.16.** Start at T-001.
