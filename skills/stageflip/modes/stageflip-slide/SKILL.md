---
title: StageFlip.Slide Mode
id: skills/stageflip/modes/stageflip-slide
tier: mode
status: substantive
last_updated: 2026-04-22
owner_task: T-135
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/css/SKILL.md
  - skills/stageflip/clips/authoring/SKILL.md
  - skills/stageflip/workflows/import-slidemotion-legacy/SKILL.md
  - skills/stageflip/workflows/parity-testing/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/concepts/loss-flags/SKILL.md
---

# StageFlip.Slide Mode

StageFlip's slide-deck editor. A Next.js 15 app that mounts
`@stageflip/editor-shell`, renders slides against the shared frame runtime
and registered clip runtimes, and speaks the canonical schema — the same
`Document` shape used by Video and Display modes.

The mode exists so slide-shaped motion content (pitches, quarterlies, ads
in 16:9 slide form) has a first-class workflow without forking the engine.
The Canvas, Filmstrip, Timeline, Properties, CommandPalette, and AI
Copilot panels are mode-specific; everything below them (schema, RIR,
frame runtime, clip runtimes, renderer-core, parity harness, export) is
shared.

## Package map

| Package / app | Purpose |
|---|---|
| `apps/stageflip-slide` | The Next.js 15 editor. Walking-skeleton entrypoint at `src/app/page.tsx`; the composed editor UI lives under `src/components/**`. |
| `@stageflip/editor-shell` | Shell-level primitives shared across all three modes: document atom + `DocumentProvider`, selection atoms, shortcut registry, undo/redo interceptor, transaction API, i18n catalog, persistence hooks. Every slide-app panel consumes `useDocument()` for reads + mutations. |
| `@stageflip/schema` | The canonical `Document` shape. Slide mode operates on `document.content.mode === 'slide'`; `content.slides[]` carries the per-slide element lists. |
| `@stageflip/rir` / `@stageflip/frame-runtime` / `@stageflip/runtimes-*` | Shared rendering stack. Slide mode's in-canvas preview + timeline scrubber run against `frame-runtime` through the registered clip runtimes. |
| `@stageflip/import-slidemotion-legacy` | One-way legacy → canonical converter. Opens existing SlideMotion documents in the Slide editor (T-130). |

`apps/stageflip-display` and `apps/stageflip-video` mount the same
`editor-shell` with different Canvas + panel shells; packages are
identical.

## Document contract

Slide documents carry `content: { mode: 'slide', slides: Slide[] }`. Each
`Slide` has:

```ts
interface Slide {
  id: string;                       // URL-safe [A-Za-z0-9_-]+
  title?: string;
  elements: Element[];              // array order = z-order
  background?: BackgroundSpec;      // { kind: 'color', value } | { kind: 'asset', value }
  durationMs?: number;              // else 'auto' at the doc level
  notes?: string;                   // exported to PPTX + PDF
  transition?: TransitionSpec;      // durationMs default 400; kind is optional (no default)
}
```

`Element` is the full 11-variant discriminated union (text, image, video,
audio, shape, group, chart, table, clip, embed, code). Array order is the
z-order the RIR compiler emits; no explicit `zIndex` field. Every element
carries an `ElementBase` with `id`, `transform`, `visible`, `locked`, and
`animations[]`.

### Multi-mode content

The same document can carry `content.mode === 'video'` or
`'display'` with different `content.*` shapes. Slide mode treats a
non-slide document as unhydrated — the properties panel and filmstrip
render a fallback message rather than crashing. See the `mode` literal
on `ContentUnion` in `@stageflip/schema`.

## UI layout

Left to right, the editor shell composes:

```
 ┌─────────────┬──────────────────────────────────────┬──────────────────┐
 │  Filmstrip  │              SlideCanvas             │    Properties    │
 │  (T-124)    │  ElementView ∘ SelectionOverlay ∘    │    Panel         │
 │             │  InlineTextEditor ∘ SlidePlayer      │    (T-125a)      │
 ├─────────────┴──────────────────────────────────────┴──────────────────┤
 │                         TimelinePanel (T-126)                         │
 ├───────────────────────────────────────────────────────────────────────┤
 │                             StatusBar                                 │
 └───────────────────────────────────────────────────────────────────────┘
```

