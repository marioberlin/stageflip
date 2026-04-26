// packages/import-pptx/src/geometries/presets/misc.ts
// Miscellaneous preset generators that don't fit a shape family. T-242a
// shipped `cloud`. T-242b first-wave added `sun` and `heart`. T-242c
// batch 2 adds `moon`, `lightningBolt`, `noSmoking`.

import { fmt } from '../format.js';
import type { PathGenerator } from '../types.js';

/**
 * `cloud`: fluffy cloud silhouette built from cubic-Bézier humps around an
 * oval-ish bounding box. The OOXML preset uses 8 arc segments with specific
 * tangent ratios; the simplified path stitches cubic humps along each edge.
 * Acceptable for visual fidelity at common box sizes; T-242c can re-derive
 * from arcs once the `<a:arcTo>` parser lands.
 */
export const cloud: PathGenerator = ({ w, h }) => {
  const tipBulge = 0.18;
  const yTopBulge = -h * tipBulge;
  const yBottomBulge = h + h * tipBulge;
  const xLeftBulge = -w * tipBulge;
  const xRightBulge = w + w * tipBulge;
  return [
    `M 0 ${h * 0.5}`,
    `C ${xLeftBulge} ${h * 0.2} ${w * 0.15} ${yTopBulge} ${w * 0.35} 0`,
    `C ${w * 0.45} ${yTopBulge} ${w * 0.65} ${yTopBulge} ${w * 0.7} 0`,
    `C ${w * 0.85} ${yTopBulge} ${xRightBulge} ${h * 0.2} ${w} ${h * 0.5}`,
    `C ${xRightBulge} ${h * 0.8} ${w * 0.85} ${yBottomBulge} ${w * 0.7} ${h}`,
    `C ${w * 0.6} ${yBottomBulge} ${w * 0.4} ${yBottomBulge} ${w * 0.3} ${h}`,
    `C ${w * 0.15} ${yBottomBulge} ${xLeftBulge} ${h * 0.8} 0 ${h * 0.5}`,
    'Z',
  ].join(' ');
};

/**
 * `sun`: a circular center with 8 triangular rays. OOXML's preset places
 * 8 ray tips at the cardinal + diagonal compass points; ray base width
 * defaults to ~25% of the ray-base-circle circumference. Simplified to
 * a star-like path with 8 outer points (rays) and 8 inner points
 * (between rays). Body/rays are a single closed polygon — schema's
 * `'custom-path'` will fill it as one shape.
 */
export const sun: PathGenerator = ({ w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.5;
  // 16 alternating points (outer / inner) starting from the top.
  const segs: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    segs.push(`${i === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`);
  }
  segs.push('Z');
  return segs.join(' ');
};

/**
 * `heart`: a heart shape from two cubic Bézier arches meeting at a top
 * notch and converging at a bottom tip. Bounding box is the standard
 * preset frame.
 */
export const heart: PathGenerator = ({ w, h }) => {
  // Top notch sits at (w/2, h*0.25); arch peaks at (w*0.25, 0) and (w*0.75, 0).
  // Tip at (w/2, h).
  return [
    `M ${w / 2} ${h * 0.25}`,
    // Left arch: control points pull up-left, then down-left toward bottom tip.
    `C ${w * 0.5} ${h * 0.05} ${w * 0.1} ${h * 0.05} ${w * 0.1} ${h * 0.3}`,
    `C ${w * 0.1} ${h * 0.55} ${w / 2} ${h * 0.75} ${w / 2} ${h}`,
    // Right arch: mirror.
    `C ${w / 2} ${h * 0.75} ${w * 0.9} ${h * 0.55} ${w * 0.9} ${h * 0.3}`,
    `C ${w * 0.9} ${h * 0.05} ${w * 0.5} ${h * 0.05} ${w / 2} ${h * 0.25}`,
    'Z',
  ].join(' ');
};

// Cubic-Bezier control offset for circular arc approximation (kappa).
const KAPPA = 0.5522847498;

