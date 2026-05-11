// packages/adapter-regression/src/index.ts
// Public surface of `@stageflip/adapter-regression` (T-435 — Phase 14 β
// closer).
//
// The package ships a CI gate that walks each of the 9 reference
// adapters (T-426..T-434), feeds it a canonical input, and asserts the
// resulting `cacheKey` + canonicalized-output SHA-256 match a recorded
// per-adapter snapshot at `snapshots/<adapter-id>.json`.
//
// Importing this module has NO side effects — adapter instantiation
// happens only when a caller invokes `buildAdapter()`.

export { ADAPTER_IDS, ADAPTER_MODALITY, canonicalInputFor, isAdapterId } from './canonical-input.js';
export type { AdapterId, CanonicalInput } from './canonical-input.js';

export { buildAdapter } from './adapters.js';

export {
  canonicalSha256Hex,
  descriptorSha256,
  outputSha256,
  parseAdapterRegressionSnapshot,
  serializeAdapterRegressionSnapshot,
} from './snapshot-format.js';
export type {
  AdapterRegressionSnapshot,
  SampleInputSnapshot,
} from './snapshot-format.js';

export { formatVerdict, runAdapterAgainstSnapshot } from './snapshot-runner.js';
export type {
  AdapterInvocationResult,
  AdapterRegressionVerdict,
  RegressableAdapter,
  SampleDrift,
} from './snapshot-runner.js';
