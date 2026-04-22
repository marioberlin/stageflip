// packages/editor-shell/src/atoms/ui.test.ts
// Active-slide id atom. Trivial surface — the test exists to lock the
// default and to document intent (empty string = no active slide).

import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { activeSlideIdAtom } from './ui';

describe('activeSlideIdAtom', () => {
  it('defaults to the empty string (no active slide)', () => {
    const store = createStore();
    expect(store.get(activeSlideIdAtom)).toBe('');
  });

  it('round-trips a written value', () => {
    const store = createStore();
    store.set(activeSlideIdAtom, 'slide-3');
    expect(store.get(activeSlideIdAtom)).toBe('slide-3');
  });
});
