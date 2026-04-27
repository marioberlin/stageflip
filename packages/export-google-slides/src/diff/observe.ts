// packages/export-google-slides/src/diff/observe.ts
// Convert connected-component diff regions into per-element observations for
// the convergence loop's `computeDiff` math (T-252 spec §3 + §6).
//
// Strategy: for each canonical element with expected bbox B, the observed
// bbox is the bounding box of the union of B + every diff region whose
// CENTER falls within B expanded by `expansionPx` pixels. The expansion
// captures regions adjacent to the element's bbox (e.g. the "left strip"
// and "right strip" diff produced by a horizontal element shift, where the
// strips are the ONLY diff signal and may sit just outside the element's
// expected footprint).
//
// If no diff region falls within the expanded bbox, the element is in
// tolerance and we emit `observed = element.transform`.
//
// This is the simple "where did the element actually land?" extractor the
// spec calls for. Production-grade text-bbox extraction (line-level glyph
// detection) is deferred per the spec's "Iterative refinement of stub
// fixtures" out-of-scope row.

import type { Element } from '@stageflip/schema';
import type { ObservedBbox } from '../convergence/diff.js';
import type { DiffRegion } from './connected-components.js';

/**
 * Default capture radius in px around the element's expected bbox. Diff
 * regions whose CENTER falls within this expansion contribute to the
 * observed bbox. Default 32 px ≈ a reasonable "nearby" tolerance for
 * 1600×900-class slide thumbnails.
 */
export const DEFAULT_EXPANSION_PX = 32;

export interface DeriveObservationsInput {
  /** Element id → canonical Element. The convergence loop's `elementsById`. */
  elementsById: Record<string, Element>;
  /** Connected-components from the API-vs-golden pixel diff. */
  regions: DiffRegion[];
  /** Px margin around the element bbox; default {@link DEFAULT_EXPANSION_PX}. */
  expansionPx?: number;
}

/**
 * For each element, return the observed bbox derived from the union of
 * (element bbox) and every diff region whose center falls within the
 * element's expanded bbox.
 */
export function deriveObservations(input: DeriveObservationsInput): ObservedBbox[] {
  const expansion = input.expansionPx ?? DEFAULT_EXPANSION_PX;
  const out: ObservedBbox[] = [];
  for (const [elementId, el] of Object.entries(input.elementsById)) {
    const expanded = {
      x: el.transform.x - expansion,
      y: el.transform.y - expansion,
      width: el.transform.width + 2 * expansion,
      height: el.transform.height + 2 * expansion,
    };
    let xMin = el.transform.x;
    let yMin = el.transform.y;
    let xMax = el.transform.x + el.transform.width;
    let yMax = el.transform.y + el.transform.height;
    let matched = false;
    for (const r of input.regions) {
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (
        cx < expanded.x ||
        cx > expanded.x + expanded.width ||
        cy < expanded.y ||
        cy > expanded.y + expanded.height
      ) {
        continue;
      }
      matched = true;
      if (r.x < xMin) xMin = r.x;
      if (r.y < yMin) yMin = r.y;
      if (r.x + r.width > xMax) xMax = r.x + r.width;
      if (r.y + r.height > yMax) yMax = r.y + r.height;
    }
    if (!matched) {
      // No drift detected — observed equals canonical (zero delta).
      out.push({
        elementId,
        x: el.transform.x,
        y: el.transform.y,
        width: el.transform.width,
        height: el.transform.height,
      });
      continue;
    }
    out.push({
      elementId,
      x: xMin,
      y: yMin,
      width: xMax - xMin,
      height: yMax - yMin,
    });
  }
  return out;
}
