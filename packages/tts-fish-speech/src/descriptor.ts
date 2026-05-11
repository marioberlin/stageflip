// packages/tts-fish-speech/src/descriptor.ts
// Static `AdapterDescriptor` for the Fish Speech TTS adapter (T-427).
// Verbatim from ADR-007 §D1 + ADR-008 §D5.
//
// `id` = `'fish-speech'` is the registry key (paired with
// `modality.kind: 'tts'`).
// `license.kind` = `'apache-2.0'` clears the per-modality whitelist
// (ADR-008 §D13: `tts` admits `apache-2.0`, `mit`, `proprietary-byo`,
// `proprietary-vendored`).
// `sandbox.kind` = `'sidecar'` (runtime: `'python'`) — the Fish Speech
// reference implementation is a Python module holding the model
// checkpoint; running in-process would require a Python runtime in
// the host. The sidecar boundary defers that to the deployment layer.
//
// **Differentiator vs T-426 Kokoro**: `supportsVoiceClone: true` —
// the adapter accepts cloned voices alongside its 8 library voices
// (one per supported language). Cloned voices activate the §D4
// `TenantVoiceConsentStore` consent path (the provider's
// `synthesize()` calls `assertVoiceConsentIfNeeded` before producing
// audio for a cloned voice).
//
// The capability shape carries two **extra fields** beyond the strict
// `TtsCapabilityDescriptor` (`voiceCount`, `sampleRateHz`) that the
// T-424 catalog generator reads via `readNumber()` — these are
// tolerated by the T-418 envelope (`z.record(z.unknown())`) but would
// be rejected by the strict `ttsCapabilityDescriptorSchema` from
// T-419. Tests pass the `validateTtsCapability` validator a SUBSET of
// the capability with the catalog-summary fields stripped.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { TtsCapabilityDescriptor, TtsVoice } from '@stageflip/asset-gen-contract';

/**
 * The 8 ISO-639-1 language codes Fish Speech v1 supports. Per the
 * upstream model card. New languages require a model upgrade — no
 * descriptor-only expansion is possible.
 */
export const FISH_SPEECH_SUPPORTED_LANGUAGES = [
  'en',
  'zh',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'ru',
] as const;

/**
 * Library voices Fish Speech v1 ships — one default voice per
 * supported language. Cloned voices are per-tenant (the descriptor
 * does NOT enumerate them; the provider treats any `voiceId` not in
 * this list as a cloned voice + activates the §D4 consent path).
 *
 * The list intentionally does NOT use `as const` — the `TtsVoice`
 * type already declares `languages` as `readonly string[]`.
 */
export const FISH_SPEECH_LIBRARY_VOICES: readonly TtsVoice[] = [
  { id: 'fs_en_default', label: 'Default (en)', origin: 'library', languages: ['en'] },
  { id: 'fs_zh_default', label: 'Default (zh)', origin: 'library', languages: ['zh'] },
  { id: 'fs_ja_default', label: 'Default (ja)', origin: 'library', languages: ['ja'] },
  { id: 'fs_ko_default', label: 'Default (ko)', origin: 'library', languages: ['ko'] },
  { id: 'fs_fr_default', label: 'Default (fr)', origin: 'library', languages: ['fr'] },
  { id: 'fs_de_default', label: 'Default (de)', origin: 'library', languages: ['de'] },
  { id: 'fs_es_default', label: 'Default (es)', origin: 'library', languages: ['es'] },
  { id: 'fs_ru_default', label: 'Default (ru)', origin: 'library', languages: ['ru'] },
];

/** Sample rate the adapter emits (Hz). Fish Speech v1 = 22050Hz. */
export const FISH_SPEECH_SAMPLE_RATE_HZ = 22050;

/** Maximum synthesizable duration per call (seconds). */
export const FISH_SPEECH_MAX_DURATION_S = 60;

/**
 * Strict `TtsCapabilityDescriptor` subset — passes
 * `validateTtsCapability` from T-419. The full
 * `fishSpeechDescriptor.capability` also carries the catalog-summary
 * fields (`voiceCount`, `sampleRateHz`) that T-424's generator reads.
 */
export const fishSpeechTtsCapability: TtsCapabilityDescriptor = {
  voices: FISH_SPEECH_LIBRARY_VOICES,
  outputFormats: ['wav'],
  sampleRates: [FISH_SPEECH_SAMPLE_RATE_HZ],
  maxDurationS: FISH_SPEECH_MAX_DURATION_S,
  emitsWordTimestamps: false,
  supportsVoiceClone: true,
};

/**
 * The static `AdapterDescriptor` the host shell registers into its
 * `AdapterRegistry`. The `descriptor` named export (alias) is what
 * `scripts/check-asset-licenses.ts` discovers via dynamic import.
 *
 * `costPerCall.usd = 0` — Fish Speech is free at the model level
 * (Apache 2.0; the host pays its own deployment compute).
 * `latencyMs.{p50,p95}` reflect the upstream "1-3s typical" claim;
 * production wire-up (T-427a) calibrates against real numbers. The
 * `p95 = 3000` keeps the adapter in the catalog's `fast < 10s` tier
 * (skills-sync's `latencyTier` bucketing).
 */
export const fishSpeechDescriptor: AdapterDescriptor = {
  id: 'fish-speech',
  modality: { kind: 'tts' },
  capability: {
    ...fishSpeechTtsCapability,
    // Catalog-summary fields read by skills-sync's `capabilitySummary`
    // helper (T-424 / packages/skills-sync/src/asset-providers-gen.ts).
    voiceCount: FISH_SPEECH_LIBRARY_VOICES.length,
    sampleRateHz: FISH_SPEECH_SAMPLE_RATE_HZ,
  },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'sidecar', runtime: 'python' },
  costPerCall: { usd: 0 },
  latencyMs: { p50: 1200, p95: 3000 },
};
