// packages/editor-shell/src/find-replace/highlights-atom.ts
// Atom carrying the currently-visible find-replace match set (T-139c).

import { atom } from 'jotai';
import type { FindMatch } from './types';

/**
 * Snapshot of the active find-replace session: the ordered match list
 * plus the currently-focused index (`-1` for "none selected").
 *
 * The canvas highlight overlay subscribes to this atom to paint match
 * rectangles on top of text elements; the FindReplace dialog writes
 * it whenever its query / options / focus change.
 *
 * Clearing the session is modelled as `{ matches: [], activeIndex: -1 }`
 * (exported as `EMPTY_FIND_HIGHLIGHTS`) rather than a nullable union —
 * consumers read `matches.length === 0` to decide whether to render.
 */
export interface FindHighlightsState {
  matches: readonly FindMatch[];
  /** Index into `matches` that should render in the "active" visual
   *  style, or `-1` if nothing's focused. */
  activeIndex: number;
}

export const EMPTY_FIND_HIGHLIGHTS: FindHighlightsState = {
  matches: [],
  activeIndex: -1,
};

export const findHighlightsAtom = atom<FindHighlightsState>(EMPTY_FIND_HIGHLIGHTS);
