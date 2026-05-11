// packages/asset-gen-contract/src/tts-provider.ts
// `TTSProvider` interface + capability Zod schema + capability validator.
// Verbatim from ADR-008 §D5. Extends `AdapterDescriptor` from T-418.
// `synthesize()` MUST call `tenantVoiceConsentStore.assertActive` before
// issuing the upstream call when `voiceId` is a cloned voice (per §D4).

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Voice / output enums (ADR-008 §D5)
// ----------------------------------------------------------------------------

/** Audio container formats a TTS adapter may emit. Per ADR-008 §D5. */
export const TTS_OUTPUT_FORMATS = ['wav', 'mp3', 'opus', 'flac'] as const;
export type TtsOutputFormat = (typeof TTS_OUTPUT_FORMATS)[number];

/**
 * Voice origin. Library voices bypass the consent check; cloned voices
 * trigger §D4 enforcement on every call.
 */
export const TTS_VOICE_ORIGINS = ['library', 'cloned-per-tenant'] as const;
export type TtsVoiceOrigin = (typeof TTS_VOICE_ORIGINS)[number];

// ----------------------------------------------------------------------------
// TtsVoice
// ----------------------------------------------------------------------------

/**
 * A voice entry the adapter exposes. Per ADR-008 §D5.
 *
 * Distinguishes consent-gated cloned voices from free-to-use library
 * voices via `origin`. The plugin manifest validation rule (§D12)
 * refuses voice-clone adapters without a declared consent UX surface.
 */
export interface TtsVoice {
  /** Stable voice id within the adapter. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Distinguishes consent-gated from free-to-use voices (per §D4). */
  readonly origin: TtsVoiceOrigin;
  /** ISO-639-1 codes the voice supports. */
  readonly languages: readonly string[];
}

const ttsVoiceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    origin: z.enum(TTS_VOICE_ORIGINS),
    languages: z.array(z.string().min(1)).readonly(),
  })
  .strict();

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D5)
// ----------------------------------------------------------------------------

/**
 * `TTSProvider`-side capability shape. Per ADR-008 §D5.
 *
 * `supportsVoiceClone === true` activates the §D4 voice-consent contract
 * — every cloned-voice synthesize() call MUST consult
 * `TenantVoiceConsentStore.assertActive`. The plugin marketplace gate
 * refuses adapters that declare this without a paired consent UX surface.
 */
export interface TtsCapabilityDescriptor {
  /** Voices this adapter exposes. */
  readonly voices: readonly TtsVoice[];
  /** Output audio formats; at least one. */
  readonly outputFormats: readonly TtsOutputFormat[];
  /** Sample rates the adapter can emit (Hz). */
  readonly sampleRates: readonly number[];
  /** Maximum synthesizable duration per call (seconds). */
  readonly maxDurationS: number;
  /**
   * Whether the adapter emits per-word timestamps the captions
   * bypass-Whisper integration (T-436) consumes.
   */
  readonly emitsWordTimestamps: boolean;
  /** Whether the adapter supports voice cloning (activates §D4). */
  readonly supportsVoiceClone: boolean;
}

export const ttsCapabilityDescriptorSchema = z
  .object({
    voices: z.array(ttsVoiceSchema).min(1).readonly(),
    outputFormats: z.array(z.enum(TTS_OUTPUT_FORMATS)).min(1).readonly(),
    sampleRates: z.array(z.number().int().positive()).min(1).readonly(),
    maxDurationS: z.number().positive(),
    emitsWordTimestamps: z.boolean(),
    supportsVoiceClone: z.boolean(),
  })
  .strict();

/**
 * Capability validator that plugs into T-418's `CapabilityDescriptorParser`.
 * Wire at host boot via `buildValidatorMap({ tts: validateTtsCapability })`.
 */
export const validateTtsCapability: CapabilityValidator = (capability) => {
  const result = ttsCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes (ADR-008 §D5)
// ----------------------------------------------------------------------------

/**
 * Per-call input. The `tenantId` flows into the §D4 consent check; the
 * adapter's pre-call hook MUST use it (not a session-scoped tenant id).
 */
export interface TtsCall {
  readonly tenantId: string;
  readonly voiceId: string;
  readonly text: string;
  readonly outputFormat: TtsOutputFormat;
  readonly sampleRate: number;
  readonly seed?: number;
}

/**
 * Per-call output. `cacheKey` matches §D1's content-addressed cache key.
 * `wordTimestamps` is set only when `descriptor.emitsWordTimestamps`.
 */
export interface TtsResult {
  readonly cacheKey: string;
  readonly url: string;
  readonly durationS: number;
  readonly wordTimestamps?: readonly { word: string; startS: number; endS: number }[];
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D5)
// ----------------------------------------------------------------------------

/**
 * `TTSProvider` extends `AdapterDescriptor` with TTS-specific call shape
 * and capability. Per ADR-008 §D5.
 *
 * The `modality.kind` is narrowed to the literal `'tts'` so consumers
 * can branch on the provider type after a `descriptor.modality.kind ===
 * 'tts'` check; `capability` is narrowed to the per-modality
 * `TtsCapabilityDescriptor` shape (the base `AdapterDescriptor.capability`
 * is opaque `Readonly<Record<string, unknown>>` per ADR-007 §D1).
 *
 * Implementations MUST call `tenantVoiceConsentStore.assertActive`
 * before issuing the upstream call when the requested voice's `origin`
 * is `'cloned-per-tenant'`.
 */
export interface TTSProvider extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'tts' };
  readonly capability: TtsCapabilityDescriptor;
  synthesize(call: TtsCall): Promise<TtsResult>;
}
