// packages/import-pptx/src/geometries/presets/arrows.ts
// Arrow-family preset path generators. Path math derived from ECMA-376
// §20.1.9 preset shape definitions. T-242a shipped `rightArrow`; T-242b
// first-wave added the three orthogonal directions (left, up, down). T-242c
// batch 1 adds `leftRightArrow`, `upDownArrow`, `bentArrow`,
// `curvedRightArrow`.

import type { PathGenerator } from '../types.js';

/** Common geometry: shaft height = 50% of perpendicular dimension; head = 50% of long dimension. */
const HEAD_FRACTION = 0.5;
const SHAFT_FRACTION = 0.5;

/**
 * `rightArrow`: arrow pointing right. Default OOXML adj1 (head/shaft width)
 * and adj2 (shaft height) result in a 50% / 50% split. T-242b uses defaults;
 * T-242c follow-up may honor adj* values.
 */
export const rightArrow: PathGenerator = ({ w, h }) => {
  const headW = w * HEAD_FRACTION;
  const shaftH = h * SHAFT_FRACTION;
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

/** `leftArrow`: arrow pointing left. Mirror of rightArrow across the vertical axis. */
export const leftArrow: PathGenerator = ({ w, h }) => {
  const headW = w * HEAD_FRACTION;
  const shaftH = h * SHAFT_FRACTION;
  const shaftTop = (h - shaftH) / 2;
  const shaftBottom = shaftTop + shaftH;
  const headEndX = headW;
  return [
    `M ${w} ${shaftTop}`,
    `L ${headEndX} ${shaftTop}`,
    `L ${headEndX} 0`,
    `L 0 ${h / 2}`,
    `L ${headEndX} ${h}`,
    `L ${headEndX} ${shaftBottom}`,
    `L ${w} ${shaftBottom}`,
    'Z',
  ].join(' ');
};

/** `upArrow`: arrow pointing up. */
export const upArrow: PathGenerator = ({ w, h }) => {
  const headH = h * HEAD_FRACTION;
  const shaftW = w * SHAFT_FRACTION;
  const shaftLeft = (w - shaftW) / 2;
  const shaftRight = shaftLeft + shaftW;
  const headBottomY = headH;
  return [
    `M ${shaftLeft} ${h}`,
    `L ${shaftLeft} ${headBottomY}`,
    `L 0 ${headBottomY}`,
    `L ${w / 2} 0`,
    `L ${w} ${headBottomY}`,
    `L ${shaftRight} ${headBottomY}`,
    `L ${shaftRight} ${h}`,
    'Z',
  ].join(' ');
};

/** `downArrow`: arrow pointing down. Mirror of upArrow. */
export const downArrow: PathGenerator = ({ w, h }) => {
  const headH = h * HEAD_FRACTION;
  const shaftW = w * SHAFT_FRACTION;
  const shaftLeft = (w - shaftW) / 2;
  const shaftRight = shaftLeft + shaftW;
  const headTopY = h - headH;
  return [
    `M ${shaftLeft} 0`,
    `L ${shaftLeft} ${headTopY}`,
    `L 0 ${headTopY}`,
    `L ${w / 2} ${h}`,
    `L ${w} ${headTopY}`,
    `L ${shaftRight} ${headTopY}`,
    `L ${shaftRight} 0`,
    'Z',
  ].join(' ');
};

/** STUB — T-242c batch 1 commit 1 (tests-first). Real geometry lands in commit 2. */
export const leftRightArrow: PathGenerator = () => '';

/** STUB — T-242c batch 1 commit 1 (tests-first). Real geometry lands in commit 2. */
export const upDownArrow: PathGenerator = () => '';

/** STUB — T-242c batch 1 commit 1 (tests-first). Real geometry lands in commit 2. */
export const bentArrow: PathGenerator = () => '';

/** STUB — T-242c batch 1 commit 1 (tests-first). Real geometry lands in commit 2. */
export const curvedRightArrow: PathGenerator = () => '';
