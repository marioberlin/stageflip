// packages/editor-shell/src/atoms/import-loss-flags.test.ts
// Atom-layer tests for the T-248 loss-flag reporter state surface.

import type { LossFlag } from '@stageflip/loss-flags';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import {
  dismissedLossFlagIdsAtom,
  importLossFlagsAtom,
  visibleLossFlagsAtom,
} from './import-loss-flags';

function makeFlag(overrides: Partial<LossFlag> = {}): LossFlag {
  return {
    id: `id-${Math.random().toString(36).slice(2, 10)}`,
    source: 'pptx',
    code: 'LF-PPTX-CUSTOM-GEOMETRY',
    severity: 'info',
    category: 'shape',
    location: {},
    message: 'Lossy translation',
    ...overrides,
  };
}

describe('importLossFlagsAtom', () => {
  it('defaults to an empty readonly array', () => {
    const store = createStore();
    const flags = store.get(importLossFlagsAtom);
    expect(flags).toEqual([]);
    expect(flags.length).toBe(0);
  });

  it('round-trips an array of LossFlag', () => {
    const store = createStore();
    const a = makeFlag({ id: 'a' });
    const b = makeFlag({ id: 'b' });
    store.set(importLossFlagsAtom, [a, b]);
    expect(store.get(importLossFlagsAtom)).toEqual([a, b]);
  });
});

describe('dismissedLossFlagIdsAtom', () => {
  it('defaults to an empty Set', () => {
    const store = createStore();
    const set = store.get(dismissedLossFlagIdsAtom);
    expect(set instanceof Set).toBe(true);
    expect(set.size).toBe(0);
  });

  it('round-trips a ReadonlySet', () => {
    const store = createStore();
    const set: ReadonlySet<string> = new Set(['x', 'y']);
    store.set(dismissedLossFlagIdsAtom, set);
    expect(store.get(dismissedLossFlagIdsAtom)).toBe(set);
  });
});

describe('visibleLossFlagsAtom (derived)', () => {
  it('returns [] when there are no flags', () => {
    const store = createStore();
    expect(store.get(visibleLossFlagsAtom)).toEqual([]);
  });

  it('filters out dismissed flag ids', () => {
    const store = createStore();
    const a = makeFlag({ id: 'a', severity: 'info' });
    const b = makeFlag({ id: 'b', severity: 'info' });
    const c = makeFlag({ id: 'c', severity: 'info' });
    store.set(importLossFlagsAtom, [a, b, c]);
    store.set(dismissedLossFlagIdsAtom, new Set(['b']));
    const visible = store.get(visibleLossFlagsAtom);
    expect(visible.map((f) => f.id)).toEqual(['a', 'c']);
  });

  it('sorts by severity descending (error > warn > info)', () => {
    const store = createStore();
    const info = makeFlag({ id: 'info', severity: 'info' });
    const warn = makeFlag({ id: 'warn', severity: 'warn' });
    const err = makeFlag({ id: 'err', severity: 'error' });
    store.set(importLossFlagsAtom, [info, warn, err]);
    const visible = store.get(visibleLossFlagsAtom);
    expect(visible.map((f) => f.id)).toEqual(['err', 'warn', 'info']);
  });

  it('within same severity, sorts by source ascending then code ascending', () => {
    const store = createStore();
    const a = makeFlag({ id: 'a', severity: 'warn', source: 'pptx', code: 'LF-PPTX-Z' });
    const b = makeFlag({ id: 'b', severity: 'warn', source: 'pptx', code: 'LF-PPTX-A' });
    const c = makeFlag({ id: 'c', severity: 'warn', source: 'gslides', code: 'LF-GS-A' });
    store.set(importLossFlagsAtom, [a, b, c]);
    const visible = store.get(visibleLossFlagsAtom);
    // gslides < pptx (alpha), then within pptx: LF-PPTX-A < LF-PPTX-Z.
    expect(visible.map((f) => f.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the source array (sorted copy)', () => {
    const store = createStore();
    const a = makeFlag({ id: 'a', severity: 'info' });
    const b = makeFlag({ id: 'b', severity: 'error' });
    const arr: LossFlag[] = [a, b];
    store.set(importLossFlagsAtom, arr);
    store.get(visibleLossFlagsAtom);
    expect(arr.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('preserves dismissed-set across importLossFlagsAtom rewrites (AC #4)', () => {
    const store = createStore();
    const a = makeFlag({ id: 'a' });
    store.set(importLossFlagsAtom, [a]);
    store.set(dismissedLossFlagIdsAtom, new Set(['a']));
    expect(store.get(visibleLossFlagsAtom)).toEqual([]);
    // Re-import: same id 'a' is still dismissed; new id 'b' shows.
    const b = makeFlag({ id: 'b' });
    store.set(importLossFlagsAtom, [a, b]);
    const visible = store.get(visibleLossFlagsAtom);
    expect(visible.map((f) => f.id)).toEqual(['b']);
  });
});
