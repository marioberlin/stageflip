// packages/import-pptx/src/geometries/presets/brackets.ts
// Bracket preset generators. T-242a ships `leftBracket`; rightBracket and
// the curly braces land in T-242b.

import type { PathGenerator } from '../types.js';

/**
 * `leftBracket`: a square-bracket left edge `⌜...⌞`. Two stub horizontal
 * segments at the top and bottom plus the vertical stem. The OOXML
 * adjustable `adj` is the corner radius / cap; T-242a uses sharp corners
 * (adj = 0 in our simplified model).
 */
export const leftBracket: PathGenerator = ({ w, h }) => {
  return [`M ${w} 0`, 'L 0 0', `L 0 ${h}`, `L ${w} ${h}`].join(' ');
};
