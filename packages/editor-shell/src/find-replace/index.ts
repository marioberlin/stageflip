// packages/editor-shell/src/find-replace/index.ts
// Barrel for the find-replace framework surface (T-139c).

export { findMatches } from './find-matches';
export { replaceAll } from './replace-all';
export {
  EMPTY_FIND_HIGHLIGHTS,
  findHighlightsAtom,
  type FindHighlightsState,
} from './highlights-atom';
export type { FindMatch, FindOptions } from './types';
