// packages/import-google-slides/src/parseGoogleSlides.ts
// Top-level entry point for the Google Slides importer. Composes:
//   1. presentations.get fetch (api/client)
//   2. Per-slide thumbnail fetch (api/client)
//   3. CV provider call per slide
//   4. Recursive page-element walk + per-element emit + matching
//   5. Layout / master extraction with inheritsFrom resolution
//   6. Slide.layoutId from slideProperties.layoutObjectId
//   7. Residual collection into tree.pendingResolution for T-246
//
// Returns a CanonicalSlideTree with `assetsResolved: false` and
// `pendingResolution` populated. Callers chain `resolveAssets`
// (re-exported from @stageflip/import-pptx) to upload image bytes.

import {
  type GoogleAuthProvider,
  type ThumbnailSize,
  fetchPresentation,
  fetchSlideThumbnail,
} from './api/client.js';
import type { ApiPresentation } from './api/types.js';
import type { CvCandidateProvider } from './cv/types.js';
import { emitGroupElement } from './elements/group.js';
import { emitImageElement } from './elements/image.js';
import { emitLineElement } from './elements/line.js';
import { emitShapeElement } from './elements/shape.js';
import { makeElementId, padBbox } from './elements/shared.js';
import { emitTableElement } from './elements/table.js';
import {
  type Affine2x3,
  type BboxPx,
  IDENTITY,
  applyAffineToUnitSquare,
  composeAffines,
  emuToPx,
  fromApi,
} from './geometry/affine.js';
import { walkPageElements } from './geometry/walk.js';
import { emitLossFlag } from './loss-flags.js';
import { matchElement } from './matching/match.js';
import { extractTemplates } from './placeholders.js';
import type {
  CanonicalSlideTree,
  LossFlag,
  ParsedElement,
  ParsedSlide,
  PendingMatchResolution,
} from './types.js';

export interface ParseGoogleSlidesOptions {
  /** Slides API presentation id. */
  presentationId: string;
  /** OAuth token provider (presentations.readonly scope). */
  auth: GoogleAuthProvider;
  /** Computer-vision candidate provider. Tests use `StubCvProvider`. */
  cv: CvCandidateProvider;
  /**
   * Thumbnail size for the per-slide PNG. Default LARGE. Slides API constrains
   * this to the SMALL/MEDIUM/LARGE enum.
   */
  thumbnailSize?: ThumbnailSize;
  /**
   * Confidence threshold for deterministic matches. Below: emits residual for
   * T-246's Gemini fallback loop. Default 0.78 per spec §5.
   */
  matchConfidenceThreshold?: number;
  /** Override of the API base URL (for testing against a recorded-response server). */
  apiBaseUrl?: string;
  /** Override the global fetch (for tests). */
  fetchImpl?: typeof fetch;
  /**
   * Test seam: pre-fetched API presentation. When provided, skips the
   * `fetchPresentation` call. Used by the fixture tests so they don't have to
   * mock `fetch`.
   */
  presentation?: ApiPresentation;
  /**
   * Test seam: pre-fetched thumbnails by slide objectId. When provided for a
   * slide, skips the thumbnail fetch. Used by fixture tests.
   */
  thumbnails?: Record<string, { bytes: Uint8Array; width: number; height: number }>;
  /**
   * Optional fixture-key map: slide objectId → CV provider fixtureKey. Lets
   * fixture tests route the StubCvProvider's per-slide candidates without
   * threading per-slide options through the public surface.
   */
  cvFixtureKeys?: Record<string, string>;
}

const DEFAULT_THRESHOLD = 0.78;

/**
 * Parse a Google Slides presentation into a CanonicalSlideTree.
 */
