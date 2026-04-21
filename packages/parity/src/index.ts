// packages/parity/src/index.ts
// Public surface of `@stageflip/parity` — the T-100 parity harness.
//
// Consumers (parity CLI T-101, CI gate T-103, visual-diff viewer T-105)
// import from this file. Internals stay private; swap out ssim.js or
// PNG decode without touching call sites.

export type { ParityImageData, Region } from './image-data';
export { assertSameDimensions, crop, loadPng } from './image-data';

export type { PsnrOptions } from './psnr';
export { psnr } from './psnr';

export type { SsimOptions } from './ssim';
export { ssim } from './ssim';

export type { ParityThresholds } from './thresholds';
export { DEFAULT_THRESHOLDS, resolveThresholds } from './thresholds';

export type { FrameInput, FrameScore, ScoreOptions, ScoreReport } from './score';
export { scoreFrames } from './score';
