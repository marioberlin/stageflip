// packages/editor-shell/src/atoms/undo.ts
// Reactive undo/redo stacks + derived can-undo / can-redo flags.

/**
 * The editor-shell owns the atom surface only. T-133 will wire the
 * actual patch apply/invert semantics — push on mutation, pop on
 * Cmd+Z, shift into redo, etc. — and will define the concrete operation
 * shape via `fast-json-patch`. Until then, the local `MicroUndo` shape
 * is intentionally minimal: two `unknown[]` arrays (forward + inverse)
 * and an optional label for cheat-sheet style display. Consumers that
 * push real patches can cast their `Operation[]` to `unknown[]` at the
 * boundary.
 *
 * Entries are capped at `MAX_MICRO_UNDO` by the push logic (not by the
 * atom itself); the atom stores the raw array so tests and tooling can
 * inspect or rebuild it freely.
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
