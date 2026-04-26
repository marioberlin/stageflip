// packages/import-pptx/src/geometries/presets/callouts.ts
// Callout-family preset generators. T-242a shipped `wedgeRectCallout`
// (rectangular callout with a triangular tail). T-242c batch 1 adds
// `wedgeRoundRectCallout`, `wedgeEllipseCallout`, `cloudCallout`,
// `borderCallout1`, `borderCallout2`.

import { fmt } from '../format.js';
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

// Tail anchor defaults shared across the wedge callouts. Per ECMA-376
// §20.1.9 default `adj1`/`adj2` ≈ -20000 / 62500: tip outside the box at
// (-0.2 w, 1.2 h), tail base on the bottom edge centered at 25%/35% of
// width.
const TAIL_TIP_X_FRACTION = -0.2;
const TAIL_TIP_Y_FRACTION = 1.2;
const TAIL_BASE_A_FRACTION = 0.25;
const TAIL_BASE_B_FRACTION = 0.35;

// Cubic-Bezier control offset for circular arc approximation (kappa).
// Standard 4-point ellipse-from-Bezier construction.
const KAPPA = 0.5522847498;

/**
 * `wedgeRoundRectCallout`: rectangular callout body with rounded corners
 * and a triangular tail. Same tail defaults as `wedgeRectCallout`.
 * Corner radius defaults to 16.667% of the shorter dimension (ECMA-376
 * §20.1.9 `adj3` default ≈ 16667).
 */
export const wedgeRoundRectCallout: PathGenerator = ({ w, h }) => {
  const r = Math.min(w, h) * 0.16667;
  const k = r * KAPPA;
  const tipX = TAIL_TIP_X_FRACTION * w;
  const tipY = TAIL_TIP_Y_FRACTION * h;
  const baseAX = TAIL_BASE_A_FRACTION * w;
  const baseBX = TAIL_BASE_B_FRACTION * w;
  return [
    // Top edge.
    `M ${fmt(r)} 0`,
    `L ${fmt(w - r)} 0`,
    // Top-right corner.
    `C ${fmt(w - r + k)} 0 ${w} ${fmt(r - k)} ${w} ${fmt(r)}`,
    // Right edge.
    `L ${w} ${fmt(h - r)}`,
    // Bottom-right corner.
    `C ${w} ${fmt(h - r + k)} ${fmt(w - r + k)} ${h} ${fmt(w - r)} ${h}`,
    // Bottom edge with the tail notch (right of the tail).
    `L ${fmt(baseBX)} ${h}`,
    `L ${fmt(tipX)} ${fmt(tipY)}`,
    `L ${fmt(baseAX)} ${h}`,
    // Bottom edge (left of the tail).
    `L ${fmt(r)} ${h}`,
    // Bottom-left corner.
    `C ${fmt(r - k)} ${h} 0 ${fmt(h - r + k)} 0 ${fmt(h - r)}`,
    // Left edge.
    `L 0 ${fmt(r)}`,
    // Top-left corner.
    `C 0 ${fmt(r - k)} ${fmt(r - k)} 0 ${fmt(r)} 0`,
    'Z',
  ].join(' ');
};

/**
 * `wedgeEllipseCallout`: elliptical body with a triangular tail. The
 * ellipse boundary is approximated by 4 cubic-Bezier arcs (standard
 * ellipse-from-Bezier construction). Tail tip default at (-0.2 w,
 * 1.2 h); tail joins the ellipse on the lower-left arc.
 */
