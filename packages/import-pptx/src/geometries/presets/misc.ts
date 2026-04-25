// packages/import-pptx/src/geometries/presets/misc.ts
// Miscellaneous preset generators that don't fit a shape family. T-242a
// shipped `cloud`. T-242b first-wave adds `sun` and `heart`. The remaining
// miscellaneous presets (moon, lightningBolt, noSmoking) land in T-242c.

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
