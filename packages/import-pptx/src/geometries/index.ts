// packages/import-pptx/src/geometries/index.ts
// Public registry mapping OOXML preset names to path generators. T-242a
// ships 6 representative presets across all six families; T-242b adds the
// remaining 30. The 14 already-mapped-to-structural-kinds presets from
// T-240 (rect, ellipse, line, polygon, star variants) are NOT in this
// registry — they continue to emit `'shape'` with structural kinds.

import { rightArrow } from './presets/arrows.js';
import { ribbon } from './presets/banners.js';
import { parallelogram } from './presets/basics.js';
import { leftBracket } from './presets/brackets.js';
import { wedgeRectCallout } from './presets/callouts.js';
import { cloud } from './presets/misc.js';
import type { AdjustmentMap, GeometryBox, PathGenerator } from './types.js';

/** Stable order keeps test snapshots deterministic + the eventual coverage list visible. */
export const PRESET_GENERATORS: Readonly<Record<string, PathGenerator>> = {
  rightArrow,
  wedgeRectCallout,
  ribbon,
  parallelogram,
  leftBracket,
  cloud,
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
 * Names every preset T-242a's geometry library covers. Used by the spec's
 * AC #1 test pin to guarantee the registry doesn't quietly shrink.
 */
export const COVERED_PRESETS: readonly string[] = Object.keys(PRESET_GENERATORS);

export { custGeomToSvgPath } from './cust-geom/parse.js';
export type { AdjustmentMap, GeometryBox, PathGenerator } from './types.js';
