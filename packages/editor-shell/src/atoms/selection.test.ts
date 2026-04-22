// packages/editor-shell/src/atoms/selection.test.ts
// Selection-set atoms + the single-select projection.

import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  selectedElementIdAtom,
  selectedElementIdsAtom,
  selectedSlideIdsAtom,
} from './selection';

describe('selection atoms', () => {
  it('default to the shared EMPTY_SELECTION frozen set', () => {
    const store = createStore();
    expect(store.get(selectedElementIdsAtom)).toBe(EMPTY_SELECTION);
    expect(store.get(selectedSlideIdsAtom)).toBe(EMPTY_SELECTION);
    expect(EMPTY_SELECTION.size).toBe(0);
  });

  it('round-trip a ReadonlySet', () => {
    const store = createStore();
    const set = new Set(['el-1', 'el-2']) as ReadonlySet<string>;
    store.set(selectedElementIdsAtom, set);
    expect(store.get(selectedElementIdsAtom)).toBe(set);
  });
});

describe('selectedElementIdAtom (single-select projection)', () => {
  it('is null when the selection is empty', () => {
    const store = createStore();
    expect(store.get(selectedElementIdAtom)).toBeNull();
  });

  it('returns the single id when exactly one element is selected', () => {
    const store = createStore();
    store.set(selectedElementIdsAtom, new Set(['only']) as ReadonlySet<string>);
    expect(store.get(selectedElementIdAtom)).toBe('only');
  });

  it('is null when two or more elements are selected', () => {
    const store = createStore();
    store.set(selectedElementIdsAtom, new Set(['a', 'b']) as ReadonlySet<string>);
    expect(store.get(selectedElementIdAtom)).toBeNull();
  });
});
