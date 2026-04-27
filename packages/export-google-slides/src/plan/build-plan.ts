// packages/export-google-slides/src/plan/build-plan.ts
// Document → SlideExportPlan. Walks each slide's elements and emits the
// preference-ordered batchUpdate request list (T-252 spec §5):
//   (a) inheritsFrom-aware UpdateShapePropertiesRequest, when the canonical
//       element references a placeholder on the slide's layout/master.
//   (b) DuplicateObjectRequest + modifications, when a similar object exists
//       on the target slide.
//   (c) CreateShapeRequest / CreateImageRequest / CreateTableRequest from
//       scratch, with downstream Insert/Update requests.
//
// The plan is a flat array of `{ kind, request, slideObjectId, elementId }`
// rows; the orchestrator applies them in array order and threads the
// per-element id mapping (slide elementId → API objectId) to downstream
// passes (convergence, image-fallback).

import type {
  Document,
  Element,
  GroupElement,
  ImageElement,
  Slide,
  TableElement,
} from '@stageflip/schema';
import type { AffineTransform, BatchUpdateRequest, ElementProperties } from '../api/types.js';
import { type PreferenceApiPageElement, bboxesFromApi, findSimilarObject } from './preference.js';

/** Plan emission strategy per element. AC #7-#9. */
export type EmissionStrategy = 'placeholder-update' | 'duplicate-similar' | 'create-from-scratch';

export interface PlannedRequest {
  /** Identifies the canonical element this request belongs to. */
  elementId: string;
  /** The slide's API page object id this element lives on. */
  slideObjectId: string;
  /** The mutation request — already in batchUpdate body shape. */
  request: BatchUpdateRequest;
  /** Strategy that produced the request. AC #7-#9 pinning. */
  strategy: EmissionStrategy;
}

export interface PlannedSlide {
  /** Canonical slide id (from `Slide.id`). */
  slideId: string;
  /** API objectId for the slide page. */
  slideObjectId: string;
  /** All planned requests for this slide, in apply order. */
  requests: PlannedRequest[];
  /** Per-element strategy used (AC #7-#9 pinning). */
  strategiesByElement: Record<string, EmissionStrategy>;
  /** Element-id ↔ API objectId map (created or pre-existing). */
  apiIdByElement: Record<string, string>;
  /** Canonical element snapshot (for the convergence loop's diff math). */
  elementsById: Record<string, Element>;
}

export interface BuildPlanOptions {
  /**
   * Pre-existing API state. When the exporter overwrites an existing
   * presentation, this is `presentations.get`'s result; when creating new,
   * it's an empty stub. `pages` holds the slides keyed by objectId.
   */
  existingPages: Record<string, PreferenceApiPageElement[] | undefined>;
  /**
   * Mapping from canonical slideId → API page objectId. The orchestrator
   * builds this when creating slides (or reads it from `existingPages`).
   */
  slideObjectIdBySlideId: Record<string, string>;
}

/** EMU/px conversion used throughout the planner. */
const EMU_PER_PX = 9525;

/**
 * Build a plan for every slide in `doc.content` (slide mode). Other modes
 * are out of scope per the spec; callers branch upstream.
 */
export function buildPlan(doc: Document, opts: BuildPlanOptions): PlannedSlide[] {
  if (doc.content.mode !== 'slide') return [];
  const out: PlannedSlide[] = [];
  for (const slide of doc.content.slides) {
    const slideObjectId = opts.slideObjectIdBySlideId[slide.id];
    if (!slideObjectId) continue;
    out.push(buildSlidePlan(slide, doc, slideObjectId, opts.existingPages[slideObjectId]));
  }
  return out;
}

function buildSlidePlan(
  slide: Slide,
  doc: Document,
  slideObjectId: string,
  existingElements: PreferenceApiPageElement[] | undefined,
): PlannedSlide {
  const requests: PlannedRequest[] = [];
  const strategiesByElement: Record<string, EmissionStrategy> = {};
  const apiIdByElement: Record<string, string> = {};
  const elementsById: Record<string, Element> = {};
  const candidates = bboxesFromApi(existingElements);

  for (const el of slide.elements) {
    emitElement({
      el,
      doc,
      slide,
      slideObjectId,
      candidates,
      requests,
      strategiesByElement,
      apiIdByElement,
      elementsById,
    });
  }

  return {
    slideId: slide.id,
    slideObjectId,
    requests,
    strategiesByElement,
    apiIdByElement,
    elementsById,
  };
}

interface EmitContext {
  el: Element;
  doc: Document;
  slide: Slide;
  slideObjectId: string;
  candidates: ReturnType<typeof bboxesFromApi>;
  requests: PlannedRequest[];
  strategiesByElement: Record<string, EmissionStrategy>;
  apiIdByElement: Record<string, string>;
  elementsById: Record<string, Element>;
}

