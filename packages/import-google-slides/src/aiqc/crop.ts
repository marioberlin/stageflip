// packages/import-google-slides/src/aiqc/crop.ts
// Convert a page PNG + crop bbox into a base64-encoded PNG that can populate
// an LLMContentBlock.image data field.
//
// Design note (T-246): the spec internally conflicts on whether T-246 calls
// T-245's `rasterizeFromThumbnail` to produce a real per-element PNG slice
// (spec §"Dependencies" says yes; spec §"Files to create / modify" says no
// and adds T-244's emitted `pageImageCropPx` is consumed directly). To keep
// T-246 self-contained without depending on `@stageflip/rasterize` (which
// would invert the §"Files to create / modify" contract), this implementation
// sends the FULL page PNG bytes in the image block and embeds the crop bbox
// as text metadata for Gemini. Gemini handles the locality reasoning. A
// follow-on task can swap this out for an actual pixel-level crop via T-245
// if convergence-rate fixtures show benefit.

export interface PageImagePng {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface CropBboxPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Encode a page PNG to base64 (no `data:` URL prefix). Throws when bytes are
 * empty (an empty PNG is never valid input to Gemini).
 */
export function cropPageImagePngBase64(page: PageImagePng, _bbox: CropBboxPx): string {
  if (page.bytes.length === 0) {
    throw new Error('page PNG bytes are empty; cannot send to Gemini');
  }
  // Node Buffer fast path; falls back to btoa-style for browsers if needed.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(page.bytes).toString('base64');
  }
  // Browser fallback — convert via binary string.
  let binary = '';
  for (let i = 0; i < page.bytes.length; i += 1) {
    binary += String.fromCharCode(page.bytes[i] ?? 0);
  }
  return btoa(binary);
}
