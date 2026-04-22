# Handover — Phase 6 mid-3 (2026-04-22, late session)

Supersedes `docs/handover-phase6-mid-2.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` (Phase 6 detail at **v1.10**), then
`docs/migration/editor-audit.md` for the T-120 inventory.

Current commit on `main`: **`a52a208`** (same as phase6-mid-2 —
the five PRs listed below are open but **not yet merged**). Working tree
clean after this session's branches.

---

## 1. Session PRs (all open, all green on 11 CI gates + 14 Playwright)

| PR | Task | Title |
|---|---|---|
| [#56](https://github.com/marioberlin/stageflip/pull/56) | T-125b | editor-shell: ZodForm auto-inspector + ClipElementProperties |
| [#57](https://github.com/marioberlin/stageflip/pull/57) | T-125c | app-slide: ChartEditor + TableEditor + AnimationPicker |
| [#58](https://github.com/marioberlin/stageflip/pull/58) | T-135  | skills/stageflip/modes/stageflip-slide: substantive final doc |
| [#59](https://github.com/marioberlin/stageflip/pull/59) | T-134  | app-slide: branding pass — Abyssal Clarity tokens + wordmark logo |
| [#60](https://github.com/marioberlin/stageflip/pull/60) | T-136  | app-slide: Phase 6 E2E regression + undo/redo shortcut |
| [#61](https://github.com/marioberlin/stageflip/pull/61) | T-129  | app-slide: ShortcutCheatSheet + StatusBar (first tranche) |

**Six PRs. Each had a pre-merge reviewer-subagent pass; every BLOCKING +
SHOULD finding was addressed before PR open. Second-pass LGTM on the
ones that took BLOCKING fixes (T-125b, T-125c, T-136).**

### Merge order notes

- #56 (T-125b) and #57 (T-125c) both touch
  `apps/stageflip-slide/src/components/properties/selected-element-properties.tsx`
  and `packages/editor-shell/src/i18n/catalog.ts`. A small three-line
  rebase is expected whichever lands second.
- #60 (T-136) adds `Mod+Z` / `Mod+Shift+Z` shortcuts. #61 (T-129) adds a
  `?` shortcut. Both touch the same `shortcuts` `useMemo` deps in
  `editor-app-client.tsx`. Clean merge either order.
- The `isNotEditingText()` helper lands in BOTH #60 and #61 independently
  — second-merged dedupes trivially.
- `properties.typeEditorsStub` copy changes three times across
  #56/#57/#59: once by T-125b, once by T-125c (final form), once by T-129
  (unchanged). Final text: `'No type-specific editor for this element.'`
  (T-125c wins).

### Scope descopes recorded in the plan

- **T-136** — Export PNG descoped. No export button in app-slide today;
  renderer-cdp has its own PNG e2e via T-119. `docs/implementation-plan.md`
  row T-136 updated in #60.
- **T-129** — first tranche only. Ships `<ShortcutCheatSheet>` +
  `<StatusBar>`. Deferred components listed in the updated plan row
  (asset browser, context menu, export/import dialogs, find/replace,
  onboarding, cloud-save, presentation mode, collab UI).
- **T-134** — Abyssal Clarity CSS var set + logo land; incremental
  adoption explicitly deferred. Existing inline-hex components are left
  as-is; future edits swap literals for `var(--ac-*)`.

---

## 2. Test + dependency surface (as of each PR against main)

### Per-package test counts (on top of phase6-mid-2's 1417 total)

| Package | Main-relative delta | End state |
|---|---|---|
| `@stageflip/editor-shell` | +38 (T-125b) +1 (T-134) | 195 |
| `@stageflip/runtimes-contract` | +2 (T-125b) | 16 |
| `@stageflip/app-slide` | +4 (T-125b) +26 (T-125c) +5 (T-134) +4 (T-136) +11 (T-129) = **+50** | 218 if all lands |

Playwright: 11 → 14 on T-136.

### Dependencies

No new third-party deps across all six PRs. `zod` was already in the
tree transitively; T-125b adds it as a direct dep on `editor-shell` +
`runtimes-contract`; T-125c adds it as a direct dep on `app-slide`.
`check-licenses`: 490, unchanged.

### CI gates

All 11 green on every PR. T-134's `<dialog>` a11y compliance + T-129's
`<dialog>` pattern pass Biome's `useSemanticElements` rule.

### Changesets

Six changesets, all `minor` bumps:

- `editor-shell-t125b-zodform.md`
- `runtimes-contract-t125b-propsschema.md`
- `app-slide-t125b-clip-editor.md`
- `app-slide-t125c-domain-editors.md`
- `app-slide-t134-branding.md`
- `app-slide-t136-e2e-regression.md`
- `app-slide-t129-shortcuts-statusbar.md`

---

## 3. Architectural decisions (this session)

### 3.1 ClipDefinition gains `propsSchema?: ZodType<P>` (T-125b)

Optional, non-breaking. Clips that declare one get auto-inspected by
`<ZodForm>`; clips that omit it surface a "no schema" notice in the
inspector. The Phase 7 agent tool-calling path reads the same field
without a further contract bump. Skill doc
(`skills/stageflip/runtimes/contract/SKILL.md`) updated in the same PR.

### 3.2 Commit-on-release is the uniform pattern for continuous inputs

Reinforced across every PR this session. Text / number / slider / color
picker / tag-list / number-list all buffer locally and commit on
blur / Enter / pointerup. Range sliders buffer draft → commit on
pointerup. Native `<input type="color">` buffers draft via onChange →
commits on blur (caught as BLOCKING on T-125b's review). Discrete
controls (booleans, enum selects, buttons) commit on click.

Rule: every input type that can fire `onChange` on every tick / keystroke
MUST buffer locally. The `PropField` / `BlurCommitText` pattern is now
copied in three files — worth extracting into `@stageflip/editor-shell`
in a future cleanup pass (see §7).

### 3.3 Stale-closure-on-Escape guard pattern

T-125c's review caught that `BlurCommitText` in both ChartEditor +
TableEditor pressed Escape → `setDraft(initial)` → `e.currentTarget.blur()`,
but the synchronous blur fires `commit()` before React flushes the state
update, so the closed-over `draft` still has the dirty value. Fixed with
an `isReverting` ref (matches `PropField`'s pattern). Now a codified
pattern — any new blur-commit input must include the ref guard.

### 3.4 `Mod+Z` / `Mod+Shift+Z` must be gated by `isNotEditingText()` (T-136)

Contenteditable nodes own their own undo history. Without the `when`
guard, Mod+Z pops both our doc-level undo AND the browser's native
contenteditable undo, desyncing DOM and document. Added a shared
`isNotEditingText()` helper; reused by T-129's `?` cheat-sheet
shortcut. Worth hoisting into `@stageflip/editor-shell`'s shortcut
module (see §7).

### 3.5 `<dialog>` over `<div role="dialog">`

Biome's `useSemanticElements` prefers native `<dialog>`. T-129 uses it
WITHOUT `showModal()` (which focus-traps) — just sets `open` and
manages Escape manually. Works, passes a11y lint.

### 3.6 Abyssal Clarity CSS vars (T-134)

Full palette now available as `--ac-*` custom properties in
`apps/stageflip-slide/src/app/globals.css`. Existing inline-hex
components are left alone on purpose to keep the PR tight; future edits
swap literals incrementally. Same approach explicitly called out in the
T-134 changeset.

### 3.7 T-129 & T-131 are multi-tranche by construction

Both are L-sized with 20–33 sub-items. Trying to ship all items in one
PR would blow the task window. Pattern: ship a focused first tranche,
update the plan row to record the split + list the deferred items,
open follow-ups on each merge.

---

## 4. Phase 6 state at this handover

| Task | Title | Status |
|---|---|---|
| T-119 through T-128, T-130, T-133, T-133a, T-125a | (as per phase6-mid-2) | ✅ all merged |
| **T-125b** | ZodForm auto-inspector + introspect module | 🟡 PR #56 open |
| **T-125c** | ChartEditor + TableEditor + AnimationPicker | 🟡 PR #57 open |
| **T-134** | Branding pass | 🟡 PR #59 open |
| **T-135** | Slide skill final | 🟡 PR #58 open |
| **T-136** | E2E regression + undo shortcut | 🟡 PR #60 open (ratification gate) |
| **T-129** | Remaining components (first tranche only) | 🟡 PR #61 open |
| **T-131** | 33 clips → ClipRuntime | **PENDING** (L) |
| **T-137** | Visual diff viewer (carried from Phase 5) | pending (M) |
| **T-138** | Auto-fix passes (carried from Phase 5) | pending (L) |

### Phase 6 exit criterion

Six PRs open ratify T-125b/c + T-134 + T-135 + T-136 + T-129 first
tranche. Merging them closes everything on the critical path **except
T-131**. T-137 and T-138 are tooling carry-overs that don't block
ratification.

**Recommendation**: merge #56 → #57 → #58 → #59 → #60 → #61 in that
order, then T-131 first tranche, then convene the ratification pass.

---

## 5. T-131 — the remaining big piece

**Goal** (per plan row): "33 SlideMotion clips ported to new ClipRuntime
(with themeSlots); each clip registered + parity fixture."

### 5.1 Why this needs its own session

Each of the 31 reference clips at
`reference/slidemotion/packages/renderer-core/src/clips/` uses Remotion
primitives directly (`useCurrentFrame`, `spring`, `interpolate`,
`Easing.bezier`). Porting any one of them involves:

1. **Rewrite against frame-runtime** — read our frame via
   `@stageflip/frame-runtime`'s hook, replace Remotion's `spring` with
   our own at `packages/frame-runtime/src/spring.ts` (T-041), replace
   `interpolate` with `packages/frame-runtime/src/interpolate.ts`,
   replace `Easing.bezier` with our named-easing table.
2. **Register in a ClipRuntime** — pick between `runtimes/css`
   (CSS-only, no frame), `runtimes/frame-runtime-bridge` (the
   React+frame-runtime bridge), `runtimes/gsap` (GSAP-backed),
   `runtimes/three` (three.js), etc. Most SM clips need the bridge.
3. **themeSlots wiring** — per plan row. Each clip that takes an
   AC-palette-defaulted prop declares `themeSlots: { propName: role }`
   so document-level theme swaps re-propagate through
   `resolveClipDefaultsForTheme`. Hardcoded palette hex in a clip is
   drift.
4. **Parity fixture** — a render pair (fixture input + golden output)
   under `packages/testing/fixtures/clips/<clip-name>/`. PSNR > threshold
   and SSIM > 0.97 against the golden. Requires the parity harness
   (T-100 family) to be wired to dispatch against the new clip.
5. **ZodForm-ready propsSchema** — optional after T-125b lands, but
   every new clip should declare one so `<ClipElementProperties>`
   auto-inspects it.

Per clip: ~200 LOC source + ~50 LOC tests + 1 parity fixture with a
checked-in golden PNG. Times 33: prohibitively large for a single PR.

### 5.2 Recommended split

The 31 reference clips cluster naturally by runtime affinity. Split T-131
into `T-131a / b / c / d / e` following the Phase 5 L-split convention:

| Sub-task | Runtime | Clips (from reference) | Notes |
|---|---|---|---|
| **T-131a** | `runtimes-css` | solid-background (already shipped), any static text/shape clips with no frame dependence (~3–5) | Simplest tier. Good ramp-up. |
| **T-131b** | `runtimes-frame-runtime-bridge` | The 14 clips that rely only on frame + interpolate/spring (counter, pull-quote, subtitle-overlay, kinetic-text, typewriter-clip, logo-intro, light-leak, chart-build, pie-chart-build, line-chart-draw, comparison-table, stock-ticker, kpi-grid, animated-value) | Bulk of the work. |
| **T-131c** | `runtimes-gsap` | gsap-dependent clips (timeline-milestones if it uses GSAP, etc.) | Read SM source for actual list. |
| **T-131d** | `runtimes-lottie` / `runtimes-three` | lottie-player, scene-3d, shader-bg, particles, animated-map | Heaviest per-clip. |
| **T-131e** | `runtimes-*` (bake tier) | video-background, gif-player, audio-visualizer-reactive, voiceover-narration | Bake-tier clips. |

Each sub-task is its own PR. Critical-path order: T-131a → T-131b
(largest) → T-131c/d/e in parallel.

### 5.3 Prerequisite: ClipDefinition surface is ready

`@stageflip/runtimes-contract` now carries `propsSchema?` (T-125b).
`themeSlots` is NOT in the contract yet — add it as part of T-131a,
alongside a `resolveClipDefaultsForTheme(clip, theme, props)` helper.

### 5.4 Prerequisite: parity harness gate is live

`pnpm parity` gate exists and passes on the 5 existing fixtures per
phase5 handover. Wiring a new clip into the parity suite should be
a thin dispatcher update in `packages/parity-cli`.

### 5.5 Prerequisite: golden PNGs

Handover phase5 §5.5 flagged that golden PNGs committed to the repo are
still "operator-handled". T-131 will surface this gap — every new clip
needs a golden. Can be auto-generated via `stageflip-parity prime`
(T-119b) once a CI operator approves.

---

## 6. How to resume

### 6.1 Starter prompt

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-mid-3.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` (v1.10) for Phase 6 detail, and
> `docs/migration/editor-audit.md` for the T-120 inventory. Confirm
> current state and the next task.

Expected confirmation: *"Phases 1+3+4+5 ratified; Phases 0+2
implementation complete. Phase 6 in progress — T-119 family + T-120 +
T-121 family + T-122 + T-123 family + T-124 + T-126 + T-127 + T-128 +
T-130 + T-133 + T-133a + T-125a merged. Six PRs open from the last
session covering T-125b, T-125c, T-129 (first tranche), T-134, T-135,
T-136. T-131 / T-137 / T-138 pending. Ready."*

### 6.2 First moves

1. **Merge the six open PRs** (#56 → #61) in order. Each has a clean
   reviewer trail + all 11 CI gates green. Expect ~3-line merge conflict
   between #56 and #57 on shared files.
2. **Start T-131a** (CSS-runtime tier) as the smallest ramp-up. Port
   the simplest 3–5 static clips to establish the porting pattern +
   wire themeSlots into the contract. See §5.2.
3. **Parallel-eligible**: T-137 (visual diff viewer — HTML artifact
   consuming `FixtureScoreOutcome`) and T-138 (auto-fix passes) can
   run in parallel with T-131. Both depend only on surfaces that
   already shipped on main.

### 6.3 Patterns that worked this session

- **Pre-merge reviewer pass** on every PR. Caught 6 BLOCKING across 6
  PRs — would have shipped real bugs without it (color-picker undo-stack
  flood, stale-closure-on-Escape, `aria-label` on a plain span, double-
  undo on contenteditable, factual drift in the skill doc).
- **`gh api --method POST /repos/:o/:r/pulls`** REST fallback when
  GraphQL rate-limits (default for this session's PR opens).
- **Plan-row updates in the same PR** when a task reveals a real
  descope (T-129 first tranche, T-136 export-PNG). Documents the
  scope trade-off where future agents will see it.
- **Second reviewer pass after BLOCKING fixes** — catches fix-introduced
  regressions. T-125b and T-125c both cleared second pass as LGTM;
  T-136 did not need a second pass since fixes were additive.

### 6.4 Open follow-ups worth listing

Carried from phase6-mid-2 § 5.5 (unchanged):

1. Golden PNGs committed to repo (operator-handled).
2. `ShortcutHandler` return-type friction.
3. Linux+auto BeginFrame hang.
4. Dev harness Phase 3/4/5 demos.
5. Video codec thresholds in parity-testing/SKILL.md.
6. 60fps scrub exit criterion.
7. `readFrameContextValue` identity function.
8. GSAP publish-gate legal review.
9. T-137 / T-138 visual diff + auto-fix.
10. CDP font pre-embedding.
11. Chromium `--font-render-hinting=none`.
12. Per-package size-limit budgets.
13. Firebase storage backend.
14. Concrete bake runtime.
15. `stageflip doctor` CLI.
16. Puppeteer-screenshot rasterization.
17. Auto-gen `skills/stageflip/reference/cli/SKILL.md`.

**New items from this session**:

- **BlurCommitText extraction**. The pattern is now duplicated across
  `chart-element-properties.tsx`, `table-element-properties.tsx`, and
  parts of `zod-form.tsx`. Worth hoisting into
  `@stageflip/editor-shell` as a shared primitive alongside `PropField`.
- **`isNotEditingText` hoist**. Defined in two places (T-136's
  `editor-app-client.tsx` and T-125b's `app-shortcuts.test.tsx`). Worth
  landing as an exported helper in `@stageflip/editor-shell`'s
  `shortcuts/` module.
- **T-129 deferred components**. Nine dialog/panel components listed in
  the updated plan row; each is a clean M-sized follow-up.
- **Export PNG flow in app-slide** (T-136 descope). Mount an export
  button, wire it to `@stageflip/renderer-cdp`'s dispatch, then add
  an E2E assertion.
- **AbsoluteClarity adoption**. Incremental swap of inline hex → CSS
  var across the slide app. Can be batched as a `chore(app-slide)`
  sweep.

---

## 7. Session stats

- **6 merged PRs opened** (#56–#61) across one working session.
- **~1467 test cases** projected across the workspace once all six
  land (+50 vs phase6-mid-2).
- **14 Playwright E2E tests** (was 11) once #60 lands.
- **490 external deps** (unchanged).
- **0 Remotion imports** (check-remotion-imports scanned 385 files).
- **11 CI gates** green on every PR.
- **7 changesets** recorded.
- **3 plan-row updates** (T-129 descope, T-134 scope boundary, T-136
  export PNG descope).
- **0 escalations** raised.

---

*End of handover. Next agent: start at §6.1. Phase 6 continues —
merge the six open PRs, then split T-131 into a/b/c/d/e per §5.2, then
ratify.*
