// packages/import-pptx/src/geometries/index.ts
// Public registry mapping OOXML preset names to path generators. T-242a
// shipped 6; T-242b first-wave added 10 more (3 orthogonal arrows, 2
// basics, 3 brackets/braces, 2 misc shapes). T-242c batch 1 adds 9 (4
// arrows + 5 callouts), bringing the total to 25. The 14 already-mapped-
// to-structural-kinds presets from T-240 (rect, ellipse, line, polygon,
// star variants) are NOT in this registry — they continue to emit
// `'shape'` with structural kinds. T-242c batch 2 adds the remaining 8 to
// reach 33; T-242d ships the trailing 3 arc-bearing presets.

import {
  bentArrow,
  curvedRightArrow,
  downArrow,
  leftArrow,
  leftRightArrow,
  rightArrow,
  upArrow,
  upDownArrow,
} from './presets/arrows.js';
import { ribbon } from './presets/banners.js';
import { chevron, parallelogram, trapezoid } from './presets/basics.js';
import { leftBrace, leftBracket, rightBrace, rightBracket } from './presets/brackets.js';
import {
  borderCallout1,
  borderCallout2,
  cloudCallout,
  wedgeEllipseCallout,
  wedgeRectCallout,
  wedgeRoundRectCallout,
} from './presets/callouts.js';
import { cloud, heart, sun } from './presets/misc.js';
import type { AdjustmentMap, GeometryBox, PathGenerator } from './types.js';

/** Stable order keeps test snapshots deterministic + the eventual coverage list visible. */
export const PRESET_GENERATORS: Readonly<Record<string, PathGenerator>> = {
  // arrows
  rightArrow,
  leftArrow,
  upArrow,
  downArrow,
  leftRightArrow,
  upDownArrow,
  bentArrow,
  curvedRightArrow,
  // callouts
  wedgeRectCallout,
  wedgeRoundRectCallout,
  wedgeEllipseCallout,
  cloudCallout,
  borderCallout1,
  borderCallout2,
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