/**
 * `moon`: a crescent moon, opening to the right by default. Outer
 * boundary is the right half of an ellipse inscribed in the box;
 * inner boundary is a narrower (concave) arc cutting back from bottom
 * to top, producing the crescent. ECMA-376 §20.1.9 default `adj` ≈
 * 50000 (inner-curve horizontal radius = 50% of box width); the round
 * 50% approximation is used here. Both arcs use 2 cubic-Bezier
 * segments each (standard ellipse-from-Bezier construction).
 */
export const moon: PathGenerator = ({ w, h }) => {
  // Outer ellipse anchor: centred on the left edge, drawn as right half.
  const cy = h / 2;
  const rxOuter = w;
  const ryOuter = h / 2;
  const kxOuter = rxOuter * KAPPA;
  const kyOuter = ryOuter * KAPPA;
  // Inner ellipse: narrower (50% of outer width), same vertical span,
  // creating the crescent's concave inner edge.
  const rxInner = w * 0.5;
  const kxInner = rxInner * KAPPA;
  return [
    // Start at top-center of the bounding box.
    'M 0 0',
    // Outer arc top→right (quarter ellipse).
    `C ${fmt(kxOuter)} 0 ${fmt(rxOuter)} ${fmt(cy - kyOuter)} ${fmt(rxOuter)} ${fmt(cy)}`,
    // Outer arc right→bottom.
    `C ${fmt(rxOuter)} ${fmt(cy + kyOuter)} ${fmt(kxOuter)} ${h} 0 ${h}`,
    // Inner arc bottom→inner-right (concave cutback).
    `C ${fmt(kxInner)} ${h} ${fmt(rxInner)} ${fmt(cy + kyOuter)} ${fmt(rxInner)} ${fmt(cy)}`,
    // Inner arc inner-right→top.
    `C ${fmt(rxInner)} ${fmt(cy - kyOuter)} ${fmt(kxInner)} 0 0 0`,
    'Z',
  ].join(' ');
};

/**
 * `lightningBolt`: a stylized lightning bolt, a 12-vertex zigzag
 * roughly Z-shaped. ECMA-376 §20.1.9 fixes the bolt's vertex
 * coordinates (no `<a:gd>` adjustments); the round-percentage
 * approximations below preserve the bolt's iconic "two-flash" outline
 * while staying readable.
 */
export const lightningBolt: PathGenerator = ({ w, h }) => {
  // 12 vertices. Coordinates as fractions of (w, h) — derived from
  // ECMA-376 §20.1.9 lightningBolt path, rounded to two-decimal
  // percentages so the shape is recognisable at any box size.
  const v: ReadonlyArray<readonly [number, number]> = [
    [0.5, 0],
    [0.78, 0.4],
    [0.6, 0.4],
    [0.85, 0.7],
    [0.65, 0.7],
    [1, 1],
    [0.5, 0.6],
    [0.7, 0.6],
    [0.4, 0.3],
    [0.55, 0.3],
    [0.3, 0],
    [0.5, 0],
  ];
  const segs: string[] = [];
  for (let i = 0; i < v.length; i++) {
    const point = v[i];
    if (point === undefined) continue;
    const [fx, fy] = point;
    segs.push(`${i === 0 ? 'M' : 'L'} ${fmt(fx * w)} ${fmt(fy * h)}`);
  }
  segs.push('Z');
  return segs.join(' ');
};

/**
 * Build a closed-cubic-Bezier circle approximation, four segments each.
 * `dir` controls winding: `'cw'` clockwise (outer ring), `'ccw'`
 * counter-clockwise (inner cutout for even-odd fills).
 */
