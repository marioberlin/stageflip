// packages/testing/src/index.ts
// Public exports for @stageflip/testing — cross-package test utilities.

export {
  DEFAULT_GOLDEN_PATTERN,
  fixtureManifestSchema,
  parityGoldensSchema,
  parityThresholdsSchema,
  parseFixtureManifest,
  resolveGoldenPath,
  type FixtureManifest,
  type ParityGoldens,
  type ParityThresholds,
} from './fixture-manifest.js';
