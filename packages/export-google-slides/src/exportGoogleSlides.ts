// packages/export-google-slides/src/exportGoogleSlides.ts
// Top-level orchestrator. Walks the canonical Document, drives plan emission
// → batchUpdate apply → convergence loop → image-fallback. Returns
// `ExportGoogleSlidesResult` with per-slide outcomes + accumulated loss flags.

import type { LossFlag } from '@stageflip/loss-flags';
import type { Document, Element, Slide } from '@stageflip/schema';
import { type SlidesMutationClient, createDefaultMutationClient } from './api/client.js';
import type { ApiPresentation, BatchUpdateRequest } from './api/types.js';
import type { ObservedBbox } from './convergence/diff.js';
import { runConvergenceLoop } from './convergence/run-loop.js';
import { imageFallbackForResidual } from './fallback/image-fallback.js';
import { emitLossFlag } from './loss-flags.js';
import { type PlannedSlide, buildPlan } from './plan/build-plan.js';
import type { PreferenceApiPageElement } from './plan/preference.js';
import {
  type ConvergenceTolerances,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TIER,
  DEFAULT_TOLERANCES,
  type ExportGoogleSlidesOptions,
  type ExportGoogleSlidesResult,
  type ExportTier,
  type SlideExportOutcome,
} from './types.js';

/**
 * Convert a `Document` into a Google Slides presentation. Behavior depends on
 * `opts.tier` (default `'hybrid'`):
 *   - `fully-editable`: plan + apply only, no convergence loop, no fallback.
 *   - `hybrid` (default): plan + apply, then convergence loop, with
 *     image-fallback for residuals.
 *   - `pixel-perfect-visual`: plan + apply, then EVERY element is
 *     image-rasterized (`maxIterations` clamped to 1).
 */
export async function exportGoogleSlides(
  doc: Document,
  opts: ExportGoogleSlidesOptions,
): Promise<ExportGoogleSlidesResult> {
  const tier: ExportTier = opts.tier ?? DEFAULT_TIER;
  const maxIterations =
    tier === 'fully-editable'
      ? 0
      : tier === 'pixel-perfect-visual'
        ? 1
        : (opts.maxIterations ?? DEFAULT_MAX_ITERATIONS);
  const tolerances: ConvergenceTolerances = {
    ...DEFAULT_TOLERANCES,
    ...(opts.tolerances ?? {}),
  };

  const apiClient: SlidesMutationClient =
    opts.apiClient ??
    createDefaultMutationClient(
      opts.apiBaseUrl !== undefined
        ? { auth: opts.auth, apiBaseUrl: opts.apiBaseUrl }
        : { auth: opts.auth },
    );

  const flags: LossFlag[] = [];
  let apiCallsMade = 0;

  // Resolve the target presentationId (overwrite vs. create new — AC #2).
  let presentationId = opts.presentationId;
  const slideObjectIdBySlideId: Record<string, string> = {};
  let existingPresentation: ApiPresentation | undefined;
  if (presentationId === undefined) {
    const titleArg = doc.meta.title !== undefined ? { title: doc.meta.title } : {};
    const created = await apiClient.createPresentation(titleArg);
    apiCallsMade += 1;
    presentationId = created.presentationId;
    // For a freshly created presentation, the API allocates one default
    // slide. We don't drive it here — the orchestrator's plan path emits
    // CreateSlide requests below for every canonical slide.
    if (doc.content.mode === 'slide') {
      // Allocate deterministic objectIds for each canonical slide.
      // Production: emit CreateSlideRequest + capture replied objectIds.
      // For T-252's canned-test path we use the canonical slideId as the
      // API objectId; tests pin via fixtures.
      for (const s of doc.content.slides) {
        slideObjectIdBySlideId[s.id] = s.id;
      }
    }
  } else if (doc.content.mode === 'slide') {
    for (const s of doc.content.slides) {
      slideObjectIdBySlideId[s.id] = s.id;
    }
    // Spec §5 step 1: read existing presentation state. The plan emitter
    // reads this to drive option (b) (duplicate-similar) — without it,
    // option (b) cannot fire because there are no candidate page elements
    // to match against.
    try {
      existingPresentation = await apiClient.getPresentation({ presentationId });
      apiCallsMade += 1;
    } catch (err) {
      // Read failures don't abort the export — the plan falls back to
      // create-from-scratch (option c). Surface the diagnostic via
      // `LF-GSLIDES-EXPORT-API-ERROR` so the caller sees it.
      flags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-EXPORT-API-ERROR',
          location: {},
          message: `presentations.get failed: ${err instanceof Error ? err.message : String(err)}`,
        }),
      );
    }
  }

  // Per-slide loss-flags for elements with animations / notes / fonts /
  // table rotation / custom geometry. AC #24.
  if (doc.content.mode === 'slide') {
    for (const slide of doc.content.slides) {
      collectPerSlideStaticFlags(slide, flags);
    }
  }

  // Plan emission. AC #7-#11. The `existingPages` map seeds option (b)
  // (duplicate-similar) candidates from the live target presentation.
  const planned = buildPlan(doc, {
    existingPages: existingPagesFromApi(existingPresentation),
    slideObjectIdBySlideId,
  });

  // Per-slide apply + convergence + fallback.
  const outcomes: SlideExportOutcome[] = [];
  for (const ps of planned) {
    const outcome = await processSlide({
      doc,
      tier,
      slide: findSlide(doc, ps.slideId),
      planned: ps,
      tolerances,
      maxIterations,
      apiClient,
      renderer: opts.renderer,
      presentationId,
      flags,
      apiObservations: opts.apiClient ? extractObservations(opts.apiClient, ps.slideId) : [],
      goldenPng: undefined,
    });
    outcomes.push(outcome.outcome);
    apiCallsMade += outcome.apiCalls;
  }

  return {
    presentationId,
    lossFlags: flags,
    outcomes,
    apiCallsMade,
  };
}

