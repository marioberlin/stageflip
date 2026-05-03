# @stageflip/app-slide

## 0.1.0

### Minor Changes

- c985aa2: T-122: walking skeleton for `apps/stageflip-slide`.
  - Next.js 15.5 App Router scaffold (tsconfig, next.config, layout,
    globals.css) on port 3100.
  - Root page mounts `<EditorShell>` with a seeded "walking-skeleton"
    document (one empty slide) and renders a blank 1920×1080 SVG canvas
    inside a header/main/canvas layout.
  - `/api/agent/execute` stubs the Phase 7 agent route: `POST` returns
    a structured 501 with `{ error: 'not_implemented', phase: 'phase-7' }`;
    `GET` returns 405. Gives component ports a stable URL to aim at.
  - Playwright walking-skeleton spec (3 tests) plus app-local
    `playwright.config.ts` with a `next start` webServer on port 3100.
    Wired into root `pnpm e2e:slide` and a new CI step in `e2e` job.
  - Drops `sharp` (Next's image-optimizer binary) via pnpm
    `ignoredOptionalDependencies` — its `@img/sharp-libvips-*`
    transitive is LGPL-3.0, not whitelisted. `next.config.mjs` sets
    `images: { unoptimized: true }` so Next doesn't try to require the
    missing binary at request time. No product loss; the walking
    skeleton ships no raster images.

  Opens T-123..T-129 component ports: each now has a real shell to
  render into and a real agent URL to call.

- 27f3f36: T-123a: `<SlideCanvas>` viewport + `<ElementView>` read-only renderer.

  Replaces the walking-skeleton blank SVG with a real scale-to-fit
  canvas:
  - **`<SlideCanvas>`** — resolves the active slide via
    `activeSlideIdAtom` + `slideByIdAtom` (T-121b), applies a CSS
    `transform: scale(min(width/1920, height/1080))` so canvas-space
    coordinates (1920×1080) keep working as the viewport resizes.
    ResizeObserver-backed; a `viewportSizeForTest` prop bypasses it for
    unit tests.
  - **`<ElementView>`** — positions each element at its `transform.x/y`
    with rotation/opacity applied. Per-type renderers: text → styled
    span, shape → SVG (rect / ellipse / custom-path), image + video →
    labelled placeholder that exposes the `asset:…` ref as a data
    attribute (real resolver arrives with T-084a), group → recursive
    render, chart/table/clip/embed/code → kind-labelled placeholder.
  - **`editor-app-client.tsx`** — seeds two text elements on the initial
    slide and hydrates `activeSlideIdAtom` on mount so the first paint
    shows the canvas populated. Header + layout unchanged.
  - **Walking-skeleton e2e** — now asserts the canvas renders with the
    seeded `element-seed-title` + `element-seed-subtitle` nodes visible.

  Tests: 18 new vitest cases (11 for ElementView, 7 for SlideCanvas),
  plus the extended e2e. Interactions (selection, drag, text edit,
  animated playback) arrive with T-123b/c/d.

- e38a554: T-123b: `<SelectionOverlay>` with 8 resize handles + rotation + move drag.

  Second of four rows split from T-123 (CanvasWorkspace port).
  - **`<CanvasScaleProvider>`** — React context carrying the live
    scale-to-fit factor from `<SlideCanvas>`. Consumers (overlay and any
    future transform UI) divide client-pixel deltas by this to re-enter
    canvas-space coordinates.
  - **`<SelectionOverlay>`** — renders one overlay per id in
    `selectedElementIdsAtom`. Each overlay has:
    - Bounding-box body that drives a **move** gesture on drag.
    - 8 **resize handles** (4 corners + 4 edges) with correct origin-
      anchoring (top-left shrinks from origin, bottom-right grows away
      from it, edges touch only one dimension).
    - Rotation handle above the top-center that writes normalized
      (0–360) rotation to the transform.
    - Enforces 1px minimum width/height so over-shrinks can't invert
      the box.
  - Commits go through `useDocument().updateDocument(...)` — mutates the
    canonical source document deeply so nested group children also
    update. History capture (undo per gesture) lands with T-133.
  - `<SlideCanvas>` now wires pointer-down on elements → select, and on
    the bare plane → clear selection.
  - `<ElementView>` accepts an optional `onPointerDown` handler; absence
    keeps elements inert (unchanged for tests that render it standalone).
  - Walking-skeleton e2e extended: click the seeded title → assert the
    overlay + corner handles + rotation handle mount.

  10 new vitest cases (move/resize/edge/rotation/min-size) + 1 new e2e.
  All 11 CI gates green locally.

- fa0c5e4: T-123c: InlineTextEditor + TextSelectionToolbar.

  Third of four rows split from T-123 (CanvasWorkspace port).
  - **`<InlineTextEditor>`** — contenteditable span that replaces a text
    element's static render while being edited. Commits the live
    `textContent` to `element.text` via `useDocument().updateDocument`
    on Enter (without Shift) or blur; Escape abandons. Writes nothing
    to the document when the text hasn't changed. Mounts focused with
    the whole text pre-selected so the first keystroke replaces.
  - **`<TextSelectionToolbar>`** — floating toolbar above the active
    editor with four buttons: bold / italic / underline / link. Each
    button toggles whole-element formatting on the element's `runs[0]`
    (weight 700, italic, underline); link is a UI stub (no schema
    write) until a later iteration adds link support. Runs are
    dropped back to `undefined` when all flags return to their
    defaults so docs don't bloat.
  - **`<ElementView>`** accepts `onDoubleClick` + a `children` override
    so the canvas can render the editor in place of the static text.
  - **`<SelectionOverlay>`** forwards double-click on the move-body up
    to the canvas (`onElementDoubleClick`). Without this the overlay
    swallows the second click of a double-click gesture on a selected
    element.
  - **`<SlideCanvas>`** tracks an `editingId` local state; on
    double-click of a text element, mounts the editor + toolbar and
    hides the selection overlay while editing. Empty-plane click
    exits edit mode.
  - Walking-skeleton e2e: new test — double-click the seeded title →
    assert the editor + toolbar mount.

  12 new vitest cases (6 editor, 6 toolbar) + 1 new e2e. 41 app tests
  total. All 11 CI gates green locally.

- 4dd40ed: T-123d: `<SlidePlayer>` — frame-driven slide preview via `@stageflip/frame-runtime`.

  Fourth and final row split from T-123 (CanvasWorkspace port). Closes
  the CanvasWorkspace tier.

  **`<SlidePlayer>`** replaces the Remotion-based `SingleSlidePreview`
  / `PlayerPreview` from the SlideMotion reference. Zero Remotion
  imports — animation math runs through `@stageflip/frame-runtime`
  (`interpolate`, `EASINGS`, `FrameProvider`, `VideoConfig`).

  Features:
  - Renders each element at its per-frame transform. `absolute` timing
    - `fade` animations with every named easing the runtime ships;
      other timing / animation kinds pass through unchanged (placeholder
      until the full compile pipeline arrives).
  - Drives a `<FrameProvider>` over the element tree so downstream
    clips / runtimes can `useCurrentFrame()`.
  - `playing` prop enables `requestAnimationFrame`-driven playback; a
    `cancelled` flag + `cancelAnimationFrame` guarantee clean teardown
    on unmount.
  - `currentFrame` + `onFrameChange` props let T-126 (timeline) scrub
    externally.
  - Exports `applyAnimationsAtFrame(element, frame, fps)` so tests and
    tooling can introspect the snapshot without mounting React.

  **App integration:** header gets a mode toggle (Edit ↔ Preview). In
  preview mode, `<SlideCanvas>` unmounts and `<SlidePlayer>` renders
  the active slide at frame 0 ready for T-126's timeline to drive.

  **Tests:** 10 vitest cases (fade math, scrub mode, rAF playback with
  a stubbed queue) + 1 e2e asserting the toggle swaps the surfaces.
  No new external deps.

  Runtime dep added: `@stageflip/frame-runtime` (workspace).

- dabe00b: T-124: `<Filmstrip>` — vertical slide-thumbnail rail.
  - **`<SlideThumbnail>`** — reuses `<ElementView>` at a fixed 160×90
    frame via a CSS scale. No separate `CssSlideRenderer` — same code
    path as the main canvas guarantees the thumb matches what the
    canvas shows.
  - **`<Filmstrip>`** — vertical rail showing every slide. Active slide
    gets a blue border + `aria-current`. Click replaces selection +
    activates; **Shift / Cmd / Ctrl click** toggles membership in
    `selectedSlideIdsAtom` without changing the active slide.
  - **Add slide** button at the bottom appends a blank slide via
    `updateDocument` (id generated via `crypto.randomUUID` with a
    `Math.random` fallback for older runtimes) and sets it active.

  **Deferred** (out of scope per plan v1.9 T-124 row, tracked in the
  audit §1 but not critical for the walking skeleton):
  - Drag-reorder
  - Right-click context menu

  **App integration** — `editor-app-client.tsx` splits the workspace
  into `<Filmstrip>` + canvas/preview; the walking-skeleton doc now
  seeds a second slide so the rail has material to show.

  **Walking-skeleton e2e** — new test asserting the filmstrip renders
  two slides and clicking the second swaps `slide-canvas`'s
  `data-active-slide-id`. Existing specs re-scoped to the canvas plane
  so filmstrip thumbnails (which reuse element ids) don't collide with
  strict-mode locator matching.

  7 new vitest cases; 84 app tests + 8 e2e green. No new deps.

- c126eba: T-125a — PropertiesPanel router + SelectedElementProperties + SlideProperties.
  Right-rail `<aside>` that branches on selection: when an element is
  selected, shows its position / size / rotation / opacity / visibility /
  lock / z-order / delete affordances; when no element is selected, shows
  a read-only summary of the active slide plus an editable notes textarea.
  ZodForm, ChartEditor, TableEditor, AnimationPicker, and the typography
  and color editors are deferred to T-125b / T-125c — the element branch
  displays a placeholder in their slot. All mutations route through
  `updateDocument`, so T-133 undo/redo covers every edit automatically.
- 753b22a: T-125b — `<ClipElementProperties>` slots into the T-125a
  PropertiesPanel router for `element.type === 'clip'`. Resolves the
  selected clip via `@stageflip/runtimes-contract`'s `findClip(kind)`,
  reads its `propsSchema`, and mounts a `<ZodForm>` whose commits write
  back to `element.params` through `useDocument().updateDocument`. Three
  fallbacks: unknown clip kind → "not in any registered runtime"; clip
  without a `propsSchema` → "no schema"; locked element → all inputs
  disabled. The prior `prop-type-placeholder` notice remains for every
  non-clip element type (chart / table / animation arrive in T-125c).
- 6019f5f: T-125c — three domain editors slot into the T-125a PropertiesPanel
  router plus a universal AnimationPicker section.
  - `<ChartElementProperties>` (for `element.type === 'chart'`) — chart
    kind enum picker, legend / axes toggles, inline-data series editor
    (blur-commit name + comma-separated values, add / remove series).
    `DataSourceRef`-bound charts surface a read-only notice (binding UI
    lands with T-167).
  - `<TableElementProperties>` (for `element.type === 'table'`) — rows /
    columns read-outs with paired add / remove buttons (remove disabled
    at the schema min of 1), headerRow toggle, per-cell content text
    input (blur-commit) + align select. colspan / rowspan / color are
    deferred.
  - `<AnimationPicker>` — always-on section above Delete. Preset buttons
    append an `Animation` with validated defaults for each of the 7
    AnimationKind branches (fade / slide / scale / rotate / color /
    keyframed / runtime); each existing animation renders a read-only
    kind label + remove. IDs minted via `crypto.randomUUID()`.

  Every mutation flows through `updateDocument`; continuous inputs
  buffer locally and commit on blur / Enter (handover-phase6-mid-2
  §3.3), so T-133 captures one undo entry per gesture. Pre-existing
  `properties.typeEditorsStub` copy updated — with T-125c shipped, the
  stub is reserved for element types without a dedicated editor (text,
  shape, image, code, embed, audio, video, group).

  New i18n keys under `properties.chart.*`, `properties.table.*`, and
  `properties.animation.*`.

- 960d094: T-126: `<TimelinePanel>` — ruler, tracks, scrubber, and pixel-math helpers.

  Ports the Remotion-free equivalent of the SlideMotion timeline from
  `reference/.../timeline/`.
  - **`timeline-math.ts`** — pure pixel/frame conversion + snap + ruler
    tick spacing + label formatter. Keeps the components dumb and
    deterministic; tests live in the math file, not in the components.
  - **`<TimelinePanel>`** — controlled wrapper (audit §2 calls this the
    cleanest port: no atom subscriptions, parent drives `currentFrame`
    - `onCurrentFrameChange`). Lays out:
    * `Ruler` — tick marks + second labels. Tick density auto-adapts to
      the current zoom via `rulerTickFrames`.
    * `Track` per element — name label + timing block per animation.
      `absolute` timings render a sized gradient block; other kinds
      render a striped placeholder with `data-timing-kind` preserved
      so reviewers can tell the compile pass isn't wired yet.
    * `Scrubber` — vertical `#5af8fb` playhead; hit-area above the
      ruler captures pointer-down + pointer-move to drive the parent
      scrub callback. Clamps to `[0, durationInFrames - 1]` and
      accounts for `scrollLeft` so the math works after the user pans
      the timeline.
    * Readout — frame number + humanized seconds (`0.5s`, `1s`,
      `2.5s`) under the scroll area.
  - **App integration** — `editor-app-client.tsx` threads a single
    `currentFrame` state through both `<SlidePlayer>` (preview mode)
    and `<TimelinePanel>` (visible in both modes). Scrubbing the
    timeline drives the player; `SlidePlayer.onFrameChange` feeds back
    into the same state so pause leaves the scrubber at the rAF-
    advanced position.

  22 new vitest cases (14 math, 8 panel) + 1 new e2e test; 77 app tests
  - 7 e2e total, all green. All 11 CI gates clean.

- cd22e88: T-127: `<CommandPalette>` — searchable modal dispatching local commands.

  Ports the SlideMotion command palette to the Remotion-free editor.
  Phase 7 (agent/engine tool router) will feed additional entries into
  the same declarative `PaletteCommand` registry without touching the
  UI shape.
  - **`commands.ts`** — plain-data `PaletteCommand[]` with `id`, `label`,
    `category` (`slide` / `selection` / `edit` / `view` / `help`),
    optional `shortcut` label, and a `run(ctx)` closure. Pure
    `filterCommands(cmds, query)` (case-insensitive substring across
    label + category + shortcut) drives the list.
  - **Default commands** wired via `useDocument`:
    - `slide.new` — appends a blank slide, activates it.
    - `slide.duplicate` — clones the active slide, activates the copy.
    - `slide.delete` — removes the active slide (refuses when the deck
      would be orphaned); active-slide rolls to the adjacent id.
    - `selection.clear` — calls `clearSelection`.
    - `help.palette` — UI placeholder that simply closes the palette.
  - **`<CommandPalette>`** — `<dialog>`-based modal with `role` semantics
    for the listbox items. Auto-focuses the input on open, `ArrowDown` /
    `ArrowUp` move the cursor, `Enter` runs, `Escape` or backdrop click
    dismisses. Commands can return `false` to leave the palette open
    (validation errors).
  - **App wiring** — `<EditorFrame>` registers a `Mod+K` shortcut via
    `useRegisterShortcuts` to open the palette, plus a toolbar button
    next to the mode toggle. The palette mounts once per editor frame
    and reads document state through `useDocument`.

  Tests: 13 new vitest cases (6 commands + 9 palette) + 1 e2e. 104 app
  tests + 9 e2e, all green. All 11 CI gates clean. No new deps.

  Follow-up (noted in code, not this PR): the editor-shell
  `ShortcutHandler` return type is strict enough to reject block-body
  arrows that return `void`. The app currently works around it with
  `return undefined` in the Mod+K handler. A small editor-shell bump
  to accept `void` returns via `biome-ignore` is worthwhile.

- a518ed6: T-128 — AI copilot stub: `<AiCopilot>` right-rail sidebar (chat log +
  input), `<AiCommandBar>` header with status + close, `<AiVariantPanel>`
  empty-state scaffold. Submitting a prompt POSTs to the existing
  `/api/agent/execute` route (501 today) and renders a "Phase 7"
  placeholder. Sidebar opens via a header toggle or `Mod+I`, closes on
  `Escape` (scoped via `useRegisterShortcuts`). Three components +
  `executeAgent` fetch wrapper + i18n keys for copilot status, welcome,
  variants, and error copy. No document writes; Phase 7 will wire the
  planner/executor/validator behind the same fetch seam.
- 7516c50: T-129 first tranche — `<ShortcutCheatSheet>` + `<StatusBar>` land as
  native Slide-mode components.
  - `<ShortcutCheatSheet>` (searchable modal) reads the live shortcut
    set via `useAllShortcuts()`, groups by `ShortcutCategory`, filters
    on description / combo text, Escape + close button both dismiss.
    Opens via the new `?` shortcut (gated by `isNotEditingText()` so
    typing `?` in the inline text editor doesn't trigger it).
  - `<StatusBar>` shows total slide + element counts across the whole
    document.

  Deferred tranches (asset browser, context menu, export / import
  dialogs, find/replace, onboarding, cloud-save panel, presentation
  mode, collaboration UI) are tracked as post-Phase-6 follow-ups on the
  implementation-plan row — scope would balloon the L-sized task well
  past its window.

  Tests: app-slide 168 → 179 (+11 — 8 cheat-sheet, 3 status-bar). All
  11 CI gates green.

- e0054c4: T-134 — StageFlip.Slide branding pass. Abyssal Clarity preserved.
  - `apps/stageflip-slide/src/app/globals.css` gains the full Abyssal
    Clarity design-token set as CSS custom properties (`--ac-bg`,
    `--ac-surface-low`, `--ac-primary-gradient`, `--ac-accent`,
    `--ac-border-subtle`, `--ac-radius-*`, `--ac-font-*`, etc.). Existing
    inline-hex-using components are left untouched; future edits should
    swap the literals for `var(--ac-*)` references.
  - `<Logo>` component (new) — brand + mode wordmark with a 24×24 SVG
    mark using the primary gradient. Renders in the editor header above
    the document title.
  - `layout.tsx` metadata is now the full product string.
  - New i18n keys: `slide.tagline`, `slide.productName`.

  Zero changes to behavior — tests unchanged, just more surface covered.

- ec58fe0: T-136 — Phase 6 E2E regression suite + `Mod+Z` / `Mod+Shift+Z` shortcut
  wiring. The Playwright suite now covers three new round-trip scenarios
  critical to ratifying slide mode:
  - **Inline text editor round-trip** — double-click → edit → blur commits
    through the document atom and re-renders in both canvas and filmstrip.
  - **Undo / redo chain** — two sequential transform commits undo in LIFO
    order via `Mod+Z`; redo restores via `Mod+Shift+Z`.
  - **Element delete** — `prop-delete` drops the element from canvas + doc
    and the slide's element-count read-out reflects the new total.

  Building the regression suite surfaced a gap: T-133 wired the undo/redo
  API but no shortcut ever reached the user. Two `essential`-category
  shortcuts (`Mod+Z` undo, `Mod+Shift+Z` redo) are now registered in the
  editor frame.

  The opacity commit-on-release contract stays unit-tested only — range
  inputs don't replay cleanly under Playwright's `fill()` and the unit
  test already exercises the exact behavior.

  Export PNG coverage is explicitly deferred: no export button exists in
  app-slide today, and wiring the full CDP export flow would balloon
  T-136. Renderer-cdp has its own PNG e2e at the package level (T-119
  reference-render test).

  E2E: 14 passing (was 11). No product-code tests changed.

- 05f5aa9: T-139b — asset browser + import dialogs + export dialog ported from
  the SlideMotion reference, plus a `clampToViewport` helper landed on
  T-139a's context menu to satisfy the reviewer's mandatory ship-blocker
  for near-edge right-clicks.

  Editor-shell framework additions:
  - `assetsAtom` / `addAssetAtom` / `removeAssetAtom` / `replaceAssetsAtom`
    / `selectedAssetIdAtom` / `selectedAssetAtom` — Jotai registry for
    the editor's in-memory asset list with append-only semantics and a
    derived selected-asset lookup.
  - `clampToViewport` pure helper + a `useLayoutEffect` wire-up inside
    `<ContextMenu>` to flip near-edge anchors instead of rendering
    partially off-screen (closes T-139a reviewer ship-blocker).

  App-slide UI additions:
  - `<AssetBrowser>` grid panel with drag-to-canvas + right-click
    context menu consuming T-139a's registry.
  - `<GoogleSlidesImport>` dialog (feature-flagged — caller injects
    `onFetchDeck`; OAuth backend is separate infra).
  - `<PptxImport>` dialog (stub with visible feature-flag banner;
    real OOXML parser pending license review — tracked as T-139b.1).
  - `<ImageUpload>` dialog with size-guard + MIME filter, appending
    to `assetsAtom`.
  - `<ExportDialog>` with resolution / format / range controls,
    dispatching to the existing `@stageflip/renderer-cdp` pipeline.

  New i18n keys under `assets.*`, `import.google.*`, `import.pptx.*`,
  `import.image.*`, and `export.*`.

- d49e5dd: T-139c — find/replace + first-run onboarding + cloud-save panel +
  presentation mode, ported from the SlideMotion reference as a fresh
  implementation against the StageFlip primitives.

  Editor-shell framework additions:
  - `findMatches` / `replaceAll` pure text search + transaction-wrapped
    document rewrite, plus `findHighlightsAtom` so the canvas overlay
    can render match rectangles without the dialog owning render
    coordinates.
  - `CloudSaveAdapter` contract + `createStubCloudSaveAdapter()`
    in-memory implementation with `__simulateConflict` / `__simulateError`
    test hooks. Phase 12's `@stageflip/collab` will swap in a real
    Firestore adapter against the same contract.

  App-slide UI additions:
  - `<FindReplace>` dialog — regex / case / whole-word toggles,
    next/previous navigation, replace-all funneled through one
    transaction. Mounted at the editor root; `Mod+F` opens.
  - `<FindHighlightsOverlay>` — canvas layer above `<SelectionOverlay>`
    that paints match rectangles tied to `findHighlightsAtom`.
  - `<Onboarding>` — step-indexed coachmark tour. Anchors use existing
    `data-testid` selectors; first-mount flag persists in
    `localStorage`. Mounted at the editor root; shows once per browser
    profile.
  - `<CloudSavePanel>` — save / saving / saved / conflict / error
    state machine with a keep-local / keep-remote conflict UI. Toggled
    from the header's `nav.cloud` button.
  - `<PresentationMode>` — full-screen slide player with keyboard nav
    (arrow keys / space / Enter / Backspace / Esc / s). `Mod+Enter`
    enters; the persistent-toolbar Present button also enters.

  New i18n keys under `findReplace.*`, `onboarding.coachmark.*`,
  `cloudSave.*`, and `presentation.*`.

- d017704: T-139a — context-menu framework + persistent + contextual toolbars.
  Adds `<ContextMenuProvider>` + `useRegisterContextMenu` + `useContextMenu`
  - `<ContextMenu>` to `@stageflip/editor-shell`, mirroring the shortcut
    registry's descriptor-based pattern. Single `contextmenu` listener on
    `window`; the first descriptor whose `match(target)` predicate passes
    opens the menu at the cursor; non-matches let the browser's native
    menu fire. Keyboard navigable (arrows + Enter + ArrowRight into
    submenus + Escape). Labels route through the i18n catalog (`t(key)`)
    and keybinds through `formatCombo()` so menu hints stay in sync with
    the shortcut registry on both platforms.

  Adds `<PersistentToolbar>` (top-of-canvas global actions: new slide,
  undo / redo with disabled-state gating, zoom stepper, present toggle,
  slide counter) and `<ContextualToolbar>` (selection-routed floating
  toolbar with text / shape / image variants, optional viewport-space
  anchor prop) to `apps/stageflip-slide`. Unblocks T-139b's asset
  browser right-click and T-139c's find-replace match navigation.

- 85d632a: T-140 — Phase 6 closeout sweep. Bundles the seven hygiene follow-ups
  the T-139a + T-139c reviewers flagged as non-blocking.

  `@stageflip/editor-shell`:
  - `<ContextMenuProvider>` drops the defensive window-level Escape
    listener. The menu root auto-focuses on open via `useLayoutEffect`
    and owns Escape dispatch through its element-level `onKeyDown`.
    Keeps the shortcut registry as the singleton keydown owner
    (CLAUDE.md §10 spirit).
  - Catalog: `toolbar.persistent.ariaLabel` added;
    `findReplace.contextMenu.replaceOne` + `.skip` removed (seeded but
    unused by T-139c).
  - Context-menu SKILL.md documents the "contextual toolbar is
    read-only for non-text elements; editing lives in PropertiesPanel"
    invariant.

  `@stageflip/app-slide`:
  - `<PersistentToolbar>` migrates its bare `aria-label` literal to
    `t('toolbar.persistent.ariaLabel')`.
  - `editor-app-client` replaces `Math.random()`-minted slide ids with
    a monotonic counter seeded from the maximum pre-existing
    `slide-N` suffix; collision-free across session reloads.
  - `<PresentationMode>` + `<ModalShell>` migrate their raw
    `window.addEventListener('keydown', ...)` listeners to
    `useRegisterShortcuts`; the registry now owns every keyboard
    shortcut in the app.
  - Tests updated to exercise the new dispatch paths (keydown
    dispatched on the menu root for the context-menu Escape
    regression).

  No behaviour change beyond the reviewer-flagged items; all 314
  `@stageflip/app-slide` tests + 263 `@stageflip/editor-shell` tests
  still pass.

- 7338d16: T-170 — Copilot wiring. `/api/agent/execute` now runs the real
  Planner → Executor → Validator triad instead of returning the Phase-6
  501 stub. The orchestrator module
  (`src/app/api/agent/execute/orchestrator.ts`) populates a registry with
  all 14 handler bundles + shared `ToolRouter<ExecutorContext>`, then
  calls the triad in sequence.

  Environment handling:
  - `ANTHROPIC_API_KEY` is read from `process.env` at request time.
  - Missing key → 503 response with `error: 'not_configured'`
    (distinct from the legacy 501 `phase-7` sentinel, which is preserved
    in the client wrapper for backwards compat with any still-deployed
    pre-T-170 builds).

  Request contract (Zod-validated, `.strict()`):
  - `prompt: string (1-4000)` — required
  - `document: Document` — required; Zod-validated against
    `documentSchema`
  - `selection?` — optional editor selection
  - `plannerModel` / `executorModel` / `validatorModel` — optional
    overrides, default to `claude-sonnet-4-6`

  Response shape on success (200):
  - `ok: true, plan, events[], finalDocument, validation`

  `executeAgent` client wrapper updated: new `kind: 'applied'` result
  carries the full `payload`; `kind: 'not_configured'` flags the 503
  case; legacy `kind: 'pending'` (501) path retained.

  6 new app tests (4 orchestrator + 2 refreshed execute-agent); 320 total
  app tests. Phase 7 now end-to-end: a Claude user with a configured API
  key can POST to `/api/agent/execute` and receive a real multi-step
  plan + executed patches + validation verdict.

### Patch Changes

- 3711af9: T-187b: lift slide-app orchestrator into `@stageflip/app-agent`.

  Moves the Phase-7 Planner/Executor/Validator wiring out of
  `apps/stageflip-slide/src/app/api/agent/execute/` and into a new
  workspace package so every editor app (slide, video, display) loads
  the same 15-bundle registry + runs the same pipeline without
  duplicating the orchestration code.

  Public surface:

  ```ts
  import {
    OrchestratorNotConfigured,
    buildProviderFromEnv,
    createOrchestrator,
    runAgent,
    type OrchestratorDeps,
    type RunAgentRequest,
    type RunAgentResult,
  } from "@stageflip/app-agent";
  ```

  Behaviour is unchanged — the slide-app's existing 4 orchestrator tests
  move with the code and continue to assert "all 15 bundles registered",
  "triad factories wired", and env-based provider construction with the
  `OrchestratorNotConfigured` sentinel.

  Slide app changes:
  - Deletes the local `orchestrator.ts` + `orchestrator.test.ts`.
  - `route.ts` imports `OrchestratorNotConfigured` + `runAgent` from
    `@stageflip/app-agent` instead of the deleted module.
  - `next.config.mjs` adds `@stageflip/app-agent` to `transpilePackages`.
  - `package.json` declares `@stageflip/app-agent` as a dep.

  Scope note: T-187c will wire the shared orchestrator into the video
  app's (`apps/stageflip-video`) `/api/agent/execute` route. The route
  is still 501 stubbed today.

- cd2fba6: T-133a — `<SelectionOverlay>` now coalesces drag / resize / rotate
  gestures into one undo entry per gesture. Every `pointerDown` opens a
  T-133a transaction via `beginTransaction`; `pointerUp` commits it;
  `pointerCancel` aborts it and restores the element to its pre-drag
  transform. A 100-event drag that previously produced 100 undo entries
  now produces exactly one. No API surface change.
- 0df802a: T-170 follow-up — align the AI copilot UI + e2e coverage with the new
  `/api/agent/execute` contract.
  - Copilot now branches explicitly on `kind: 'not_configured'` (new 503
    path) and `kind: 'applied'` (the real orchestration result). Applied
    results render a one-line summary of `<stepCount> steps, validation:
<tier>`; detailed diff preview is downstream work.
  - New i18n key `copilot.notConfigured` carries the
    `ANTHROPIC_API_KEY` hint.
  - Playwright smoke updated: the "assistant reply" assertion now
    accepts `Error:`, `ANTHROPIC_API_KEY`, `not configured`, or the
    legacy `Phase 7` phrasing (any of the documented response paths is
    valid during rollout). Two new API-level specs assert the 400
    `invalid_request` + 503 `not_configured` paths directly.
  - Two new unit tests cover the `not_configured` and `applied` render
    branches.

  No behaviour change for already-wired deploys — this is pure rollout
  alignment.

- Updated dependencies [3711af9]
- Updated dependencies [6019f5f]
- Updated dependencies [e0054c4]
- Updated dependencies [05f5aa9]
- Updated dependencies [d49e5dd]
- Updated dependencies [d062bc1]
- Updated dependencies [ce146db]
- Updated dependencies [d13c772]
- Updated dependencies [c126eba]
- Updated dependencies [753b22a]
- Updated dependencies [a518ed6]
- Updated dependencies [5548212]
- Updated dependencies [cd2fba6]
- Updated dependencies [6c44323]
- Updated dependencies [a146bd2]
- Updated dependencies [62db960]
- Updated dependencies [c0eed61]
- Updated dependencies [7ddf9ad]
- Updated dependencies [1c9dea3]
- Updated dependencies [bbcbd38]
- Updated dependencies [fa7bd86]
- Updated dependencies [919af67]
- Updated dependencies [019f79c]
- Updated dependencies [3871486]
- Updated dependencies [a248a29]
- Updated dependencies [ec428bb]
- Updated dependencies [844a620]
- Updated dependencies [6cb351f]
- Updated dependencies [58d78e7]
- Updated dependencies [3280984]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [d017704]
- Updated dependencies [85d632a]
- Updated dependencies [b8808c7]
- Updated dependencies [2b06f13]
- Updated dependencies [3457c83]
- Updated dependencies [b1a5501]
- Updated dependencies [39a7adf]
- Updated dependencies [f8b47f0]
- Updated dependencies [10ae733]
- Updated dependencies [822826e]
- Updated dependencies [e69465d]
- Updated dependencies [db8df77]
- Updated dependencies [8dd5df9]
- Updated dependencies [3140b2d]
- Updated dependencies [724650d]
- Updated dependencies [ceec209]
- Updated dependencies [4aed082]
- Updated dependencies [980b019]
- Updated dependencies [ca340c5]
- Updated dependencies [a7e9fec]
- Updated dependencies [a1cf600]
- Updated dependencies [d0e7076]
- Updated dependencies [1a684b1]
- Updated dependencies [0df802a]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/app-agent@0.1.0
  - @stageflip/editor-shell@0.1.0
  - @stageflip/engine@0.1.0
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/frame-runtime@1.0.0
  - @stageflip/llm-abstraction@0.1.0
  - @stageflip/loss-flags@0.1.0
  - @stageflip/schema@0.1.0
  - @stageflip/agent@0.1.0
