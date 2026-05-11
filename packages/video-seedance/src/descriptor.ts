// packages/video-seedance/src/descriptor.ts
// Static `AdapterDescriptor` for the Seedance 2.0 video adapter (T-430).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'seedance'` is the registry key (paired with `modality.kind:
// 'video-gen'`).
// `license.kind` = `'proprietary-byo'` clears the per-modality whitelist
// (ADR-008 §D13 line 654: `video-gen` admits `apache-2.0`, `mit`,
// `proprietary-byo`, `proprietary-vendored`). Tenant supplies the fal.ai
// API credentials at runtime — StageFlip ships no vendored model
// checkpoint.
// `sandbox.kind` = `'remote-service'` (`baseUrlEnvVar:
// 'FAL_API_BASE_URL'`) — the fal.ai HTTPS API is the production
// endpoint; the env var is the credentials anchor T-430a will read.
//
// **Differentiators vs T-428 / T-429**: same `proprietary-byo` posture
// + same `remote-service` sandbox shape, but:
//   - modality is `video-gen` (not `three-d`);
//   - capability carries `aspectRatios`, `frameRates`, `maxDurationS`,
//     `outputFormats: ['mp4']`, `emitsAudio: true` (rare),
//     `safetyFilters: []`;
//   - the differentiator-surface fields `supportsLipSync: true`,
//     `supportsNativeAudio: true`, `supportedResolutions: ['1080p']`
//     are recorded as catalog-readable extras (the routing layer
//     doesn't filter on them in v1; the agent UI surfaces them);
//   - `latencyMs = 90_000 / 180_000` (~1–3 min typical; still **batch
//     tier**);
//   - `costPerCall.usd = 1.5` — Seedance is `enterprise` cost-tier per
//     skills-sync's bucketing (>$0.10 → enterprise).
//
// The capability shape carries fields beyond the strict
// `VideoGenCapabilityDescriptor` (`maxDurationSec` for the T-424
// catalog generator; `supportsLipSync` / `supportsNativeAudio` /
// `supportedResolutions` as descriptive differentiator-surface fields)
// that are tolerated by the T-418 envelope (`z.record(z.unknown())`)
// but would be rejected by the strict
// `videoGenCapabilityDescriptorSchema` from T-419. Tests pass the
// `validateVideoGenCapability` validator a SUBSET of the capability
// with the catalog-summary + differentiator fields stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { VideoGenCapabilityDescriptor } from '@stageflip/asset-gen-contract';

/** Maximum duration the adapter declares (seconds). */
export const SEEDANCE_MAX_DURATION_S = 15;

/** Frame rate the adapter declares (fps). */
export const SEEDANCE_FRAME_RATE = 30;

/**
 * Env-var name the production wire-up (T-430a) reads to discover the
 * fal.ai HTTPS base URL. Encoded in the descriptor's
 * `sandbox.baseUrlEnvVar`. The stub mode never reads this.
 */
export const SEEDANCE_BASE_URL_ENV_VAR = 'FAL_API_BASE_URL';

/**
 * Strict `VideoGenCapabilityDescriptor` subset — passes
 * `validateVideoGenCapability` from T-419. The full
 * `seedanceDescriptor.capability` also carries the catalog-summary +
 * differentiator-surface fields the T-424 generator + agent UI read.
 */
export const seedanceVideoGenCapability: VideoGenCapabilityDescriptor = {
  aspectRatios: ['16:9', '9:16', '1:1'],
  frameRates: [SEEDANCE_FRAME_RATE],
  maxDurationS: SEEDANCE_MAX_DURATION_S,
  outputFormats: ['mp4'],
  emitsAudio: true,
  safetyFilters: [],
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 1.5` — fal.ai charges per video; tenant pays.
 * Bucketed as `enterprise` by skills-sync's cost-tier helper
 * (>$0.10 → enterprise).
 * `latencyMs.{p50,p95}` reflect the upstream "~1–3 minute typical"
 * claim — this places the adapter in the catalog's `batch < 5min`
 * tier (skills-sync's `latencyTier` bucketing).
 */
export const seedanceDescriptor: AdapterDescriptor = {
  id: 'seedance',
  modality: { kind: 'video-gen' },
  capability: {
    ...seedanceVideoGenCapability,
    // Catalog-summary field read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `video-gen` row reads `aspectRatios` (already on the strict
    // capability) + `maxDurationSec` (the catalog-summary alias for
    // `maxDurationS`).
    maxDurationSec: SEEDANCE_MAX_DURATION_S,
    // Differentiator-surface fields (descriptive; the agent UI / catalog
    // can surface; the routing layer does NOT filter on them in v1):
    supportsLipSync: true,
    supportsNativeAudio: true,
    supportedResolutions: ['1080p'],
  },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: SEEDANCE_BASE_URL_ENV_VAR },
  costPerCall: { usd: 1.5 },
  latencyMs: { p50: 90_000, p95: 180_000 },
};