export async function parseGoogleSlides(
  opts: ParseGoogleSlidesOptions,
): Promise<CanonicalSlideTree> {
  const threshold = opts.matchConfidenceThreshold ?? DEFAULT_THRESHOLD;
  const thumbSize: ThumbnailSize = opts.thumbnailSize ?? 'LARGE';
  const apiOpts: Parameters<typeof fetchPresentation>[2] = {};
  if (opts.apiBaseUrl !== undefined) apiOpts.apiBaseUrl = opts.apiBaseUrl;
  if (opts.fetchImpl !== undefined) apiOpts.fetchImpl = opts.fetchImpl;

  const presentation =
    opts.presentation ?? (await fetchPresentation(opts.presentationId, opts.auth, apiOpts));
  const pageSizeEmu = {
    width: presentation.pageSize?.width?.magnitude ?? 9_144_000,
    height: presentation.pageSize?.height?.magnitude ?? 5_143_500,
  };

  // Phase 1: extract templates (layouts + masters) so slide elements'
  // inheritsFrom can resolve.
  const templates = extractTemplates(presentation, { width: 1600, height: 900 });
  const allFlags: LossFlag[] = [...templates.flags];

  // Phase 2: per-slide processing.
  const slides: ParsedSlide[] = [];
  const pendingResolution: Record<string, Record<string, PendingMatchResolution>> = {};
  // T-246 contract amendment: keep references to the per-slide PNG bytes
  // already in memory so the AI-QC convergence loop can crop per-element
  // slices for Gemini multimodal prompts. See T-246 spec line 36.
  const pageImagesPng: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};

  for (const slidePage of presentation.slides ?? []) {
    if (!slidePage.objectId) continue;
    const slideObjectId = slidePage.objectId;
    const slideId = makeElementId(slideObjectId, 'slide');

    // Fetch (or skip — fixture tests provide thumbnails).
    const thumb =
      opts.thumbnails?.[slideObjectId] ??
      (await fetchSlideThumbnail(
        opts.presentationId,
        slideObjectId,
        thumbSize,
        opts.auth,
        apiOpts,
      ));
    const renderSize = { width: thumb.width, height: thumb.height };
    const emuPerPx = emuToPx({ pageSizeEmu, renderSize });

    // T-246 contract amendment: stash the PNG bytes by slideId. We keep the
    // existing `thumb` reference (no copy) — the bytes are already in memory
    // for the CV pass, so retaining them on the tree is essentially free.
    pageImagesPng[slideId] = {
      bytes: thumb.bytes,
      width: thumb.width,
      height: thumb.height,
    };

    // CV detection.
    const cvDetectOpts: Parameters<CvCandidateProvider['detect']>[1] = {
      renderWidth: thumb.width,
      renderHeight: thumb.height,
    };
    const fixtureKey = opts.cvFixtureKeys?.[slideObjectId];
    if (fixtureKey) cvDetectOpts.fixtureKey = fixtureKey;
    const cvCandidates = await opts.cv.detect(thumb.bytes, cvDetectOpts);

    const slideFlags: LossFlag[] = [];
    const slideResiduals: Record<string, PendingMatchResolution> = {};
    const slideElements: ParsedElement[] = [];

    // Walk for matching: gives flat (element, world) tuples used to compute
    // bboxes for the matcher. The actual emit dispatch is recursive (so
    // nested groups produce nested ParsedGroupElement output).
    const walked = walkPageElements(slidePage.pageElements);
    const elementWorld = new Map<string, Affine2x3>();
    const elementZRank = new Map<string, number>();
    walked.forEach((w, idx) => {
      if (w.element.objectId) {
        elementWorld.set(w.element.objectId, w.worldTransform);
        elementZRank.set(w.element.objectId, idx);
      }
    });

    // Recursive emitter: for each top-level element, recursively builds the
    // canonical element. Group children dispatch back through this.
    const emitOne = (
      apiEl: import('./api/types.js').ApiPageElement,
      worldTransform: Affine2x3,
      fallback: string,
    ): { element: ParsedElement; flags: LossFlag[] } => {
      const sizeEmu = {
        width: apiEl.size?.width?.magnitude ?? pageSizeEmu.width,
        height: apiEl.size?.height?.magnitude ?? pageSizeEmu.height,
      };
      const worldBbox = applyAffineToUnitSquare({
        worldTransform,
        sizeEmu,
        emuPerPx,
      });

      if (apiEl.elementGroup) {
        const childTransforms = (apiEl.elementGroup.children ?? []).map((child) => {
          const childLocal = fromApi(child.transform);
          return composeAffines(worldTransform, childLocal);
        });
        const childWorldBboxes = (apiEl.elementGroup.children ?? []).map((child, i) => {
          const childSize = {
            width: child.size?.width?.magnitude ?? pageSizeEmu.width,
            height: child.size?.height?.magnitude ?? pageSizeEmu.height,
          };
          return applyAffineToUnitSquare({
            worldTransform: childTransforms[i] ?? IDENTITY,
            sizeEmu: childSize,
            emuPerPx,
          });
        });
        let childIdx = -1;
        return emitGroupElement({
          apiElement: apiEl,
          worldBbox,
          slideId,
          fallback,
          childWorldBboxes,
          emitChild: (apiChild, _bbox, fb) => {
            childIdx += 1;
            const ct = childTransforms[childIdx] ?? IDENTITY;
            return emitOne(apiChild, ct, fb);
          },
        });
      }

      // Run matching for non-group elements (matching only meaningfully
      // applies to leaves with bboxes). Below threshold → record residual.
      const elementId = makeElementId(apiEl.objectId, fallback);
      const z = apiEl.objectId ? (elementZRank.get(apiEl.objectId) ?? 0) : 0;
      const match = matchElement({
        apiElement: apiEl,
        elementBboxPx: worldBbox,
        elementZRank: z,
        slideDim: renderSize,
        candidates: cvCandidates,
      });
      const overall = match.best?.overallConfidence ?? 0;

      let emitted: { element: ParsedElement; flags: LossFlag[] };
      if (apiEl.image) {
        emitted = emitImageElement({ apiElement: apiEl, worldBbox, slideId, fallback });
      } else if (apiEl.table) {
        emitted = emitTableElement({ apiElement: apiEl, worldBbox, slideId, fallback });
      } else if (apiEl.line) {
        emitted = emitLineElement({ apiElement: apiEl, worldBbox, slideId, fallback });
      } else {
        emitted = emitShapeElement({
          apiElement: apiEl,
          worldBbox,
          layoutIds: templates.layoutIds,
          masterIds: templates.masterIds,
          slideId,
          fallback,
        });
      }

      // Residual handling: only meaningful for leaves where match was attempted
      // and the deterministic confidence is below threshold. Tables and
      // images skip the residual (their values come from API only anyway).
      const elementHasMatchableBody = !apiEl.table && !apiEl.image && !apiEl.line;
      if (elementHasMatchableBody && overall < threshold) {
        emitted.flags.push(
          emitLossFlag({
            code: 'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
            location: { slideId, elementId },
            message: `match confidence ${overall.toFixed(3)} < threshold ${threshold}`,
          }),
        );
        slideResiduals[elementId] = {
          slideId,
          elementId,
          apiElement: emitted.element,
          pageImageCropPx: clampBbox(padBbox(worldBbox, 16), renderSize),
          rankedCandidates: match.ranked.map((r) => ({ ...r })),
        };
      }

      return emitted;
    };

    for (let i = 0; i < (slidePage.pageElements?.length ?? 0); i += 1) {
      const apiEl = slidePage.pageElements?.[i];
      if (!apiEl) continue;
      const local = fromApi(apiEl.transform);
      const fallback = `${slideId}_el_${i}`;
      const out = emitOne(apiEl, local, fallback);
      slideElements.push(out.element);
      slideFlags.push(...out.flags);
    }

    const slide: ParsedSlide = { id: slideId, elements: slideElements };
    const layoutObjectId = slidePage.slideProperties?.layoutObjectId;
    if (layoutObjectId !== undefined && templates.layoutIds.has(layoutObjectId)) {
      slide.layoutId = layoutObjectId;
    }
    slides.push(slide);
    if (Object.keys(slideResiduals).length > 0) {
      pendingResolution[slideId] = slideResiduals;
    }
    allFlags.push(...slideFlags);
  }

  const tree: CanonicalSlideTree = {
    slides,
    layouts: templates.layouts,
    masters: templates.masters,
    lossFlags: allFlags,
    pendingResolution,
    pageImagesPng,
    assetsResolved: false,
  };
  return tree;
}

function clampBbox(bbox: BboxPx, dim: { width: number; height: number }): BboxPx {
  const x = Math.max(0, bbox.x);
  const y = Math.max(0, bbox.y);
  const w = Math.min(dim.width - x, bbox.width);
  const h = Math.min(dim.height - y, bbox.height);
  return { x, y, width: Math.max(1, w), height: Math.max(1, h) };
}
