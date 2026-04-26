// packages/rasterize/src/crop.ts
// Pure RGBA-buffer crop with padding clamp. Produces the visible-region
// pixel buffer; the encode step turns it back into PNG bytes. The clamp
// behavior (T-245 spec §2 step 2 + AC #7–#9) is the only non-trivial
// algorithmic piece in this package: bbox coordinates outside the source
// are NOT zero-padded — the output is the visible region only.

import type { BboxPx } from './types.js';
import { RasterizeError } from './types.js';

/** Result of a clamp computation: the rectangle inside the source image. */
export interface ClampedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clamp a padded bbox to the source image's extent.
 *
 *   padded.x  = bboxPx.x - paddingPx
 *   padded.y  = bboxPx.y - paddingPx
 *   padded.x2 = bboxPx.x + bboxPx.width  + paddingPx
 *   padded.y2 = bboxPx.y + bboxPx.height + paddingPx
 *
 * Then intersect with the source rect [0, 0, sourceWidth, sourceHeight]. If
 * the intersection is empty, throws `RasterizeError({ code: 'BBOX_OUT_OF_BOUNDS' })`
 * — emitting a 0-pixel asset isn't useful for any consumer.
 */
export function clampBbox(
  bboxPx: BboxPx,
  paddingPx: number,
  sourceWidth: number,
  sourceHeight: number,
): ClampedRect {
  const x1 = bboxPx.x - paddingPx;
  const y1 = bboxPx.y - paddingPx;
  const x2 = bboxPx.x + bboxPx.width + paddingPx;
  const y2 = bboxPx.y + bboxPx.height + paddingPx;

  const cx1 = Math.max(0, x1);
  const cy1 = Math.max(0, y1);
  const cx2 = Math.min(sourceWidth, x2);
  const cy2 = Math.min(sourceHeight, y2);

  const width = cx2 - cx1;
  const height = cy2 - cy1;

  if (width <= 0 || height <= 0) {
    throw new RasterizeError(
      'BBOX_OUT_OF_BOUNDS',
      `bbox {x:${bboxPx.x}, y:${bboxPx.y}, w:${bboxPx.width}, h:${bboxPx.height}} ` +
        `with paddingPx=${paddingPx} does not intersect source ${sourceWidth}×${sourceHeight}`,
    );
  }
  return { x: cx1, y: cy1, width, height };
}

/**
 * Copy a rectangular region out of a row-major RGBA buffer into a tightly
 * packed RGBA buffer of the cropped dimensions. Source rect must already be
 * clamped to the source's extent (callers use `clampBbox`).
 */
export function cropRgba(source: Buffer, sourceWidth: number, rect: ClampedRect): Buffer {
  const out = Buffer.alloc(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row++) {
    const srcStart = ((rect.y + row) * sourceWidth + rect.x) * 4;
    const srcEnd = srcStart + rect.width * 4;
    const dstStart = row * rect.width * 4;
    source.copy(out, dstStart, srcStart, srcEnd);
  }
  return out;
}
