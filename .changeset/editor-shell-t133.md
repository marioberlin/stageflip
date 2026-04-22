---
'@stageflip/editor-shell': minor
---

T-133 — wire RFC 6902 undo/redo on top of the T-121b atom surface.
`updateDocument` now auto-diffs the pre/post documents with
`fast-json-patch`, pushing a `MicroUndo` of forward + inverse
`Operation[]` onto `undoStackAtom`. New `undo()` / `redo()` actions on
the `useDocument()` surface pop from their respective stacks and apply
the patches. `<EditorShell>` registers `Mod+Z` / `Mod+Shift+Z`
shortcuts by default. `setDocument` clears both stacks so
cross-document patches can't apply into a drifted state.
