# SlideMotion Editor Audit — Component & Infrastructure Inventory (T-120)

**Status**: Initial audit, 2026-04-22.
**Source**: `reference/slidemotion/apps/editor/` (gitignored local-only IP).
**Consumers**: T-121 (greenfield editor-shell), T-122 (walking skeleton `apps/stageflip-slide`), T-123–T-129 (component ports), T-132 (Jotai atoms port), T-134 (branding), T-136 (E2E regression).
**Reader context**: This audit is the shared inventory every subsequent Phase 6 port task reads. Update it as components get ported — cross off rows or flip the port-tier column when a component lands.

---

## 1. React Components

| File Path (relative to `reference/slidemotion/apps/editor/`) | Exported Component(s) | Purpose | Port Tier |
|---|---|---|---|
| `src/components/SlideCanvas.tsx` | `SlideCanvas` | Main canvas viewport with scale-to-fit, drag selection, element selection overlay, inline text editing. Renders via `SlideRenderer` (fast mode) with live selection feedback. | CanvasWorkspace (T-123) |
| `src/components/SelectionOverlay.tsx` | `SelectionOverlay` | Visual bounding boxes + drag handles for selected elements; corner rotation, edge resize, center move. | CanvasWorkspace (T-123) |
| `src/components/InlineTextEditor.tsx` | `InlineTextEditor` | Contenteditable overlay for in-canvas text editing; reads/writes `element.content.value`; integrates with blur + commit. | CanvasWorkspace (T-123) |
| `src/components/TextSelectionToolbar.tsx` | `TextSelectionToolbar` | Floating toolbar (bold/italic/underline/link/translate/rewrite) when text element selected; uses T-125 ZodForm introspection. | CanvasWorkspace (T-123) |
| `src/components/SingleSlidePreview.tsx` | `SingleSlidePreview` | Remotion `<Player>` component for fidelity-mode preview + animation scrubbing; wired to timeline scrubber. **Note**: Remotion-importing code here must NOT be copied into StageFlip. Replace with `@stageflip/frame-runtime` + `PlayerShell` during T-123. | CanvasWorkspace (T-123) |
| `src/components/Filmstrip.tsx` | `Filmstrip` | Vertical strip of slide thumbnails; drag-reorder, multi-select (Shift/Cmd click), right-click menu, active highlight. Uses `CssSlideRenderer` for fast thumbnails. | Filmstrip (T-124) |
| `src/components/PropertiesPanel.tsx` | `PropertiesPanel` | Right sidebar: element/slide properties inspector. Routes to `SelectedElementProperties`, `SlideProperties`, or `ZodForm` for clip props. Includes animation/chart/table editors. | PropertiesPanel (T-125) |
| `src/components/zodform/ZodForm.tsx` | `ZodForm` | Auto-generated form from Zod schema; introspects type to render input/select/checkbox/color/multi. Powers clip prop editing. | PropertiesPanel (T-125) |
| `src/components/zodform/introspect.ts` | (module) | Schema introspection: maps Zod types → form field type (text, number, color, enum, array). | PropertiesPanel (T-125) |
| `src/components/ChartEditor.tsx` | `ChartEditor` | Chart element editor: data series entry, chart type picker, axis labels. Manages `ChartElement.data` and `metadata.dataSourceRef`. | PropertiesPanel (T-125) |
| `src/components/TableEditor.tsx` | `TableEditor` | Table cell grid editor; add/remove rows/cols; cell click-to-edit inline. | PropertiesPanel (T-125) |
| `src/components/AnimationPicker.tsx` | `AnimationPicker` | Dropdown to select entrance/exit animation (`fade_in`, `bounce_in`, etc.); duration + delay sliders. Updates `element.animationIn/animationOut`. | PropertiesPanel (T-125) |
| `src/components/timeline/TimelinePanel.tsx` | `TimelinePanel` | Horizontal timeline below filmstrip; shows element timing blocks, keyframe dots, scrubber. Drag edges to edit `timing.from`/`timing.durationMs`. | TimelinePanel (T-126) |
| `src/components/timeline/Ruler.tsx` | `Ruler` | Time-axis ruler (0s, 1s, 2s…) with frame-rate label. | TimelinePanel (T-126) |
| `src/components/timeline/Scrubber.tsx` | `Scrubber` | Vertical playhead bar; draggable to scrub `currentFrame`. | TimelinePanel (T-126) |
| `src/components/timeline/Track.tsx` | `Track` | One row per element; shows animIn ramp, timing block, keyframe dots, animOut ramp. | TimelinePanel (T-126) |
| `src/components/timeline/timeline-math.ts` | (module) | Utility: frame ↔ pixel conversion, FPS constants, snap logic. | TimelinePanel (T-126) |
| `src/components/CommandPalette.tsx` | `CommandPalette` | Modal cmd-palette: search by name/category, execute tool calls (newSlide, rewriteText, etc.), mode switching. | CommandPalette (T-127) |
| `src/components/AICopilot.tsx` | `AICopilot` | Sidebar AI assistant; streaming chat, quick-action buttons, diff preview before apply, token budget display. | AiCopilot (T-128) |
| `src/components/AiCommandBar.tsx` | `AiCommandBar` | Top bar for AI mode shortcuts + status. | AiCopilot (T-128) |
| `src/components/AiVariantPanel.tsx` | `AiVariantPanel` | Gallery of AI-generated slide variants; select to apply. | AiCopilot (T-128) |
| `src/components/Navbar.tsx` | `Navbar` | Top bar: title, undo/redo, mode tabs (Create/Edit/Present/Validate), save/export buttons, user menu. | Other (T-129) |
| `src/components/Sidebar.tsx` | `Sidebar` | Left collapsible panel: Slides (filmstrip), Assets, Components, Theme picker. | Other (T-129) |
| `src/components/StatusBar.tsx` | `StatusBar` | Bottom bar: slide/element count, import diagnostics badge. | Other (T-129) |
| `src/components/CreateMode.tsx` | `CreateMode` | Layout wrapper for AI-first slide creation; houses AI command bar + canvas preview. | Other (T-129) |
| `src/components/EditMode.tsx` | `EditMode` | Layout wrapper for precision editing; stacks canvas, timeline, properties. Mounts keyboard shortcut handler. | Other (T-129) |
| `src/components/PresentationMode.tsx` | `PresentationMode` | Full-screen slideshow; arrow keys to navigate, Esc to exit. | Other (T-129) |
| `src/components/ContextMenu/ContextMenu.tsx` | `ContextMenu` | Right-click context menu framework (`@radix-ui/react-context-menu`); dispatches to useSlideMenuBuilder / useElementMenuBuilder. | Other (T-129) |
| `src/components/ContextMenu/useElementMenu.ts` | (hook) | Builds context menu for selected element: duplicate, delete, group/ungroup, link, copy, cut. | Other (T-129) |
| `src/components/ContextMenu/useSlideMenu.ts` | (hook) | Builds context menu for slide: duplicate, delete, move up/down, paste. | Other (T-129) |
| `src/components/ContextualToolbar.tsx` | `ContextualToolbar` | Type-aware toolbar that appears below canvas; shape fill, stroke, text color, etc. based on selection type. | Other (T-129) |
| `src/components/PersistentToolbar/PersistentToolbar.tsx` | `PersistentToolbar` | Floating action bar (background, layout, theme, transition) accessible from anywhere in the editor. | Other (T-129) |
| `src/components/ShortcutCheatSheet.tsx` | `ShortcutCheatSheet` | Modal: searchable table of all registered keyboard shortcuts grouped by category. Reads `useAllShortcuts()`. | Other (T-129) |
| `src/components/ExportDialog.tsx` | `ExportDialog` | Modal: format picker (PNG/PDF/PPTX/MP4), scope (all/current), loss-flag review, export button. | Other (T-129) |
| `src/components/GoogleImportDialog.tsx` | `GoogleImportDialog` | Modal: import from Google Slides via OAuth token or gws CLI JSON. | Other (T-129) |
| `src/components/ImageUploadModal.tsx` | `ImageUploadModal` | Modal: drag/drop or click-upload images; insert into canvas. | Other (T-129) |
| `src/components/BindDataSourceModal.tsx` | `BindDataSourceModal` | Modal: connect chart/table to CSV/JSON/Sheets/Airtable/SQL. Manages `metadata.dataSourceRef`. | Other (T-129) |
| `src/components/FindReplaceDialog.tsx` | `FindReplaceDialog` | Modal: find text in all slides; replace all with regex support. | Other (T-129) |
| `src/components/Onboarding.tsx` | `Onboarding` | New-user flow: template gallery, import options, blank deck creation. | Other (T-129) |
| `src/components/CloudSavePanel.tsx` | `CloudSavePanel` | Modal: list saved presentations from Firestore; load/delete. | Other (T-129) |
| `src/components/ClipCodeEditor.tsx` | `ClipCodeEditor` | Code editor for custom clip props (JSON). | Other (T-129) |
| `src/components/ClipPicker.tsx` | `ClipPicker` | Gallery of registered clips; click to insert into slide. | Other (T-129) |
| `src/components/ComponentLibrary.tsx` | `ComponentLibrary` | Component instance gallery + editor. | Other (T-129) |
| `src/components/CustomClipManager.tsx` | `CustomClipManager` | Upload + manage user-defined custom clips. | Other (T-129) |
| `src/components/PlayerPreview.tsx` | `PlayerPreview` | Full-slide Remotion player preview (fidelity mode). **Same note as `SingleSlidePreview`**: must not copy Remotion imports. | Other (T-129) |
| `src/components/ValidationPanel.tsx` | `ValidationPanel` | Validation results panel: linting rules + auto-fix passes. | Other (T-129) |
| `src/components/VisualDiffPanel.tsx` | `VisualDiffPanel` | Side-by-side or overlay visual diff; shows schema changes + PSNR/SSIM metrics. | Other (T-129) |
| `src/components/ImportDiagnosticsNotice.tsx` | `ImportDiagnosticsNotice` | Banner: issues from import (missing fonts, unsupported shapes). Click to review. | Other (T-129) |
| `src/components/UserMenu.tsx` | `UserMenu` | Dropdown: sign in/out, team selection, settings. | Other (T-129) |
| `src/components/TeamManager.tsx` | `TeamManager` | Modal: create teams, invite members, assign roles. | Other (T-129) |
| `src/components/CollaborationBar.tsx` | `CollaborationBar` | Live presence indicator (who's editing this doc). | Other (T-129) |
| `src/components/SingleInputDialog.tsx` | `SingleInputDialog` | Utility modal: single text input + save/cancel (reused for link URL, rename, etc.). | Other (T-129) |
| `src/components/SlideErrorBoundary.tsx` | `SlideErrorBoundary` | Error boundary wrapping slide render; shows fallback on crash. | Other (T-129) |

**Total components: 52** across 7 port tiers. The mapping to T-123..T-129 reflects the Phase 6 task split. CanvasWorkspace (T-123) is the largest single-task group with 5 components; PropertiesPanel (T-125) has 6. Remaining 30+ components (dialogs, toolbars, menus, utility panels) fall into T-129's "remaining" bucket.

---

## 2. Jotai Atoms

| File | Atom Name | Type | Purpose |
|---|---|---|---|
| `src/store/atoms/document.ts` | `documentAtom` | Simple | Primary document state; `null` until hydrated from localStorage or blank. |
| `src/store/atoms/document.ts` | `slideByIdAtom(id)` | Derived (memoized factory) | Fine-grained subscription to a single slide by ID; re-renders only when that slide changes. Memoized per ID. |
| `src/store/atoms/document.ts` | `elementByIdAtom(id)` | Derived (memoized factory) | Fine-grained subscription to a single element by ID across all slides. Memoized per ID. |
| `src/store/atoms/ui.ts` | `activeSlideIdAtom` | Simple | Currently active (displayed) slide ID. |
| `src/store/atoms/selection.ts` | `selectedElementIdsAtom` | Simple | `ReadonlySet` of currently multi-selected element IDs on the active slide. |
| `src/store/atoms/selection.ts` | `selectedSlideIdsAtom` | Simple | `ReadonlySet` of multi-selected slide IDs in the filmstrip. |
| `src/store/atoms/selection.ts` | `selectedElementIdAtom` | Derived | Back-compat projection: single selected element ID or `null` if 0 or 2+ elements selected. |
| `src/store/atoms/undo.ts` | `undoStackAtom` | Simple | Array of `MicroUndo` entries (RFC 6902 JSON patch + inverse). Max 100 entries. |
| `src/store/atoms/undo.ts` | `redoStackAtom` | Simple | Array of `MicroUndo` entries for redo. |
| `src/store/atoms/undo.ts` | `canUndoAtom` | Derived | Boolean; `true` if `undoStackAtom.length > 0`. |
| `src/store/atoms/undo.ts` | `canRedoAtom` | Derived | Boolean; `true` if `redoStackAtom.length > 0`. |

**Total atoms: 11** (6 simple, 5 derived). All centralized in `src/store/atoms/`. The `slideByIdAtom()` and `elementByIdAtom()` factories enable fine-grained subscriptions without pulling the entire document on every change.

**Note on `atomFamily`**: The code deliberately avoids Jotai's deprecated `atomFamily` and uses a hand-rolled `Map` cache for the memoized factories. This is forward-compatible with Jotai v3.

---

## 3. Custom Hooks

| File | Hook Name | Purpose | Scope |
|---|---|---|---|
| `src/hooks/useKeyboardShortcuts.ts` | `useKeyboardShortcuts()` | Registers ~60 global keyboard shortcuts (undo/redo, copy/cut/paste, delete, selection, nudge, text formatting, etc.) into the ShortcutRegistry. Reads context via refs so the array stays stable across renders. | Global / Feature-specific |
| `src/hooks/useClipboard.ts` | `useClipboard()` | Exposes `copy()`, `cut()`, `paste()`, `pasteWithoutFormatting()`. Serializes selected elements to JSON; writes to `navigator.clipboard` with a prefix; falls back to module-scope ref. | Reusable utility |
| `src/hooks/useAutoRefreshDataSources.ts` | `useAutoRefreshDataSources()` | On document load, scans all slides for bound data sources (`chart.metadata.dataSourceRef`). Auto-refreshes public providers (CSV/JSON URLs) if stale. Prevents refresh loops via `lastRunDocIdRef`. | Feature-specific |
| `src/shortcuts/ShortcutRegistry.tsx` | `useRegisterShortcuts(shortcuts)` | Registers a batch of shortcuts into the global registry for the component's lifetime. Unregisters on unmount. | Reusable framework |
| `src/shortcuts/ShortcutRegistry.tsx` | `useAllShortcuts()` | Returns a reactive snapshot of all currently-registered shortcuts. Re-renders consumers when shortcuts register/unregister. Powers the cheat sheet modal. | Reusable framework |

Plus two React context providers wrapping Jotai + Firebase state:

| File | Provider | Purpose |
|---|---|---|
| `src/store/DocumentContext.tsx` | `DocumentProvider` / `useDocument()` | Exposes document state + 20+ actions (setDocument, addSlide, selectElement, updateElement, undo, redo, etc.) over the Jotai atoms. Thin adapter. |
| `src/store/AuthContext.tsx` | `AuthProvider` / `useAuth()` | Exposes user, teams, auth actions (signIn, signOut). Wraps Firestore. |

**Total custom hooks: 5 + 2 context providers.**

---

## 4. Keyboard Shortcuts

All shortcuts registered via `useRegisterShortcuts()` in `src/hooks/useKeyboardShortcuts.ts`. No raw `addEventListener('keydown', ...)` in feature code; ShortcutRegistry owns the single global listener.

**Legacy raw-keydown handlers found** (must migrate during T-121 or T-129):

- `src/components/PresentationMode.tsx` — exit presentation on Esc
- `src/components/AICopilot.tsx` — close copilot on Esc
- `src/components/CreateMode.tsx` — mode switching

### Registered shortcuts (via ShortcutRegistry)

| Key Combo | Action | Category | Gate |
|---|---|---|---|
| `Mod+Z` | Undo | edit.undo | — |
| `Mod+Shift+Z` | Redo | edit.redo | — |
| `Mod+C` | Copy | edit.copy | — |
| `Mod+X` | Cut | edit.cut | — |
| `Mod+V` | Paste | edit.paste | — |
| `Mod+Shift+V` | Paste without formatting | edit.paste-plain | — |
| `Mod+F` | Find | edit.find | — |
| `Mod+Shift+H` | Find & Replace | edit.find-replace | — |
| `Mod+K` | Insert link | object.insert-link | — |
| `Delete` / `Backspace` | Delete (focus-routed) | delete.focus-routed | Outside input/textarea/contenteditable |
| `Escape` | Deselect all | selection.deselect | — |
| `Mod+A` | Select all (on slide) | selection.select-all | — |
| `Tab` / `Shift+Tab` | Cycle selection | selection.cycle-{next,prev} | Outside input/textarea/contenteditable |
| `Mod+D` | Duplicate (focus-routed) | duplicate.focus-routed | — |
| `Mod+M` | New slide | slide.new | — |
| `Mod+Shift+D` | Duplicate slide | slide.duplicate | — |
| `Mod+Shift+A` | Select all slides | slide.select-all | Filmstrip focus |
| `Mod+ArrowUp/Down` | Move slide / element order | order.{up,down} | — |
| `Mod+Shift+ArrowUp/Down` | Move to ends | order.to-{start,end} | — |
| `Mod+Enter` | Start presentation from current | presentation.enter.current | — |
| `Mod+Shift+Enter` | Start presentation from 1 | presentation.enter.start | — |
| `Mod+/` / `Shift+?` | Cheat sheet | help.cheat-sheet | `?` gated to canvas focus |
| `Arrow{Up,Down,Left,Right}` | Nudge 10px | element.nudge.{dir} | Outside input/textarea/contenteditable |
| `Shift+Arrow{dir}` | Nudge 1px | element.nudge.{dir}.micro | Outside input/textarea/contenteditable |
| `Mod+Alt+G` / `Mod+Alt+Shift+G` | Group / Ungroup | object.{group,ungroup} | — |
| `Mod+B` / `Mod+I` / `Mod+U` | Bold / Italic / Underline | text.{bold,italic,underline} | `hasTextTarget()` |
| `Mod+Shift+L/E/R/J` | Align left/center/right/justify | text.align.{…} | — |
| `Mod+Shift+>` / `Mod+Shift+<` | Font size up/down | text.size.{up,down} | — |
| `Mod+Shift+7` / `Mod+Shift+8` | Numbered / Bulleted list | text.list.{numbered,bulleted} | — |
| `Mod+\` | Clear text formatting | text.clear-formatting | — |

**Total shortcuts: 43 registered.** Input-target suppression is built in: bare-key shortcuts (arrows, escape, tab, delete) fire only outside `<input>`, `<textarea>`, and `contenteditable`. Text-scoped shortcuts gate on `hasTextTarget()`.

**T-121 implication**: The shortcut registry and all bindings must be ported first. The 3 legacy `addEventListener` sites must migrate to the registry during the port.

---

## 5. Routes (Next.js App Router)

| Route | Purpose | Handler file |
|---|---|---|
| `/` | Main editor page | `src/app/page.tsx` — mounts app layout |
| `/dev` | Dev/debug page | `src/app/dev/page.tsx` |
| `/api/health` | Health check | `src/app/api/health/route.ts` |
| `/api/validate` | Validate document | `src/app/api/validate/route.ts` |
| `/api/document` | CRUD document | `src/app/api/document/route.ts` |
| `/api/document/slides` | Slide list / add | `src/app/api/document/slides/route.ts` |
| `/api/document/slides/[slideId]` | Slide detail | `src/app/api/document/slides/[slideId]/route.ts` |
| `/api/agent/tools` | List tools | `src/app/api/agent/tools/route.ts` |
| `/api/agent/execute` | Execute tool | `src/app/api/agent/execute/route.ts` |
| `/api/engine/validate` | Validate via engine | `src/app/api/engine/validate/route.ts` |
| `/api/data-source/sql` | SQL data source | `src/app/api/data-source/sql/route.ts` |

**Layout hierarchy**:
- `src/app/layout.tsx` — root layout (fonts, providers: DocumentProvider, AuthProvider, ShortcutRegistryProvider)
- `src/app/page.tsx` — mounts EditMode / CreateMode / PresentationMode / ValidationMode based on `modeAtom`

**No dynamic routes** beyond `[slideId]`. Single-page SPA with client-side mode switching.

---

## 6. Non-Jotai State

| Storage | Purpose | Scope |
|---|---|---|
| **DocumentContext** | Wraps Jotai atoms; exposes unified actions API. | Global |
| **AuthContext** | User + teams + Firestore auth. | Global |
| **localStorage** | Document persistence: saves doc JSON on every autosave; loads on next session. (`src/store/persistence.ts`) | Session |
| **Module-scope refs** | `useClipboard` fallback clipboard, `useKeyboardShortcuts` reader refs, `useAutoRefreshDataSources` loop-detection ref. | Component-scoped |
| **Window custom events** | Modal open triggers: `CHEAT_SHEET_OPEN_EVENT`, `FIND_REPLACE_OPEN_EVENT`, `SINGLE_INPUT_DIALOG_EVENT`, `slidemotion:presentation-open`, etc. | Global |

**No Zustand, Redux, or other stores.** Jotai + React Context + localStorage is the complete state stack.

---

## 7. Third-Party Behaviour-Critical Dependencies

From `reference/slidemotion/apps/editor/package.json`:

| Package | Version | Purpose | Status for StageFlip |
|---|---|---|---|
| `jotai` | ^2.19.1 | Atomic state. Uses hand-rolled factory instead of deprecated `atomFamily`. | ✓ Whitelist |
| `@radix-ui/react-context-menu` | ^2.2.16 | Context menu primitives (headless). | ✓ Whitelist |
| `@radix-ui/react-dialog` | ^1.1.15 | Dialog/modal primitives. | ✓ Whitelist |
| `fast-json-patch` | ^3.1.1 | RFC 6902 JSON patch for undo/redo. | ✓ Already in StageFlip |
| `next` | ^16.2.4 | App Router framework. | ✓ Whitelist |
| `react` / `react-dom` | ^19.2.5 | Framework. | ✓ Whitelist |
| `html2canvas` | ^1.4.1 | PNG thumbnail fallback when CSS renderer unavailable. | **⚠ Verify whitelist before T-121.** Non-core; may be replaceable. |
| `csstype` | ^3.2.3 | TS CSS types. | ✓ Dev-only |
| `@slidemotion/*` | workspace | Internal monorepo packages (agent, engine, schema, renderer-core, validation, design-system, collaboration, importers). | ✓ Replaced by `@stageflip/*` equivalents during port |

**⚠ Remotion** is imported by `SingleSlidePreview.tsx` and `PlayerPreview.tsx` in the reference code. Per CLAUDE.md §3, **Remotion imports are banned in StageFlip**. Both must be reimplemented against `@stageflip/frame-runtime` during T-123 / T-129 — no port-by-copy.

**Decision before T-121**: confirm `html2canvas` whitelist status. If blocked, plan thumbnail fallback strategy (native canvas export? server-side render?).

---

## 8. i18n Surface

**Catalog location**: `src/i18n/catalog.ts` — flat key → string map (170+ keys).

**Shape**: ✓ Matches StageFlip target (`apps/<app>/src/i18n/catalog.ts` + `t('key')` call sites).

**Current state**: Fully i18n-scaffolded.
- `setLocale('pseudo')` renders `⟦key⟧` for QA runs to spot missing translations.
- All UI strings use `t('key')` — no bare string literals in user-visible copy.
- Minimal setup: no `react-i18next`, no lazy bundle per locale, no RTL wiring.

**Sample keys**: `nav.undo`, `nav.redo`, `nav.create`, `nav.export`, `export.confirm.title`, `export.loss.unsupportedSuffix`, `commandPalette.placeholder`, `copilot.title`, `properties.fallback`, `status.elements`.

**Action for T-121+**: Copy the en + pseudo catalogs into `apps/stageflip-slide/src/i18n/catalog.ts`. Update keys as needed for StageFlip branding (e.g., during T-134). No breaking changes to the `t()` API.

---

## Summary + Port Sequence Implications

### Component counts by port tier
| Tier | Task | Component count |
|---|---|---|
| CanvasWorkspace | T-123 | 5 |
| Filmstrip | T-124 | 1 (+ right-click menu hooks) |
| PropertiesPanel | T-125 | 6 |
| TimelinePanel | T-126 | 4 + 1 utility module |
| CommandPalette | T-127 | 1 |
| AiCopilot | T-128 | 3 |
| Other | T-129 | 32 |
| **Total** | — | **52** |

### State + hook dependencies (shape of T-121 / T-132)

- **T-121 (editor-shell) must deliver first**: shortcut registry + `ShortcutRegistryProvider`; DocumentContext + AuthContext shells; localStorage persistence adapter; the 11 Jotai atoms (this is also T-132 — flag for overlap).
- **T-123 (CanvasWorkspace) depends on**: `documentAtom`, `selectedElementIdsAtom`, `activeSlideIdAtom`, `useKeyboardShortcuts`, `InlineTextEditor`-flavoured commit hook.
- **T-124 (Filmstrip) depends on**: `documentAtom`, `activeSlideIdAtom`, `selectedSlideIdsAtom`, right-click menu hooks.
- **T-125 (PropertiesPanel) depends on**: `selectedElementIdAtom` (projection), ZodForm introspection, clip metadata from registered runtimes.
- **T-126 (TimelinePanel) depends on**: no atoms directly; is a controlled component (parent passes state + callbacks). The cleanest port.
- **T-127 (CommandPalette) depends on**: `documentAtom`, `executeTool` from engine/agent (Phase 7).
- **T-128 (AiCopilot) depends on**: `documentAtom`, diff engine from `@stageflip/validation`, token budget (Phase 7).

### Decision points before T-121 kicks off

1. **Shortcut registry port** — the cheat-sheet + every feature shortcut depends on this. Port verbatim (API-compatible).
2. **Atoms port (T-132)** — Must land alongside or before T-123. Consider whether T-121 ships stub atoms or T-132 ships them; the tasks overlap.
3. **Context providers** — DocumentContext + AuthContext are thin adapters. Port during T-121.
4. **`html2canvas` license decision** — blocker if it's not on the whitelist.
5. **Legacy `addEventListener` migration** (3 sites) — migrate to registry during T-121 or first touch during component ports.
6. **Remotion replacement in `SingleSlidePreview` + `PlayerPreview`** — reimplement via `@stageflip/frame-runtime` + the runtimes contract. Part of T-123 + T-129.

### Pattern observations (useful for the ports)

- **Fine-grained atoms** — the `slideByIdAtom(id)` / `elementByIdAtom(id)` memoized-factory pattern minimizes re-renders. Preserve it.
- **Context ref-reads** — `useKeyboardShortcuts.ts` reads context state via refs rather than subscriptions, which keeps the shortcut array stable across renders. Worth preserving.
- **Focus-routed shortcuts** — "delete" and "duplicate" behave differently on elements vs slides depending on focus target. Preserve this routing logic.
- **Radix UI** — already standardized for menus + dialogs. Good primitive choice for the port.
- **No raw `fetch`** in UI code — all API calls go through the engine tool-router. Preserve.

---

**End of audit.** Update this doc as components port; the Port Tier column and the "Total components" count should drop as T-123–T-129 land. This file is the shared inventory for every Phase 6 port PR.
