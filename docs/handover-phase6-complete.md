# Handover — Phase 6 complete (2026-04-23)

Supersedes `docs/handover-phase6-mid-2.md` as the live starter doc.
If you are the next agent: start here, then `CLAUDE.md`, then
`docs/implementation-plan.md` (now at **v1.12**) for Phase 7.

Status at write-time: **Phase 6 awaiting ratification.** T-120 through
T-138 + T-139a/b/c + the T-140 sweep all merged. Working tree clean
after the T-140 sweep PR merges; every gate green.

---

## 1. Where we are

- **Phase 0 (Bootstrap)** — ratified 2026-04-20. T-001..T-017 done.
- **Phase 1 (Schema + RIR + Determinism)** — ratified 2026-04-20.
  T-020..T-034 done; T-035..T-039 (Firebase) deferred.
- **Phase 2 (Frame Runtime)** — implementation complete. T-040..T-055
  done (16/16).
- **Phase 3 (Runtime Contract + Concrete Runtimes)** — ratified
  2026-04-21. 11/11 done.
- **Phase 4 (Vendored CDP Engine + Export Dispatcher)** — ratified
  2026-04-21. 13/13 done.
- **Phase 5 (Parity Harness + Pre-Render Linter)** — ratified
  2026-04-22. 6 of 8 original rows merged; T-105 → T-137 + T-106 →
  T-138 carried forward and now shipped in Phase 6.
- **Phase 6 (Slide Migration)** — **implementation complete; awaiting
  human ratification** per CLAUDE.md §2.

### Exit criteria (from plan)

> `apps/stageflip-slide` achieves parity with current SlideMotion
> editor; existing SlideMotion documents migrate via
> `@stageflip/import-slidemotion-legacy`.

- **Exit criterion 1 — legacy-import parity.** ✅ T-130 ships the
  one-way converter with a 34-case test suite covering text / image /
  shape / group + solid-color / image backgrounds, structured warnings
  for every lossy mapping, and a final `documentSchema.parse()` gate
  on the output.