function bezierCircle(cx: number, cy: number, rx: number, ry: number, dir: 'cw' | 'ccw'): string {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  if (dir === 'cw') {
    return [
      `M ${fmt(cx)} ${fmt(cy - ry)}`,
      `C ${fmt(cx + kx)} ${fmt(cy - ry)} ${fmt(cx + rx)} ${fmt(cy - ky)} ${fmt(cx + rx)} ${fmt(cy)}`,
      `C ${fmt(cx + rx)} ${fmt(cy + ky)} ${fmt(cx + kx)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)}`,
      `C ${fmt(cx - kx)} ${fmt(cy + ry)} ${fmt(cx - rx)} ${fmt(cy + ky)} ${fmt(cx - rx)} ${fmt(cy)}`,
      `C ${fmt(cx - rx)} ${fmt(cy - ky)} ${fmt(cx - kx)} ${fmt(cy - ry)} ${fmt(cx)} ${fmt(cy - ry)}`,
      'Z',
    ].join(' ');
  }
  return [
    `M ${fmt(cx)} ${fmt(cy - ry)}`,
    `C ${fmt(cx - kx)} ${fmt(cy - ry)} ${fmt(cx - rx)} ${fmt(cy - ky)} ${fmt(cx - rx)} ${fmt(cy)}`,
    `C ${fmt(cx - rx)} ${fmt(cy + ky)} ${fmt(cx - kx)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)}`,
    `C ${fmt(cx + kx)} ${fmt(cy + ry)} ${fmt(cx + rx)} ${fmt(cy + ky)} ${fmt(cx + rx)} ${fmt(cy)}`,
    `C ${fmt(cx + rx)} ${fmt(cy - ky)} ${fmt(cx + kx)} ${fmt(cy - ry)} ${fmt(cx)} ${fmt(cy - ry)}`,
    'Z',
  ].join(' ');
}

/**
 * `noSmoking`: a prohibition sign — outer circular ring with a
 * diagonal bar. The OOXML ring has a stroke ratio defaulting to ~10%
 * of the radius (`adj` ≈ 10000); the bar sits at 30° from horizontal.
 * Approximated here as three subpaths under the SVG even-odd fill
 * convention: outer circle (CW), inner circle (CCW cutout), and a
 * thin rotated rectangle for the bar. T-242d may re-derive with real
 * arcs once `<a:arcTo>` lands.
 */
export const noSmoking: PathGenerator = ({ w, h }) => {
  const cx = w / 2;
  const cy = h / 2;
  const rOuter = Math.min(w, h) / 2;
  // Ring thickness ≈ 10% of outer radius (ECMA default `adj1`).
  const ringThickness = rOuter * 0.1;
  const rInner = rOuter - ringThickness;
  // Bar: spans the full diameter, 10% as thick as the diameter,
  // rotated 30° clockwise from horizontal.
  const barLen = rOuter * 2;
  const barThk = ringThickness;
  const angle = (30 * Math.PI) / 180;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  // Local rectangle corners centered at the origin: (±L/2, ±T/2).
  const local: ReadonlyArray<readonly [number, number]> = [
    [-barLen / 2, -barThk / 2],
    [barLen / 2, -barThk / 2],
    [barLen / 2, barThk / 2],
    [-barLen / 2, barThk / 2],
  ];
  const bar = local.map((p) => {
    const [lx, ly] = p;
    return [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca] as const;
  });
  const barAt = (i: number): readonly [number, number] => {
    const point = bar[i];
    if (point === undefined) throw new Error('noSmoking: bar vertex out of range');
    return point;
  };
  const [b0x, b0y] = barAt(0);
  const [b1x, b1y] = barAt(1);
  const [b2x, b2y] = barAt(2);
  const [b3x, b3y] = barAt(3);
  return [
    bezierCircle(cx, cy, rOuter, rOuter, 'cw'),
    bezierCircle(cx, cy, rInner, rInner, 'ccw'),
    `M ${fmt(b0x)} ${fmt(b0y)} L ${fmt(b1x)} ${fmt(b1y)} L ${fmt(b2x)} ${fmt(b2y)} L ${fmt(b3x)} ${fmt(b3y)} Z`,
  ].join(' ');
};
