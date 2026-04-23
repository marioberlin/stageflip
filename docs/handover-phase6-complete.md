# Handover — Phase 6 complete (2026-04-23)

Supersedes `docs/handover-phase6-mid-6.md` (and every earlier mid-N
doc) as the live starter doc. If you are the next agent: start here,
then `CLAUDE.md`, then `docs/implementation-plan.md` for Phase 7.

Current commit on `main`: `89e8e3b` (Phase 6 polish — PR #83).
Working tree clean. Every gate green.

**Ratification status: awaiting orchestrator sign-off.** This
handover documents what shipped + what deferred. The plan row's
"Status" line flips to `Ratified YYYY-MM-DD` only after a human
orchestrator has reviewed this doc against the exit criteria.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — complete. T-001..T-017.
- **Phase 1 (Schema + RIR + Determinism)** — ✅ Ratified 2026-04-20.
- **Phase 2 (Frame Runtime)** — complete. T-040..T-055.
- **Phase 3 (Runtime Contract + Concrete Runtimes)** — ✅ Ratified 2026-04-21.
- **Phase 4 (Vendored CDP Engine + Export Dispatcher)** — ✅ Ratified 2026-04-21.
- **Phase 5 (Parity Harness + Pre-Render Linter)** — ✅ Ratified 2026-04-22.
- **Phase 6 (Slide Migration)** — ⏳ **Awaiting ratification.** Every
  plan row shipped (T-120 through T-138 + the T-119 CI-render family
  spawned mid-phase), with a handful of explicit carve-outs tracked
  below as post-Phase-6 follow-ups.

### Phase 6 tasks as shipped

The original T-131 plan row expanded to 19 sub-tasks across six
tranches (b.1/b.2/b.3, c, d.1–d.4, e.0–e.2, f.1–f.3). Rationale
documented in the `mid-N` handover chain; sub-tasks exist because
single-PR scope on the composite was prohibitive.

The T-119 CI-render family (T-119, 119b–119f) was spawned mid-phase
from handover-phase5 §6.2 follow-up (render-e2e + golden priming);
each sub-task tracked as a separate plan row.

Summary by group:

| Group | Tasks | Notes |
|---|---|---|
| Shell + atoms | T-120, T-121a/b/c | Editor-shell package with 196 tests; Jotai atoms + context shells; Next.js 15 walking skeleton |
| Walking skeleton | T-122 | `apps/stageflip-slide` wired end-to-end |
| Canvas + interactions | T-123a/b/c/d | SlideCanvas, SelectionOverlay, InlineTextEditor, SlidePlayer (frame-runtime, zero Remotion imports) |
| UI components | T-124 (Filmstrip), T-125a/b/c (PropertiesPanel + ZodForm + ChartEditor/TableEditor/AnimationPicker), T-126 (TimelinePanel), T-127 (command palette), T-128 (AI copilot), T-129 (ShortcutCheatSheet + StatusBar first tranche — remaining deferred) | |
| Import + branding | T-130 (`@stageflip/import-slidemotion-legacy` — 34 tests), T-134 (StageFlip.Slide branding), T-135 (modes skill) | |
| Clip ports | T-131a, 131b.1/.2/.3, 131c (scope-zero audit), 131d.1/.2/.3/.4, 131e.0/.1/.2, 131f.1/.2a/.2b/.2c/.3, 131f.4 (folded into .e.2) | **32 of 32 reference clips ported** |
| History | T-133, T-133a | Undo/redo via fast-json-patch; subsumed T-132 |
| E2E | T-136 | Playwright regression suite (export-PNG descoped — see §5) |
| Visual diff viewer | T-137 | `stageflip-parity report` subcommand |
| Auto-fix passes | T-138 | 10 rules gained `fix`; iterative orchestrator |
| CI render-e2e (spawned) | T-119, T-119b, T-119c, T-119d, T-119e, T-119f | Real-Chrome + ffmpeg gate; golden priming wired to CI artifacts |

### Exit criteria (from plan)

> `apps/stageflip-slide` achieves parity with current SlideMotion
> editor; existing SlideMotion documents migrate via
> `@stageflip/import-slidemotion-legacy`.

Two axes; one met, one met-with-caveat.

- **Import via `@stageflip/import-slidemotion-legacy`** ✅. T-130
  shipped the one-way converter old-schema → new-schema with
  `mode='slide'`. 34 tests cover the known field shapes from the
  reference deck corpus.

- **`apps/stageflip-slide` achieves parity** ✅ **with caveat**.
  The core editor shell, canvas + interactions, filmstrip, timeline,
  properties panel (+ ZodForm + domain editors), undo/redo,
  shortcut registry, command palette, AI copilot sidebar, and all
  32 reference clips are ported and test-covered. The T-129 "port
  remaining components" row explicitly deferred asset browser,
  context-menu framework, contextual/persistent toolbars, export
  dialog, import dialogs (Google / PPTX / image upload), find/
  replace, onboarding, cloud-save panel, presentation mode — these
  exist in the SlideMotion reference but do not have ports in the
  greenfield shell. The `[rev]` framing of Phase 6 (greenfield
  shell + component port rather than copy-and-rip) makes these
  tranches naturally post-exit; they are neither regressions nor
  implicit promises. Tracked in §5 "Deferred / carried forward".

### No escalations this phase

No task triggered a formal `docs/escalation-*.md`. Scope
negotiations (T-131 sub-splits, T-132 subsumed by T-121b, T-131d.4
SVG-fallback descope, T-131f.4 folded into T-131e.2) were handled
via plan-version bumps + handover §3 "architectural decisions"
entries.

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of Phase 6)

