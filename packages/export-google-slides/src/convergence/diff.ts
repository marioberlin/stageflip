// packages/export-google-slides/src/convergence/diff.ts
// Per-element + whole-slide diff. T-252 spec §3 + §6. The convergence loop
// calls this after each batchUpdate apply; below-tolerance elements are
// nudged via `adjust.ts` for the next iteration; residuals at loop exit
// fall into image-fallback.
//
// The diff is intentionally simple: each canonical element carries a
// pre-computed bbox in the same px space the rendered API thumbnail returns;
// the renderer-cdp golden for the slide is also at those pixel dimensions.
// We compare per-element bboxes using the element's `transform.{x,y,w,h}`
// against an "observed bbox" the orchestrator threads through (in tests,
// the observed bbox comes from the canned API state — production wiring
// runs a connected-components pass on the Slides PNG).

import type { Element } from '@stageflip/schema';
import type { ConvergenceTolerances } from '../types.js';

export interface ElementDiff {
  elementId: string;
  kind: 'text' | 'image' | 'shape' | 'table' | 'group' | 'other';
  /** Difference in position (px) — absolute max of x/y delta. */
  positionDeltaPx: number;
  /** Difference in size (px) — absolute max of width/height delta. */
  sizeDeltaPx: number;
  /** True when this element falls within its tolerance band. */
  inTolerance: boolean;
}

export interface SlideDiff {
  perElement: ElementDiff[];
  /** Whole-slide pixel-area difference normalized to [0,1]. */
  perceptualDiff: number;
  /** True when EVERY element is in tolerance OR perceptual diff is below threshold. */
  allElementsInTolerance: boolean;
}

/** Per-element observed bbox, in the same px space as the canonical's transform. */
export interface ObservedBbox {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputeDiffInput {
  elementsById: Record<string, Element>;
  observed: ObservedBbox[];
  /**
   * Whole-slide perceptual diff (precomputed by the orchestrator from the
   * goldenPng vs apiPng pair). Tests inject canned values; production
   * wires through a pixel-by-pixel diff utility. Range [0,1].
   */
  perceptualDiff: number;
  tolerances: ConvergenceTolerances;
}

/** Compute the per-element + whole-slide diff for one iteration. */
export function computeDiff(input: ComputeDiffInput): SlideDiff {
  const perElement: ElementDiff[] = [];
  for (const obs of input.observed) {
    const el = input.elementsById[obs.elementId];
    if (el === undefined) continue;
    const dx = Math.abs(obs.x - el.transform.x);
    const dy = Math.abs(obs.y - el.transform.y);
    const dw = Math.abs(obs.width - el.transform.width);
    const dh = Math.abs(obs.height - el.transform.height);
    const positionDeltaPx = Math.max(dx, dy);
    const sizeDeltaPx = Math.max(dw, dh);
    const kind = mapKind(el);
    const inTolerance = withinTolerance(kind, positionDeltaPx, sizeDeltaPx, input.tolerances);
    perElement.push({ elementId: obs.elementId, kind, positionDeltaPx, sizeDeltaPx, inTolerance });
  }
  // Whole-slide gating: AC #17 — perceptual diff below threshold is
  // in-tolerance even if individual elements drift slightly.
  const perceptualGate = input.perceptualDiff < input.tolerances.perceptualDiffThreshold;
  const allInTol = perElement.every((e) => e.inTolerance);
  return {
    perElement,
    perceptualDiff: input.perceptualDiff,
    allElementsInTolerance: allInTol || perceptualGate,
  };
}

function mapKind(el: Element): ElementDiff['kind'] {
  switch (el.type) {
    case 'text':
      return 'text';
    case 'image':
      return 'image';
    case 'shape':
      return 'shape';
    case 'table':
      return 'table';
    case 'group':
      return 'group';
    default:
      return 'other';
  }
}

function withinTolerance(
  kind: ElementDiff['kind'],
  positionDeltaPx: number,
  sizeDeltaPx: number,
  tol: ConvergenceTolerances,
): boolean {
  if (kind === 'text') {
    return positionDeltaPx <= tol.textBboxPositionPx && sizeDeltaPx <= tol.textBboxSizePx;
  }
  // image / shape / table / group / other use the tighter pixel-based
  // tolerance per spec §3.
  return positionDeltaPx <= tol.imageShapePx && sizeDeltaPx <= tol.imageShapePx;
}
