// packages/music-acestep/src/descriptor.ts
// Static `AdapterDescriptor` for the ACE-Step music adapter (T-432).
// Verbatim from ADR-007 §D1 + ADR-008 §D6.
//
// `id` = `'ace-step'` is the registry key (paired with
// `modality.kind: 'music-gen'`).
// `license.kind` = `'mit'` clears the per-modality whitelist (ADR-008
// §D13 line 655: `music-gen` admits `apache-2.0`, `mit`, `cc-by`,
// `proprietary-byo`, `proprietary-vendored`).
// `sandbox.kind` = `'in-process'` — ACE-Step ONNX is in-process-runnable
// on supported (GPU-equipped) hardware; sidecar isolation lands in
// T-432a if the production wire-up needs it. Mirrors Kokoro's posture
// (also `in-process` + permissive license).
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
 * Canonical genre list ACE-Step v1 targets. Descriptive — the T-419
 * capability schema does not enumerate; vendors set their own
 * vocabulary. Eight broad buckets matching the ACE-Step model card.
 */
export const ACE_STEP_GENRES: readonly string[] = [
  'electronic',
  'pop',
  'rock',
  'classical',
  'hip-hop',
  'jazz',
  'ambient',
  'folk',
];

/** Maximum synthesizable duration per call (seconds). 5-minute track. */
export const ACE_STEP_MAX_DURATION_S = 300;

/** Sample rate the adapter emits (Hz). CD-quality default. */
export const ACE_STEP_SAMPLE_RATE_HZ = 44100;

/**
 * Strict `MusicGenCapabilityDescriptor` subset — passes
 * `validateMusicGenCapability` from T-419. The full
 * `aceStepDescriptor.capability` also carries the catalog-summary +
 * differentiator-surface fields the T-424 generator + agent UI read.
 */
export const aceStepMusicGenCapability: MusicGenCapabilityDescriptor = {
  genres: ACE_STEP_GENRES,
  maxDurationS: ACE_STEP_MAX_DURATION_S,
  outputFormats: ['wav', 'mp3'],
  outputLicense: 'permissive',
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — ACE-Step is free at the model level (the
 * host pays its own compute). Bucketed as `free` cost-tier per
 * skills-sync's threshold.
 * `latencyMs.{p50,p95} = 8000 / 9500` reflect the upstream "5-minute
 * track in <10s on RTX 3090" claim — strictly < 10s places the
 * adapter in the catalog's `fast < 10s` tier (skills-sync's
 * `latencyTier` bucketing is `p95 < 10_000` exclusive). Production
 * wire-up (T-432a) calibrates against real numbers.
 */
export const aceStepDescriptor: AdapterDescriptor = {
  id: 'ace-step',
  modality: { kind: 'music-gen' },
  capability: {
    ...aceStepMusicGenCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts):
    // `music-gen` row reads `maxDurationSec` + `sampleRateHz`.
    maxDurationSec: ACE_STEP_MAX_DURATION_S,
    sampleRateHz: ACE_STEP_SAMPLE_RATE_HZ,
    // Differentiator-surface fields (descriptive; the agent UI / catalog
    // can surface; the routing layer does NOT filter on them in v1):
    supportsStructure: true,
    qualityHint: 'high',
  },
  license: { kind: 'mit' },
  sandbox: { kind: 'in-process' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 8_000, p95: 9_500 },
};