- **Exit criterion 2 — `apps/stageflip-slide` parity with SlideMotion.**
  ✅ T-139a/b/c merged (#86 / #87 / #88) closed the nine deferred
  surfaces the orchestrator review of the draft closeout flagged as
  load-bearing: context-menu framework, persistent + contextual
  toolbars, asset browser, three import dialogs (Google Slides / PPTX /
  image upload), export dialog, find/replace, onboarding coachmarks,
  cloud-save panel, presentation mode. Every component ships
  tests-first, catalog-backed i18n copy, and shortcut-registry-routed
  keybindings. The T-140 sweep that produces this handover cleaned up
  the seven reviewer follow-ups from T-139a + T-139c without changing
  behaviour.

No task triggered a formal `docs/escalation-*.md` this phase.

### Phase 6 tasks as shipped

| ID | Title | PR |
|---|---|---|
| T-119 | CI render-e2e job (Chrome + ffmpeg) | #55 |
| T-119b/c/d | Parity `prime` subcommand + converter | #62 / #62b / #62c |
| T-120 | SlideMotion editor audit | #48 |
| T-121a | Shortcut registry + provider | #49 (part) |
| T-121b | Jotai atoms + Document/Auth shells | #49 (part) |
| T-121c | Shell composition + persistence + i18n catalog | #49 (part) |
| T-122 | Walking skeleton `apps/stageflip-slide` | #49 (part) |
| T-123a | `<SlideCanvas>` viewport | #50 |
| T-123b | `<SelectionOverlay>` + transform handles | #51 |
| T-123c | `<InlineTextEditor>` + `<TextSelectionToolbar>` | #52 |
| T-123d | `<SlidePlayer>` via `@stageflip/frame-runtime` | #53 |
| T-124 | Filmstrip | #54 |
| T-125a | `<PropertiesPanel>` router + Selected/Slide stubs | #53 |
| T-125b | ZodForm auto-inspector + introspect | #56 |
| T-125c | ChartEditor + TableEditor + AnimationPicker | #57 |
| T-126 | TimelinePanel | #54 |
| T-127 | Command palette + tool search | #54 |
| T-128 | AI copilot sidebar + streaming stub | #50 |
| T-129 | Remaining components (first tranche) | #61 |
| T-130 | `@stageflip/import-slidemotion-legacy` | #51 |
| T-131a | `runtimes-css` + `themeSlots` | #63 |
| T-131b.1/b.2/b.3 | `runtimes-frame-runtime-bridge` 14 clips | #64 / #65 / #66 |
| T-131c | GSAP tier scope-zero | #68 |
| T-131d.1/.2/.3/.4 | lottie/three/shader + animated-map | #67 / #74 / #75 / #80 |
| T-131e.0/.1/.2 | bake-tier media-host + 4 clips | #71 / #72 / #73 |
| T-131f.1 | 4 bridge standalones | #69 |
| T-131f.2a/b/c | 5 dashboard composites | #76 / #77 / #78 |
| T-131f.3 | Financial statement composite | #79 |
| T-133 | Undo/redo via fast-json-patch | #49 |
| T-133a | Coalescing transaction API | #54 |
| T-134 | Branding pass — Abyssal Clarity tokens | #59 |
| T-135 | `skills/stageflip/modes/stageflip-slide/SKILL.md` | #58 |
| T-136 | E2E Playwright regression | #60 |
| T-137 | Visual diff viewer (`stageflip-parity report`) | #81 |
| T-138 | Auto-fix passes with iterative convergence | #82 |
| (polish) | Phase 6 polish — shader warn + commentary + currency | #83 |
| **T-139** | **spawned via plan v1.11 bump** | #85 |
| **T-139a** | **Context-menu framework + persistent/contextual toolbars** | **#86** |
| **T-139b** | **Asset browser + import/export dialogs** | **#87** |
| **T-139c** | **Find/replace + onboarding + cloud-save + presentation** | **#88** |
| **T-140** | **Phase 6 closeout sweep (this PR)** | **(this PR)** |

---

## 2. Test + dependency surface

### Per-package test counts on `main` (end of Phase 6)

| Package | Cases |
|---|---|
| `@stageflip/schema` | 92 |
| `@stageflip/rir` | 36 |
| `@stageflip/storage` | 23 |
| `@stageflip/frame-runtime` | 345 |
| `@stageflip/determinism` | 14 |
| `@stageflip/skills-core` | 14 |
| `@stageflip/testing` | 39 |
| `@stageflip/runtimes-contract` | 26 |
| `@stageflip/runtimes-frame-runtime-bridge` | 392 |
| `@stageflip/runtimes-css` | 23 |
| `@stageflip/runtimes-gsap` | 12 |
| `@stageflip/runtimes-lottie` | 33 |
| `@stageflip/runtimes-shader` | 38 |
| `@stageflip/runtimes-three` | 15 |
| `@stageflip/fonts` | 23 |
| `@stageflip/renderer-cdp` | 242 |
| `@stageflip/parity` | 40 |
| `@stageflip/cdp-host-bundle` | 29 |
| `@stageflip/parity-cli` | 93 |
| `@stageflip/validation` | 69 |
| `@stageflip/skills-sync` | 9 |
| `@stageflip/import-slidemotion-legacy` | 34 |
| `@stageflip/editor-shell` | 263 |
| `@stageflip/app-slide` | 314 |
| **Total** | **~2218** |

`app-slide` Playwright e2e (T-136): **11 passing** walking-skeleton
specs.

### CI gate surface — all green on every merge

```
pnpm typecheck
pnpm lint
pnpm test
pnpm check-licenses               — 490 deps
pnpm check-remotion-imports       — 535 files scanned, 0 matches
pnpm check-determinism            — 57 files scanned
pnpm check-skill-drift            — link-integrity + tier-coverage
pnpm skills-sync:check            — schema + validation-rules in sync
pnpm size-limit                   — frame-runtime 19.52 kB, bundle 367.33 kB
pnpm parity                       — structural (goldens still deferred)
```

### Dependencies

490 external deps license-audited (PASS). The T-139 family and T-140
sweep did not add any new dependencies — every UI surface uses the
already-pinned React 19 / Jotai / fast-json-patch / Zod stack.

### Changesets recorded this phase (T-139 + T-140)

- `t139a-context-menu-toolbars.md` — editor-shell minor, app-slide minor
- `t139b-assets-and-dialogs.md` — editor-shell minor, app-slide minor
- `t139c-find-replace-onboarding-cloud-presentation.md` — both packages minor
- `t140-phase6-sweep.md` (this PR) — editor-shell minor (context-menu
  Escape API shape change + modal-shell shortcut pattern), app-slide
  minor

All on `private: true` packages; publish deferred to Phase 10.

---

## 3. Architectural decisions (T-139 + T-140 only)

Layered on top of `handover-phase6-mid-2.md` §3.

### 3.1 Context-menu registry mirrors shortcut registry (T-139a)

`<ContextMenuProvider>` holds a single `contextmenu` listener on
`window`; descriptors register via `useRegisterContextMenu(descriptor)`
analogous to `useRegisterShortcuts`. Descriptors carry a
`match(target: HTMLElement | null) → boolean` predicate and an ordered
item list. First match wins (registration order); non-matches let the
browser's native menu survive — scrollbars + URL bar keep working.
i18n labels via `labelKey` piped through `t()`; keybind hints via
`formatCombo()` stay in sync with the shortcut grammar. Hand-rolled
rather than Radix to keep the dep graph lean; documented in
`skills/stageflip/concepts/editor-context-menu/SKILL.md`.

### 3.2 Viewport clamp on context menus (T-139b)

`clampToViewport(x, y, w, h, vw, vh)` is a pure helper + a
`useLayoutEffect` re-positioner in `<Menu>`. Opens the menu at the
cursor, measures `getBoundingClientRect()` on the second pass, flips
the origin toward the viewport interior if it would overflow right or
bottom. Fixes the near-edge right-click case for the asset browser
(cells adjacent to the right-side panel).

### 3.3 Contextual toolbar is read-only for non-text elements (T-139a)

Shape / image / video / table / chart / clip selections surface the
selection type + current values as read-only badges. Editing flows
live in T-125a's `<PropertiesPanel>` router (via
`ClipElementProperties` / `ChartEditor` / `TableEditor` /
`AnimationPicker`). Text is the single exception — inline bold /
italic / alignment map 1-1 to contenteditable commands rather than
atom mutations, so the toolbar carries those directly. Invariant
documented in the context-menu SKILL.md by T-140 #4 after the T-139a
reviewer flagged re-litigation risk.

