// packages/import-pptx/src/geometries/index.ts
// Public registry mapping OOXML preset names to path generators. T-242a
// shipped 6; T-242b first-wave adds 10 more (3 orthogonal arrows, 2 basics,
// 3 brackets/braces, 2 misc shapes). The 14 already-mapped-to-structural-
// kinds presets from T-240 (rect, ellipse, line, polygon, star variants)
// are NOT in this registry — they continue to emit `'shape'` with
// structural kinds. T-242c will add the remaining ~20 to reach the spec's
// 50-preset commitment.

import { downArrow, leftArrow, rightArrow, upArrow } from './presets/arrows.js';
import { ribbon } from './presets/banners.js';
import { chevron, parallelogram, trapezoid } from './presets/basics.js';
import { leftBrace, leftBracket, rightBrace, rightBracket } from './presets/brackets.js';
import { wedgeRectCallout } from './presets/callouts.js';
import { cloud, heart, sun } from './presets/misc.js';
import type { AdjustmentMap, GeometryBox, PathGenerator } from './types.js';

/** Stable order keeps test snapshots deterministic + the eventual coverage list visible. */
export const PRESET_GENERATORS: Readonly<Record<string, PathGenerator>> = {
  // arrows
  rightArrow,
  leftArrow,
  upArrow,
  downArrow,
  // callouts
  wedgeRectCallout,
  // banners
  ribbon,
  // basics
  parallelogram,
  trapezoid,
  chevron,
  // brackets / braces
  leftBracket,
  rightBracket,
  leftBrace,
  rightBrace,
  // misc
  cloud,
  sun,
  heart,
};

/**
 * Build an SVG `d` string for a preset, or `undefined` if the preset is not
 * yet covered. Caller (the shape parser) keeps emitting
 * `LF-PPTX-PRESET-GEOMETRY` + `unsupported-shape` for the `undefined` case
 * so T-245's rasterization fallback still picks them up.
 */
export function geometryFor(
  prst: string,
  box: GeometryBox,
  adjustments?: AdjustmentMap,
): string | undefined {
  const gen = PRESET_GENERATORS[prst];
  if (gen === undefined) return undefined;
  return gen(box, adjustments);
}

/**
 * Names every preset the geometry library covers. Used by the spec's AC #1
 * test pin to guarantee the registry doesn't quietly shrink.
 */
export const COVERED_PRESETS: readonly string[] = Object.keys(PRESET_GENERATORS);

/**
 * Per-preset metadata: which `<a:avLst>` adjustment names are honored
 * somewhere in the parser. Empty arrays mean the preset uses spec defaults.
 * Used by the shape parser to decide whether to emit
 * `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` when a fixture sets adjustments we
 * don't read.
 *
 * `roundRect` honoring lives in `elements/shape.ts` (it maps to a structural
 * `'rect'`, not a custom-path generator) — but the registry still lists
 * `roundRect: ['adj']` so the asymmetry is documented in one place.
 */
export const HONORED_ADJUSTMENTS: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(COVERED_PRESETS.map((name) => [name, [] as readonly string[]])),
  roundRect: ['adj'],
};

export { custGeomToSvgPath } from './cust-geom/parse.js';
export type { AdjustmentMap, GeometryBox, PathGenerator } from './types.js';
