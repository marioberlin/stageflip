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