### 3.4 Modal keyboard owners go through the shortcut registry (T-140)

Presentation mode, modal-shell, and the context-menu provider all had
raw `window.addEventListener('keydown', ...)` listeners at T-139c
merge. CLAUDE.md §10 mandates every keyboard shortcut flows through
`useRegisterShortcuts`. T-140 migrated all three:

- **`<PresentationMode>`** — nine shortcuts (arrows / Space / Enter /
  Backspace / Escape / `s`) registered when `open === true`,
  unregistered on close. Relies on the registry's `isTypingTarget`
  guard for bare-key suppression.
- **`<ModalShell>`** — one Escape shortcut per open modal, keyed on
  `testIdSuffix` for uniqueness. Nested modals rely on registration
  order (FIFO; inner modal registers last so its iteration-order
  priority is lower, but the registry stops on first handled match).
- **`<ContextMenuProvider>`** — the defensive window-level Escape
  listener is gone entirely; the menu root auto-focuses on open and
  its element-level `onKeyDown` handler owns Escape dispatch.

### 3.5 Monotonic slide-id counter (T-140)

T-139a minted slide ids via `Math.random().toString(36).slice(...)`
which produced 8-char suffixes. T-140 #3 replaces with a
module-scoped monotonic counter, seeded from the maximum numeric
suffix of any pre-existing `slide-N` id on first mint. One counter per
browser tab (editor-app-client is a client-only module). Collision-
free for any session length.

### 3.6 i18n key discipline (T-140 #2 + #6)

Two housekeeping items that hit the catalog:

- `toolbar.persistent.ariaLabel` added; the last bare `aria-label`
  literal on `<PersistentToolbar>` migrates to `t()`.
