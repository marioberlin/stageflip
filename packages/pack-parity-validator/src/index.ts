// packages/pack-parity-validator/src/index.ts
// T-549 — Public surface of `@stageflip/pack-parity-validator`.
//
// Marketplace publish handler (T-536, future) and pack-loader install
// gate (T-495) consume this package to score every parity fixture a
// pack ships against the cluster's PSNR + SSIM thresholds.

export {
  type ClusterPsnrThreshold,
  DEFAULT_CLUSTER_THRESHOLDS,
  getClusterThreshold,
  resolveClusterThreshold,
} from './thresholds/cluster-thresholds.js';

export {
  type FixtureValidationInput,
  type FixtureValidationReason,
  type FixtureValidationResult,
  validateFixture,
} from './validator/validate-fixture.js';

export {
  type PackFixtureManifest,
  type PackFixtureValidationInput,
  type PackParityReport,
  type PackParityReportEntry,
  type PackParityReportSummary,
  validatePackFixtures,
} from './validator/validate-pack.js';

export { formatPackParityReport } from './report/parity-report.js';
