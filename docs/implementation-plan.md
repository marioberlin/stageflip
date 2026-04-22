# StageFlip — Implementation Plan v1.9

**Audience**: AI coding agents executing autonomously; human product owners ratifying at phase boundaries.
**Scope**: 280+ tasks across 12 phases, from empty repo to first public beta.
**Format**: Every task is self-contained with references, prompts, acceptance criteria, and verification commands.
**Last updated**: 2026-04-22 — T-123 pre-split into T-123a/b/c/d (CanvasWorkspace port) following the Phase 5 L-split convention. See §C.10 changelog.

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
| **T-129 [rev]** | Port remaining components. **First tranche shipped**: searchable `<ShortcutCheatSheet>` (keyed on `useAllShortcuts`, `?` shortcut), `<StatusBar>` (slide + element counts). **Deferred tranches** (tracked as post-Phase-6 follow-ups): asset browser, context-menu framework, contextual/persistent toolbars, export dialog, import dialogs (Google / PPTX / image upload), find/replace, onboarding, cloud-save panel, presentation mode. Collaboration UI is a Phase 7+ concern once `@stageflip/collab` lands | L |
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
| **T-131d.2 [deferred]** | **`shader-bg` (escape-hatch GLSL clip)** — needs runtime extension before porting. Our `defineShaderClip` validates GLSL at author-time; `shader-bg` accepts arbitrary GLSL via render-time props. Design call: extend `defineShaderClip` with a "user-shader" variant that accepts GLSL via props, OR add a separate `defineUserShaderClip` factory. Either way the runtime contract grows. Picked up by a future agent — no current consumer blocking | S |
| **T-131d.3 [deferred]** | **`lottie-player`** — reference imports `@remotion/lottie` which is forbidden per CLAUDE.md §3 (no Remotion imports). Needs a fresh integration against `lottie-web` (Apache-2.0, on the THIRD_PARTY whitelist? — confirm before adding). Sized M-L depending on how much of `@remotion/lottie`'s seek/preload pipeline we reimplement. Consumer-blocking only when a deck wires a Lottie animation, which Phase 6 does not | M |
| **T-131d.4 [deferred]** | **`animated-map`** — reference imports `mapbox-gl` (BSD-3-Clause + commercial-use restrictions on the underlying tile API). Needs `THIRD_PARTY.md` review + a Mapbox account-token strategy + a render-side fix for the imperative `useEffect` pattern (mapbox-gl is canvas-based + not deterministic across runs without seeded styles). Sized L. Heavy enough that it may instead become a bake-tier clip (T-131e family) once we know the constraints | L |
| **T-131e [new]** | **bake tier — 4 clips**: video-background, gif-player, audio-visualizer-reactive, voiceover-narration. Wired to the bake-tier dispatcher | M |
| T-133 | Undo/redo via fast-json-patch | M |
| T-134 | Branding pass: StageFlip.Slide logo, copy, CSS vars. Abyssal Clarity preserved | M |
| T-135 | `skills/stageflip/modes/stageflip-slide/SKILL.md` final | M |
| T-136 | E2E Playwright regression: new deck / add slide / edit text / preview / undo+redo chain / element delete. **Export PNG descoped** — no export button exists in app-slide today; `@stageflip/renderer-cdp` has its own PNG e2e via the T-119 reference-render suite, which covers the render path at the package boundary. Wiring a full Export-PNG UI flow would balloon T-136; tracked as a follow-up on the Phase 6 post-exit list | M |
| **T-137** | **Visual diff viewer** (side-by-side / slider / overlay) — HTML artifact consuming `FixtureScoreOutcome` + `ScoreReport` from `@stageflip/parity-cli`. Carried from Phase 5 (was T-105); rule + score surface stable as of T-104/T-107 merges | M |
| **T-138** | **Auto-fix passes (10) with iterative convergence** — builds on T-104's `LintRule` + `LintFinding` surface. Each rule declares an optional `fix(document)` that returns a mutated document; the orchestrator runs up to 10 passes until either no findings remain or no rule produced a change. Carried from Phase 5 (was T-106) | L |
| **T-119 [new]** | **CI render-e2e job** — new `render-e2e` job on `ubuntu-latest` behind the existing `dorny/paths-filter` rendering scope. Installs `chrome-headless-shell` via Puppeteer's browser cache + `ffmpeg`/`ffprobe` via `apt-get`. Flips `@stageflip/renderer-cdp`'s `reference-render.e2e.test.ts` from silent-skip to green on CI (3 fixtures × real Puppeteer + real ffmpeg + real ffprobe, already passing locally). Uploads the 3 MP4s as artifacts for operator inspection. Structurally resolves handover-phase5 §6.2. No new package, no new CLI — just `.github/workflows/ci.yml` + minor docs | M |
| **T-119b [rev]** | **`stageflip-parity prime` subcommand — orchestrator + REFERENCE_FIXTURES render path.** Pure `primeFixture(path, renderFn, fsOps)` orchestrator in `@stageflip/parity-cli` with a `PrimeRenderFn` port (unit-tested against a fake render + in-memory fs). CLI subcommand `stageflip-parity prime` wires up a real Puppeteer-backed renderer using `PuppeteerCdpSession` + `createRuntimeBundleHostHtml` from `@stageflip/cdp-host-bundle`, rendering the 3 hand-coded `RIRDocument` fixtures from `@stageflip/renderer-cdp`'s `REFERENCE_FIXTURES` to PNGs on disk. Proves the full render-to-PNG pipeline end-to-end; **does not** render the 5 parity fixtures in `packages/testing/fixtures/` because no `FixtureManifest` → `RIRDocument` converter exists yet (see T-119d). Scope narrowed from the v1.6 entry after mid-task discovery that the shape gap is real — v1.6 implicitly assumed a converter that doesn't exist | M |
| **T-119c [new]** | **Wire `stageflip-parity prime` into CI as artifact step + operator workflow docs** — extends the T-119 job with a post-render step that invokes the prime subcommand against `REFERENCE_FIXTURES`, uploads the generated PNG set as a `parity-goldens-reference-<sha>` artifact, and never commits. Operators download, inspect, and commit via a normal PR. Updates `parity-testing/SKILL.md` with the "priming in CI" section. Unblocks handover-phase5 §6.1 **for the reference set**; the parity-fixture set waits on T-119d | S |
| **T-119d [new]** | **`manifestToDocument(manifest)` converter** — new pure function in `@stageflip/testing` (or a new `@stageflip/fixture-compile` package if scope argues for it) that takes a `FixtureManifest` + returns a `RIRDocument` suitable for `PuppeteerCdpSession.mount`. Hand-assembles a single-clip document: composition → doc-level fields, `{runtime, kind, props}` + clip window → one `clip`-content element with deterministic id + transform + timing. Zod-validates via `rirDocumentSchema`; parity fixtures then become renderable via T-119b's orchestrator. Once this lands, T-119b's CLI gains a `--parity` flag that renders the 5 parity fixtures in addition to REFERENCE_FIXTURES, and T-119c's CI artifact grows to include the parity-golden set. **This is the piece that actually unblocks §6.1 for parity goldens** — T-119b/c unblock it only for the reference set | M |

---

## Phase 7 — Agent + Semantic Tools (Week 34–38)

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

**End of plan v1.10.** Start at T-001.
