// packages/export-html5-zip/src/fallback/index.ts
// T-204 barrel — fallback-generator surface.

export type {
  FallbackGeneratorOptions,
  FrameRenderer,
  RgbaFrame,
} from './types.js';

export { encodePng } from './render-png.js';
export { type EncodeGifOptions, encodeGif } from './render-gif.js';
export {
  type CreateFallbackGeneratorInput,
  createFallbackGenerator,
  gifFrameIndices,
  midpointFrameIndex,
} from './generator.js';
export {
  type SolidColorRendererOptions,
  createSolidColorFrameRenderer,
} from './mock-renderer.js';
