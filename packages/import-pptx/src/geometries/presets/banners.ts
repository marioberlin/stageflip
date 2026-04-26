// packages/import-pptx/src/geometries/presets/banners.ts
// Banner / scroll preset generators. T-242a shipped `ribbon`. T-242c batch
// 2 adds the up-fold variant `ribbon2`, the two paper scrolls
// (`verticalScroll`, `horizontalScroll`), and the high-point stars
// (`star10`, `star12`).

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

// --- T-242c batch 2 scaffolding (impl in follow-up commit) -----------------

/** Placeholder. Implementation lands in the impl commit. */
const PLACEHOLDER: PathGenerator = () => 'M 0 0 Z';

/** `ribbon2`: up-fold mirror of `ribbon` (tabs at the top). */
export const ribbon2: PathGenerator = PLACEHOLDER;

/** `verticalScroll`: paper scroll body with rolled curls. */
export const verticalScroll: PathGenerator = PLACEHOLDER;

/** `horizontalScroll`: paper scroll body with rolled curls. */
export const horizontalScroll: PathGenerator = PLACEHOLDER;

/** `star10`: 10-pointed star. */
export const star10: PathGenerator = PLACEHOLDER;

/** `star12`: 12-pointed star. */
export const star12: PathGenerator = PLACEHOLDER;
