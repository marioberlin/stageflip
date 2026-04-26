// packages/import-pptx/src/geometries/presets/arrows.ts
// Arrow-family preset path generators. Path math derived from ECMA-376
// §20.1.9 preset shape definitions. T-242a shipped `rightArrow`; T-242b
// first-wave added the three orthogonal directions (left, up, down). T-242c
// batch 1 adds `leftRightArrow`, `upDownArrow`, `bentArrow`,
// `curvedRightArrow`.

import { fmt } from '../format.js';
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

/**
 * `leftRightArrow`: a horizontal double-headed arrow. Two arrowheads
 * (one at each end of the box) joined by a central shaft. ECMA-376
 * §20.1.9 defaults: each head spans ≈ 25% of width (`adj1`), shaft
 * height = 50% of box height (`adj2`).
 */
export const leftRightArrow: PathGenerator = ({ w, h }) => {
  const headW = w * 0.25;
  const shaftH = h * SHAFT_FRACTION;
  const shaftTop = (h - shaftH) / 2;
  const shaftBottom = shaftTop + shaftH;
  const leftHeadEndX = headW;
  const rightHeadStartX = w - headW;
  return [
    `M 0 ${fmt(h / 2)}`,
    `L ${fmt(leftHeadEndX)} 0`,
    `L ${fmt(leftHeadEndX)} ${fmt(shaftTop)}`,
    `L ${fmt(rightHeadStartX)} ${fmt(shaftTop)}`,
    `L ${fmt(rightHeadStartX)} 0`,
    `L ${w} ${fmt(h / 2)}`,
    `L ${fmt(rightHeadStartX)} ${h}`,
    `L ${fmt(rightHeadStartX)} ${fmt(shaftBottom)}`,
    `L ${fmt(leftHeadEndX)} ${fmt(shaftBottom)}`,
    `L ${fmt(leftHeadEndX)} ${h}`,
    'Z',
  ].join(' ');
};

/**
 * `upDownArrow`: a vertical double-headed arrow. Mirror of
 * `leftRightArrow` across the diagonal: heads span ≈ 25% of height each,
 * shaft width = 50% of box width.
 */
export const upDownArrow: PathGenerator = ({ w, h }) => {
  const headH = h * 0.25;
  const shaftW = w * SHAFT_FRACTION;
  const shaftLeft = (w - shaftW) / 2;
  const shaftRight = shaftLeft + shaftW;
  const topHeadEndY = headH;
  const bottomHeadStartY = h - headH;
  return [
    `M ${fmt(w / 2)} 0`,
    `L ${w} ${fmt(topHeadEndY)}`,
    `L ${fmt(shaftRight)} ${fmt(topHeadEndY)}`,
    `L ${fmt(shaftRight)} ${fmt(bottomHeadStartY)}`,
    `L ${w} ${fmt(bottomHeadStartY)}`,
    `L ${fmt(w / 2)} ${h}`,
    `L 0 ${fmt(bottomHeadStartY)}`,
    `L ${fmt(shaftLeft)} ${fmt(bottomHeadStartY)}`,
    `L ${fmt(shaftLeft)} ${fmt(topHeadEndY)}`,
    `L 0 ${fmt(topHeadEndY)}`,
    'Z',
  ].join(' ');
};

/**
 * `bentArrow`: an L-shaped arrow that starts on the bottom edge, runs
 * upward along the left side, then bends right and terminates in an
 * arrowhead pointing right at mid-height. ECMA-376 §20.1.9 default
 * `adj1`/`adj2`/`adj3` ≈ 25000 (25% of the shorter dimension); `adj4`
 * controls the head width. Approximated here as: shaft thickness 25% of
 * the shorter dimension, head spans 25% of width, head height 50% of
 * the box.
 */
export const bentArrow: PathGenerator = ({ w, h }) => {
  const shaft = Math.min(w, h) * 0.25;
  const headW = w * 0.25;
  const headH = h * 0.5;
  const headTipX = w;
  const headTipY = h * 0.5;
  const headBaseX = w - headW;
  const headTopY = headTipY - headH / 2;
  const headBottomY = headTipY + headH / 2;
  const innerTopY = headTipY - shaft / 2;
  const innerBottomY = headTipY + shaft / 2;
  const innerLeftX = shaft;
  return [
    `M 0 ${h}`,
    `L 0 ${fmt(innerTopY)}`,
    `L ${fmt(headBaseX)} ${fmt(innerTopY)}`,
    `L ${fmt(headBaseX)} ${fmt(headTopY)}`,
    `L ${fmt(headTipX)} ${fmt(headTipY)}`,
    `L ${fmt(headBaseX)} ${fmt(headBottomY)}`,
    `L ${fmt(headBaseX)} ${fmt(innerBottomY)}`,
    `L ${fmt(innerLeftX)} ${fmt(innerBottomY)}`,
    `L ${fmt(innerLeftX)} ${h}`,
    'Z',
  ].join(' ');
};

/**
 * `curvedRightArrow`: a smoothly curving rightward arrow. The OOXML
 * preset uses `<a:arcTo>` segments for the body curves; T-242c batch 1
 * approximates with cubic Béziers (parser support for `<a:arcTo>` is
 * deferred to T-242d). The body sweeps from bottom-left up to a
 * rightward-pointing arrowhead at the right edge; visual fidelity is
 * acceptable at typical box sizes. Will be re-derived with real arcs
 * alongside `cloud` after T-242d lands.
 */
export const curvedRightArrow: PathGenerator = ({ w, h }) => {
  const shaft = h * 0.25;
  const headW = w * 0.2;
  const headH = h * 0.4;
  const headTipX = w;
  const headTipY = h * 0.5;
  const headBaseX = w - headW;
  const headTopY = headTipY - headH / 2;
  const headBottomY = headTipY + headH / 2;
  const innerBottomY = headTipY + shaft / 2;
  return [
    `M 0 ${h}`,
    // Outer curve: (0, h) → top-base of the head.
    `C ${fmt(w * 0.3)} ${h} ${fmt(w * 0.6)} ${fmt(h * 0.5)} ${fmt(headBaseX)} ${fmt(headTopY)}`,
    // Arrowhead: top-base → tip → bottom-base.
    `L ${fmt(headTipX)} ${fmt(headTipY)}`,
    `L ${fmt(headBaseX)} ${fmt(headBottomY)}`,
    `L ${fmt(headBaseX)} ${fmt(innerBottomY)}`,
    // Inner curve: head's inner-bottom → (0, h - shaft).
    `C ${fmt(w * 0.5)} ${fmt(h * 0.55)} ${fmt(w * 0.25)} ${fmt(h * 0.85)} 0 ${fmt(h - shaft)}`,
    'Z',
  ].join(' ');
};
