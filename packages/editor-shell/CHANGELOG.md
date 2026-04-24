# @stageflip/editor-shell

## 0.1.0

### Minor Changes

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

- d062bc1: T-121a: initial public surface — shortcut registry framework.

  - `Shortcut` + `ShortcutCategory` + `ShortcutHandler` types.
  - `matchesKeyCombo(event, combo)` — platform-aware (Mod → Cmd/Ctrl),
    strict matching, Space + named-key support.
  - `formatCombo(combo)` — macOS glyphs vs plus-separated display.
  - `currentFocusZone()` / `focusIsInZone(zone)` — `data-focus-zone`
    attribute-based routing for context-aware shortcuts.
  - `<ShortcutRegistryProvider>`, `useRegisterShortcuts(list)`,
    `useAllShortcuts()` — one global `keydown` listener, input-target
    suppression for bare-key combos, sync decline chaining, async =
    eager preventDefault, `useSyncExternalStore`-backed snapshot.

  Zero UI; pure framework. Consumed by T-121c (shell composition) and
  every T-123..T-129 component port that registers shortcuts.

- ce146db: T-121b: Jotai atoms + DocumentContext / AuthContext shells.

  Subsumes the original T-132 row.

  **Atoms** (11 per editor-audit §2):

  - `documentAtom: Atom<Document | null>` — canonical source document.
  - `slideByIdAtom(id)` / `elementByIdAtom(id)` — memoized Map-cached
    derived atoms. Mode-aware: slide-only lookups return `undefined` for
    video / display mode documents.
  - `activeSlideIdAtom`, `selectedElementIdsAtom`, `selectedSlideIdsAtom`,
    `selectedElementIdAtom` (single-select projection), `EMPTY_SELECTION`.
  - `undoStackAtom`, `redoStackAtom`, `canUndoAtom`, `canRedoAtom`,
    `MAX_MICRO_UNDO` (100), and a local `MicroUndo` shape
    (`{ label?, forward: unknown[], inverse: unknown[] }`) — T-133 will
    wire concrete `fast-json-patch` operations through the same atom
    surface.

  **Contexts**:

  - `<DocumentProvider>` — creates a fresh `jotai` store per provider
    instance so multiple editor subtrees stay isolated. `useDocument()`
    returns a coarse reactive facade with `setDocument` / `updateDocument`,
    `setActiveSlide`, selection replace/toggle/clear, and undo stack
    push/pop with automatic MAX_MICRO_UNDO cap + redo-stack invalidation
    on forward mutation.
  - `<AuthProvider>` / `useAuth()` — shell only; `user` is always `null`,
    `signIn()` and `signOut()` reject with "not implemented" until the
    backend lands. Unblocks component ports that depend on the shape.

  **Runtime deps added**:

  - `jotai` (MIT, ^2.19.1) — atomic state, Map-cache factories.
  - `@stageflip/schema` (workspace) — `Document` / `Slide` / `Element`.

- d13c772: T-121c: `<EditorShell>` composition + localStorage persistence + i18n scaffold.

  Completes the T-121 family. With this, every Phase 6 component port can
  mount a real shell and depend on every hook resolving.

  - **`<EditorShell>`** — one-component tree root composing
    `ShortcutRegistryProvider` → `DocumentProvider` → `AuthProvider`
    (outer → inner). Optional `initialDocument` seeds `documentAtom`;
    `initialLocale` flips the i18n catalog once on mount; `autosave`
    (off by default) enables debounced localStorage writes.

  - **Persistence** — per-doc localStorage slots keyed by docId, a
    bounded recent-documents index (cap = `MAX_RECENT_DOCUMENTS` / 10),
    deduplication on re-save, graceful degradation (SSR, Safari private
    browsing, quota exceeded — every entry point swallows errors and
    returns a safe default). `useAutosaveDocument({ delayMs, serialize,
enabled })` hook debounces document changes through
    `documentAtom` and writes via `JSON.stringify` (or a custom
    serializer). Schema validation deferred to the consumer — this
    layer is bytes-only.

  - **i18n** — flat `Map<string, string>` catalog with `setLocale`,
    `getLocale`, `t(key, fallback?)`. Seeded with 80+ keys from the
    SlideMotion editor audit §8 (nav, common, export, onboarding,
    cloud, properties, shortcuts, copilot, command-palette, status).
    SlideMotion / Remotion branded strings rewritten as generic
    StageFlip copy — T-134 branding pass can edit any of them
    without touching call sites. Pseudo-localization mode
    (`setLocale('pseudo')`) renders every key as `⟦key⟧` for QA.

  34 new tests; 125/125 total across editor-shell.