CommandPalette (T-127) and AI Copilot (T-128) float above the shell
as toggled overlays — CommandPalette on a keyboard shortcut, AiCopilot
from a toolbar toggle (`copilotOpen` state). Neither is a persistent
row in the layout.

### SlideCanvas (T-123a + supporting)

`apps/stageflip-slide/src/components/canvas/`

- `slide-canvas.tsx` — 1920×1080 slide surface with `canvas-scale-context`
  for HiDPI. Mounts every visible element via `ElementView`.
- `element-view.tsx` — pure-render dispatcher on `element.type`. No
  mutations; selection + edit surfaces overlay on top.
- `selection-overlay.tsx` — bounding-box with 8 resize handles + rotation
  handle. Drag / resize / rotate open a T-133a coalescing transaction so
  each gesture is one undo entry, not N.
- `inline-text-editor.tsx` + `text-selection-toolbar.tsx` —
  contenteditable overlay that replaces a text element's static render
  on double-click. Commits `runs[]` on blur + Enter, reverts on Escape.
- `slide-player.tsx` — in-canvas preview. Compiles RIR, scrubs against
  `useCurrentFrame()`, drives playback from the timeline scrubber.

Zero Remotion imports anywhere in this tree (CI gate
`check-remotion-imports`).

### Filmstrip (T-124)

`apps/stageflip-slide/src/components/filmstrip/` renders miniature slide
thumbnails with drag-to-reorder. Thumbnails use a CSS-only renderer
(no Remotion, no dispatcher) — same approach as SlideMotion's
`CssSlideRenderer` — so the filmstrip is cheap at 60 slides.

### TimelinePanel (T-126)

`apps/stageflip-slide/src/components/timeline/` — below the canvas.
Draggable block edges edit `element.timing`; draggable keyframe dots
edit `element.keyframes[]`; draggable ruler scrubber updates
`currentFrame`. The edit-vs-preview toggle flips the canvas to
`<SlidePlayer>` two-way synced with the scrubber.

`timeline-math.ts` owns the pure pixel↔frame↔time conversions so
layout math is unit-testable without mounting React.

### PropertiesPanel (T-125a)

`apps/stageflip-slide/src/components/properties/properties-panel.tsx`
is the router. Three render branches:

1. **Element selected** → `<SelectedElementProperties>`:
   - Position / Size / Rotation (PropField number inputs,
     commit-on-blur).
   - Opacity (range slider, commit-on-release).
   - Visible + Locked toggles.
   - Z-order buttons (front / forward / back / bottom).
   - Delete.
   - A type-specific editor slot for future chart / table / animation
     editors (T-125c) and the `ClipElementProperties` ZodForm wrap
     (T-125b).
2. **No element selected, active slide** → `<SlideProperties>`:
   id, title, background, duration, element count, notes textarea.
3. **Unhydrated** → fallback message.

Every mutation funnels through `updateDocument`, so T-133's interceptor
captures one undo entry per commit. Range-type inputs (slider,
textarea) use local-draft + commit-on-release to avoid flooding the
undo stack.

### CommandPalette (T-127)

`apps/stageflip-slide/src/components/command-palette/` — slash
commands keyed on the current selection. `commands.ts` holds the pure
command registry; Cmd/Ctrl-K surfaces the UI. Commands dispatch
actions via the `useDocument()` mutators.

### AiCopilot stub (T-128)

`apps/stageflip-slide/src/components/ai-copilot/` — right-rail chat
stub. `execute-agent.ts` exposes the `fetchImpl` seam; the walking
route returns 501 → `pending` today. Phase 7 wires the real
planner → executor → validator behind the same seam with zero
component-level changes.

Per-id `data-testid="ai-message-${id}"` + `data-role` selectors on
rows avoid Playwright strict-mode multi-match after a second turn.

## State + interactions

### Document atom + hooks

