// packages/video-runway/src/descriptor.ts
// Static `AdapterDescriptor` for the Runway Gen-4 video adapter (T-431).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'runway'` is the registry key (paired with `modality.kind:
// 'video-gen'`).
// `license.kind` = `'proprietary-byo'` clears the per-modality whitelist
// (ADR-008 §D13 line 654: `video-gen` admits `apache-2.0`, `mit`,
// `proprietary-byo`, `proprietary-vendored`). Tenant supplies the
// Runway API credentials at runtime — StageFlip ships no vendored
// model checkpoint.
// `sandbox.kind` = `'remote-service'` (`baseUrlEnvVar:
// 'RUNWAY_API_BASE_URL'`) — the Runway HTTPS API is the production
// endpoint; the env var is the credentials anchor T-431a will read.
//
// **Differentiators vs T-430 (Seedance)** — both are `video-gen` +
// `proprietary-byo` + `remote-service`, but:
//   - capability carries broader `aspectRatios` (5 entries vs 3);
//   - `frameRates: [24]` (film-style; cinematic) vs Seedance's `[30]`;
//   - `maxDurationS: 10` (conservative Runway Gen-4 cap) vs `15`;
//   - `emitsAudio: false` — Runway Gen-4 produces silent video; THIS
//     IS THE PRIMARY DIFFERENTIATOR. Pairing audio is an orchestrator
//     concern (T-436 may pair with a TTS / music-gen adapter);
//   - differentiator-surface flags `supportsLipSync: false`,
//     `supportsNativeAudio: false`, `supportedResolutions: ['1080p',
//     '4k']`, `qualityHint: 'highest'` (production-tier) are recorded
//     as catalog-readable extras (the routing layer doesn't filter on
//     them in v1; the agent UI surfaces them);
//   - `latencyMs = 90_000 / 180_000` (same batch tier as Seedance);
//   - `costPerCall.usd = 2.0` — Runway Gen-4 production-tier
//     commercial pricing; bucketed `enterprise` cost-tier per
//     skills-sync's >$0.10 threshold.
//
// The capability shape carries fields beyond the strict
// `VideoGenCapabilityDescriptor` (`maxDurationSec` for the T-424
// catalog generator; `supportsLipSync` / `supportsNativeAudio` /
// `supportedResolutions` / `qualityHint` as descriptive
// differentiator-surface fields) that are tolerated by the T-418
// envelope (`z.record(z.unknown())`) but would be rejected by the
// strict `videoGenCapabilityDescriptorSchema` from T-419. Tests
// pass the `validateVideoGenCapability` validator a SUBSET of the
// capability with the catalog-summary + differentiator fields
// stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { VideoGenCapabilityDescriptor } from '@stageflip/asset-gen-contract';

/** Maximum duration the adapter declares (seconds). */
export const RUNWAY_MAX_DURATION_S = 10;

/** Frame rate the adapter declares (fps; film-style / cinematic). */
export const RUNWAY_FRAME_RATE = 24;

/**
 * Env-var name the production wire-up (T-431a) reads to discover the
 * Runway HTTPS base URL. Encoded in the descriptor's
 * `sandbox.baseUrlEnvVar`. The stub mode never reads this.
 */
export const RUNWAY_BASE_URL_ENV_VAR = 'RUNWAY_API_BASE_URL';

/**
 * Strict `VideoGenCapabilityDescriptor` subset — passes
 * `validateVideoGenCapability` from T-419. The full
 * `runwayDescriptor.capability` also carries the catalog-summary +
 * differentiator-surface fields the T-424 generator + agent UI read.
 */
export const runwayVideoGenCapability: VideoGenCapabilityDescriptor = {
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  frameRates: [RUNWAY_FRAME_RATE],
  maxDurationS: RUNWAY_MAX_DURATION_S,
  outputFormats: ['mp4'],
  emitsAudio: false,
  safetyFilters: [],
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 2.0` — Runway charges per video; tenant pays.
 * Bucketed as `enterprise` by skills-sync's cost-tier helper
 * (>$0.10 → enterprise; Runway Gen-4 production-grade pricing).
 * `latencyMs.{p50,p95}` reflect the upstream "~1–3 minute typical"
 * claim — this places the adapter in the catalog's `batch < 5min`
 * tier (skills-sync's `latencyTier` bucketing).
 */
export const runwayDescriptor: AdapterDescriptor = {
  id: 'runway',
  modality: { kind: 'video-gen' },
  capability: {
    ...runwayVideoGenCapability,
    // Catalog-summary field read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `video-gen` row reads `aspectRatios` (already on the strict
    // capability) + `maxDurationSec` (the catalog-summary alias for
    // `maxDurationS`).
    maxDurationSec: RUNWAY_MAX_DURATION_S,
    // Differentiator-surface fields (descriptive; the agent UI / catalog
    // can surface; the routing layer does NOT filter on them in v1):
    supportsLipSync: false,
    supportsNativeAudio: false,
    supportedResolutions: ['1080p', '4k'],
    qualityHint: 'highest',
  },
  license: { kind: 'proprietary-byo' },
  sandbox: { kind: 'remote-service', baseUrlEnvVar: RUNWAY_BASE_URL_ENV_VAR },
  costPerCall: { usd: 2.0 },
  latencyMs: { p50: 90_000, p95: 180_000 },
};
