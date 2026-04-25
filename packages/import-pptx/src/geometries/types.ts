// packages/import-pptx/src/geometries/types.ts
// Types shared by every geometry generator. A generator is a pure function
// from box dimensions (+ optional adjustments) to an SVG `d` attribute
// string. Generators are deterministic; same inputs → identical output.

/** Bounding box the preset draws into. Width and height are in pixels. */
export interface GeometryBox {
  w: number;
  h: number;
}

/**
 * Adjustments parsed from `<a:avLst>`. Map keyed by the OOXML adjustment
 * name (e.g. `adj` for roundRect, `adj1`/`adj2` for callouts). Values are
 * raw integers from the `fmla="val N"` form. Generators that need a
 * different unit (percent of box, EMU) interpret per the OOXML spec.
 */
export type AdjustmentMap = Record<string, number>;

/** Signature every preset path generator implements. */
export type PathGenerator = (box: GeometryBox, adjustments?: AdjustmentMap) => string;