`editor-shell` owns the atom. Panels call `useDocument()` to read
`document`, mutate via `updateDocument((doc) => ...)` or
`setDocument(doc)`, and subscribe to selection + active-slide state.
Each slide-app panel mounts inside one `<DocumentProvider>`; the
`jotai` store is per-provider so tests (and any future secondary
editor instance) stay isolated.

### Undo / redo (T-133 + T-133a)

- **Auto-record (T-133).** Every `updateDocument` diff-pushes a
  `MicroUndo` (RFC-6902 patches via `fast-json-patch`) if the forward
  patch is non-empty. Stack capped at `MAX_MICRO_UNDO = 100`.
- **Coalescing (T-133a).** `beginTransaction(label?)` snapshots the
  atom; `updateDocument` calls between `begin` and `commit` still
  apply but skip the per-call push; `commitTransaction()` diffs
  snapshot-vs-final and pushes one entry. Nested begins are ignored.
  `cancelTransaction()` restores the snapshot. Gestures
  (SelectionOverlay drag / resize / rotate) open a transaction; one-off
  clicks do not.

Rule of thumb: **every gesture-based editor gets a transaction**;
every discrete commit (form submit, button click, keyboard action) uses
raw `updateDocument`.

### Selection

Atoms in `@stageflip/editor-shell/src/atoms/selection.ts`:

- `selectedElementIdsAtom` — `ReadonlySet<string>`.
- `selectedElementIdAtom` — convenience getter that resolves to the
  single selected id when `size === 1`, else `null`. Multi-select
  falls through to the slide-properties branch of the router (a
  dedicated multi-select editor is a future-expand).
- `selectedSlideIdsAtom` — slide-level selection drives Filmstrip.

### Keyboard shortcuts

Slide-mode shortcuts register via `useRegisterShortcuts` from
`editor-shell` — never raw `window.addEventListener('keydown', …)`.
The shortcut registry de-duplicates chord bindings and powers the
cheat-sheet (opened by `?`).

### i18n

Every user-visible string flows through `t('key')` from
`@stageflip/editor-shell/src/i18n/catalog.ts`. Bare string literals in
Slide-app UI are drift per CLAUDE.md §10. Pseudo-locale mode
(`setLocale('pseudo')`) renders `⟦key⟧` so QA passes spot the misses.

### Persistence

`useAutosaveDocument()` + `saveDocument()` / `loadDocumentSerialized()`
from `editor-shell/src/persistence/`. Local storage today; the Firebase
storage backend is the documented future path (see
`concepts/auth/SKILL.md` + the storage-firebase package).

## Rendering pipeline

Slide preview and export share the RIR → clip-runtime dispatch path:

1. The editor mutates `Document` in-place through `updateDocument`.
2. On play / scrub, `<SlidePlayer>` compiles the RIR and asks the
   frame runtime for the current frame.
3. Clips dispatch by `kind` via `findClip(kind)` on
   `@stageflip/runtimes-contract`; the owning runtime renders.
4. Export (PNG, PDF, MP4, PPTX, HTML5 ZIP, Marp) reuses the same
   dispatch against the CDP host bundle — pixel-parity with preview is
   enforced by the parity harness.

**Never** import `remotion` or `@remotion/*` anywhere in the slide
tree. CI gate: `pnpm check-remotion-imports` must see zero matches.

### Determinism

Slide-app code is outside the determinism-restricted scope
(clip + runtime code). Editor components may use `Date.now()`,
`crypto.randomUUID()`, timers, and so on. **Clip code rendered inside
the canvas MUST remain deterministic** — see
`concepts/determinism/SKILL.md` for the scope boundary.

## Migration + import

`@stageflip/import-slidemotion-legacy` (T-130) is the entry point for
existing SlideMotion decks:

```ts
importLegacyDocument(input: unknown) → {
  document: Document;
  warnings: { path: string; reason: string; detail?: string }[];
}
```