function emitElement(ctx: EmitContext): void {
  const { el } = ctx;
  ctx.elementsById[el.id] = el;

  // (a) Placeholder-update path — element carries inheritsFrom and the
  // referenced template exists. AC #7.
  if (el.inheritsFrom !== undefined) {
    const placeholder = resolveInheritedPlaceholder(ctx.doc, el.inheritsFrom);
    if (placeholder !== undefined) {
      const apiObjectId = `${el.inheritsFrom.templateId}_${el.inheritsFrom.placeholderIdx}`;
      ctx.apiIdByElement[el.id] = apiObjectId;
      ctx.strategiesByElement[el.id] = 'placeholder-update';
      ctx.requests.push({
        elementId: el.id,
        slideObjectId: ctx.slideObjectId,
        strategy: 'placeholder-update',
        request: {
          updateShapeProperties: {
            objectId: apiObjectId,
            fields: 'shapeBackgroundFill',
            shapeProperties: shapePropertiesFromElement(el),
          },
        },
      });
      // For text elements, also issue an InsertText so the placeholder
      // body reflects the canonical text.
      if (el.type === 'text') {
        ctx.requests.push({
          elementId: el.id,
          slideObjectId: ctx.slideObjectId,
          strategy: 'placeholder-update',
          request: {
            insertText: { objectId: apiObjectId, text: el.text },
          },
        });
      }
      return;
    }
  }

  // (b) Duplicate-similar path — a candidate on the target slide passes the
  // similarity heuristic. AC #8.
  if (el.type !== 'group') {
    const similarId = findSimilarObject(el, ctx.candidates);
    if (similarId !== undefined) {
      const newId = `${el.id}_dup`;
      ctx.apiIdByElement[el.id] = newId;
      ctx.strategiesByElement[el.id] = 'duplicate-similar';
      ctx.requests.push({
        elementId: el.id,
        slideObjectId: ctx.slideObjectId,
        strategy: 'duplicate-similar',
        request: {
          duplicateObject: {
            objectId: similarId,
            objectIds: { [similarId]: newId },
          },
        },
      });
      // Modify the duplicate to match the canonical's transform + content.
      ctx.requests.push({
        elementId: el.id,
        slideObjectId: ctx.slideObjectId,
        strategy: 'duplicate-similar',
        request: {
          updatePageElementTransform: {
            objectId: newId,
            transform: affineFromElement(el),
            applyMode: 'ABSOLUTE',
          },
        },
      });
      if (el.type === 'text') {
        ctx.requests.push({
          elementId: el.id,
          slideObjectId: ctx.slideObjectId,
          strategy: 'duplicate-similar',
          request: { insertText: { objectId: newId, text: el.text } },
        });
      }
      return;
    }
  }

  // (c) Create-from-scratch path. AC #9.
  emitCreate(ctx);
}

/**
 * Default-tier emission: create the element from scratch, then any per-type
 * follow-ups (InsertText, MergeTableCells, GroupObjects).
 */
function emitCreate(ctx: EmitContext): void {
  const { el, slideObjectId } = ctx;
  const newId = `${el.id}_new`;
  ctx.apiIdByElement[el.id] = newId;
  ctx.strategiesByElement[el.id] = 'create-from-scratch';

  const elementProperties: ElementProperties = {
    pageObjectId: slideObjectId,
    size: {
      width: { magnitude: el.transform.width * EMU_PER_PX, unit: 'EMU' },
      height: { magnitude: el.transform.height * EMU_PER_PX, unit: 'EMU' },
    },
    transform: affineFromElement(el),
  };

  if (el.type === 'image') {
    emitCreateImage(ctx, newId, el, elementProperties);
    return;
  }
  if (el.type === 'table') {
    emitCreateTable(ctx, newId, el, elementProperties);
    return;
  }
  if (el.type === 'group') {
    emitCreateGroup(ctx, newId, el);
    return;
  }
  if (el.type === 'text') {
    ctx.requests.push({
      elementId: el.id,
      slideObjectId,
      strategy: 'create-from-scratch',
      request: {
        createShape: {
          objectId: newId,
          shapeType: 'TEXT_BOX',
          elementProperties,
        },
      },
    });
    ctx.requests.push({
      elementId: el.id,
      slideObjectId,
      strategy: 'create-from-scratch',
      request: { insertText: { objectId: newId, text: el.text } },
    });
    return;
  }
  if (el.type === 'shape') {
    ctx.requests.push({
      elementId: el.id,
      slideObjectId,
      strategy: 'create-from-scratch',
      request: {
        createShape: {
          objectId: newId,
          shapeType: shapeKindToSlidesType(el.shape),
          elementProperties,
        },
      },
    });
    return;
  }
  // Other element types: omit; the convergence loop / loss-flag path may
  // still treat them as residuals via image-fallback. The emitter is
  // intentionally silent here — unsupported types are out of scope per the
  // spec's "Out of scope" matrix.
}