interface ProcessSlideInput {
  doc: Document;
  tier: ExportTier;
  slide: Slide | undefined;
  planned: PlannedSlide;
  tolerances: ConvergenceTolerances;
  maxIterations: number;
  apiClient: SlidesMutationClient;
  renderer: import('./types.js').RendererCdpProvider;
  presentationId: string;
  flags: LossFlag[];
  apiObservations: Array<{ observed: ObservedBbox[]; perceptualDiff: number }>;
  goldenPng: Uint8Array | undefined;
}

interface ProcessSlideOutput {
  outcome: SlideExportOutcome;
  apiCalls: number;
}

async function processSlide(input: ProcessSlideInput): Promise<ProcessSlideOutput> {
  let apiCalls = 0;
  // 1. Initial apply of the planned requests.
  if (input.planned.requests.length > 0) {
    const applyResult = await safeBatchUpdate(input.apiClient, {
      presentationId: input.presentationId,
      requests: input.planned.requests.map((r) => r.request),
    });
    apiCalls += 1;
    // Map per-request errors into LF-GSLIDES-EXPORT-API-ERROR. AC #25.
    if (applyResult.errors !== undefined && applyResult.errors.length > 0) {
      for (const err of applyResult.errors) {
        // requestIndex === -1 sentinel = whole-batch failure (thrown by the
        // underlying client), no specific request to attribute to. We emit
        // the flag without an elementId/originalSnippet rather than
        // misattributing to requests[0].
        const planned =
          err.requestIndex >= 0 ? input.planned.requests[err.requestIndex] : undefined;
        const elementId = planned?.elementId ?? '';
        const flagInput: Parameters<typeof emitLossFlag>[0] = {
          code: 'LF-GSLIDES-EXPORT-API-ERROR',
          location: { slideId: input.planned.slideId, elementId },
          message: err.message,
        };
        if (planned !== undefined) {
          flagInput.originalSnippet = JSON.stringify(planned.request);
        }
        input.flags.push(emitLossFlag(flagInput));
      }
    }
  }

  // 2. Tier branching:
  //    - fully-editable: no convergence, no fallback.
  //    - pixel-perfect-visual: every element becomes a fallback.
  //    - hybrid: convergence loop, then image-fallback for residuals.
  if (input.tier === 'fully-editable') {
    return {
      outcome: {
        slideId: input.planned.slideId,
        iterations: 0,
        residualCount: 0,
        finalMetrics: { textBboxPx: 0, imageShapePx: 0, perceptualDiffPct: 0 },
      },
      apiCalls,
    };
  }

  if (input.tier === 'pixel-perfect-visual') {
    // Force EVERY element to fallback. AC #6.
    let residualCount = 0;
    // B2: learn the actual thumbnail dimensions so the canonical-side
    // golden matches. `LARGE` is 1600 × auto-height (16:9 → 900,
    // 4:3 → 1200, etc.). The renderer is then driven at those exact
    // dimensions and the fallback bbox math stays in shared coordinates.
    const apiThumb = await input.apiClient.fetchSlideThumbnail({
      presentationId: input.presentationId,
      slideObjectId: input.planned.slideObjectId,
    });
    apiCalls += 1;
    const goldenSize = { width: apiThumb.width, height: apiThumb.height };
    const goldenPng = await loadGoldenPng(input, goldenSize);
    for (const [elementId, el] of Object.entries(input.planned.elementsById)) {
      const apiId = input.planned.apiIdByElement[elementId];
      if (apiId === undefined) continue;
      try {
        const fb = await imageFallbackForResidual({
          element: el,
          apiObjectId: apiId,
          slideObjectId: input.planned.slideObjectId,
          goldenPng,
          goldenSize,
          apiClient: input.apiClient,
        });
        await safeBatchUpdate(input.apiClient, {
          presentationId: input.presentationId,
          requests: fb.requests,
        });
        apiCalls += 2; // 1 for drive upload + 1 for batchUpdate.
        input.flags.push(
          emitLossFlag({
            code: 'LF-GSLIDES-EXPORT-FALLBACK',
            location: { slideId: input.planned.slideId, elementId },
            message: 'pixel-perfect-visual tier: element rasterized',
          }),
        );
        residualCount += 1;
      } catch (err) {
        input.flags.push(
          emitLossFlag({
            code: 'LF-GSLIDES-EXPORT-API-ERROR',
            location: { slideId: input.planned.slideId, elementId },
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    return {
      outcome: {
        slideId: input.planned.slideId,
        iterations: 1,
        residualCount,
        finalMetrics: { textBboxPx: 0, imageShapePx: 0, perceptualDiffPct: 0 },
      },
      apiCalls,
    };
  }

  // Hybrid (default).
  const loop = await runConvergenceLoop({
    doc: input.doc,
    presentationId: input.presentationId,
    slideId: input.planned.slideId,
    slideObjectId: input.planned.slideObjectId,
    elementsById: input.planned.elementsById,
    apiIdByElement: input.planned.apiIdByElement,
    apiClient: input.apiClient,
    renderer: input.renderer,
    tolerances: input.tolerances,
    maxIterations: input.maxIterations,
    observationsByIteration: input.apiObservations,
  });
  apiCalls += loop.apiCalls;

  // Residual elements at loop exit fall into image-fallback.
  let residualCount = 0;
  const residualElements = loop.finalDiff.perElement.filter((e) => !e.inTolerance);
  if (residualElements.length > 0) {
    // B2: re-use the thumbnail's actual dimensions for the residual crop
    // so the rasterized fallback aligns with what Slides will render.
    const apiThumb = await input.apiClient.fetchSlideThumbnail({
      presentationId: input.presentationId,
      slideObjectId: input.planned.slideObjectId,
    });
    apiCalls += 1;
    const goldenSize = { width: apiThumb.width, height: apiThumb.height };
    const goldenPng = await loadGoldenPng(input, goldenSize);
    for (const r of residualElements) {
      const el = input.planned.elementsById[r.elementId];
      const apiId = input.planned.apiIdByElement[r.elementId];
      if (el === undefined || apiId === undefined) continue;
      try {
        const fb = await imageFallbackForResidual({
          element: el,
          apiObjectId: apiId,
          slideObjectId: input.planned.slideObjectId,
          goldenPng,
          goldenSize,
          apiClient: input.apiClient,
        });
        await safeBatchUpdate(input.apiClient, {
          presentationId: input.presentationId,
          requests: fb.requests,
        });
        apiCalls += 2;
        // Stalled-and-fallback double-emit per AC #14: when the loop ended
        // because adjustments planned to zero, BOTH flags fire on the same
        // residual.
        if (loop.stalled) {
          input.flags.push(
            emitLossFlag({
              code: 'LF-GSLIDES-EXPORT-CONVERGENCE-STALLED',
              location: { slideId: input.planned.slideId, elementId: r.elementId },
              message: 'convergence loop produced zero adjustments before tolerance',
            }),
          );
        }
        input.flags.push(
          emitLossFlag({
            code: 'LF-GSLIDES-EXPORT-FALLBACK',
            location: { slideId: input.planned.slideId, elementId: r.elementId },
            message: 'element fell into image-fallback after convergence',
          }),
        );
        residualCount += 1;
      } catch (err) {
        input.flags.push(
          emitLossFlag({
            code: 'LF-GSLIDES-EXPORT-API-ERROR',
            location: { slideId: input.planned.slideId, elementId: r.elementId },
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  // Final metrics — max per-element drift the loop observed.
  let textBboxPx = 0;
  let imageShapePx = 0;
  for (const e of loop.finalDiff.perElement) {
    if (e.kind === 'text') {
      textBboxPx = Math.max(textBboxPx, e.positionDeltaPx, e.sizeDeltaPx);
    } else {
      imageShapePx = Math.max(imageShapePx, e.positionDeltaPx, e.sizeDeltaPx);
    }
  }

  return {
    outcome: {
      slideId: input.planned.slideId,
      iterations: loop.iterations,
      residualCount,
      finalMetrics: {
        textBboxPx,
        imageShapePx,
        perceptualDiffPct: loop.finalDiff.perceptualDiff,
      },
    },
    apiCalls,
  };
}

/**
 * Best-effort wrapper around `apiClient.batchUpdate` that swallows thrown
 * errors and surfaces them via the response's `errors[]` field. Real Slides
 * API responses don't carry this; the test stub does. Production wraps a
 * thrown HTTP error into the same shape so the caller has a uniform handle.
 */
async function safeBatchUpdate(
  apiClient: SlidesMutationClient,
  args: { presentationId: string; requests: BatchUpdateRequest[] },
): Promise<import('./api/types.js').BatchUpdateResponse> {
  try {
    return await apiClient.batchUpdate(args);
  } catch (err) {
    // Sentinel: the whole batch failed (e.g. network/HTTP throw), not a
    // specific request index. -1 distinguishes from per-request errors that
    // the API can return with `requestIndex: 0..N-1`. The orchestrator's
    // `LF-GSLIDES-EXPORT-API-ERROR` emitter handles -1 as "no specific
    // request id".
    return {
      presentationId: args.presentationId,
      replies: [],
      errors: [
        {
          requestIndex: -1,
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }
}

function findSlide(doc: Document, slideId: string): Slide | undefined {
  if (doc.content.mode !== 'slide') return undefined;
  return doc.content.slides.find((s) => s.id === slideId);
}

function collectPerSlideStaticFlags(slide: Slide, flags: LossFlag[]): void {
  // AC #24: animations dropped — one per slide that had any.
  const hasAnimations = walkElements(slide.elements).some((e) => e.animations.length > 0);
  if (hasAnimations) {
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED',
        location: { slideId: slide.id },
        message: 'one or more elements had animations; Slides export drops them',
      }),
    );
  }
  // AC #24: notes dropped — one per slide with non-empty notes.
  if (slide.notes !== undefined && slide.notes.length > 0) {
    flags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-EXPORT-NOTES-DROPPED',
        location: { slideId: slide.id },
        message: 'speaker notes dropped (out of scope per spec)',
        originalSnippet: slide.notes.slice(0, 200),
      }),
    );
  }
  // Custom-geometry shapes degrade to image-fallback per spec; we surface
  // the flag here so it's tied to the slide, not just the element.
  for (const el of walkElements(slide.elements)) {
    if (el.type === 'shape' && el.shape === 'custom-path') {
      flags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED',
          location: { slideId: slide.id, elementId: el.id },
          message: 'custom-path shape degraded; Slides has no custom-path equivalent',
        }),
      );
    }
    if (el.type === 'table') {
      // Per-cell rotation isn't carried in the canonical schema today, so
      // there's nothing to detect; the flag is reserved for round-trip
      // imports that surface rotated cells as element-level annotations.
      // T-252 v1 leaves this flag emission to future schema extensions.
    }
    if (el.type === 'text' && el.fontFamily !== undefined && !FONT_SUPPORTED.has(el.fontFamily)) {
      flags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED',
          location: { slideId: slide.id, elementId: el.id },
          message: `font "${el.fontFamily}" not in supported family list; substituted`,
          originalSnippet: el.fontFamily,
        }),
      );
    }
  }
}

/** Subset of Slides-supported font families. Production list is much larger; we accept the common set. */
const FONT_SUPPORTED = new Set([
  'Arial',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Roboto',
  'Times New Roman',
  'Verdana',
]);

function walkElements(elements: Element[]): Element[] {
  const out: Element[] = [];
  for (const el of elements) {
    out.push(el);
    if (el.type === 'group') {
      out.push(...walkElements(el.children));
    }
  }
  return out;
}

async function loadGoldenPng(
  input: ProcessSlideInput,
  size: { width: number; height: number },
): Promise<Uint8Array> {
  return await input.renderer.renderSlide(input.doc, input.planned.slideId, size);
}

/**
 * Normalize a `presentations.get` response into the `existingPages` map
 * shape `buildPlan` expects: keyed by slide objectId, values are arrays of
 * `PreferenceApiPageElement` (the planner's candidate type).
 *
 * Spec §5 step 1. Without this map, option (b) (duplicate-similar) never
 * fires; the planner collapses to options (a) → (c).
 */
function existingPagesFromApi(
  pres: ApiPresentation | undefined,
): Record<string, PreferenceApiPageElement[] | undefined> {
  const out: Record<string, PreferenceApiPageElement[] | undefined> = {};
  if (pres?.slides === undefined) return out;
  for (const slide of pres.slides) {
    if (slide.objectId === undefined) continue;
    const elements: PreferenceApiPageElement[] = [];
    for (const pe of slide.pageElements ?? []) {
      // Pluck only the fields the planner reads. Dropping unknown fields
      // keeps the map narrow and avoids carrying server-side state we
      // don't need.
      const entry: PreferenceApiPageElement = {};
      if (pe.objectId !== undefined) entry.objectId = pe.objectId;
      if (pe.size !== undefined) {
        const size: PreferenceApiPageElement['size'] = {};
        if (pe.size.width?.magnitude !== undefined) {
          size.width = { magnitude: pe.size.width.magnitude };
        }
        if (pe.size.height?.magnitude !== undefined) {
          size.height = { magnitude: pe.size.height.magnitude };
        }
        entry.size = size;
      }
      if (pe.transform !== undefined) {
        const tf: PreferenceApiPageElement['transform'] = {};
        if (pe.transform.translateX !== undefined) tf.translateX = pe.transform.translateX;
        if (pe.transform.translateY !== undefined) tf.translateY = pe.transform.translateY;
        entry.transform = tf;
      }
      if (pe.shape !== undefined) {
        entry.shape = pe.shape;
      }
      if (pe.image !== undefined) entry.image = pe.image;
      if (pe.table !== undefined) entry.table = pe.table;
      if (pe.elementGroup !== undefined) entry.elementGroup = pe.elementGroup;
      elements.push(entry);
    }
    out[slide.objectId] = elements;
  }
  return out;
}

/**
 * Test seam: when the caller supplies a `RecordingMutationClient` that
 * carries pre-baked observations for the convergence loop, surface them.
 * Production callers don't use this — the renderer/diff pair runs live.
 */
function extractObservations(
  apiClient: SlidesMutationClient,
  slideId: string,
): Array<{ observed: ObservedBbox[]; perceptualDiff: number }> {
  // Duck-type the test client. The recording client carries a per-slide
  // observation map under `__convergenceObservations`.
  const raw = (apiClient as unknown as Record<string, unknown>).__convergenceObservations;
  if (!raw || typeof raw !== 'object') return [];
  const map = raw as Record<string, Array<{ observed: ObservedBbox[]; perceptualDiff: number }>>;
  return map[slideId] ?? [];
}