The returned `document` is final-gated through `documentSchema.parse()`
so callers can trust it; the warning list carries structured entries
for every lossy mapping. MVP maps text / image / shape / group + solid
and image backgrounds; chart, table, video, embed, gradients, timing,
animations, captions, and brand fields drop with a warning. Editor
surfaces the warnings via the `ImportDiagnosticsNotice` pattern
(dispatch `stageflip:reopen-import-notice` to re-open after dismiss).

See `workflows/import-slidemotion-legacy/SKILL.md` for details.

## Quality gates

Every slide-app PR must pass the shared gate set:

- `pnpm typecheck` — TS strict with `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`.
- `pnpm lint` — Biome.
- `pnpm test` — Vitest; ≥85% coverage on changed code.
- `pnpm check-licenses` — whitelist only.
- `pnpm check-remotion-imports` — zero matches anywhere in slide tree.
- `pnpm check-determinism` — scoped rule; applies only to clip/runtime
  code but CI still runs for every PR.
- `pnpm check-skill-drift` — skills ↔ source. If you change behavior
  that this file describes, update this file in the same PR.
- `pnpm parity` — PSNR + SSIM if rendering touched.

Plus: PR template checklist complete, changeset included if a
publishable package is touched.

## Acceptance (Phase 6 exit criterion)

`apps/stageflip-slide` achieves parity with the pre-fork SlideMotion
editor on the following:

- Create / open / save deck.
- Slide CRUD via Filmstrip (add, reorder, duplicate, delete).
- Element CRUD via Canvas + SelectionOverlay.
- Inline text editing via T-123c's contenteditable surface.
- Timeline scrubbing + element-timing + keyframe drags.
- Preview mode driven by `<SlidePlayer>` through the frame runtime.
- CommandPalette slash commands keyed on selection.
- PropertiesPanel routing including type-specific editors.
- Undo / redo (coalesced for gestures).
- Legacy-document import through `import-slidemotion-legacy`.
- PNG export through `@stageflip/renderer-cdp` (Phase 4 pipeline).

The T-136 Playwright regression suite walks the golden path end-to-end
and is the formal ratification gate.

## Where things go

| Adding… | Goes in |
|---|---|
| New Slide-editor panel | `apps/stageflip-slide/src/components/<panel>/` + i18n keys + tests. Register shortcuts via `useRegisterShortcuts`. |
| New translated UI string | `packages/editor-shell/src/i18n/catalog.ts` + `t('key')` at the use site (never a bare string literal). |
| New command-palette command | `apps/stageflip-slide/src/components/command-palette/commands.ts` — keep dispatch pure. |
| New type-specific properties editor | `apps/stageflip-slide/src/components/properties/<type>-element-properties.tsx` + route from `selected-element-properties.tsx`. |
| New element type (schema-level) | `packages/schema/src/elements/<name>.ts` + dispatcher update in `renderer-core` + skill update — shared across all three modes. |
| New clip | `packages/runtimes/<kind>/src/clips/<clip>/` + `registerClip()` + parity fixture + skill. Shared across modes; slide mode picks up the new kind through `findClip`. |
| New keyboard shortcut | Register via `useRegisterShortcuts`; never raw `addEventListener('keydown', …)`. |
| New agent tool (Phase 7) | Handler in `@stageflip/engine` + registry + `skills/stageflip/tools/<category>/SKILL.md`. Slide mode consumes tools through the AI copilot seam. |

## Related

- Runtime contract + `propsSchema` for clip-prop auto-inspection:
  `runtimes/contract/SKILL.md`.
- Frame-runtime render path: `runtimes/frame-runtime/SKILL.md`.
- CSS runtime (the default live tier): `runtimes/css/SKILL.md`.
- Authoring new clips: `clips/authoring/SKILL.md`.
- Legacy import: `workflows/import-slidemotion-legacy/SKILL.md`.
- Parity harness + PSNR / SSIM thresholds:
  `workflows/parity-testing/SKILL.md`.
- Determinism scope boundary: `concepts/determinism/SKILL.md`.
- Export loss flags: `concepts/loss-flags/SKILL.md`.
- Owning task: T-135 (this doc). Composing tasks span T-119 through
  T-136 in `docs/implementation-plan.md`.
