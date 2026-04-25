// packages/import-pptx/src/geometries/presets/brackets.ts
// Bracket and brace preset generators. T-242b first-wave adds rightBracket,
// leftBrace, rightBrace; T-242c may add roundedBracket variants.
//
// All bracket / brace presets are stroked-only paths in OOXML; they don't
// close. Schema's `'custom-path'` accepts open paths just fine.

import type { PathGenerator } from '../types.js';

/**
 * `leftBracket`: a square-bracket left edge `⌜...⌞`. Two stub horizontal
 * caps plus the vertical stem. Default sharp corners (T-242 ignores the
 * `adj` corner radius).
 */
export const leftBracket: PathGenerator = ({ w, h }) => {
  return [`M ${w} 0`, 'L 0 0', `L 0 ${h}`, `L ${w} ${h}`].join(' ');
};

/** `rightBracket`: mirror of `leftBracket` across the vertical axis. */
export const rightBracket: PathGenerator = ({ w, h }) => {
  return ['M 0 0', `L ${w} 0`, `L ${w} ${h}`, `L 0 ${h}`].join(' ');
};

/**
 * `leftBrace`: a curly brace `{` built from straight-line segments and
 * cubic Bézier curves. Mid-point pinches inward at `adj * w`; T-242 uses
 * the OOXML default of ~50% width.
 */
export const leftBrace: PathGenerator = ({ w, h }) => {
  const midY = h / 2;
  // Top half curls right→left into the mid pinch; bottom half is a mirror.
  return [
    `M ${w} 0`,
    // Top-right cap into a quarter curve toward the right side.
    `C ${w * 0.5} 0 ${w * 0.5} ${h * 0.25} ${w * 0.5} ${midY}`,
    // Mid pinch: a small flat at x = 0.
    `L 0 ${midY}`,
    `L ${w * 0.5} ${midY}`,
    // Bottom half mirrors the top.
    `C ${w * 0.5} ${h * 0.75} ${w * 0.5} ${h} ${w} ${h}`,
  ].join(' ');
};

/** `rightBrace`: mirror of `leftBrace` across the vertical axis. */
export const rightBrace: PathGenerator = ({ w, h }) => {
  const midY = h / 2;
  return [
    'M 0 0',
    `C ${w * 0.5} 0 ${w * 0.5} ${h * 0.25} ${w * 0.5} ${midY}`,
    `L ${w} ${midY}`,
    `L ${w * 0.5} ${midY}`,
    `C ${w * 0.5} ${h * 0.75} ${w * 0.5} ${h} 0 ${h}`,
  ].join(' ');
};
