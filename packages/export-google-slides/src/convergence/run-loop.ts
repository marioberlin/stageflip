// packages/export-google-slides/src/convergence/run-loop.ts
// The convergence loop driver (T-252 spec §6). Orchestrates the
// fetch-diff-adjust-apply cycle for one slide, up to `maxIterations`. At
// loop exit returns the final diff so the orchestrator can decide which
// elements fall into image-fallback (§7).
//
// Production path (B1 fix): each iteration fetches the rendered Slides PNG,
// renders the canonical-side golden at the SAME dimensions (B2 fix), runs
// `computePixelDiff` → `findRegions` → `deriveObservations`. The loop
// produces non-zero `iterations` and fires `LF-GSLIDES-EXPORT-CONVERGENCE-STALLED` /
// `LF-GSLIDES-EXPORT-FALLBACK` against real pixel observations.
//
// Test seam: `observationsByIteration[i]`, when defined, supersedes the
// pixel-derived observation for iteration i. Tests use this to drive
// deterministic unit-test paths (no PNG synthesis required). When the seam
// returns `undefined` for the iteration, the production pipeline runs.

import type { Document } from '@stageflip/schema';
import type { SlidesMutationClient } from '../api/client.js';
import { findRegions } from '../diff/connected-components.js';
import { deriveObservations } from '../diff/observe.js';
import { computePixelDiff } from '../diff/pixel-diff.js';
import type { ConvergenceTolerances, RendererCdpProvider } from '../types.js';
import { planAdjustments } from './adjust.js';
import type { ObservedBbox, SlideDiff } from './diff.js';
import { computeDiff } from './diff.js';

export interface RunLoopInput {
  doc: Document;
  presentationId: string;
  slideId: string;
  slideObjectId: string;
  elementsById: Record<string, import('@stageflip/schema').Element>;
  apiIdByElement: Record<string, string>;
  apiClient: SlidesMutationClient;
  renderer: RendererCdpProvider;
  tolerances: ConvergenceTolerances;
  maxIterations: number;
  /**
   * Test seam: per-iteration observed bboxes + perceptual diff. When defined
   * for an iteration, supersedes the pixel-diff path. Production callers
   * pass `[]` (or undefined) and the loop uses the real
   * pixel-diff → connected-components → observation pipeline. Index 0 is
   * the post-initial-apply observation.
   */
  observationsByIteration?: Array<{
    observed: ObservedBbox[];
    perceptualDiff: number;
  }>;
}

export interface RunLoopResult {
  iterations: number;
  finalDiff: SlideDiff;
  /** True when the last iteration's adjustments were empty (stalled). AC #14. */
  stalled: boolean;
  /** API call counter increment from this loop run. */
  apiCalls: number;
}

/**
 * Run up to `maxIterations` of the diff-adjust-apply cycle for one slide.
 * Returns the final diff + a `stalled` flag. The orchestrator owns the
 * residual → image-fallback dispatch.
 */
export async function runConvergenceLoop(input: RunLoopInput): Promise<RunLoopResult> {
  let iter = 0;
  let stalled = false;
  let lastDiff: SlideDiff | undefined;
  let apiCalls = 0;
  const seam = input.observationsByIteration ?? [];
  while (iter < input.maxIterations) {
    // Fetch the rendered Slides PNG. B2: capture actual returned dimensions
    // so the renderer can produce a matching golden — `LARGE` thumbnails
    // are 1600 px wide with the height varying by aspect ratio
    // (16:9 → 900, 4:3 → 1200, etc.).
    const apiPng = await input.apiClient.fetchSlideThumbnail({
      presentationId: input.presentationId,
      slideObjectId: input.slideObjectId,
    });
    apiCalls += 1;

    // Render the canonical-side golden at the SAME dimensions as the API
    // thumbnail. Mismatched dimensions would cause `computePixelDiff` to
    // throw — and even if we accommodated, the diff math depends on shared
    // coordinate space.
    const goldenPng = await input.renderer.renderSlide(input.doc, input.slideId, {
      width: apiPng.width,
      height: apiPng.height,
    });

    // Test seam OR production pipeline.
    const seamObs = seam[iter];
    let observed: ObservedBbox[];
    let perceptualDiff: number;
    if (seamObs !== undefined) {
      observed = seamObs.observed;
      perceptualDiff = seamObs.perceptualDiff;
    } else {
      const pix = computePixelDiff(apiPng.bytes, goldenPng);
      const regions = findRegions(pix.diffMask, pix.width, pix.height);
      observed = deriveObservations({ elementsById: input.elementsById, regions });
      perceptualDiff = pix.perceptualDiff;
    }

    const diff = computeDiff({
      elementsById: input.elementsById,
      observed,
      perceptualDiff,
      tolerances: input.tolerances,
    });
    lastDiff = diff;
    iter += 1;
    if (diff.allElementsInTolerance) break;

    const observedById: Record<string, { x: number; y: number; width: number; height: number }> =
      {};
    for (const o of observed) {
      observedById[o.elementId] = { x: o.x, y: o.y, width: o.width, height: o.height };
    }
    const adjustments = planAdjustments({
      diff,
      apiIdByElement: input.apiIdByElement,
      elementsById: input.elementsById,
      observedById,
    });
    if (adjustments.length === 0) {
      stalled = true;
      break;
    }
    await input.apiClient.batchUpdate({
      presentationId: input.presentationId,
      requests: adjustments,
    });
    apiCalls += 1;
  }

  return {
    iterations: iter,
    finalDiff: lastDiff ?? {
      perElement: [],
      perceptualDiff: 0,
      allElementsInTolerance: true,
    },
    stalled,
    apiCalls,
  };
}