- 753b22a: T-125b — ZodForm auto-inspector + Zod-3 introspect module. New public
  surface: `ZodForm`, `introspectSchema`, `introspectField`, plus the
  `FieldSpec` / `FieldKind` / `DiscriminatedBranch` types. Covers strings
  (with hex-color detection), numbers (with slider classification when
  bounded), booleans, enums (both `z.enum` and `z.nativeEnum`), string /
  number arrays, nested objects, and discriminated unions. Commit
  semantics match handover-phase6-mid-2 §3.3: text / number / slider /
  color / number-list / tag-list buffer locally and commit on blur /
  Enter / pointerup so T-133's undo interceptor captures one entry per
  gesture. Discrete controls (boolean toggle, enum select, color picker
  click) commit immediately. New i18n keys under the `zodform.*` and
  `properties.clip.*` namespaces.
- 5548212: T-133 — wire RFC 6902 undo/redo on top of the T-121b atom surface.
  `updateDocument` now auto-diffs the pre/post documents with
  `fast-json-patch`, pushing a `MicroUndo` of forward + inverse
  `Operation[]` onto `undoStackAtom`. New `undo()` / `redo()` actions on
  the `useDocument()` surface pop from their respective stacks and apply
  the patches. `<EditorShell>` registers `Mod+Z` / `Mod+Shift+Z`
  shortcuts by default. `setDocument` clears both stacks so
  cross-document patches can't apply into a drifted state.
- cd2fba6: T-133a — coalescing transaction API on top of the T-133 undo/redo
  interceptor. New `useDocument()` actions `beginTransaction(label?)`,
  `commitTransaction()`, `cancelTransaction()` + an `inTransaction: boolean`
  flag. Between `begin` and `commit`, every `updateDocument` call applies
  to the atom but skips the per-call undo push; `commit` diffs the
  transaction snapshot against the final document and pushes one
  `MicroUndo` covering the whole gesture. `cancel` restores the atom to
  the snapshot. A net-zero diff on commit is a no-op (no empty entry).
  `undo()` / `redo()` are no-ops while a transaction is active;
  `setDocument()` clears a pending transaction along with the stacks.

  Unblocks T-133a drag coalescing in `@stageflip/app-slide` (one undo
  entry per drag instead of one per pointermove).

- 6c44323: T-181 (scoped): shared timeline math + multi-track layout primitives.

  Hoists frame↔pixel math (formerly owned by `apps/stageflip-slide`'s
  T-126 timeline) into `@stageflip/editor-shell` so video, display, and
  future modes all consume the same logic:

  - **Math** — `frameToPx`, `pxToFrame`, `snapFrame`, `rulerTickFrames`,
    `formatFrameLabel`, `TimelineScale`. Ported verbatim; slide app's
    local `timeline-math.ts` is now a re-export of these symbols.
  - **Tracks** — new `trackRowLayout`, `placeElementBlock`,
    `placeTrackElements`, `totalTrackStackHeight`. Canonical top-to-bottom
    order is `visual` / `overlay` / `caption` / `audio` with per-kind
    heights; blocks are clipped to `[0, durationFrames)`; out-of-range
    blocks are filtered.

  Scope note: T-181 React components (panel, ruler, track rows) ship in
  follow-up PRs. This PR is pure math + layout types so the downstream UI
  work has a deterministic foundation.

- a146bd2: T-181b (scoped): headless React primitives for the multi-track timeline.

  Builds on T-181's shared math + track layout with opinion-free React
  components the video app (T-187) and future modes can compose into
  full timeline UIs:

  - **`useTimelineScale`** — hook returning a `TimelineScale` from a
    composition fps + base px/sec, with a zoom knob (`setZoom`,
    `zoomBy`, `reset`) clamped to `[minZoom, maxZoom]`. Non-finite
    input is silently rejected so wheel-zoom handlers don't panic on
    deltas that produce NaN.
  - **`<TimelineRuler>`** — renders ticks + labels across
    `[0, durationFrames]` using `rulerTickFrames` for sensible
    spacing; accepts `tickFrames` + `formatLabel` overrides.
  - **`<TimelineStack>`** — render-prop wrapper that sizes itself to
    the total track-stack height and renders one child per row.
  - **`<TrackRow>`** — absolutely-positioned row band, exposes
    `data-track-id/-kind/-index` + CSS custom properties
    (`--sf-tl-row-top`, `--sf-tl-row-height`) for host styling.
  - **`<ElementBlock>`** — absolutely-positioned clip block inside a
    row; publishes `data-element-id` + `data-selected` + CSS vars
    (`--sf-tl-block-left`, `--sf-tl-block-width`).

  All four components carry zero app-specific CSS — `className` /
  `style` / `data-*` / CSS custom properties are the only styling
  seams.

  Tests: +18 (10 components + 8 hook) on top of T-181's 29 math/layout
  tests. 310/310 editor-shell green; slide app unchanged.

