// packages/sfx-stable-audio/src/descriptor.ts
// Static `AdapterDescriptor` for the Stable Audio Open SFX adapter
// (T-434). Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'stable-audio-open'` is the registry key (paired with
// `modality.kind: 'sfx'`).
// `license.kind` = `'apache-2.0'` clears the per-modality whitelist
// (ADR-008 §D13 line 656: `sfx` admits `apache-2.0`, `mit`, `cc-by`,
// `proprietary-byo`, `proprietary-vendored`).
// `sandbox.kind` = `'in-process'` — Stable Audio Open is a short-form
// diffusion model that runs on consumer GPU; in-process posture
// mirrors ACE-Step / YuE. Sidecar isolation lands in T-434a if the
// production wire-up needs it.
//
// The capability shape carries fields beyond the strict
// `SfxCapabilityDescriptor` (`maxDurationSec` + `sampleRateHz` for
// the T-424 catalog generator; `supportsOneShot` + `qualityHint` as
// descriptive differentiator-surface fields) that are tolerated by
// the T-418 envelope (`z.record(z.unknown())`) but would be rejected
// by the strict `sfxCapabilityDescriptorSchema` from T-419. Tests
// pass the `validateSfxCapability` validator a SUBSET of the
// capability with the catalog-summary + differentiator fields
// stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { SfxCapabilityDescriptor } from '@stageflip/asset-gen-contract';

/** Maximum synthesizable duration per call (seconds). Short-form SFX. */
export const STABLE_AUDIO_MAX_DURATION_S = 30;

/** Sample rate the adapter emits (Hz). CD-quality default. */
export const STABLE_AUDIO_SAMPLE_RATE_HZ = 44100;

/**
 * Strict `SfxCapabilityDescriptor` subset — passes
 * `validateSfxCapability` from T-419. The full
 * `stableAudioDescriptor.capability` also carries the catalog-summary
 * + differentiator-surface fields the T-424 generator + agent UI read.
 */
export const stableAudioSfxCapability: SfxCapabilityDescriptor = {
  outputFormats: ['wav', 'mp3'],
  sampleRates: [STABLE_AUDIO_SAMPLE_RATE_HZ],
  maxDurationS: STABLE_AUDIO_MAX_DURATION_S,
  supportsLoop: true,
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — Stable Audio Open is free at the model
 * level (the host pays its own compute). Bucketed as `free` cost-tier
 * per skills-sync's threshold.
 * `latencyMs.{p50,p95} = 5000 / 8000` reflect typical short-form
 * diffusion-model inference times on consumer GPU and place the
 * adapter in the catalog's `fast < 10s` tier (skills-sync's
 * `latencyTier` bucketing is `p95 < 10_000` exclusive). Production
 * wire-up (T-434a) calibrates against real numbers.
 */
export const stableAudioDescriptor: AdapterDescriptor = {
  id: 'stable-audio-open',
  modality: { kind: 'sfx' },
  capability: {
    ...stableAudioSfxCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `sfx` row reads `maxDurationSec` + `sampleRateHz`.
    maxDurationSec: STABLE_AUDIO_MAX_DURATION_S,
    sampleRateHz: STABLE_AUDIO_SAMPLE_RATE_HZ,
    // Differentiator-surface fields (descriptive; the agent UI / catalog
    // can surface; the routing layer does NOT filter on them in v1):
    supportsOneShot: true,
    qualityHint: 'high',
  },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 5_000, p95: 8_000 },
};
