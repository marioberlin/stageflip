// packages/rasterize/src/rasterize.ts
// Entry function. Validates inputs → decodes PNG → clamps bbox → crops RGBA →
// re-encodes PNG → hashes bytes → returns RasterizedAsset. The function is
// async-typed even though the underlying pipeline is synchronous: the public
// surface declared in T-245 spec §1 returns Promise<RasterizedAsset> so
// future variants (e.g. a streaming or worker-thread implementation) don't
// break the contract.

import { createHash } from 'node:crypto';
import { clampBbox, cropRgba } from './crop.js';
import { decodePng } from './decode.js';
import { DEFAULT_COMPRESSION_LEVEL, DEFAULT_FILTER_TYPE, encodePng } from './encode.js';
import type { BboxPx, RasterizeOptions, RasterizedAsset } from './types.js';
import { RasterizeError } from './types.js';

/** Pinned default padding per T-245 spec §1 + AC #2. */
export const DEFAULT_PADDING_PX = 16;

/**
 * Crop a region out of a rendered slide PNG, re-encode it, and return the
 * bytes plus a content-hashed asset id. Pure: no I/O, no clock, no random.
 *
 * The bbox is in source-pixel coordinates (NOT EMU). Padding is added on
 * each side, then the result is clamped to the source's extent — coordinates
 * outside the source are NOT zero-padded; the output is the visible region
 * only.
 *
 * Determinism: same `pageImage` + `bboxPx` + `opts` produces byte-identical
 * `bytes` and `contentHashId` across calls. See spec §3.
 *
 * @throws {RasterizeError} when inputs are invalid (`INVALID_PNG`,
 *   `BBOX_INVALID`, `BBOX_OUT_OF_BOUNDS`, `OPTIONS_INVALID`) or pngjs encode
 *   fails (`ENCODE_FAILED`).
 */
export async function rasterizeFromThumbnail(
  pageImage: Uint8Array,
  bboxPx: BboxPx,
  opts: RasterizeOptions = {},
): Promise<RasterizedAsset> {
  validateBbox(bboxPx);
  const paddingPx = opts.paddingPx ?? DEFAULT_PADDING_PX;
  const compressionLevel = opts.compressionLevel ?? DEFAULT_COMPRESSION_LEVEL;
  const filterType = opts.filterType ?? DEFAULT_FILTER_TYPE;
  validateOptions(paddingPx, compressionLevel, filterType);

  const decoded = decodePng(pageImage);
  const rect = clampBbox(bboxPx, paddingPx, decoded.width, decoded.height);
  const cropped = cropRgba(decoded.data, decoded.width, rect);
  const bytes = encodePng({
    width: rect.width,
    height: rect.height,
    rgba: cropped,
    compressionLevel,
    filterType,
  });
  const contentHashId = createHash('sha256').update(bytes).digest('hex');

  return {
    bytes,
    contentType: 'image/png',
    contentHashId,
    width: rect.width,
    height: rect.height,
  };
}

function validateBbox(bbox: BboxPx): void {
  if (
    Number.isNaN(bbox.x) ||
    Number.isNaN(bbox.y) ||
    Number.isNaN(bbox.width) ||
    Number.isNaN(bbox.height)
  ) {
    throw new RasterizeError('BBOX_INVALID', 'bbox contains NaN');
  }
  if (bbox.width <= 0 || bbox.height <= 0) {
    throw new RasterizeError(
      'BBOX_INVALID',
      `bbox width (${bbox.width}) and height (${bbox.height}) must both be > 0`,
    );
  }
}

function validateOptions(paddingPx: number, compressionLevel: number, filterType: number): void {
  if (Number.isNaN(paddingPx) || paddingPx < 0) {
    throw new RasterizeError(
      'OPTIONS_INVALID',
      `paddingPx must be a non-negative number; got ${paddingPx}`,
    );
  }
  if (
    Number.isNaN(compressionLevel) ||
    !Number.isInteger(compressionLevel) ||
    compressionLevel < 0 ||
    compressionLevel > 9
  ) {
    throw new RasterizeError(
      'OPTIONS_INVALID',
      `compressionLevel must be an integer in 0..9; got ${compressionLevel}`,
    );
  }
  // pngjs 7 accepts -1 (sentinel for "all filters / adaptive") or one of
  // 0..4 (the 5 PNG filter algorithms). Anything else makes the packer's
  // `filters[sel]` lookup undefined.
  if (
    Number.isNaN(filterType) ||
    !Number.isInteger(filterType) ||
    filterType < -1 ||
    filterType > 4
  ) {
    throw new RasterizeError(
      'OPTIONS_INVALID',
      `filterType must be -1 (all filters) or an integer in 0..4; got ${filterType}`,
    );
  }
}