| Package | Cases | Change vs Phase 5 |
|---|---|---|
| `@stageflip/schema` | 92 | unchanged |
| `@stageflip/rir` | 36 | unchanged |
| `@stageflip/storage` | 23 | unchanged |
| `@stageflip/frame-runtime` | 345 | +17 (T-123d SlidePlayer reimpl) |
| `@stageflip/determinism` | 14 | unchanged |
| `@stageflip/skills-core` | 14 | unchanged |
| `@stageflip/testing` | 39 | +13 (T-119d `manifestToDocument` converter) |
| `@stageflip/runtimes-contract` | 26 | +12 (T-131a `themeSlots` + `resolveClipDefaultsForTheme`) |
| **`@stageflip/runtimes-frame-runtime-bridge`** | **392** | **+378** (T-131b/d/e/f families — 31 reference-clip ports + auto-fix polish) |
| `@stageflip/runtimes-css` | 23 | +10 (T-131a gradient-background demonstrator) |
| `@stageflip/runtimes-gsap` | 12 | unchanged |
| `@stageflip/runtimes-lottie` | 33 | +20 (T-131d.3 lottie-player) |
| `@stageflip/runtimes-shader` | 38 | +16 (T-131d.2 shader-bg + T-138 polish warn tests) |
| `@stageflip/runtimes-three` | 15 | unchanged |
| `@stageflip/fonts` | 23 | unchanged |
| `@stageflip/renderer-cdp` | 242 | unchanged (surface stable; Phase 6 didn't touch renderer internals) |
| `@stageflip/parity` | 40 | unchanged |
| `@stageflip/cdp-host-bundle` | 29 | +1 (T-131d.4 31-clip assertion bump) |
| **`@stageflip/parity-cli`** | **93** | **+65** (T-119b/c/d/e/f prime subcommand + T-137 viewer) |
| **`@stageflip/validation`** | **69** | **+27** (T-138 auto-fix orchestrator + 10 rule fixes) |
| `@stageflip/skills-sync` | 9 | +1 (T-138 Auto-fix column assertion) |
| **`@stageflip/editor-shell`** | **196** | **+196** (new; T-121a/b/c + every T-123 family member that touches provider state) |
| **`@stageflip/app-slide`** | **222** | **+222** (new; T-122 walking skeleton + every component-port integration test) |
| **`@stageflip/import-slidemotion-legacy`** | **34** | **+34** (new; T-130 converter) |
| **Total** | **~2059** | **+~1012 vs Phase 5 complete** |

### Dependencies added in Phase 6

`pnpm check-licenses` went 482 → 490 deps scanned at Phase 6 exit.
Every new dep is MIT or Apache-2.0.

| Package | Version | Install site | License |
|---|---|---|---|
| `jotai` | pinned via editor-shell | `@stageflip/editor-shell` | MIT |
| `fast-json-patch` | pinned via editor-shell | `@stageflip/editor-shell` (T-133) | MIT |
| `next` | 15.x | `apps/stageflip-slide` | MIT |
| `@radix-ui/*` (several) | — | `@stageflip/ui-kit` + `apps/stageflip-slide` | MIT |
| `lottie-web` | MIT (T-131d.3 — was pinned at T-064 but landed as an active dep this phase via lottie-player) | `@stageflip/runtimes-lottie` | MIT |
| miscellaneous editor-shell + app-slide transitive deps | — | — | MIT / Apache-2.0 |

No forbidden licences, no new Remotion imports, no `mapbox-gl`
(T-131d.4 deliberately shipped SVG-fallback only — see §3.6).

### New workspace packages (Phase 6)

| Package | Private | Purpose |
|---|---|---|
| `@stageflip/editor-shell` | yes | Shell that composes ShortcutRegistryProvider + DocumentProvider + AuthProvider; Jotai atoms; i18n catalog; localStorage persistence |
| `@stageflip/app-slide` | yes | Next.js 15 host that mounts editor-shell + wires the clip-runtime registry + agent |
| `@stageflip/import-slidemotion-legacy` | yes | One-way converter old-SlideMotion-schema → new-RIR/canonical-schema |
| `@stageflip/ui-kit` | yes | (populated) Abyssal Clarity React component primitives shared across app-slide + editor-shell |

`@stageflip/runtimes-blender` remains a stub (`export {};`) — bake
tier is Phase 12 (T-265).

### CI gate surface (10 gates + optional e2e + new render-e2e)

Gates unchanged from Phase 5 in structure; paths + counts bumped:

```
pnpm typecheck | lint | test | build
pnpm check-licenses              — 490 deps, PASS
pnpm check-remotion-imports      — 477 source files, PASS
pnpm check-skill-drift           — PASS
pnpm skills-sync:check           — PASS
pnpm check-determinism           — 57 source files, PASS
pnpm size-limit                  — PASS
                                   • frame-runtime (core) 5.46 / 10 kB
                                   • frame-runtime /path 19.52 / 25 kB
                                   • cdp-host-bundle 367.33 / 500 kB
pnpm parity                       — structural (awaiting goldens)
pnpm e2e                          — optional browser install
```

**New in Phase 6**:

```
.github/workflows/ci.yml  render-e2e  — real Chrome + ffmpeg + ffprobe,
                                        T-119 job, uploads reference
                                        + parity golden PNGs as
                                        artifacts
```

The `parity` job is still structural-only (no goldens committed
yet). With `render-e2e` now publishing golden-prime artifacts on
every rendering-adjacent PR (T-119c / T-119e / T-119f), committing
goldens becomes an operator workflow: download → inspect → commit
→ parity flips from structural to behavioural. Operator-handled.

### Changesets recorded in Phase 6

**~28 changesets added this phase**, all `minor` or `patch` bumps
on private packages. Recorded for the eventual Phase 10 publish
audit. A partial list (in merge order):

- editor-shell T-121a / T-121b / T-121c
- app-slide T-122
- canvas / interactions T-123a / T-123b / T-123c / T-123d
- filmstrip T-124
- properties panel T-125a / T-125b / T-125c
- timeline T-126
- command palette T-127
- AI copilot T-128
- T-129 first tranche (ShortcutCheatSheet + StatusBar)
- import-slidemotion-legacy T-130
- **runtimes-frame-runtime-bridge** T-131b.1 / b.2 / b.3 / d.1 / f.1 / f.2a / f.2b / f.2c / f.3 / e.0 / e.1 / e.2 / d.4 (the largest cluster — 32 clips across 13 sub-tranches)
- shader T-131d.2 (shader-bg)
- lottie T-131d.3 (lottie-player)
- T-133 / T-133a (undo-redo)
- T-134 (branding) / T-135 (modes skill)
- T-136 (e2e)
- parity-cli T-119b / T-119c / T-119d / T-119e / T-119f (prime family)
- parity-cli T-137 (viewer subcommand)
- validation T-138 (auto-fix)
- Phase 6 polish (shader warn + inline commentary + currency map)

---

## 3. Architectural decisions (Phase 6)

Layered on top of Phase 5 handover §4.

### 3.1 Greenfield shell, not copy-and-rip

The plan row reframed Phase 6 from "copy the SlideMotion editor
into the new monorepo" to "build a greenfield shell, then port
components one at a time." The critical implication: **the old
editor is the reference, not the substrate**. Every component landed
as a fresh implementation studying the reference, not importing it.
Zero Remotion imports through the entire T-123d `SlidePlayer` reimpl;
32/32 clips reimplemented against `@stageflip/frame-runtime`.

### 3.2 `themeSlots` as a runtime-contract primitive (T-131a)

Added to `ClipDefinition` + `ThemeSlot` types in
`@stageflip/runtimes-contract`. Lets clips declare which of their
default prop values pull from `palette.*` roles. `resolveClipDefaultsForTheme(clip,
theme, props)` helper fills the gap. Every clip port in the T-131b
family then ships a `themeSlots` map. The alternative — hardcoded
hex defaults — would have frozen each clip to a single palette.

### 3.3 `ZodForm` auto-inspector (T-125b)

Consumes the `propsSchema` every clip declares (T-125b extended
`defineFrameClip` / `defineCssClip` / `defineShaderClip` /
`defineLottieClip` to forward props schemas). PropertiesPanel
mounts `<ZodForm schema={clip.propsSchema} />` for any selected
clip element — inputs generate from Zod's `_def` via an introspect
module kept separate because the Zod internal structure is
nontrivial to walk safely. Means a new clip kind is automatically
editable in the properties panel, no per-clip UI work.

### 3.4 Clip ports grouped by complexity, not by runtime tier

The original T-131 "by runtime tier" grouping turned out to be a
poor predictor of port size. Survey during T-131c found every
reference clip uses `useCurrentFrame` / `interpolate` / `spring`, so
the tier split became a scope-zero audit. The effective grouping is
now **by complexity** (light / medium / heavy tranches in T-131b)
and by **integration concern** (T-131d = deps that needed research,
T-131e = bake-tier adjacency, T-131f = dashboards + composites). 32
of 32 reference clips ship in `@stageflip/runtimes-frame-runtime-bridge`.

### 3.5 Sub-component discipline: inline until a second consumer exists

T-131f.2 / T-131f.3 (sales-dashboard, financial-statement) have
3–5 private sub-components each (`PipelineFunnel`, `ForecastChart`,
`DealCard`, `KpiStrip`, `StatementTable`, `CommentsRail`,
`ObjectiveCard`). Every one inlined as a module-private helper.
Policy: **export only when a concrete second consumer exists**.
`ObjectiveCard` was initially exported in T-131f.2b, reviewer flagged
premature API surface, reverted before merge. Documented in the
mid-6 handover §3.2.

### 3.6 `mapbox-gl` is not in the determinism-scoped path (T-131d.4)

`animated-map` ported as the **SVG-fallback-only** variant. The
reference's real-tiles branch uses canvas imperative mutation + network
fetches per tile; both violate the frame-runtime determinism
invariants listed in `CLAUDE.md` §3. Gating a deck on a Mapbox
account token is also the wrong posture for a bridge-tier *preview*
clip. Real tiles are a Phase 7+ bake-tier question (a hypothetical
`animated-map-real` clip that pre-renders during export). Zero new
runtime deps, no `THIRD_PARTY.md` change.

### 3.7 Visual-diff viewer is a tool, not a gate (T-137)

`stageflip-parity report` exits `0` on successful HTML emission
regardless of scoring PASS/FAIL. The score subcommand is the gate;
the viewer is the diagnostic surface *for* the gate. The HTML
artifact is portable (base64-embedded PNGs, inline CSS + JS, works
over `file://`) so operators can attach it to PR comments without
running a server.

### 3.8 Auto-fix is opt-in and per-rule (T-138)

`LintRule` gains an optional `fix(document, findings): RIRDocument
| null` method. `autoFixDocument(doc, opts)` orchestrator runs up
to 10 passes (default) until either converged or pass-limit. Rules
without deterministic safe repairs (e.g.
`text-color-is-valid-css`, `shape-custom-path-has-path`) omit
`fix` — their findings persist to `finalReport`. Regular
`lintDocument` never mutates. Auto-fix never gates anything.

### 3.9 CI render-e2e prints golden-prime artifacts on every PR

T-119 + T-119b..f wire a `render-e2e` CI job that renders both the
3 hand-coded `REFERENCE_FIXTURES` from `@stageflip/renderer-cdp` AND
every `packages/testing/fixtures/*.json` via
`manifestToDocument()` (T-119d) → uploads each set as a
`parity-goldens-{reference|fixtures}-<sha>` artifact. Operators
download, inspect, and commit. Golden priming is operator-handled
from this point; the CI gate becomes behavioural the moment goldens
land under each fixture's `goldens.dir`.

### 3.10 Phase 6 polish: defaults that fail loudly rather than silently

Three small follow-ups (PR #83) tightened edge cases that the
reference handled silently:

- `ShaderClipHost` silently dropped bad GLSL; now `console.warn` in
  `NODE_ENV !== 'production'` with the GL info log.
- `commentaryMode: 'inline'` silently rendered as `rail`; now renders
  an actual inline horizontal strip below the table.
- `currencyPrefix` silently rendered bare numbers for anything other
  than USD/EUR; now covers 13 ISO currencies with a
  `<CODE> ` fallback so the number is never unlabelled.

---

## 4. Plan-version churn

Phase 6 absorbed seven plan-version bumps (v1.5 → v2.2) tracked in
`docs/implementation-plan.md` §C. Each bump corresponds to a
scope-negotiation moment resolved inline rather than via escalation:

- **v1.5 → v1.6** — T-119 family spawned to resolve phase-5 §6.2
  render-e2e follow-up.
- **v1.6 → v1.7** — T-119b split after mid-task discovery that the
  `FixtureManifest → RIRDocument` converter didn't exist
  (narrowed scope, spawned T-119d).
- **v1.7 → v1.8** — T-121 split into a/b/c; T-132 subsumed by T-121b.
- **v1.8 → v1.9** — T-123 split into a/b/c/d; T-125 split into
  a/b/c; T-131 split into a/b/c/d/e/f.
- **v1.9 → v2.0** — T-131b split into b.1/b.2/b.3; T-131d sub-
  split after clip-by-clip survey.
- **v2.0 → v2.1** — T-131e sub-split (e.0 media-host prereq surfaced);
  T-131f added after audit-driven catch-up.
- **v2.1 → v2.2** — T-131d.4 SVG-fallback descope + T-131f.4 folded
  into T-131e.2.

Every version entry has a `docs/handover-phase6-mid-N.md` companion
that documents the in-phase reasoning. Mid-N chain is preserved on
branches for audit; `handover-phase6-mid-6.md` is the live starter
at the time this closeout drafts.

---

## 5. Deferred / carried forward

Four categories of known gaps. Each is explicitly tracked rather
than implicitly promised; none block Phase 7's start.

### 5.1 Parity gaps against the SlideMotion reference (T-129 deferred tranches)

UI surfaces that exist in the reference editor but do not have
ports in `apps/stageflip-slide`:

- Asset browser
- Context-menu framework
- Contextual / persistent toolbars
- Export dialog (triggers the render pipeline from inside the
  editor; `@stageflip/renderer-cdp` itself has full e2e coverage
  at the package boundary via T-119)
- Import dialogs (Google Slides / PPTX / image upload)
- Find / replace
- Onboarding flow
- Cloud-save panel
- Presentation mode

Scheduled as post-Phase-6 follow-ups — pick up in Phase 7 or later
as product requirements surface.

### 5.2 E2E export-PNG flow descoped (T-136)

T-136's Playwright regression ships (new deck / add slide / edit
text / preview / undo+redo chain / element delete) but deliberately
skips "Export PNG". `@stageflip/renderer-cdp` has its own PNG e2e
via the T-119 reference-render suite — the render path is covered
at the package boundary. Wiring a full Export-PNG UI flow would
have ballooned T-136. Post-Phase-6 follow-up.

### 5.3 Bake-tier runtime wiring is Phase 12 (T-265)

T-131e.0/.1/.2 shipped the four bake-tier-adjacent clips
(`video-background`, `gif-player`, `voiceover-narration`,
`audio-visualizer-reactive`) bridge-style for preview. Deterministic
export of decks using these clips still requires a concrete
`BakeRuntime` impl in `@stageflip/runtimes-blender` + an app-slide
dispatcher. Scheduled as T-265 (Phase 12) — the blender runtime
needs Docker + GPU drivers + BullMQ infra that does not yet exist.
Not consumer-blocking until someone tries to export a deck using
those four clips; the interfaces (`BakeJob` / `BakeArtifact` /
`BakeOrchestrator`) are already live in `packages/renderer-cdp/src/bake.ts`
from T-089 for future-Phase-12 use.

### 5.4 Parity goldens not committed

Every parity fixture (35 total under `packages/testing/fixtures/`)
has `thresholds` + `goldens.dir` populated but no golden PNGs
committed. The CI `parity` gate runs structurally: it catches
manifest drift + CLI regressions but not pixel drift.

T-119 + T-119c + T-119e + T-119f wired the render-e2e CI job to
produce golden-prime artifacts on every rendering-adjacent PR.
Priming is now purely an operator workflow:

1. Touch a rendering-adjacent file in a PR.
2. Wait for `render-e2e` to finish.
3. Download the `parity-goldens-reference-<sha>` and
   `parity-goldens-fixtures-<sha>` artifacts.
4. Visually inspect each PNG.
5. Commit under each fixture's `goldens.dir`.

The `parity` gate flips from structural to behavioural the moment
goldens land. Documented at length in
`skills/stageflip/workflows/parity-testing/SKILL.md`.

### 5.5 Other small follow-ups

- `useWindowedAudioData` analogue for pre-decoded window samples —
  only needed if the bake path ever wants per-frame FFT snapshots.
  T-131e.2 confirmed `useAudioVisualizer` (already in frame-
  runtime from T-053) is sufficient for the bridge preview path.
- Sub-component exports (`ObjectiveCard`, `DealCard`,
  `StatementTable`) stay private until a second consumer exists
  per §3.5.
- `commentaryMode: 'inline'` cards are a single-row strip today; a
  richer "commentary inline within specific table rows" layout is
  a separate follow-up if a future deck needs row-anchored
  commentary.

---

## 6. File / directory map delta

Phase 6 added three workspace apps/packages + substantial clip +
UI content. Highest-density additions:

```
apps/stageflip-slide/                               [NEW — T-122 + every downstream]
  Next.js 15 host; mounts editor-shell; wires agent; 222 tests

packages/editor-shell/                              [NEW — T-121a/b/c + T-123 family]
  src/
    shortcuts/             (T-121a)                 ShortcutRegistryProvider + useRegisterShortcuts + useAllShortcuts
    atoms/                 (T-121b)                 11 Jotai atoms for document / selection / undo-redo
    context/               (T-121b)                 DocumentProvider + AuthProvider shells
    i18n/                  (T-121c)                 Flat catalog + setLocale pseudo-locale support
    persist/               (T-121c)                 localStorage adapter
    canvas/                (T-123a/b/c)             SlideCanvas viewport, SelectionOverlay, InlineTextEditor
    player/                (T-123d)                 <SlidePlayer> (frame-runtime-driven; zero Remotion)
    timeline/              (T-126)                  TimelinePanel (scrubber + keyframe editing)
    properties/            (T-125a/b/c)             PropertiesPanel router + ZodForm + ChartEditor + TableEditor + AnimationPicker
    filmstrip/             (T-124)                  Filmstrip
    command-palette/       (T-127)                  Command palette + tool search
    copilot/               (T-128)                  AI copilot sidebar + streaming
    status/                (T-129)                  ShortcutCheatSheet + StatusBar (first tranche)
    history/               (T-133)                  fast-json-patch undo/redo
    {*.test.ts + *.test.tsx}                        196 cases total

packages/import-slidemotion-legacy/                 [NEW — T-130]
  src/                                              one-way converter old-schema → new-schema, mode='slide'
  {*.test.ts}                                       34 cases

packages/runtimes/frame-runtime-bridge/src/clips/   [MASSIVE — T-131b/d/e/f families]
  +31 clip files                                    (+{_dashboard-utils.ts} shared private helpers)
  index.ts                                          ALL_BRIDGE_CLIPS → 31 clips
  {*.test.tsx}                                      392 cases (was 14)

packages/runtimes/shader/src/clips/                 [MOD — T-131d.2]
  shader-bg.ts                                      escape-hatch GLSL via props

packages/runtimes/lottie/src/clips/                 [MOD — T-131d.3]
  lottie-player.tsx                                 prop-driven playback of inline animationData

packages/runtimes/contract/src/index.ts             [MOD — T-131a]
  +ThemeSlot + resolveClipDefaultsForTheme + themeSlots on ClipDefinition

packages/parity-cli/src/                            [MOD — T-119b..f + T-137]
  prime.ts + prime-cli.ts + puppeteer-primer.ts     golden-prime orchestrator + CLI
  viewer-html.ts + viewer.ts + report-cli.ts        (T-137) visual-diff viewer
  bin/parity.js                                     unchanged shim
  {*.test.ts}                                       93 cases (was 28)

packages/validation/src/                            [MOD — T-138]
  types.ts                                          +fix? on LintRule
  auto-fix.ts                                       autoFixDocument orchestrator
  rules/{transform,composition,stacking,content,fonts}.ts  +10 rule fixes
  {*.test.ts}                                       69 cases (was 42)

packages/testing/                                   [MOD — T-119d]
  src/manifest-to-document.ts                       converter for render-e2e priming

packages/frame-runtime/src/                         [MOD — T-123d]
  player/                                           <SlidePlayer>-facing primitives (non-Remotion useCurrentFrame-aware)

packages/cdp-host-bundle/src/                       [MOD — T-131d.4 + every clip-count bump]
  runtimes.test.ts                                  bridge.clips.size === 31

packages/ui-kit/                                    [POPULATED]
  Abyssal Clarity primitives (GlassPanel, BioluminescentButton, etc.)

.github/workflows/ci.yml                            [MOD — T-119]
  +render-e2e job with golden-prime artifacts
  +dorny/paths-filter scope covers editor-shell + app-slide

docs/
  handover-phase6-mid-{1..6}.md                     mid-phase handover chain (branches only)
  handover-phase6-complete.md                       [NEW] this doc
  implementation-plan.md                            §C.11..C.17 v1.5 → v2.2
  migration/editor-audit.md                         [NEW — T-120] reference-editor audit

skills/stageflip/
  workflows/parity-testing/SKILL.md                 [MOD — T-137] + viewer section + fix-column reference
  reference/validation-rules/SKILL.md               [REGEN — T-138] + Auto-fix column + orchestrator prose
  runtimes/frame-runtime-bridge/SKILL.md            [MOD per tranche] tranche ledger through f.3 + d.4
  modes/stageflip-slide/SKILL.md                    [MOD — T-135] final

.changeset/                                         +~28 entries (see §2)
```

---

## 7. Statistics — end of Phase 6

- **~74 commits** on `main` across Phase 6 (v1.5 baseline `75defb4` → Phase-6-polish `89e8e3b`).
- **~2059 test cases** across **24 test-active packages** (+~1012 from Phase 5).
- **490 external deps** license-audited (PASS) — +8 vs Phase 5 (jotai, fast-json-patch, next, @radix-ui/* et al.; every addition MIT or Apache-2.0).
- **477 source files** scanned for Remotion imports (PASS). Zero matches — `<SlidePlayer>` and every clip reimplemented against `@stageflip/frame-runtime`.
- **57 source files** scanned for determinism (PASS) — scope grew with the 32 clip ports.
- **10 CI gates** (+ optional e2e + the new `render-e2e` job from T-119).
- **~28 changesets** added this phase across 9 packages. All `private: true` today; recorded for the eventual Phase 10 publish audit.
- **0 ADRs** accepted. ADR-001 + ADR-002 unchanged.
- **32 reference clips** ported (out of 32 in `reference/slidemotion/packages/renderer-core/src/clips/registry.ts`) — full coverage.
- **31 bridge-clip kinds** on `@stageflip/runtimes-frame-runtime-bridge` (dashboards deduplicate 6→1 composite each).
- **10 lint-rule auto-fixes** shipped under T-138.
- **3 rendering-adjacent workspace packages added** (editor-shell, app-slide, import-slidemotion-legacy).
- **0 escalations** raised this phase. Precedent from Phase 5 preserved.

---

## 8. How to resume

### 8.1 Ratification

Before any Phase 7 work begins, an orchestrator / human reviewer
should:

1. Review this handover against the exit criteria in §1.
2. Check the caveat in §1 (deferred T-129 tranches) against the
   product expectation for parity.
3. Flip the plan-row Phase 6 status line in
   `docs/implementation-plan.md` from "⏳ awaiting ratification" to
   "✅ **Ratified YYYY-MM-DD**" + reference this doc.
4. Merge the ratification PR.

If the caveat in §1.2 is deemed non-blocking, Phase 6 ratifies as-is.
If the T-129 deferred tranches are deemed load-bearing for parity,
the appropriate action is to spawn a T-139 (or similar) row to pick
up the deferred tranches before Phase 7 starts.

### 8.2 Starter prompt (for the next agent, once ratified)

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-complete.md` top to bottom. Then
> `CLAUDE.md`. Then `docs/implementation-plan.md` for Phase 7. Confirm
> current state and the first Phase 7 task.

### 8.3 Phase 7 starts at T-140

Phase 7 ("AI Agent Integration") begins at T-140 per the plan. The
core surfaces it consumes are all stable at Phase 6 exit:

- `@stageflip/runtimes-contract` with `themeSlots` + `propsSchema`
- `@stageflip/runtimes-frame-runtime-bridge` with 31 clips
- `@stageflip/validation` with 33 rules + 10 auto-fixes
- `@stageflip/parity-cli` with `score` + `prime` + `report`
  subcommands
- `@stageflip/editor-shell` + `apps/stageflip-slide` greenfield shell

No Phase-6-shipped surface is expected to churn for Phase 7.

### 8.4 Operator-next-steps (independent of Phase 7)

- Prime parity goldens by landing a rendering-adjacent PR + committing
  the `parity-goldens-{reference|fixtures}-<sha>` artifacts into each
  fixture's `goldens.dir`. Flips the parity CI gate behavioural.
- Decide on the T-129 deferred tranches: in-scope for Phase 6 exit
  (spawn T-139), out-of-scope (leave for post-Phase-6), or product-
  gated (wait for requirement signal).
- Decide on the bake-tier wiring priority: T-265 (Phase 12) is the
  scheduled home; if an early Phase 7 deck wants to export a
  `video-background` / `gif-player` / `audio-visualizer-reactive`
  clip, consider pulling the `BakeRuntime` impl forward.

---

*End of handover. Next agent: go to §8.2 for the starter prompt.
Phase 6 ratification is outstanding at time of draft.*
