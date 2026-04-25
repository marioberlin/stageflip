// packages/import-pptx/src/geometries/presets/callouts.ts
// Callout-family preset generators. T-242a ships `wedgeRectCallout`
// (rectangular callout with a triangular tail); remaining callouts land in
// T-242b.

import type { PathGenerator } from '../types.js';

/**
 * `wedgeRectCallout`: a rectangle with a triangular tail. Default tail tip
 * sits at (-0.2 * w, 1.2 * h) — outside the box, pointing down-left — per
 * the OOXML spec's adj1/adj2 defaults (-20%, 62.5%). The tail base is on
 * the rectangle's bottom edge centered at 25% / 35% of width. The simpler
 * geometry T-242a ships uses default adj values; T-242b honors them.
 */
export const wedgeRectCallout: PathGenerator = ({ w, h }) => {
  // Tail tip: (-0.2w, 1.2h). Tail base on bottom edge: (0.25w, h) and (0.35w, h).
  const tipX = -0.2 * w;
  const tipY = 1.2 * h;
  const baseAX = 0.25 * w;
  const baseBX = 0.35 * w;
  return [
    'M 0 0',
    `L ${w} 0`,
    `L ${w} ${h}`,
    `L ${baseBX} ${h}`,
    `L ${tipX} ${tipY}`,
    `L ${baseAX} ${h}`,
    `L 0 ${h}`,
    'Z',
  ].join(' ');
};
