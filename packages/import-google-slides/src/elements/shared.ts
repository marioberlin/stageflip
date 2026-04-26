// packages/import-google-slides/src/elements/shared.ts
// Shared helpers used by per-element emit functions: id sanitization,
// transform construction (px from world bbox), inheritsFrom resolution.

import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';

/**
 * Make an element id safe for the schema's `idSchema` regex
 * (`/^[A-Za-z0-9_-]+$/`). Slides API objectIds are usually safe but we
 * defensively replace anything else.
 */
export function makeElementId(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '_');
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Build a schema-compliant `transform` (x, y, width, height in render-pixel
 * coords) from a world-space bbox. Width/height fall back to 1 to satisfy
 * the schema's `positive()` constraint; degenerate elements (zero-area) are
 * rare in Slides but can occur on placeholders.
 */
export function transformFromBbox(bbox: BboxPx): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
} {
  return {
    x: bbox.x,
    y: bbox.y,
    width: Math.max(bbox.width, 1),
    height: Math.max(bbox.height, 1),
    rotation: 0,
    opacity: 1,
  };
}

/**
 * Look up a placeholder's parent template id. Spec §6: when
 * `placeholder.parentObjectId` resolves to a parsed layout/master, set
 * `inheritsFrom: { templateId: layoutId, placeholderIdx: index }`.
 *
 * Transitive: if the layout exists but doesn't define the placeholderIdx,
 * the master may still — but per AC #29, the slide element's `templateId` is
 * the LAYOUT id (not the master); the RIR `applyInheritance` pass walks the
 * chain.
 *
 * Returns the resolved templateId or `null` if the parentObjectId doesn't
 * match any parsed layout/master.
 */
export function resolveInheritsFrom(
  apiEl: ApiPageElement,
  layoutIds: ReadonlySet<string>,
  masterIds: ReadonlySet<string>,
): { templateId: string; placeholderIdx: number } | null {
  const ph = apiEl.shape?.placeholder;
  if (!ph || ph.parentObjectId === undefined || ph.index === undefined) return null;
  const parentId = ph.parentObjectId;
  if (layoutIds.has(parentId)) {
    return { templateId: parentId, placeholderIdx: ph.index };
  }
  if (masterIds.has(parentId)) {
    return { templateId: parentId, placeholderIdx: ph.index };
  }
  return null;
}

/** Pad a bbox by `padPx` on each side (used for the residual `pageImageCropPx`). */
export function padBbox(bbox: BboxPx, padPx: number): BboxPx {
  return {
    x: bbox.x - padPx,
    y: bbox.y - padPx,
    width: bbox.width + 2 * padPx,
    height: bbox.height + 2 * padPx,
  };
}
