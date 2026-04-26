// packages/import-pptx/src/geometries/presets/banners.ts
// Banner / scroll preset generators. T-242a shipped `ribbon`. T-242c batch
// 2 adds the up-fold variant `ribbon2`, the two paper scrolls
// (`verticalScroll`, `horizontalScroll`), and the high-point stars
// (`star10`, `star12`).

import { fmt } from '../format.js';
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

/**
 * `ribbon2`: an up-fold ribbon — tabs hang above the band rather than
 * below it. Topology is identical to `ribbon` mirrored across the
 * horizontal axis: tab height ~25% of total height (default `adj1`), tab
 * fold inset 12.5% (default `adj2`).
 */
export const ribbon2: PathGenerator = ({ w, h }) => {
  const tabH = h * 0.25;
  const bandTop = tabH;
  const insetX = w * 0.125;
  const tabInsetX = w * 0.05;
  return [
    `M 0 ${fmt(bandTop)}`,
    `L ${fmt(tabInsetX)} 0`,
    `L ${fmt(insetX)} ${fmt(bandTop)}`,
    `L ${fmt(w - insetX)} ${fmt(bandTop)}`,
    `L ${fmt(w - tabInsetX)} 0`,
    `L ${w} ${fmt(bandTop)}`,
    `L ${fmt(w - insetX)} ${h}`,
    `L ${fmt(insetX)} ${h}`,
    'Z',
  ].join(' ');
};

// Cubic-Bezier control offset for circular arc approximation (kappa).
// Standard 4-point ellipse-from-Bezier construction.
const KAPPA = 0.5522847498;

/**
 * `verticalScroll`: a tall paper scroll. Body is a panel with two
 * scroll curls — top-left and bottom-right — each rendered as a
 * full half-circle "roll" protruding from the body. Each half-circle
 * is built from 2 cubic-Bezier quarters (4 cubic segments total).
 * ECMA-376 §20.1.9 default `adj1` ≈ 12500 (curl radius = 12.5% of the
 * shorter dimension).
 */
export const verticalScroll: PathGenerator = ({ w, h }) => {
  const r = Math.min(w, h) * 0.125;
  const k = r * KAPPA;
  // Body inner rect: inset r on the left for the top-left curl, inset r
  // on the right for the bottom-right curl. The two curls protrude as
  // half-circles past the inner-rect corners.
  return [
    // Start on the top edge to the right of the top-left curl shoulder.
    `M ${fmt(r)} 0`,
    // Top edge → top-right corner (square).
    `L ${w} 0`,
    // Right edge down to the bottom-right curl start.
    `L ${w} ${fmt(h - 2 * r)}`,
    // Bottom-right curl: half-circle bulging down-and-right past the
    // box's bottom-right region. Two cubic Bézier quarters.
    `C ${fmt(w + k)} ${fmt(h - 2 * r)} ${fmt(w + r)} ${fmt(h - 2 * r + r - k)} ${fmt(w + r)} ${fmt(h - r)}`,
    `C ${fmt(w + r)} ${fmt(h - r + k)} ${fmt(w + k)} ${h} ${w} ${h}`,
    // Bottom edge → bottom-left corner (square).
    `L 0 ${h}`,
    // Left edge up to the top-left curl start.
    `L 0 ${fmt(2 * r)}`,
    // Top-left curl: half-circle bulging up-and-left past the box.
    `C ${fmt(-k)} ${fmt(2 * r)} ${fmt(-r)} ${fmt(2 * r - r + k)} ${fmt(-r)} ${fmt(r)}`,
    `C ${fmt(-r)} ${fmt(r - k)} ${fmt(-k)} 0 0 0`,
    'Z',
  ].join(' ');
};

/**
 * `horizontalScroll`: a wide paper scroll. Mirror topology of
 * `verticalScroll` with the curls oriented along the horizontal axis:
 * top-left curl bulges up-and-left, bottom-right curl bulges
 * down-and-right. Defaults follow the same `adj1` ≈ 12.5% of the
 * shorter dimension as `verticalScroll`. 4 cubic-Bezier segments total.
 */
export const horizontalScroll: PathGenerator = ({ w, h }) => {
  const r = Math.min(w, h) * 0.125;
  const k = r * KAPPA;
  return [
    // Start on the left edge below the top-left curl.
    `M 0 ${fmt(2 * r)}`,
    // Top-left curl: half-circle bulging up past the box top.
    `C 0 ${fmt(2 * r - k)} ${fmt(r - k)} ${fmt(r)} ${fmt(r)} ${fmt(r)}`,
    `C ${fmt(r + k)} ${fmt(r)} ${fmt(2 * r)} ${fmt(r - k)} ${fmt(2 * r)} 0`,
    // Top edge → top-right corner (square).
    `L ${w} 0`,
    // Right edge down to the bottom-right curl start.
    `L ${w} ${fmt(h - 2 * r)}`,
    // Bottom-right curl: half-circle bulging down past the box bottom.
    `C ${w} ${fmt(h - 2 * r + k)} ${fmt(w - r + k)} ${fmt(h - r)} ${fmt(w - r)} ${fmt(h - r)}`,
    `C ${fmt(w - r - k)} ${fmt(h - r)} ${fmt(w - 2 * r)} ${fmt(h - r + k)} ${fmt(w - 2 * r)} ${h}`,
    // Bottom edge → bottom-left corner (square).
    `L 0 ${h}`,
    'Z',
  ].join(' ');
};

/**
 * Build an n-pointed star path with alternating outer / inner radii.
 * Per ECMA-376 §20.1.9 default `adj` (≈ 38197 in 100000ths), inner
 * radius ≈ 38.197% of outer radius — the round-numbered approximation
 * lands at 0.38, which keeps points visually crisp without breaking
 * adjacency.
 */
function regularStar(w: number, h: number, points: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.38;
  const segs: string[] = [];
  // 2 * points vertices, alternating outer / inner, starting at the top
  // (angle = -90°).
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    segs.push(`${i === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)}`);
  }
  segs.push('Z');
  return segs.join(' ');
}

/** `star10`: 10-pointed star. */
export const star10: PathGenerator = ({ w, h }) => regularStar(w, h, 10);

/** `star12`: 12-pointed star. */
export const star12: PathGenerator = ({ w, h }) => regularStar(w, h, 12);
