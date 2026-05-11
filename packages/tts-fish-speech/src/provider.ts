// packages/tts-fish-speech/src/provider.ts
// `FishSpeechTtsProvider` — implements `TTSProvider` from T-419 over
// the `fishSpeechDescriptor` from `./descriptor.ts`. T-427 ships
// **stub mode** only: `synthesize()` derives the canonical cache key
// per ADR-008 §D1 + returns a deterministic silent-WAV `data:` URI.
// Production mode throws `NotYetImplementedError` (gated on T-427a —
// Fish Speech Python sidecar / model checkpoint audit pending).
//
// **Differentiator vs T-426 Kokoro**: voice-clone consent
// enforcement. The provider derives whether the requested `voiceId`
// is a library voice (in `FISH_SPEECH_LIBRARY_VOICES`) or a cloned
// voice (anything else); cloned voices invoke
// `assertVoiceConsentIfNeeded` BEFORE producing audio. Library voices
// bypass consent.
//
// Defensive ordering inside `synthesize()`:
//   1. Voice-consent check (cloned voices). Library voices skip.
//      → throws `VoiceConsentRequiredError` on missing / denied
//        consent. Fires before format / sample-rate validation so a
//        malformed cloned-voice call still surfaces the consent
//        refusal first.
//   2. Output-format validation. → throws `Error` on mismatch.
//   3. Sample-rate validation. → throws `Error` on mismatch.
//   4. Production-mode dispatch. → throws `NotYetImplementedError`.
//   5. Stub-mode body: derive cache key, build silent-WAV URI,
//      return.

import type {
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxModel,
} from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import type {
  TTSProvider,
  TenantVoiceConsentStore,
  TtsCall,
  TtsCapabilityDescriptor,
  TtsResult,
} from '@stageflip/asset-gen-contract';

import { FISH_SPEECH_LIBRARY_VOICES, fishSpeechDescriptor } from './descriptor.js';
import { generateSilentWavDataUri } from './stub-audio.js';
import { assertVoiceConsentIfNeeded } from './voice-consent.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic silent-WAV
 *   payload at the declared sample rate. Used for tests + as a
 *   placeholder while T-427a's production wire-up audit pends.
 * - `'production'`: real Fish Speech library call. NOT IMPLEMENTED in
 *   T-427 — `synthesize()` throws `NotYetImplementedError`.
 */
export type FishSpeechProviderMode = 'stub' | 'production';

/**
 * Thrown by `FishSpeechTtsProvider.synthesize()` in `'production'`
 * mode. Production wire-up is deferred to T-427a (Fish Speech Python
 * sidecar / model checkpoint audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface FishSpeechTtsProviderOptions {
  readonly mode?: FishSpeechProviderMode;
  /**
   * Optional `TenantVoiceConsentStore` instance. Required for
   * cloned-voice synthesize() calls. Library-voice calls work without
   * it. When undefined, cloned-voice calls fail-closed with
   * `VoiceConsentRequiredError` per ADR-008 §D4 (the adapter never
   * silently bypasses consent).
   */
  readonly voiceConsentStore?: TenantVoiceConsentStore;
}

/**
 * Lower bound for synthesized duration (seconds). Empty / very short
 * prompts still produce a 0.5s clip so downstream consumers
 * (captions, timeline placement) have a non-degenerate duration to
 * work with.
 */
const MIN_DURATION_S = 0.5;

/**
 * Upper bound for synthesized duration (seconds). Matches
 * `fishSpeechDescriptor.capability.maxDurationS`. Prompts longer than
 * the proxy estimate (~`text.length / 15`) clamp to this value rather
 * than throwing — the orchestrator may chunk before calling the
 * adapter.
 */
const MAX_DURATION_S = 60;

/**
 * Rough characters-per-second proxy for the stub-mode duration
 * estimate. Per the spec: `durationS = text.length / CHARS_PER_SECOND`,
 * clamped to `[MIN_DURATION_S, MAX_DURATION_S]`. Matches Kokoro's
 * proxy so cache-key-shape tests can be ported across adapters.
 */
const CHARS_PER_SECOND = 15;

/** The library voice ids, frozen for fast `has()` membership checks. */
const LIBRARY_VOICE_IDS: ReadonlySet<string> = new Set(FISH_SPEECH_LIBRARY_VOICES.map((v) => v.id));

/**
 * Reference Fish Speech TTS adapter (v1; stub-mode body). Implements
 * `TTSProvider` so the orchestrator may invoke it through the same
 * surface every other TTS adapter exposes.
 *
 * **Voice-clone-aware**: the provider derives whether the requested
 * `voiceId` is a library voice or a cloned one and enforces §D4
 * consent on cloned voices.
 */
