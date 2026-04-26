// packages/editor-shell/src/atoms/import-loss-flags.ts
// Loss-flag reporter state surface (T-248). Session-ephemeral atoms — no
// persistence; reset on reload. The reporter UI in `apps/stageflip-slide`
// reads `visibleLossFlagsAtom`; future apps wire their own badges against
// the same atom.

import type { LossFlag } from '@stageflip/loss-flags';
import { atom } from 'jotai';

/**
 * Raw flag list as produced by an importer. Default `[]`. Writers replace
 * the whole array on every successful import. **Inert until the import
 * pipeline writes** — see T-248 §"Notes for the Orchestrator" #1.
 */
export const importLossFlagsAtom = atom<readonly LossFlag[]>([]);

/**
 * Per-session set of dismissed flag ids. Default empty `Set`. Re-import
 * does NOT clear this set (AC #4): the same `LossFlag.id` (content-hash
 * derived) stays dismissed across re-imports of the same source file.
 */
export const dismissedLossFlagIdsAtom = atom<ReadonlySet<string>>(new Set<string>());

/**
 * Derived: `importLossFlagsAtom` minus `dismissedLossFlagIdsAtom`, sorted
 * by severity descending (`error` > `warn` > `info`) then by `category`
 * ascending then by `source` ascending then by `code` ascending. Returns
 * a fresh array on every read; safe for downstream `.map`.
 */
export const visibleLossFlagsAtom = atom((get) => {
  const flags = get(importLossFlagsAtom);
  const dismissed = get(dismissedLossFlagIdsAtom);
  return flags
    .filter((f) => !dismissed.has(f.id))
    .slice()
    .sort(compareFlags);
});

const SEVERITY_RANK: Readonly<Record<LossFlag['severity'], number>> = {
  error: 0,
  warn: 1,
  info: 2,
};

function compareFlags(a: LossFlag, b: LossFlag): number {
  const sevDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sevDelta !== 0) return sevDelta;
  if (a.category !== b.category) return a.category < b.category ? -1 : 1;
  if (a.source !== b.source) return a.source < b.source ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  return 0;
}
