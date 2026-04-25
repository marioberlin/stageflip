// packages/import-pptx/src/geometries/presets/basics.ts
// Basic-shape preset generators. T-242a ships `parallelogram` only; the
// rest (trapezoid, chevron, chord, pie, donut) land in T-242b.

import type { PathGenerator } from '../types.js';

/**
 * `parallelogram`: a slanted rectangle. Top edge is offset to the right by
 * `adj * width`; default adj = 25%. T-242a uses the default.
 */
export const parallelogram: PathGenerator = ({ w, h }) => {
  const slant = w * 0.25;
  return [`M ${slant} 0`, `L ${w} 0`, `L ${w - slant} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
};