export class FishSpeechTtsProvider implements TTSProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = fishSpeechDescriptor.id;
  readonly modality: { readonly kind: 'tts' } = { kind: 'tts' };
  readonly capability: TtsCapabilityDescriptor;
  readonly license = fishSpeechDescriptor.license;
  readonly sandbox: SandboxModel = fishSpeechDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when
  // the descriptor sets them; otherwise omit so the property is
  // genuinely absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: FishSpeechProviderMode;
  readonly #voiceConsentStore: TenantVoiceConsentStore | undefined;

  constructor(options: FishSpeechTtsProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    this.#voiceConsentStore = options.voiceConsentStore;
    if (fishSpeechDescriptor.costPerCall !== undefined) {
      this.costPerCall = fishSpeechDescriptor.costPerCall;
    }
    if (fishSpeechDescriptor.latencyMs !== undefined) {
      this.latencyMs = fishSpeechDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope
    // back to the strict `TtsCapabilityDescriptor` shape (the
    // descriptor stores the strict subset PLUS the catalog-summary
    // fields; the strict reader reads a structurally-compatible
    // subset).
    const cap = fishSpeechDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      voices: cap.voices as TtsCapabilityDescriptor['voices'],
      outputFormats: cap.outputFormats as TtsCapabilityDescriptor['outputFormats'],
      sampleRates: cap.sampleRates as TtsCapabilityDescriptor['sampleRates'],
      maxDurationS: cap.maxDurationS as number,
      emitsWordTimestamps: cap.emitsWordTimestamps as boolean,
      supportsVoiceClone: cap.supportsVoiceClone as boolean,
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): FishSpeechProviderMode {
    return this.#mode;
  }

  /**
   * Synthesize speech for `call`. Stub-mode returns a deterministic
   * silent-WAV `data:` URI; production mode throws
   * `NotYetImplementedError`.
   *
   * Throws (in this order):
   *   - `VoiceConsentRequiredError` when `call.voiceId` is a cloned
   *     voice and consent is missing / denied;
   *   - `Error` when `call.outputFormat !== 'wav'`;
   *   - `Error` when `call.sampleRate !== 22050`;
   *   - `NotYetImplementedError` in production mode (after
   *     validation).
   */
  async synthesize(call: TtsCall): Promise<TtsResult> {
    const isClonedVoice = !LIBRARY_VOICE_IDS.has(call.voiceId);

    // (1) Voice-consent check (per ADR-008 §D4). Fires BEFORE format
    // / sample-rate validation so a malformed cloned-voice call still
    // surfaces the consent refusal first.
    await assertVoiceConsentIfNeeded({
      store: this.#voiceConsentStore,
      tenantId: call.tenantId,
      voiceProvider: 'fish-speech',
      voiceId: call.voiceId,
      isClonedVoice,
    });

    // (2) Output-format validation.
    if (call.outputFormat !== 'wav') {
      throw new Error(
        `FishSpeechTtsProvider.synthesize: unsupported outputFormat "${call.outputFormat}" (only 'wav' is supported in v1)`,
      );
    }

    // (3) Sample-rate validation.
    if (call.sampleRate !== 22050) {
      throw new Error(
        `FishSpeechTtsProvider.synthesize: unsupported sampleRate ${call.sampleRate} (only 22050Hz is supported in v1)`,
      );
    }

    // (4) Production mode → not yet implemented.
    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'FishSpeechTtsProvider.synthesize: production wire-up deferred to T-427a (Fish Speech Python sidecar / model checkpoint audit pending)',
      );
    }

    // (5) Stub mode body.
    const durationS = clamp(call.text.length / CHARS_PER_SECOND, MIN_DURATION_S, MAX_DURATION_S);
    const url = generateSilentWavDataUri(durationS, call.sampleRate);
    const key = await deriveCacheKey({
      modality: 'tts',
      model: `fish-speech:${call.voiceId}`,
      voice: call.voiceId,
      prompt: call.text,
      params: {
        sampleRate: call.sampleRate,
        outputFormat: call.outputFormat,
        // `voiceCloneFingerprint` is included ONLY when the voice is
        // a cloned one — so library-voice cache keys remain
        // backwards-compatible should Fish Speech ever expose the
        // same `voiceId` under both library and clone modes.
        ...(isClonedVoice ? { voiceCloneFingerprint: `clone:${call.voiceId}` } : {}),
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      durationS,
    };
  }
}

/** Clamp `value` into `[min, max]`. Pure helper for the duration estimate. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
