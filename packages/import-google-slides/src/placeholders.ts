// packages/import-google-slides/src/placeholders.ts
// Extract layouts and masters from the Slides API response into the canonical
// CanonicalSlideTree.{layouts,masters} maps. AC #25-27.
//
// Walking strategy: layouts and masters are top-level arrays on
// `presentation.layouts[]` and `presentation.masters[]`. Each page has a
// `pageType` ('LAYOUT' | 'MASTER' | 'SLIDE'), an objectId, and a
// pageElements list. We emit one ParsedSlide per layout / master, with the
// layout's masterId derived from `layoutProperties.masterObjectId`.
//
// The canonical schema's `SlideLayout` requires `masterId`. If a layout's
// `masterObjectId` is missing or doesn't resolve to a parsed master, we
// fall back to the first master's id (or a synthetic '__missing__'). This
// keeps the schema validation happy; the RIR pass tolerates the dangling id.

import type { ApiPage, ApiPresentation } from './api/types.js';
import { emitGroupElement } from './elements/group.js';
import { emitImageElement } from './elements/image.js';
import { emitLineElement } from './elements/line.js';
import { emitShapeElement } from './elements/shape.js';
import { makeElementId } from './elements/shared.js';
import { emitTableElement } from './elements/table.js';
import type { Affine2x3 } from './geometry/affine.js';
import {
  IDENTITY,
  applyAffineToUnitSquare,
  composeAffines,
  emuToPx,
  fromApi,
} from './geometry/affine.js';
import { walkPageElements } from './geometry/walk.js';
import type { LossFlag, ParsedElement, ParsedSlide } from './types.js';

export interface ExtractContext {
  pageSizeEmu: { width: number; height: number };
  /** Per-slide render dimensions if we have them; layouts/masters use page size as a stand-in. */
  defaultRenderSize: { width: number; height: number };
  layoutIds: ReadonlySet<string>;
  masterIds: ReadonlySet<string>;
}

interface PageEmitInputs {
  page: ApiPage;
  pageId: string;
  renderSize: { width: number; height: number };
  ctx: ExtractContext;
}

/** Produce per-element ParsedElement list with collected loss flags for one page. */
export function emitPageElements(inputs: PageEmitInputs): {
  elements: ParsedElement[];
  flags: LossFlag[];
} {
  const { page, pageId, renderSize, ctx } = inputs;
  const flags: LossFlag[] = [];
  const elements: ParsedElement[] = [];
  const emuPerPx = emuToPx({ pageSizeEmu: ctx.pageSizeEmu, renderSize });

  const pageElements = page.pageElements ?? [];

  // Recursive emitter; closes over ctx so groups can dispatch back into it.
  const emitOne = (
    apiEl: import('./api/types.js').ApiPageElement,
    worldTransform: Affine2x3,
    fallback: string,
  ): { element: ParsedElement; flags: LossFlag[] } => {
    const sizeEmu = {
      width: apiEl.size?.width?.magnitude ?? ctx.pageSizeEmu.width,
      height: apiEl.size?.height?.magnitude ?? ctx.pageSizeEmu.height,
    };
    const worldBbox = applyAffineToUnitSquare({
      worldTransform,
      sizeEmu,
      emuPerPx,
    });

    if (apiEl.elementGroup) {
      // Compute child world bboxes by recursively composing transforms.
      const childWorldBboxes = (apiEl.elementGroup.children ?? []).map((child) => {
        const childLocal = fromApi(child.transform);
        const childWorld = composeAffines(worldTransform, childLocal);
        const childSize = {
          width: child.size?.width?.magnitude ?? ctx.pageSizeEmu.width,
          height: child.size?.height?.magnitude ?? ctx.pageSizeEmu.height,
        };
        return applyAffineToUnitSquare({
          worldTransform: childWorld,
          sizeEmu: childSize,
          emuPerPx,
        });
      });
      // We need to dispatch child emission with child world transforms, not
      // bboxes alone — re-derive in emitChild closure.
      const childTransforms = (apiEl.elementGroup.children ?? []).map((child) => {
        const childLocal = fromApi(child.transform);
        return composeAffines(worldTransform, childLocal);
      });
      let childIdx = -1;
      const out = emitGroupElement({
        apiElement: apiEl,
        worldBbox,
        slideId: pageId,
        fallback,
        childWorldBboxes,
        emitChild: (apiChild, _childBbox, fb) => {
          childIdx += 1;
          const ct = childTransforms[childIdx] ?? IDENTITY;
          return emitOne(apiChild, ct, fb);
        },
      });
      return out;
    }

    if (apiEl.image) {
      return emitImageElement({ apiElement: apiEl, worldBbox, slideId: pageId, fallback });
    }
    if (apiEl.table) {
      return emitTableElement({ apiElement: apiEl, worldBbox, slideId: pageId, fallback });
    }
    if (apiEl.line) {
      return emitLineElement({ apiElement: apiEl, worldBbox, slideId: pageId, fallback });
    }
    // Default: shape (text-bearing or geometric).
    return emitShapeElement({
      apiElement: apiEl,
      worldBbox,
      layoutIds: ctx.layoutIds,
      masterIds: ctx.masterIds,
      slideId: pageId,
      fallback,
    });
  };

  for (let i = 0; i < pageElements.length; i += 1) {
    const apiEl = pageElements[i];
    if (!apiEl) continue;
    const local = fromApi(apiEl.transform);
    const fallback = `${pageId}_el_${i}`;
    const out = emitOne(apiEl, local, fallback);
    elements.push(out.element);
    flags.push(...out.flags);
  }

  // walkPageElements is exposed for matching; not invoked here. Reserved.
  void walkPageElements;

  return { elements, flags };
}