- `findReplace.contextMenu.replaceOne` + `.skip` keys removed. T-139a
  seeded them in anticipation of a right-click match-action menu; the
  T-139c find-replace dialog ships Prev / Next / Replace / Replace All
  buttons instead, and the highlight rectangles on the canvas have
  `pointerEvents: 'none'` (can't host a right-click target). Wiring a
  contrived context-menu surface was out of scope; the keys come out
  of the catalog rather than sit unused.

---

## 4. Conventions reinforced this phase

Layered on `handover-phase6-mid-2.md` §4:

- **Spawn late-breaking tasks rather than descope.** The draft Phase 6
  closeout's first round flagged nine deferred surfaces as follow-ups;
  the orchestrator review ruled them load-bearing for exit criterion
  2 and spawned T-139 (pre-split into a/b/c) rather than carrying
  them to Phase 7. Three M-sized PRs merged in under 48 hours; T-140
  sweep closes the loop.
- **Reviewer follow-ups are first-class.** Every PR's reviewer thread
  produces a list of "non-blocking but worth a sweep" items. T-140 is
  the first time we've bundled them into a dedicated task rather than
  leaving them scattered in GitHub comments. Low-friction; repeatable.
- **i18n discipline holds.** Every new user-visible string in the
  T-139 family landed as a catalog key + `t()` call site. The T-140
  sweep surfaced the one bare `aria-label` literal that slipped
  through in T-139a and migrated it without ceremony.
- **Shortcut registry is the singleton keydown owner.** No
  component-local `addEventListener('keydown', ...)` survives
  post-T-140. Modals + overlays either register via the registry or
  use element-level `onKeyDown` on a focused container.

---

## 5. Flagged risks + follow-ups (by urgency)

### §5.1 Parity gaps against the SlideMotion reference

**Closed this phase.** The nine deferred surfaces flagged at
handover-phase6-mid-2 time (asset browser, context-menu framework,
persistent / contextual toolbars, export dialog, three import dialogs,
find/replace, onboarding, cloud-save panel, presentation mode) all
shipped under T-139a/b/c. See §1 exit-criterion 2 + §C.10 v1.11 / v1.12
plan changelog for detail.

### §5.2 Goldens not primed

Carried from Phase 5. The 5 parity fixtures in
`packages/testing/fixtures/` still lack committed PNG goldens. T-119b
+ T-119c + T-119d shipped the CLI + converter + CI artifact step that
make priming a normal PR flow, but the actual operator priming pass
(render → inspect → commit) hasn't been run. Non-blocking for Phase 6
ratification since the harness is structurally green; promote to
Phase 7 tooling work.

### §5.3 Bake-tier dispatcher

Carried from T-131e.0/.1/.2. The four bake-tier clips ship the bridge-
style preview path via `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>`;
concrete `BakeRuntime` wiring + the app-slide dispatcher hookup
remains a Phase 7+ question. Doesn't block Phase 6 exit — preview
renders work today; deterministic export of those specific clips
defers.

### §5.4 Parity fixture goldens (duplicate of §5.2 for emphasis)

The §5.2 flag is the same concern. Carry forward.

### §5.5 Small post-Phase-6 follow-ups

Low-urgency cleanups that landed in reviewer notes:

- Auto-generated schema skill "object object object…" artifact (Phase
  1 §6.10, carried).
- Video codec threshold rows in `parity-testing/SKILL.md` still
  marked `(TBD)` — calibrate when the first codec parity fixture
  primes goldens.
- `readFrameContextValue` identity function from Phase 2 still public
  API. No natural retirement point surfaced in Phase 6.
- GSAP publish-gate legal review — blocks `private: false` on
  `@stageflip/runtimes-gsap` + `@stageflip/cdp-host-bundle` at Phase
  10. Unchanged from Phase 5.

### §5.6 Post-T-139 follow-ups captured by T-140 sweep (shipped)

All seven items landed on this PR:

1. **Context-menu Escape consolidated into element-level handler.**
   The window-keydown listener inside `<ContextMenuProvider>` was
   defensive-redundant with the menu root's own `onKeyDown`; removed.
   Rationale: keep the shortcut registry as the singleton keydown
   owner (CLAUDE.md §10 spirit, if not letter — modal dismissal
   isn't a net-new keyboard shortcut).
2. **Persistent-toolbar `aria-label` migrated to `t()`.** One bare
   literal remained on `<PersistentToolbar>` after T-139a; catalog key
   `toolbar.persistent.ariaLabel` added in T-140.
3. **Monotonic slide-id counter.** Replaces `Math.random()`-minted
   suffixes with a seeded counter. Collision-free.
4. **Context-menu SKILL.md documents the read-only-for-non-text
   invariant.** One paragraph added so future contributors don't
   re-litigate the "editing lives in PropertiesPanel" boundary.
5. **Raw `addEventListener('keydown', ...)` removed across three
   files** — `<PresentationMode>`, `<ModalShell>`, and
   `<ContextMenuProvider>`. First two now register via
   `useRegisterShortcuts`; third drops the listener entirely.
6. **Find-replace context-menu keys removed.** Unused per the
   T-139c PR-description drift flag. Drop-keys variant picked after
   assessing the match UI — highlight rectangles are
   `pointerEvents: 'none'`, so right-click wiring would require a
   non-trivial UI refactor outside T-140 scope.
7. **PR #88 description drift acknowledged in this handover** — the
   find-replace dialog never consumed `useRegisterContextMenu` as the
   T-139c description claimed. Item 6 resolves the keys; the text
   drift is recorded here and in the T-140 PR body.

---

## 6. File / directory map delta — T-139 + T-140 additions

```
packages/editor-shell/src/
  context-menu/                               [NEW — T-139a]
    context-menu-provider.tsx                 single contextmenu listener + registry
    context-menu.tsx                          open-state renderer + clampToViewport
    matches-target.ts                         pure pickContextMenu() dispatcher
    clamp-to-viewport.test.ts                 T-139b clamp helper tests
    types.ts                                  descriptor + item shapes
    {*.test.tsx}                              ~20 cases across the module
  assets/                                     [NEW — T-139b]
    assets-atom.ts                            assetsAtom + selected/add/remove/replace
    assets-atom.test.ts                       9 cases
  find-replace/                               [NEW — T-139c]
    find-matches.ts                           pure case/whole-word/regex scanner
    replace-all.ts                            structurally-shared doc rewrite
    find-highlights-atom.ts                   layered canvas highlight state
    index.ts                                  barrel
    {*.test.ts}                               21 cases
  cloud-save/                                 [NEW — T-139c]
    adapter.ts                                CloudSaveAdapter contract
    stub-adapter.ts                           in-memory + latency-knob stub
    index.ts                                  barrel
    stub-adapter.test.ts                      7 cases
  i18n/catalog.ts                             [MOD] +~90 keys (T-139a/b/c);
                                              +toolbar.persistent.ariaLabel (T-140);
                                              −findReplace.contextMenu.* (T-140)

apps/stageflip-slide/src/components/
  toolbar/                                    [NEW — T-139a]
    persistent-toolbar.tsx                    top-of-canvas global actions
    contextual-toolbar.tsx                    selection-driven floating bar
    {*.test.tsx}                              20 cases
  asset-browser/                              [NEW — T-139b]
    asset-browser.tsx                         filter + grid + right-click menu
    asset-browser.test.tsx                    7 cases
  dialogs/                                    [NEW — T-139b + T-139c]
    modal-shell.tsx                           shared dialog chrome (T-139b)
    import/
      google-slides-import.tsx                OAuth stub + injectable onFetchDeck
      pptx-import.tsx                         picker + feature-flag stub
      image-upload.tsx                        file picker → assetsAtom append
    export/
      export-dialog.tsx                       format × resolution × range picker
    find-replace/
      find-replace.tsx                        dialog around findMatches / replaceAll
  onboarding/                                 [NEW — T-139c]
    onboarding.tsx                            5-step coachmark with localStorage flag
  cloud-save/                                 [NEW — T-139c]
    cloud-save-panel.tsx                      status + manual save + conflict UI
  presentation/                               [NEW — T-139c]
    presentation-mode.tsx                     full-screen player + keyboard nav
  canvas/find-highlights-overlay.tsx          [NEW — T-139c] match rectangles
  app/editor-app-client.tsx                   [MOD] mounts T-139a/b/c surfaces;
                                              T-140 monotonic slide-id counter

skills/stageflip/concepts/editor-context-menu/
  SKILL.md                                    [NEW — T-139a];
                                              [MOD — T-140] read-only invariant paragraph

docs/
  handover-phase6-complete.md                 [NEW — T-140] this doc
  implementation-plan.md                      [MOD] v1.11 → v1.12;
                                              Phase 6 status flipped to ⏳ Awaiting ratification

.changeset/
  t139a-context-menu-toolbars.md              [NEW]
  t139b-assets-and-dialogs.md                 [NEW]
  t139c-find-replace-onboarding-cloud-presentation.md [NEW]
  t140-phase6-sweep.md                        [NEW]
```

---

## 7. Statistics — end of Phase 6

- **~40 merged PRs** across Phase 6 (T-119 family → T-140 sweep).
- **2218 test cases** across 24 test-active packages + 1 app; ~577 in
  the post-T-139 touched packages (`editor-shell` 263 + `app-slide`
  314). Up ~800 from Phase 5's 1047.
- **11 Playwright walking-skeleton tests** (from T-136).
- **490 external deps** license-audited (PASS); no new deps in the
  T-139 family or T-140 sweep.
- **535 source files** scanned for Remotion imports — zero matches.
- **57 source files** scanned for determinism violations — zero.
- **9 CI gates** green on every merge (typecheck / lint / test /
  check-licenses / check-remotion-imports / check-determinism /
  check-skill-drift / skills-sync:check / size-limit; parity is
  path-filtered + structural).
- **4 plan-version bumps** this phase (v1.7 → v1.12): v1.7 T-119b
  narrow + T-119d add; v1.8 T-121 split; v1.9 T-123 split; v1.10
  T-125 split; v1.11 T-139 spawn; v1.12 Phase 6 awaiting
  ratification.
- **0 escalations** raised.

---

## 8. How to resume

### 8.1 Starter prompt for the next session

> I'm continuing StageFlip development from a fresh context. Read
> `docs/handover-phase6-complete.md` top to bottom. Then `CLAUDE.md`.
> Then `docs/implementation-plan.md` (now at v1.12) for Phase 7.
> Confirm current state and the next task.

Expected confirmation: *"Phases 1+3+4+5 ratified; Phases 0+2
implementation complete. Phase 6 awaiting ratification. Next work:
Phase 7 — Agent + Semantic Tools (Planner + Executor + Validator
over hierarchical tool bundles)."*

### 8.2 Orchestrator checklist for Phase 6 ratification

Before stamping "✅ Ratified 2026-04-xx" in
`docs/implementation-plan.md`:

- [ ] `pnpm install --frozen-lockfile` clean.
- [ ] All 9 gates green on `main`.
- [ ] `docs/implementation-plan.md` Phase 6 row gets the ✅ Ratified
      banner.
- [ ] Confirm §5.2 (golden priming) carries to Phase 7 as tooling
      work; assign an owner.
- [ ] Confirm §5.3 (bake-tier dispatcher) carries to Phase 7+.
- [ ] Confirm §5.5 small follow-ups list is accurate.

### 8.3 What Phase 7 looks like

Phase 7 is the AI plane: Planner + Executor + Validator over the tool
bundles seeded in `skills/stageflip/tools/**`. T-128's AI copilot stub
(`apps/stageflip-slide/src/components/ai-copilot/`) is the UI surface
Phase 7 wires to real execution. The `/api/agent/execute` route in the
Next.js app is the HTTP seam; the stub currently returns 501 →
`pending`, which becomes the contract Phase 7's executor fulfills.

Scope for the opening Phase 7 task cluster (per the plan):

- Tool-router + handler registration in `packages/engine/`.
- Hierarchical tool bundles keyed on `skills/stageflip/tools/<cat>/SKILL.md`.
- Planner / Executor / Validator loop with validation via T-104's
  `@stageflip/validation` + T-138's `autoFixDocument`.
- API wiring so `<AiCopilot>` stops returning `pending`.

---

*End of handover. Next agent: start at §8.1. Phase 7 opens with the
agent plane; golden priming + bake-tier dispatcher ride along as
Phase 7+ tooling work.*
