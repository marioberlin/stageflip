// packages/import-pptx/src/geometries/presets/arrows.ts
// Arrow-family preset path generators. T-242a ships `rightArrow` only;
// remaining arrows (left, up, down, leftRight, upDown, bent, curvedRight)
// land in T-242b.
//
// Path math derived from ECMA-376 §20.1.9 preset shape definitions.

import type { PathGenerator } from '../types.js';

/**
 * `rightArrow`: a horizontal arrow pointing right. Default head occupies
 * 50% of width and 100% of height; shaft is 50% of height. The OOXML preset
 * exposes adj1 (head/shaft width fraction) and adj2 (shaft height fraction)
 * but we use spec defaults for T-242a; honoring adjustments is T-242b's job.
 */
export const rightArrow: PathGenerator = ({ w, h }) => {
  const headW = w * 0.5;
  const shaftH = h * 0.5;
  const shaftTop = (h - shaftH) / 2;
  const shaftBottom = shaftTop + shaftH;
  const headStartX = w - headW;
  return [
    `M 0 ${shaftTop}`,
    `L ${headStartX} ${shaftTop}`,
    `L ${headStartX} 0`,
    `L ${w} ${h / 2}`,
    `L ${headStartX} ${h}`,
    `L ${headStartX} ${shaftBottom}`,
    `L 0 ${shaftBottom}`,
    'Z',
  ].join(' ');
};
