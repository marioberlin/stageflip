// packages/import-pptx/src/geometries/presets/basics.ts
// Basic-shape preset generators. T-242b first-wave adds `trapezoid` and
// `chevron`; remaining basics (chord, pie, donut) land in T-242c.

import type { PathGenerator } from '../types.js';

/**
 * `parallelogram`: a slanted rectangle. Top edge is offset to the right by
 * `adj * width`; default adj = 25%. T-242 uses the default.
 */
export const parallelogram: PathGenerator = ({ w, h }) => {
  const slant = w * 0.25;
  return [`M ${slant} 0`, `L ${w} 0`, `L ${w - slant} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
};

/**
 * `trapezoid`: shorter top edge centered above a wider bottom. Default
 * adj = 25% inset on each side of the top edge.
 */
export const trapezoid: PathGenerator = ({ w, h }) => {
  const inset = w * 0.25;
  return [`M ${inset} 0`, `L ${w - inset} 0`, `L ${w} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
};

/**
 * `chevron`: a right-pointing chevron (>-shaped block). Default adj = 50%
 * notch depth (the inner-left vertex sits at adj * width of the way from
 * the left edge).
 */
export const chevron: PathGenerator = ({ w, h }) => {
  const notch = w * 0.5;
  return [
    'M 0 0',
    `L ${w - notch} 0`,
    `L ${w} ${h / 2}`,
    `L ${w - notch} ${h}`,
    `L 0 ${h}`,
    `L ${notch} ${h / 2}`,
    'Z',
  ].join(' ');
};