export const wedgeEllipseCallout: PathGenerator = ({ w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const tipX = TAIL_TIP_X_FRACTION * w;
  const tipY = TAIL_TIP_Y_FRACTION * h;
  // Tail base anchors on the ellipse boundary at the bottom-left
  // quadrant: rotate by ~210°/240° from center. Approximate with two
  // points along the bottom arc.
  const baseAAngle = Math.PI * 0.85; // upper of the two anchor points
  const baseBAngle = Math.PI * 1.0;
  const baseAX = cx + rx * Math.cos(baseAAngle);
  const baseAY = cy + ry * Math.sin(baseAAngle);
  const baseBX = cx + rx * Math.cos(baseBAngle);
  const baseBY = cy + ry * Math.sin(baseBAngle);
  return [
    // Top of ellipse → right.
    `M ${fmt(cx)} 0`,
    `C ${fmt(cx + kx)} 0 ${w} ${fmt(cy - ky)} ${w} ${fmt(cy)}`,
    // Right → bottom.
    `C ${w} ${fmt(cy + ky)} ${fmt(cx + kx)} ${h} ${fmt(cx)} ${h}`,
    // Bottom → left (down to tail base anchor B).
    `C ${fmt(cx - kx)} ${h} ${fmt(baseBX)} ${fmt(baseBY)} ${fmt(baseBX)} ${fmt(baseBY)}`,
    // Tail: out to the tip and back.
    `L ${fmt(tipX)} ${fmt(tipY)}`,
    `L ${fmt(baseAX)} ${fmt(baseAY)}`,
    // Left → top.
    `C 0 ${fmt(cy - ky)} ${fmt(cx - kx)} 0 ${fmt(cx)} 0`,
    'Z',
  ].join(' ');
};

/**
 * `cloudCallout`: a cloud-shaped body (8 cubic-Bezier humps) plus a
 * tail emerging from the lower-left. Body curve pattern is borrowed
 * verbatim from the `cloud` preset; per the T-242c spec carry-forward
 * #2, both will be re-derived from arcs after T-242d lands. Tail uses
 * the same default anchor pattern as the wedge callouts.
 */
export const cloudCallout: PathGenerator = ({ w, h }) => {
  const tipBulge = 0.18;
  const yTopBulge = -h * tipBulge;
  const yBottomBulge = h + h * tipBulge;
  const xLeftBulge = -w * tipBulge;
  const xRightBulge = w + w * tipBulge;
  const tipX = TAIL_TIP_X_FRACTION * w;
  const tipY = TAIL_TIP_Y_FRACTION * h;
  const baseAX = TAIL_BASE_A_FRACTION * w;
  const baseBX = TAIL_BASE_B_FRACTION * w;
  return [
    `M 0 ${fmt(h * 0.5)}`,
    `C ${fmt(xLeftBulge)} ${fmt(h * 0.2)} ${fmt(w * 0.15)} ${fmt(yTopBulge)} ${fmt(w * 0.35)} 0`,
    `C ${fmt(w * 0.45)} ${fmt(yTopBulge)} ${fmt(w * 0.65)} ${fmt(yTopBulge)} ${fmt(w * 0.7)} 0`,
    `C ${fmt(w * 0.85)} ${fmt(yTopBulge)} ${fmt(xRightBulge)} ${fmt(h * 0.2)} ${w} ${fmt(h * 0.5)}`,
    `C ${fmt(xRightBulge)} ${fmt(h * 0.8)} ${fmt(w * 0.85)} ${fmt(yBottomBulge)} ${fmt(w * 0.7)} ${h}`,
    `C ${fmt(w * 0.6)} ${fmt(yBottomBulge)} ${fmt(w * 0.4)} ${fmt(yBottomBulge)} ${fmt(baseBX)} ${h}`,
    // Tail tip and back to the second base anchor.
    `L ${fmt(tipX)} ${fmt(tipY)}`,
    `L ${fmt(baseAX)} ${h}`,
    `C ${fmt(w * 0.15)} ${fmt(yBottomBulge)} ${fmt(xLeftBulge)} ${fmt(h * 0.8)} 0 ${fmt(h * 0.5)}`,
    'Z',
  ].join(' ');
};

/**
 * `borderCallout1`: a rectangular callout body plus a single straight
 * leader line emerging from one corner. ECMA-376 §20.1.9 defaults: the
 * leader runs from the top-left corner of the body to (-0.2 w, 1.2 h)
 * — outside the box, lower-left — as a single line segment. Leader is
 * a separate subpath (own `M`) so renderers stroke but don't fill it.
 */
export const borderCallout1: PathGenerator = ({ w, h }) => {
  const tipX = TAIL_TIP_X_FRACTION * w;
  const tipY = TAIL_TIP_Y_FRACTION * h;
  return [
    // Rectangle body.
    'M 0 0',
    `L ${w} 0`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    'Z',
    // Leader subpath: top-left corner of the body → tip outside box.
    'M 0 0',
    `L ${fmt(tipX)} ${fmt(tipY)}`,
  ].join(' ');
};

/**
 * `borderCallout2`: a rectangular callout body plus a two-segment bent
 * leader line. ECMA-376 §20.1.9 defaults: the leader exits the body at
 * the top-left corner, runs to a knee at (-0.1 w, 1.1 h), then to the
 * tip at (-0.2 w, 1.2 h). Leader is a separate subpath (`M` + 2 `L`s).
 */
export const borderCallout2: PathGenerator = ({ w, h }) => {
  const tipX = TAIL_TIP_X_FRACTION * w;
  const tipY = TAIL_TIP_Y_FRACTION * h;
  const kneeX = -0.1 * w;
  const kneeY = 1.1 * h;
  return [
    // Rectangle body.
    'M 0 0',
    `L ${w} 0`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    'Z',
    // Bent leader subpath.
    'M 0 0',
    `L ${fmt(kneeX)} ${fmt(kneeY)}`,
    `L ${fmt(tipX)} ${fmt(tipY)}`,
  ].join(' ');
};
