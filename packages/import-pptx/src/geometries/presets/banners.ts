// packages/import-pptx/src/geometries/presets/banners.ts
// Banner / scroll preset generators. T-242a ships `ribbon` only (down-pointing
// ribbon with two folded ends); ribbon2, scrolls, and the high-point stars
// land in T-242b.

import type { PathGenerator } from '../types.js';

/**
 * `ribbon`: a horizontal banner with two trailing folded ends. Top half is
 * the main band; the bottom-left and bottom-right notches imply folded
 * tabs. Per OOXML defaults: tab height ~25% of total height, fold notch
 * inset 12.5%.
 */
export const ribbon: PathGenerator = ({ w, h }) => {
  const tabH = h * 0.25;
  const bandH = h - tabH;
  const insetX = w * 0.125;
  const tabInsetX = w * 0.05;
  const bandBottom = bandH;
  const tabBottom = h;
  return [
    `M ${insetX} 0`,
    `L ${w - insetX} 0`,
    `L ${w} ${bandBottom}`,
    `L ${w - tabInsetX} ${tabBottom}`,
    `L ${w - insetX} ${bandBottom}`,
    `L ${insetX} ${bandBottom}`,
    `L ${tabInsetX} ${tabBottom}`,
    `L 0 ${bandBottom}`,
    'Z',
  ].join(' ');
};
