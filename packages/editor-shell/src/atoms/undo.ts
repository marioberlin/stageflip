// packages/editor-shell/src/atoms/undo.ts
// Reactive undo/redo stacks + derived can-undo / can-redo flags.

/**
 * Storage-only layer. `DocumentProvider` (T-133) wires the apply/invert
 * semantics: `updateDocument` diffs pre/post via `fast-json-patch` and
 * pushes a `MicroUndo` whose `forward` + `inverse` arrays carry
 * `Operation[]`; `undo()` / `redo()` pop + apply.
 *
 * `MicroUndo`'s fields are typed `unknown[]` rather than `Operation[]`
 * so the atom surface stays framework-agnostic — callers that want to
 * synthesise non-RFC-6902 operations (future macro-undo, snapshot
 * groups) can reuse the stack without dragging the `fast-json-patch`
 * type in.
 *
 * Entries are capped at `MAX_MICRO_UNDO` by the push logic, not by the
 * atom itself. Tests and tooling read the raw array freely.
 */

import type { Document } from '@stageflip/schema';
import { atom } from 'jotai';

export const MAX_MICRO_UNDO = 100;

export interface MicroUndo {
  label?: string;
  forward: unknown[];
  inverse: unknown[];
}

export const undoStackAtom = atom<MicroUndo[]>([]);
export const redoStackAtom = atom<MicroUndo[]>([]);

export const canUndoAtom = atom<boolean>((get) => get(undoStackAtom).length > 0);
export const canRedoAtom = atom<boolean>((get) => get(redoStackAtom).length > 0);

/**
 * In-progress transaction (T-133a). Non-null while a gesture is
 * coalescing many `updateDocument` calls into one eventual undo entry.
 * `snapshot` is the document state captured by `beginTransaction`; the
 * commit step diffs current-vs-snapshot and pushes exactly one
 * `MicroUndo`.
 *
 * While non-null:
 *   - `updateDocument` skips its diff-and-push path (the commit handles
 *     it)
 *   - `undo()` / `redo()` are no-ops so a mid-drag keybind can't
 *     interleave a history rewrite with the in-flight transaction
 *   - `setDocument` clears this atom along with the stacks (consistent
 *     with the rest of the cross-document invariant)
 */
export interface ActiveTransaction {
  snapshot: Document;
}

export const transactionAtom = atom<ActiveTransaction | null>(null);

export const inTransactionAtom = atom<boolean>((get) => get(transactionAtom) !== null);
