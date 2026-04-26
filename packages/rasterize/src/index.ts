// packages/rasterize/src/index.ts
// @stageflip/rasterize — public surface. Pure-TS PNG-crop primitive consumed
// by T-244 (Google Slides import image-fallback) and T-252 (Google Slides
// export image-fallback). The package has no awareness of import/export
// semantics or AssetStorage — consumers wire upload + loss-flag emission at
// their layer. See `skills/stageflip/reference/rasterize/SKILL.md`.

export { rasterizeFromThumbnail, DEFAULT_PADDING_PX } from './rasterize.js';
export { DEFAULT_COMPRESSION_LEVEL, DEFAULT_FILTER_TYPE } from './encode.js';
export { RasterizeError } from './types.js';
export type {
  BboxPx,
  RasterizeOptions,
  RasterizedAsset,
  RasterizeErrorCode,
} from './types.js';
