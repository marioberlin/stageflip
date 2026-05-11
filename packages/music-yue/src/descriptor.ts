// packages/music-yue/src/descriptor.ts
// Static `AdapterDescriptor` for the YuE music adapter (T-433).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'yue'` is the registry key (paired with `modality.kind:
// 'music-gen'`).
// `license.kind` = `'apache-2.0'` clears the per-modality whitelist
// (ADR-008 §D13 line 655: `music-gen` admits `apache-2.0`, `mit`,
// `cc-by`, `proprietary-byo`, `proprietary-vendored`).
// `sandbox.kind` = `'in-process'` — YuE ports run on the host
// process when GPU is available; sidecar isolation lands in T-433a
// if the production wire-up needs it. Mirrors ACE-Step's posture
// (also `in-process` + permissive-license-family).
//
// **Attribution posture** (the YuE-specific delta vs T-432 ACE-Step):
// `capability.outputLicense` = `'attribution-required'`. The provider
// emits a `YUE_ATTRIBUTION` string in every `MusicGenResult`, which
// the T-423 handler bundle propagates into `MediaProvenance.attribution`
// (per T-421 schema) for the exporter / UI to surface. This honors
// Apache 2.0's attribution clause without requiring a schema change.
// There is no separate `license.attribution` boolean on
// `AdapterLicensePosture` — that union is closed
// (`packages/adapters-core/src/adapter-descriptor.ts`). The attribution
// requirement is encoded by `outputLicense` on the modality capability
// envelope (routing-layer facing) plus the runtime string on
// `MusicGenResult` (consumer-bundle facing). Two surfaces, two
// audiences, by design.
//
// The capability shape carries fields beyond the strict
// `MusicGenCapabilityDescriptor` (`maxDurationSec` + `sampleRateHz` for
// the T-424 catalog generator; `supportsStructure` + `qualityHint` as
// descriptive differentiator-surface fields) that are tolerated by
// the T-418 envelope (`z.record(z.unknown())`) but would be rejected
// by the strict `musicGenCapabilityDescriptorSchema` from T-419. Tests
// pass the `validateMusicGenCapability` validator a SUBSET of the
// capability with the catalog-summary + differentiator fields
// stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { MusicGenCapabilityDescriptor } from '@stageflip/asset-gen-contract';

/**
 * Canonical genre list YuE v1 targets. Descriptive — the T-419
 * capability schema does not enumerate; vendors set their own
 * vocabulary. Eight broad buckets matching the YuE model card; mirrors
 * ACE-Step's vocabulary for consistency in the music-gen modality.
 */
export const YUE_GENRES: readonly string[] = [
  'electronic',
  'pop',
  'rock',
  'classical',
  'hip-hop',
  'jazz',
  'ambient',
  'folk',
];

/** Maximum synthesizable duration per call (seconds). Full-song generation. */
export const YUE_MAX_DURATION_S = 300;

/** Sample rate the adapter emits (Hz). CD-quality default. */
export const YUE_SAMPLE_RATE_HZ = 44100;

/**
 * Canonical attribution string the provider emits in every
 * `MusicGenResult.attribution`. T-423 handler bundle propagates this
 * into `MediaProvenance.attribution`; the exporter / UI surfaces it
 * in the credits / final output. Honors Apache 2.0's attribution
 * clause.
 *
 * Constant by design — does NOT enter the cache-key derivation
 * (two YuE calls with the same prompt + params share a cache key
 * regardless of attribution; the attribution is constant for the
 * adapter, not a function of the call).
 */
export const YUE_ATTRIBUTION = 'Generated with YuE (Apache 2.0)';

/**
 * Strict `MusicGenCapabilityDescriptor` subset — passes
 * `validateMusicGenCapability` from T-419. The full
 * `yueDescriptor.capability` also carries the catalog-summary +
 * differentiator-surface fields the T-424 generator + agent UI read.
 *
 * `outputLicense: 'attribution-required'` is the YuE-specific delta
 * — the FIRST adapter to exercise this disposition. ACE-Step (T-432)
 * declares `'permissive'`; YuE declares `'attribution-required'`.
 */
export const yueMusicGenCapability: MusicGenCapabilityDescriptor = {
  genres: YUE_GENRES,
  maxDurationS: YUE_MAX_DURATION_S,
  outputFormats: ['wav', 'mp3'],
  outputLicense: 'attribution-required',
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — YuE is free at the model level (the host
 * pays its own compute). Bucketed as `free` cost-tier per skills-sync's
 * threshold.
 * `latencyMs.{p50,p95} = 8500 / 9800` place the adapter in the
 * catalog's `fast < 10s` tier (skills-sync's `latencyTier` bucketing
 * is `p95 < 10_000` exclusive). Production wire-up (T-433a) calibrates
 * against real numbers; defaulting to 'fast' per the spec when
 * benchmarks are uncertain.
 */
export const yueDescriptor: AdapterDescriptor = {
  id: 'yue',
  modality: { kind: 'music-gen' },
  capability: {
    ...yueMusicGenCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `music-gen` row reads `maxDurationSec` + `sampleRateHz`.
    maxDurationSec: YUE_MAX_DURATION_S,
    sampleRateHz: YUE_SAMPLE_RATE_HZ,
    // Differentiator-surface fields (descriptive; the agent UI / catalog
    // can surface; the routing layer does NOT filter on them in v1):
    supportsStructure: true,
    qualityHint: 'high',
  },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 8_500, p95: 9_800 },
};
