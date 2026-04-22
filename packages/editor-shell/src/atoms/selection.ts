// packages/editor-shell/src/atoms/selection.ts
// Multi-select state for elements and slides.

/**
 * Selection is stored as a `ReadonlySet<string>` so component equality
 * checks can rely on set identity. `EMPTY_SELECTION` is a shared frozen
 * instance so every "no selection" initial value reuses the same
 * reference — consumers that memoize on identity avoid a re-render when
 * one panel mounts and another already had empty selection.
 *
 * `selectedElementIdAtom` projects the set down to a single id when
 * exactly one element is selected. It powers single-select affordances
 * (PropertiesPanel, SelectionOverlay) that need to know "which one"
 * without caring about multi-select.
 */

import { atom } from 'jotai';

export const EMPTY_SELECTION: ReadonlySet<string> = Object.freeze(new Set<string>());

export const selectedElementIdsAtom = atom<ReadonlySet<string>>(EMPTY_SELECTION);
export const selectedSlideIdsAtom = atom<ReadonlySet<string>>(EMPTY_SELECTION);

export const selectedElementIdAtom = atom<string | null>((get) => {
  const set = get(selectedElementIdsAtom);
  if (set.size !== 1) return null;
  const [only] = set;
  return only ?? null;
});