/**
 * Convert an `ApiPage` of pageType LAYOUT into a ParsedSlide. The slide id is
 * the layout's objectId (sanitized); placeholders live in `slide.elements`.
 * The `name` field on the canonical SlideLayout is the layout's `displayName`
 * or falls back to the objectId.
 */
export function emitLayout(
  page: ApiPage,
  ctx: ExtractContext,
): { slide: ParsedSlide; flags: LossFlag[] } {
  const id = makeElementId(page.objectId, 'layout');
  const result = emitPageElements({
    page,
    pageId: id,
    renderSize: ctx.defaultRenderSize,
    ctx,
  });
  return {
    slide: { id, elements: result.elements },
    flags: result.flags,
  };
}

/** Convert a MASTER page into a ParsedSlide. Same shape as emitLayout. */
export function emitMaster(
  page: ApiPage,
  ctx: ExtractContext,
): { slide: ParsedSlide; flags: LossFlag[] } {
  const id = makeElementId(page.objectId, 'master');
  const result = emitPageElements({
    page,
    pageId: id,
    renderSize: ctx.defaultRenderSize,
    ctx,
  });
  return {
    slide: { id, elements: result.elements },
    flags: result.flags,
  };
}

/**
 * Top-level extractor: walks `presentation.layouts[]` and
 * `presentation.masters[]`, emits ParsedSlide records for each, and returns
 * the index sets the slide-emission stage will consult.
 */
export function extractTemplates(
  presentation: ApiPresentation,
  defaultRenderSize: { width: number; height: number },
): {
  layouts: Record<string, ParsedSlide>;
  masters: Record<string, ParsedSlide>;
  layoutIds: Set<string>;
  masterIds: Set<string>;
  flags: LossFlag[];
} {
  const flags: LossFlag[] = [];
  const layouts: Record<string, ParsedSlide> = {};
  const masters: Record<string, ParsedSlide> = {};
  const layoutIds = new Set<string>();
  const masterIds = new Set<string>();

  // Use raw API objectIds for the index sets (so placeholder.parentObjectId
  // lookups match the API's identifiers).
  for (const m of presentation.masters ?? []) {
    if (m.objectId) masterIds.add(m.objectId);
  }
  for (const l of presentation.layouts ?? []) {
    if (l.objectId) layoutIds.add(l.objectId);
  }

  const pageSizeEmu = {
    width: presentation.pageSize?.width?.magnitude ?? 9_144_000,
    height: presentation.pageSize?.height?.magnitude ?? 5_143_500,
  };
  const ctx: ExtractContext = {
    pageSizeEmu,
    defaultRenderSize,
    layoutIds,
    masterIds,
  };

  for (const m of presentation.masters ?? []) {
    if (!m.objectId) continue;
    const out = emitMaster(m, ctx);
    masters[m.objectId] = out.slide;
    flags.push(...out.flags);
  }
  for (const l of presentation.layouts ?? []) {
    if (!l.objectId) continue;
    const out = emitLayout(l, ctx);
    layouts[l.objectId] = out.slide;
    flags.push(...out.flags);
  }
  return { layouts, masters, layoutIds, masterIds, flags };
}
