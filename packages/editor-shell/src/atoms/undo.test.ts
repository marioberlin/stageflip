// packages/editor-shell/src/atoms/undo.test.ts
// Undo/redo stacks + derived `canUndo` / `canRedo` flags. T-121b owns
// the reactive atom surface only; T-133 will wire actual patch
// apply/invert semantics.

import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import {
  MAX_MICRO_UNDO,
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from './undo';

function makeEntry(label: string): MicroUndo {
  return { label, forward: [], inverse: [] };
}

describe('MAX_MICRO_UNDO', () => {
  it('is a positive integer budget', () => {
    expect(MAX_MICRO_UNDO).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_MICRO_UNDO)).toBe(true);
  });
});

describe('undoStackAtom / redoStackAtom', () => {
  it('default to empty arrays', () => {
    const store = createStore();
    expect(store.get(undoStackAtom)).toEqual([]);
    expect(store.get(redoStackAtom)).toEqual([]);
  });

  it('round-trip a push', () => {
    const store = createStore();
    const entry = makeEntry('edit-text');
    store.set(undoStackAtom, [entry]);
    expect(store.get(undoStackAtom)).toEqual([entry]);
  });
});

describe('canUndoAtom / canRedoAtom', () => {
  it('are false when the respective stack is empty', () => {
    const store = createStore();
    expect(store.get(canUndoAtom)).toBe(false);
    expect(store.get(canRedoAtom)).toBe(false);
  });

  it('become true when the stack has entries', () => {
    const store = createStore();
    store.set(undoStackAtom, [makeEntry('a')]);
    store.set(redoStackAtom, [makeEntry('b')]);
    expect(store.get(canUndoAtom)).toBe(true);
    expect(store.get(canRedoAtom)).toBe(true);
  });

  it('re-derive when the stack empties', () => {
    const store = createStore();
    store.set(undoStackAtom, [makeEntry('a')]);
    expect(store.get(canUndoAtom)).toBe(true);
    store.set(undoStackAtom, []);
    expect(store.get(canUndoAtom)).toBe(false);
  });
});
