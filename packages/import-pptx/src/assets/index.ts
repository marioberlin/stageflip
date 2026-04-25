// packages/import-pptx/src/assets/index.ts
// T-243 — public surface for asset resolution.

export { inferContentType } from './content-type.js';
export { resolveAssets } from './resolve.js';
export { AssetResolutionError } from './types.js';
export type { AssetResolutionErrorCode, AssetStorage } from './types.js';
