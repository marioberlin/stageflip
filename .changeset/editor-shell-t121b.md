---
"@stageflip/editor-shell": minor
---

T-121b: Jotai atoms + DocumentContext / AuthContext shells.

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
