// packages/rasterize/src/types.ts
// Public types + error class for @stageflip/rasterize. The package surface is
// intentionally tiny: one entry function (`rasterizeFromThumbnail`) plus the
// types declared here. See T-245 spec §1 (public surface) + §5 (error
// taxonomy). Consumers (T-244 import image-fallback, T-252 export
// image-fallback) translate `RasterizeError` into their domain's loss flags.

/**
 * Pixel-space bounding box. Coordinates are NOT EMUs; consumers convert
 * before calling. The box may extend past the source image's bounds — the
 * crop algorithm clamps to the visible region (see spec §2 step 2).
 */
export interface BboxPx {
  /** Top-left x in source-pixel coordinates. */
  x: number;
  /** Top-left y in source-pixel coordinates. */
  y: number;
  /** Width in source pixels. Must be > 0. */
  width: number;
  /** Height in source pixels. Must be > 0. */
  height: number;
}

/**
 * Tunables for the rasterize pass. All optional; defaults are pinned to keep
 * output byte-deterministic across calls.
 */
export interface RasterizeOptions {
  /**
   * Padding in pixels added to each side of the bbox before cropping. Helps
   * the consumer recover anti-aliased edges and sub-pixel overflows the
   * source bbox didn't quite include. Default 16.
   */
  paddingPx?: number;
  /**
   * PNG compression level for the re-encode (0–9). Default 6 — the pngjs
   * default and a reasonable size/speed compromise. Different levels produce
   * different bytes; consumers depending on byte-stable hashes should not
   * override unless they pin the value.
   */
  compressionLevel?: number;
  /**
   * PNG filter type for the re-encode. Default `pngjs.constants.PNG_ALL_FILTERS`
   * (4) — per-row adaptive. Different filter types produce different bytes.
   */
  filterType?: number;
}

/**
 * The rasterize result. Consumers pass `bytes` to `AssetStorage.put` (along
 * with `contentType`); the storage's returned id is the source of truth, but
 * `contentHashId` is a stable hint suitable for dedup keys.
 */
export interface RasterizedAsset {
  /** PNG bytes of the cropped region. */
  bytes: Uint8Array;
  /** Always `'image/png'` in v1. */
  contentType: 'image/png';
  /**
   * sha256(bytes) hex, full 64 chars. NOT truncated — mirrors
   * `packages/import-pptx/src/assets/resolve.ts`'s asset-side precedent.
   * (`@stageflip/loss-flags` truncates to 12 because flag IDs have a small
   * surface; asset content has a much larger one.)
   */
  contentHashId: string;
  /** Cropped width in pixels (post-padding, post-clamp). */
  width: number;
  /** Cropped height in pixels (post-padding, post-clamp). */
  height: number;
}

/** Discriminator vocabulary for `RasterizeError`. */
export type RasterizeErrorCode =
  /** Source bytes don't decode as PNG (signature mismatch / pngjs threw). */
  | 'INVALID_PNG'
  /** Bbox doesn't intersect the image at all. */
  | 'BBOX_OUT_OF_BOUNDS'
  /** Negative width/height/x/y or NaN in the bbox. */
  | 'BBOX_INVALID'
  /** compressionLevel out of 0–9, paddingPx negative, etc. */
  | 'OPTIONS_INVALID'
  /** pngjs encode threw (unexpected; surfaces upstream pngjs failures). */
  | 'ENCODE_FAILED';

/**
 * Domain-typed error thrown by `rasterizeFromThumbnail`. Consumers translate
 * `code` into their own loss-flag taxonomy. Carries an optional `cause` so
 * the underlying pngjs error can be surfaced for debugging.
 */
export class RasterizeError extends Error {
  readonly code: RasterizeErrorCode;
  override readonly cause?: unknown;

  constructor(code: RasterizeErrorCode, message: string, cause?: unknown) {
    super(`[${code}] ${message}`);
    this.name = 'RasterizeError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}
