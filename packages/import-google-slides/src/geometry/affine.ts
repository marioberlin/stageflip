// packages/import-google-slides/src/geometry/affine.ts
// Package-local 2×3 affine math for Slides API transforms. T-244 spec §3
// explicitly forbids extracting helpers from `@stageflip/import-pptx`'s
// domain-specific accumulator (chOff/chExt + rotation-around-center). The
// Slides API exposes a true 2×3 affine `{scaleX, scaleY, translateX,
// translateY, shearX, shearY}`; composition is the standard matrix product.

import type { ApiAffineTransform } from '../api/types.js';

/**
 * Resolved 2×3 affine matrix. Column-major notation matching how Slides
 * documents the transform applied to the unit square — i.e., for a point
 * (x, y) the world coords are
 *   X = scaleX * x + shearX * y + translateX
 *   Y = shearY * x + scaleY * y + translateY
 */
export interface Affine2x3 {
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  translateX: number;
  translateY: number;
}

/** Identity transform — neutral element for `composeAffines`. */
export const IDENTITY: Affine2x3 = {
  scaleX: 1,
  scaleY: 1,
  shearX: 0,
  shearY: 0,
  translateX: 0,
  translateY: 0,
};

/**
 * Convert an `ApiAffineTransform` (any field optional, default identity) to a
 * resolved `Affine2x3`. Slides API defaults: scale = 1, shear/translate = 0.
 */
export function fromApi(t: ApiAffineTransform | undefined): Affine2x3 {
  if (!t) return { ...IDENTITY };
  return {
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    shearX: t.shearX ?? 0,
    shearY: t.shearY ?? 0,
    translateX: t.translateX ?? 0,
    translateY: t.translateY ?? 0,
  };
}

/**
 * Compose two affines. `compose(parent, child)` returns the matrix M such
 * that applying M to a point in the child's local space yields the parent's
 * world space. Equivalent to the matrix product P · C where each affine is
 * the augmented 3×3:
 *
 *   [ scaleX  shearX  translateX ]
 *   [ shearY  scaleY  translateY ]
 *   [   0       0         1      ]
 *
 * Pin (AC #6): child translateX=100 inside parent {translateX=200,
 * scaleX=2} → world translateX = 200 + 2*100 = 400.
 */
export function composeAffines(parent: Affine2x3, child: Affine2x3): Affine2x3 {
  // Matrix product P · C, expanded.
  const a = parent.scaleX * child.scaleX + parent.shearX * child.shearY;
  const b = parent.scaleX * child.shearX + parent.shearX * child.scaleY;
  const c = parent.scaleX * child.translateX + parent.shearX * child.translateY + parent.translateX;
  const d = parent.shearY * child.scaleX + parent.scaleY * child.shearY;
  const e = parent.shearY * child.shearX + parent.scaleY * child.scaleY;
  const f = parent.shearY * child.translateX + parent.scaleY * child.translateY + parent.translateY;
  return {
    scaleX: a,
    shearX: b,
    translateX: c,
    shearY: d,
    scaleY: e,
    translateY: f,
  };
}

export interface PageSizeEmu {
  width: number;
  height: number;
}

export interface RenderSize {
  width: number;
  height: number;
}

/**
 * Per-axis EMU-to-pixel scale factor. Pinned by AC #7: 9144000 × 5143500 EMU
 * (default 16:9 page) at 1600×900 → ~0.0001749 (within 1e-9).
 */
export function emuToPx(args: {
  pageSizeEmu: PageSizeEmu;
  renderSize: RenderSize;
}): { x: number; y: number } {
  return {
    x: args.renderSize.width / args.pageSizeEmu.width,
    y: args.renderSize.height / args.pageSizeEmu.height,
  };
}

export interface BboxPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Apply a world-space affine (already composed with parent transforms) plus
 * a per-axis EMU→px scale to a unit square sized by the element's API `size`.
 * Returns the axis-aligned bounding box in render pixels. Slides' transform
 * acts on the local coordinate frame whose unit square has dimensions
 * (size.width, size.height) — applying it gives the world (EMU) coords.
 *
 * The result clips to the slide bounds; out-of-bounds elements are still
 * emitted with their world bbox (clipping is the renderer's concern).
 */
export function applyAffineToUnitSquare(args: {
  worldTransform: Affine2x3;
  sizeEmu: { width: number; height: number };
  emuPerPx: { x: number; y: number };
}): BboxPx {
  const { worldTransform, sizeEmu, emuPerPx } = args;
  // Four corners of the local box (0,0), (w,0), (0,h), (w,h).
  const cornersLocal = [
    [0, 0],
    [sizeEmu.width, 0],
    [0, sizeEmu.height],
    [sizeEmu.width, sizeEmu.height],
  ] as const;
  const cornersWorldEmu = cornersLocal.map(([lx, ly]) => ({
    x: worldTransform.scaleX * lx + worldTransform.shearX * ly + worldTransform.translateX,
    y: worldTransform.shearY * lx + worldTransform.scaleY * ly + worldTransform.translateY,
  }));
  const xs = cornersWorldEmu.map((p) => p.x * emuPerPx.x);
  const ys = cornersWorldEmu.map((p) => p.y * emuPerPx.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
