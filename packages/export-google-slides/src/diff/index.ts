// packages/export-google-slides/src/diff/index.ts
// Public surface of the diff module. Wired into `convergence/run-loop.ts`.

export { computePixelDiff, DEFAULT_PIXEL_DELTA } from './pixel-diff.js';
export type { PixelDiffOptions, PixelDiffResult } from './pixel-diff.js';
export { findRegions } from './connected-components.js';
export type { DiffRegion, FindRegionsOptions } from './connected-components.js';
export { deriveObservations } from './observe.js';
export type { DeriveObservationsInput } from './observe.js';