- 62db960: T-181c: scrubber state + playhead + `<TimelinePanel>` composition.

  Completes T-181's editor-shell surface so the video app (T-187) can
  render a working multi-track timeline without rebuilding pointer
  plumbing:

  - **`useScrubber`** — owns `currentFrame` + `dragging`, plus an
    `onPointerDown` handler that seeks on pointerdown and follows the
    cursor via document `pointermove`/`pointerup`. Clamps to
    `[0, durationFrames]`, snaps to `snapFrames`, ignores non-left
    buttons.
  - **`<Playhead>`** — vertical line positioned at
    `frameToPx(currentFrame)`. `pointer-events: none` by default so
    track clicks pass through.
  - **`<TimelinePanel>`** — layout shell that stacks a ruler row
    (pointer surface for `useScrubber`), a body for host tracks, and
    the playhead. Forwards `rulerProps` + `onRulerPointerDown`; panel
    width matches composition duration.

  Tests: +15 (7 scrubber + 8 panel/playhead) on top of T-181b's suite.
  Editor-shell total: 325/325 green. Still zero opinionated CSS —
  hosts style via `className`/`style`/`data-*`/CSS custom properties.

- c0eed61: T-182: multi-aspect preview bouncer primitives (9:16 / 1:1 / 16:9
  simultaneously).

  Adds a pure layout math module plus two headless components so the video
  app (T-187) can render the same composition against several aspect
  ratios side-by-side for operator review:

  - **`AspectRatio` + `COMMON_ASPECTS`** — `{ w, h, label? }`; canonical
    set ships 16:9 / 1:1 / 9:16.
  - **`fitAspect(aspect, bounds)`** — largest ratio-preserving rectangle
    that fits a bounding box.
  - **`layoutAspectPreviews(aspects, container, { gapPx?, maxHeightPx? })`**
    — row layout returning per-preview `{ widthPx, heightPx }`. All
    previews share a common height; total widths + gaps ≤ container
    width. Defaults: `gapPx=12`, `maxHeightPx=container.height`.
  - **`<AspectRatioPreview>`** — fixed-size frame at the given aspect,
    `overflow: hidden`, publishes `data-aspect-w/-h/-label` + CSS
    variables.
  - **`<AspectRatioGrid>`** — flex row wrapper that runs
    `layoutAspectPreviews` and renders an `<AspectRatioPreview>` per
    aspect. Host supplies content via the `renderPreview(placement)`
    render-prop; falls back to the aspect label.

  Tests: +23 (14 math + 9 components). Editor-shell 333/333 green. Zero
  opinionated CSS — hosts style via `className` / `style` / `data-*` /
  CSS custom properties.

- 7ddf9ad: T-201: multi-size banner preview grid for StageFlip.Display.

  Sibling of T-182's `AspectRatioGrid` — the aspect grid lays out
  ratio-only boxes; this one lays out **fixed-dimension** banner cells
  (300×250, 728×90, 160×600 — the `DISPLAY_CANONICAL_SIZES` set from
  T-200).

  - **`layoutBannerSizes(sizes, container, options)`** (pure math) —
    computes a single uniform scale factor such that the row of cells
    fits both `container.width` (widths + gaps) and `container.height`
    (tallest cell). Clamps to `[minScale, maxScale]` (defaults 0.1 / 1)
    so over-large containers don't enlarge banners beyond 1×.
  - **`<BannerSizePreview>`** — one scaled cell; clips host content
    with `overflow: hidden`. Exposes `--sf-banner-scale`,
    `--sf-banner-width`, `--sf-banner-height` CSS custom props so host
    chrome (rulers, badges) can stay in sync.
  - **`<BannerSizeGrid>`** — renders one preview per supplied size;
    threads `currentFrame` into the grid + every `renderPreview`
    callback so scrubbing updates all sizes in lockstep. Defaults
    `currentFrame` to 0.

  Preserves inter-cell proportions — a 300×250 and 728×90 stay at the
  right relative size no matter the container. Uses `BoxSize` from the
  existing `aspect-ratio/math` barrel so consumers keep a single shared
  geometry type.

  24 new tests (13 math + 11 component), 100% coverage on the new
  files. Zero new runtime deps.

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

### Patch Changes

- c126eba: T-125a — seed 20 new `properties.*` i18n keys (panel header / fallback,
  actions, visibility / lock, z-order buttons, delete, type-editor stub,
  slide id / title / background / duration / elements / notes) consumed
  by the `@stageflip/app-slide` PropertiesPanel. No behavior change in
  `@stageflip/editor-shell` itself.
- a518ed6: T-128 — seed 9 new `copilot.*` i18n keys (`close`, `welcome`,
  `notWired`, `errorPrefix`, `status.{idle,pending,error}`, `variants`,
  `variants.empty`) consumed by the `@stageflip/app-slide` copilot stub.
  No behavior change in `@stageflip/editor-shell` itself.
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

- Updated dependencies [36d0c5d]
  - @stageflip/schema@0.1.0
