// packages/tts-kokoro/src/descriptor.ts
// Static `AdapterDescriptor` for the Kokoro TTS adapter (T-426).
// Verbatim from ADR-007 §D1 + ADR-008 §D5.
//
// `id` = `'kokoro'` is the registry key (paired with `modality.kind: 'tts'`).
// `license.kind` = `'apache-2.0'` clears the per-modality whitelist
// (ADR-008 §D13: `tts` admits `apache-2.0`, `mit`, `proprietary-byo`,
// `proprietary-vendored`).
// `sandbox.kind` = `'in-process'` — Kokoro is small enough (~82M params) to
// run inline in the host process; sidecar isolation lands in T-426a if the
// production wire-up needs it.
//
// The capability shape carries two **extra fields** beyond the strict
// `TtsCapabilityDescriptor` (`voiceCount`, `sampleRateHz`) that the T-424
// catalog generator reads via `readNumber()` — these are tolerated by
// the T-418 envelope (`z.record(z.unknown())`) but would be rejected by
// the strict `ttsCapabilityDescriptorSchema` from T-419. Tests pass the
// `validateTtsCapability` validator a SUBSET of the capability with the
// catalog-summary fields stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { TtsCapabilityDescriptor, TtsVoice } from '@stageflip/asset-gen-contract';

/**
 * Voice list Kokoro v1 ships. Every voice is a library voice (no
 * cloning); every voice is English (US or GB accent denoted by `a`/`b`
 * prefix per the upstream Kokoro convention). The list intentionally
 * does NOT use `as const` — the `TtsVoice` type already declares
 * `languages` as `readonly string[]`.
 */
export const KOKORO_VOICES: readonly TtsVoice[] = [
  { id: 'af_bella', label: 'Bella (en, US, female)', origin: 'library', languages: ['en'] },
  { id: 'af_nicole', label: 'Nicole (en, US, female)', origin: 'library', languages: ['en'] },
  { id: 'af_sarah', label: 'Sarah (en, US, female)', origin: 'library', languages: ['en'] },
  { id: 'am_adam', label: 'Adam (en, US, male)', origin: 'library', languages: ['en'] },
  { id: 'am_michael', label: 'Michael (en, US, male)', origin: 'library', languages: ['en'] },
  { id: 'bf_emma', label: 'Emma (en, GB, female)', origin: 'library', languages: ['en'] },
  { id: 'bf_isabella', label: 'Isabella (en, GB, female)', origin: 'library', languages: ['en'] },
  { id: 'bm_george', label: 'George (en, GB, male)', origin: 'library', languages: ['en'] },
  { id: 'bm_lewis', label: 'Lewis (en, GB, male)', origin: 'library', languages: ['en'] },
  {
    id: 'af_default',
    label: 'Default voice (en, US, female)',
    origin: 'library',
    languages: ['en'],
  },
];

/** Sample rate the adapter emits (Hz). Kokoro v1 = 24000Hz. */
export const KOKORO_SAMPLE_RATE_HZ = 24000;

/** Maximum synthesizable duration per call (seconds). */
export const KOKORO_MAX_DURATION_S = 60;

/**
 * Strict `TtsCapabilityDescriptor` subset — passes
 * `validateTtsCapability` from T-419. The full `kokoroDescriptor.capability`
 * also carries the catalog-summary fields (`voiceCount`, `sampleRateHz`)
 * that T-424's generator reads.
 */
export const kokoroTtsCapability: TtsCapabilityDescriptor = {
  voices: KOKORO_VOICES,
  outputFormats: ['wav'],
  sampleRates: [KOKORO_SAMPLE_RATE_HZ],
  maxDurationS: KOKORO_MAX_DURATION_S,
  emitsWordTimestamps: false,
  supportsVoiceClone: false,
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — Kokoro is free at the model level (the host
 * pays its own compute). `latencyMs.{p50,p95}` reflect the upstream
 * "sub-0.3s" claim; production wire-up (T-426a) calibrates against
 * real numbers.
 */
export const kokoroDescriptor: AdapterDescriptor = {
  id: 'kokoro',
  modality: { kind: 'tts' },
  capability: {
    ...kokoroTtsCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts).
    voiceCount: KOKORO_VOICES.length,
    sampleRateHz: KOKORO_SAMPLE_RATE_HZ,
  },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 200, p95: 300 },
};
