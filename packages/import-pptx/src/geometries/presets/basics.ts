// packages/import-pptx/src/geometries/presets/basics.ts
// Basic-shape preset generators. T-242b first-wave adds `trapezoid` and
// `chevron`. T-242d adds the trailing arc-bearing trio (`chord`, `pie`,
// `donut`) — the SVG `A` command lets each one ship as a real arc rather
// than the cubic-Bezier ellipse approximation used by `noSmoking`.

import { fmt } from '../format.js';
import type { PathGenerator } from '../types.js';

/**
 * `parallelogram`: a slanted rectangle. Top edge is offset to the right by
 * `adj * width`; default adj = 25%. T-242 uses the default.
 */
export const parallelogram: PathGenerator = ({ w, h }) => {
  const slant = w * 0.25;
  return [`M ${slant} 0`, `L ${w} 0`, `L ${w - slant} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
};

/**
 * `trapezoid`: shorter top edge centered above a wider bottom. Default
 * adj = 25% inset on each side of the top edge.
 */
export const trapezoid: PathGenerator = ({ w, h }) => {
  const inset = w * 0.25;
  return [`M ${inset} 0`, `L ${w - inset} 0`, `L ${w} ${h}`, `L 0 ${h}`, 'Z'].join(' ');
};

/**
 * `chevron`: a right-pointing chevron (>-shaped block). Default adj = 50%
 * notch depth (the inner-left vertex sits at adj * width of the way from
 * the left edge).
 */
export const chevron: PathGenerator = ({ w, h }) => {
  const notch = w * 0.5;
  return [
    'M 0 0',
    `L ${w - notch} 0`,
    `L ${w} ${h / 2}`,
    `L ${w - notch} ${h}`,
    `L 0 ${h}`,
    `L ${notch} ${h / 2}`,
    'Z',
  ].join(' ');
};

// --- T-242d: arc-bearing presets -------------------------------------------
// All three honor `<a:avLst>`-derived adjustments via the registry's
// `adjustments` arg. ECMA-376 §20.1.9 unit conventions:
//   - angle adjustments: 60000ths of a degree (90° = 5400000, 270° = 16200000)
//   - percentage adjustments (donut.adj1): 1000ths of one (25% = 25000)
//
// Default adjustments below match ECMA-376 §20.1.9 reference geometry: a
// blank `<a:avLst>` (or no `adjustments` arg) yields the "open from the
// right" pie/chord wedge (start angle 0°, sweep 270°) and the 25%-thickness
// donut. Generators read by name (`adj1` / `adj2`) so partial overrides
// (just `adj1`, or just `adj2`) work as the parser hands them in.

const DEFAULT_PIE_ADJ1 = 0; // start angle, 60000ths of a degree
const DEFAULT_PIE_ADJ2 = 16200000; // sweep, 60000ths of a degree (= 270°)
const DEFAULT_DONUT_ADJ1 = 25000; // ring thickness, 1000ths of width (= 25%)

/** OOXML angle in 60000ths of a degree → radians. */
function angleToRad(ooxmlAngle: number): number {
  return (ooxmlAngle * Math.PI) / (180 * 60000);
}

/**
 * Helper: compute the SVG `A` arc tail
 * (`A rx ry 0 large-arc sweep endX endY`) for a centered-ellipse arc.
 *
 * `cx`, `cy` are the ellipse center; `rx`, `ry` are the radii; `stOoxml`
 * and `swOoxml` are start/sweep angles in OOXML units (60000ths of a
 * degree). Returns the start point plus the arc-tail string so callers
 * can assemble `M startX startY <arcTail>` or `M cx cy L startX startY <arcTail>`.
 */
function ellipseArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stOoxml: number,
  swOoxml: number,
): { startX: number; startY: number; arcTail: string } {
  const stRad = angleToRad(stOoxml);
  const swRad = angleToRad(swOoxml);
  const startX = cx + rx * Math.cos(stRad);
  const startY = cy + ry * Math.sin(stRad);
  const endX = cx + rx * Math.cos(stRad + swRad);
  const endY = cy + ry * Math.sin(stRad + swRad);
  const largeArc = Math.abs(swOoxml) > 180 * 60000 ? 1 : 0;
  const sweep = swOoxml >= 0 ? 1 : 0;
  const arcTail = `A ${fmt(rx)} ${fmt(ry)} 0 ${largeArc} ${sweep} ${fmt(endX)} ${fmt(endY)}`;
  return { startX, startY, arcTail };
}

/**
 * `pie`: a filled wedge — `M cx cy L startX startY A … Z`. Default
 * `<a:avLst>`: `adj1 = 0` (start angle 0°), `adj2 = 16200000` (sweep 270°,
 * "open right" wedge). Honors `adj1` (start angle) and `adj2` (sweep).
 * ECMA-376 §20.1.9.
 */
export const pie: PathGenerator = ({ w, h }, adjustments) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const stOoxml = adjustments?.adj1 ?? DEFAULT_PIE_ADJ1;
  const swOoxml = adjustments?.adj2 ?? DEFAULT_PIE_ADJ2;
  const { startX, startY, arcTail } = ellipseArc(cx, cy, rx, ry, stOoxml, swOoxml);
  return [`M ${fmt(cx)} ${fmt(cy)}`, `L ${fmt(startX)} ${fmt(startY)}`, arcTail, 'Z'].join(' ');
};

/**
 * `chord`: an arc closed by a straight line back to the start —
 * `M startX startY A … Z`. Same default adjustments as `pie`. The closing
 * line is the chord. ECMA-376 §20.1.9.
 */
export const chord: PathGenerator = ({ w, h }, adjustments) => {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const stOoxml = adjustments?.adj1 ?? DEFAULT_PIE_ADJ1;
  const swOoxml = adjustments?.adj2 ?? DEFAULT_PIE_ADJ2;
  const { startX, startY, arcTail } = ellipseArc(cx, cy, rx, ry, stOoxml, swOoxml);
  return [`M ${fmt(startX)} ${fmt(startY)}`, arcTail, 'Z'].join(' ');
};

/**
 * `donut`: a ring — outer ellipse (CW) plus inner ellipse cutout (CCW).
 * Two SVG `A`-built ellipses per subpath (semicircle pairs). The opposite
 * winding directions cancel under SVG's default `fill-rule="nonzero"` so
 * the hole renders transparent — no `fill-rule="evenodd"` override needed.
 *
 * Honors `adj1` (ring thickness in 1000ths of width; default 25000 = 25%).
 * ECMA-376 §20.1.9.
 */
export const donut: PathGenerator = ({ w, h }, adjustments) => {
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const adj1 = adjustments?.adj1 ?? DEFAULT_DONUT_ADJ1;
  const t = (w * adj1) / 100000;
  const rxIn = Math.max(0, rx - t);
  const ryIn = Math.max(0, ry - t);

  // Outer ring (CW, sweep=1). Two semicircles via SVG `A` from (w, cy) →
  // (0, cy) → (w, cy). large-arc=1, sweep=1.
  const outer = [
    `M ${fmt(w)} ${fmt(cy)}`,
    `A ${fmt(rx)} ${fmt(ry)} 0 1 1 0 ${fmt(cy)}`,
    `A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(w)} ${fmt(cy)}`,
    'Z',
  ].join(' ');
  // Inner cutout (CCW, sweep=0). Same topology with the reduced radii.
  const inner = [
    `M ${fmt(t)} ${fmt(cy)}`,
    `A ${fmt(rxIn)} ${fmt(ryIn)} 0 1 0 ${fmt(w - t)} ${fmt(cy)}`,
    `A ${fmt(rxIn)} ${fmt(ryIn)} 0 1 0 ${fmt(t)} ${fmt(cy)}`,
    'Z',
  ].join(' ');
  return `${outer} ${inner}`;
};
