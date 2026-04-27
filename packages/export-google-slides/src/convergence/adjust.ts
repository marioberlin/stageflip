// packages/export-google-slides/src/convergence/adjust.ts
// Diff → adjustment requests. T-252 spec §6 — given a per-element diff, build
// the inverse-delta `UpdatePageElementTransformRequest` that nudges the
// element back toward its canonical bbox. The math is deliberately
// rudimentary: subtract the observed delta. If the observed delta is zero
// for every out-of-tolerance element, the loop has stalled and we return
// an empty array so the orchestrator can emit
// `LF-GSLIDES-EXPORT-CONVERGENCE-STALLED` and fall into image-fallback.

import type { Element } from '@stageflip/schema';
import type { BatchUpdateRequest } from '../api/types.js';
import type { ElementDiff } from './diff.js';

export interface PlanAdjustmentsInput {
  diff: { perElement: ElementDiff[] };
  apiIdByElement: Record<string, string>;
  elementsById: Record<string, Element>;
  /** Observed bboxes, used to compute the inverse delta. */
  observedById: Record<string, { x: number; y: number; width: number; height: number }>;
}

const EMU_PER_PX = 9525;

/**
 * Build a `BatchUpdateRequest[]` that nudges each out-of-tolerance element
 * by the inverse of its observed drift. Returns empty when no adjustments
 * are needed OR every adjustment would be zero (stalled).
 */
export function planAdjustments(input: PlanAdjustmentsInput): BatchUpdateRequest[] {
  const out: BatchUpdateRequest[] = [];
  for (const ed of input.diff.perElement) {
    if (ed.inTolerance) continue;
    const apiId = input.apiIdByElement[ed.elementId];
    const el = input.elementsById[ed.elementId];
    const obs = input.observedById[ed.elementId];
    if (apiId === undefined || el === undefined || obs === undefined) continue;
    const deltaX = el.transform.x - obs.x;
    const deltaY = el.transform.y - obs.y;
    if (deltaX === 0 && deltaY === 0) continue;
    out.push({
      updatePageElementTransform: {
        objectId: apiId,
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: deltaX * EMU_PER_PX,
          translateY: deltaY * EMU_PER_PX,
          unit: 'EMU',
        },
        applyMode: 'RELATIVE',
      },
    });
  }
  return out;
}
