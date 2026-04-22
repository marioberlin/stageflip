---
'@stageflip/editor-shell': minor
---

T-133a — coalescing transaction API on top of the T-133 undo/redo
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
