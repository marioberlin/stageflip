// packages/editor-shell/src/atoms/import-loss-flags.ts
// Loss-flag reporter state surface (T-248) — scaffold; implementation in
// the follow-up `feat:` commit.

import type { LossFlag } from '@stageflip/loss-flags';
import { atom } from 'jotai';

export const importLossFlagsAtom = atom<readonly LossFlag[]>([]);

export const dismissedLossFlagIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

// Scaffold: returns the unsorted, unfiltered list so AC #3 / #4 tests fail.
export const visibleLossFlagsAtom = atom((get) => {
  const flags = get(importLossFlagsAtom);
  return flags.slice();
});
