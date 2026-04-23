// packages/editor-shell/src/find-replace/types.ts
// Shared types for the find-replace framework surface (T-139c).

/**
 * A located match inside a document. The tuple of (slideId, elementId,
 * start, length) uniquely identifies the match; `slideIndex` is cached
 * for ordering + UI readout and must equal the index of `slideId` in
 * the slide-mode document at call time.
 */
export interface FindMatch {
  slideId: string;
  slideIndex: number;
  elementId: string;
  /** Element text at match time — flattened. */
  elementText: string;
  /** Offset of the match inside `elementText`. */
  start: number;
  /** Length of the matched substring. */
  length: number;
}

/**
 * Options for `findMatches`. All flags default to the most permissive
 * (case-insensitive plain substring) — same defaults as the reference
 * editor.
 */
export interface FindOptions {
  caseSensitive?: boolean;
  /** Require the match to be surrounded by non-word characters. */
  wholeWord?: boolean;
  /** Treat `query` as a JavaScript regular expression. `wholeWord` is
   *  ignored when this is true — users express word boundaries with
   *  `\b` themselves. Invalid regex → empty result. */
  regex?: boolean;
}
