// packages/import-pptx/src/geometries/presets/misc.ts
// Miscellaneous preset generators that don't fit a shape family. T-242a
// ships `cloud`; sun, moon, heart, lightningBolt, noSmoking land in T-242b.

import type { PathGenerator } from '../types.js';

/**
 * `cloud`: a fluffy cloud silhouette built from cubic-Bézier humps around
 * an oval-ish bounding box. The OOXML preset uses 8 arc segments with
 * specific tangent ratios; the simplified T-242a path stitches four cubic
 * humps along each edge. Visually faithful at common box sizes; T-242b can
 * tighten the curves if a fixture surfaces visible drift.
 */
export const cloud: PathGenerator = ({ w, h }) => {
  // Hump heights expressed as a fraction of the perpendicular dimension.
  const tipBulge = 0.18;
  // Top-edge sweeps: four cubic humps left → right.
  const topY = 0;
  const bottomY = h;
  const leftX = 0;
  const rightX = w;
  const yTopBulge = -h * tipBulge;
  const yBottomBulge = h + h * tipBulge;
  const xLeftBulge = -w * tipBulge;
  const xRightBulge = w + w * tipBulge;

  return [
    // Start at top-left.
    `M ${leftX} ${h * 0.5}`,
    // Up-and-right bulge to top-mid-left.
    `C ${xLeftBulge} ${h * 0.2} ${w * 0.15} ${yTopBulge} ${w * 0.35} ${topY}`,
    // Top-mid bulge.
    `C ${w * 0.45} ${yTopBulge} ${w * 0.65} ${yTopBulge} ${w * 0.7} ${topY}`,
    // Top-right bulge.
    `C ${w * 0.85} ${yTopBulge} ${xRightBulge} ${h * 0.2} ${rightX} ${h * 0.5}`,
    // Right-edge bulge to bottom-right.
    `C ${xRightBulge} ${h * 0.8} ${w * 0.85} ${yBottomBulge} ${w * 0.7} ${bottomY}`,
    // Bottom-mid.
    `C ${w * 0.6} ${yBottomBulge} ${w * 0.4} ${yBottomBulge} ${w * 0.3} ${bottomY}`,
    // Bottom-left.
    `C ${w * 0.15} ${yBottomBulge} ${xLeftBulge} ${h * 0.8} ${leftX} ${h * 0.5}`,
    'Z',
  ].join(' ');
};