function emitCreateImage(
  ctx: EmitContext,
  newId: string,
  el: ImageElement,
  elementProperties: ElementProperties,
): void {
  ctx.requests.push({
    elementId: el.id,
    slideObjectId: ctx.slideObjectId,
    strategy: 'create-from-scratch',
    request: {
      createImage: {
        objectId: newId,
        url: assetRefToUrl(el.src),
        elementProperties,
      },
    },
  });
}

function emitCreateTable(
  ctx: EmitContext,
  newId: string,
  el: TableElement,
  elementProperties: ElementProperties,
): void {
  ctx.requests.push({
    elementId: el.id,
    slideObjectId: ctx.slideObjectId,
    strategy: 'create-from-scratch',
    request: {
      createTable: {
        objectId: newId,
        rows: el.rows,
        columns: el.columns,
        elementProperties,
      },
    },
  });
  // Per-cell InsertText. AC #11.
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < el.columns; c++) {
      const cell = el.cells.find((cc) => cc.row === r && cc.col === c);
      const text = cell?.content ?? '';
      ctx.requests.push({
        elementId: el.id,
        slideObjectId: ctx.slideObjectId,
        strategy: 'create-from-scratch',
        request: {
          insertText: {
            objectId: newId,
            text,
            cellLocation: { rowIndex: r, columnIndex: c },
          },
        },
      });
    }
  }
  // Per-merged-cell MergeTableCells. AC #11.
  for (const cell of el.cells) {
    if (cell.colspan > 1 || cell.rowspan > 1) {
      ctx.requests.push({
        elementId: el.id,
        slideObjectId: ctx.slideObjectId,
        strategy: 'create-from-scratch',
        request: {
          mergeTableCells: {
            objectId: newId,
            tableRange: {
              location: { rowIndex: cell.row, columnIndex: cell.col },
              rowSpan: cell.rowspan,
              columnSpan: cell.colspan,
            },
          },
        },
      });
    }
  }
}

/**
 * Group emission. AC #10: child creates FIRST, then a single
 * GroupObjectsRequest binds them.
 */
function emitCreateGroup(ctx: EmitContext, groupNewId: string, el: GroupElement): void {
  const childIds: string[] = [];
  for (const child of el.children) {
    emitElement({ ...ctx, el: child });
    const childApiId = ctx.apiIdByElement[child.id];
    if (childApiId !== undefined) childIds.push(childApiId);
  }
  ctx.apiIdByElement[el.id] = groupNewId;
  ctx.requests.push({
    elementId: el.id,
    slideObjectId: ctx.slideObjectId,
    strategy: 'create-from-scratch',
    request: {
      groupObjects: {
        groupObjectId: groupNewId,
        childrenObjectIds: childIds,
      },
    },
  });
}

/** Resolve an `inheritsFrom` reference to its placeholder element, or undefined. */
function resolveInheritedPlaceholder(
  doc: Document,
  ref: { templateId: string; placeholderIdx: number },
): Element | undefined {
  for (const layout of doc.layouts) {
    if (layout.id !== ref.templateId) continue;
    return layout.placeholders[ref.placeholderIdx];
  }
  for (const master of doc.masters) {
    if (master.id !== ref.templateId) continue;
    return master.placeholders[ref.placeholderIdx];
  }
  return undefined;
}

function shapePropertiesFromElement(_el: Element): Record<string, unknown> {
  // T-252 spec §5: UpdateShapeProperties preserves theme bindings — we
  // intentionally omit `shapeBackgroundFill` overrides at the placeholder
  // tier so the inherited theme propagates. The empty record is the minimal
  // valid shape.
  return {};
}

function affineFromElement(el: Element): AffineTransform {
  return {
    scaleX: 1,
    scaleY: 1,
    translateX: el.transform.x * EMU_PER_PX,
    translateY: el.transform.y * EMU_PER_PX,
    unit: 'EMU',
  };
}

function shapeKindToSlidesType(kind: string): string {
  switch (kind) {
    case 'rect':
      return 'RECTANGLE';
    case 'ellipse':
      return 'ELLIPSE';
    case 'star':
      return 'STAR_5';
    case 'polygon':
      return 'PENTAGON';
    case 'line':
      return 'STRAIGHT_LINE';
    default:
      // `custom-path` and any unknowns degrade through the convergence loop's
      // image-fallback path. The spec's `LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED`
      // is emitted by the orchestrator when this returns a placeholder type.
      return 'RECTANGLE';
  }
}

function assetRefToUrl(ref: string): string {
  // Production callers pre-resolve asset:<id> via the import-pptx asset
  // pipeline. For T-252 v1 we accept either the resolved http(s) URL or a
  // bare `asset:<id>` form (round-trip parity tests use the latter).
  return ref;
}
