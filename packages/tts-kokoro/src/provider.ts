// packages/tts-kokoro/src/provider.ts
// `KokoroTtsProvider` — implements `TTSProvider` from T-419 over the
// `kokoroDescriptor` from `./descriptor.ts`. T-426 ships **stub mode**
// only: `synthesize()` derives the canonical cache key per ADR-008 §D1
// + returns a deterministic silent-WAV `data:` URI. Production mode
// throws `NotYetImplementedError` (gated on T-426a — Kokoro npm
// package / ONNX runtime audit pending).
//
// Validation (per AC #4):
//   - voiceId must be in `kokoroDescriptor.capability.voices`.
//   - outputFormat must equal `'wav'` (only declared format).
//   - sampleRate must equal `24000` (only declared sample rate).
//
// All three failures throw a synchronous `Error` so the orchestrator's
// `FallbackChainExecutor` (T-418) treats them as adapter rejection.

import type {
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxModel,
} from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import type {
  TTSProvider,
  TtsCall,
  TtsCapabilityDescriptor,
  TtsResult,
} from '@stageflip/asset-gen-contract';

import { kokoroDescriptor } from './descriptor.js';
import { generateSilentWavDataUri } from './stub-audio.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic silent-WAV
 *   payload at the declared sample rate. Used for tests + as a
 *   placeholder while T-426a's production wire-up audit pends.
 * - `'production'`: real Kokoro library call. NOT IMPLEMENTED in
 *   T-426 — `synthesize()` throws `NotYetImplementedError`.
 */
export type KokoroProviderMode = 'stub' | 'production';

/**
 * Thrown by `KokoroTtsProvider.synthesize()` in `'production'` mode.
 * Production wire-up is deferred to T-426a (kokoro-js / ONNX runtime
 * license + edge-runtime audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface KokoroTtsProviderOptions {
  readonly mode?: KokoroProviderMode;
}

/**
 * Lower bound for synthesized duration (seconds). Empty / very short
 * prompts still produce a 0.5s clip so downstream consumers (captions,
 * timeline placement) have a non-degenerate duration to work with.
 */
const MIN_DURATION_S = 0.5;

/**
 * Upper bound for synthesized duration (seconds). Matches
 * `kokoroDescriptor.capability.maxDurationS`. Prompts longer than the
 * proxy estimate (~`text.length / 15`) clamp to this value rather than
 * throwing — the orchestrator may chunk before calling the adapter.
 */
const MAX_DURATION_S = 60;

/**
 * Rough characters-per-second proxy for the stub-mode duration estimate.
 * Per the spec: `durationS = text.length / CHARS_PER_SECOND`, clamped
 * to `[MIN_DURATION_S, MAX_DURATION_S]`. The exact constant is
 * arbitrary (~15 chars/s ≈ 180 wpm) — the production wire-up uses the
 * real synthesized duration.
 */
const CHARS_PER_SECOND = 15;

/**
 * Reference Kokoro TTS adapter (v1; stub-mode body). Implements
 * `TTSProvider` so the orchestrator may invoke it through the same
 * surface every other TTS adapter exposes.
 */
export class KokoroTtsProvider implements TTSProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = kokoroDescriptor.id;
  readonly modality: { readonly kind: 'tts' } = { kind: 'tts' };
  readonly capability: TtsCapabilityDescriptor;
  readonly license = kokoroDescriptor.license;
  readonly sandbox: SandboxModel = kokoroDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: KokoroProviderMode;

  constructor(options: KokoroTtsProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (kokoroDescriptor.costPerCall !== undefined) {
      this.costPerCall = kokoroDescriptor.costPerCall;
    }
    if (kokoroDescriptor.latencyMs !== undefined) {
      this.latencyMs = kokoroDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `TtsCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary fields; the
    // strict reader reads a structurally-compatible subset).
    const cap = kokoroDescriptor.capability as CapabilityDescriptor;
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
  get mode(): KokoroProviderMode {
    return this.#mode;
  }

  /**
   * Synthesize speech for `call`. Stub-mode returns a deterministic
   * silent-WAV `data:` URI; production mode throws
   * `NotYetImplementedError`.
   *
   * Throws synchronously (before mode dispatch) when:
   *   - `call.voiceId` is not in the declared voice list,
   *   - `call.outputFormat !== 'wav'`,
   *   - `call.sampleRate !== 24000`.
   */
  async synthesize(call: TtsCall): Promise<TtsResult> {
    const voice = this.capability.voices.find((v) => v.id === call.voiceId);
    if (voice === undefined) {
      throw new Error(
        `KokoroTtsProvider.synthesize: unknown voiceId "${call.voiceId}" (declared voices: ${this.capability.voices.map((v) => v.id).join(', ')})`,
      );
    }
    if (call.outputFormat !== 'wav') {
      throw new Error(
        `KokoroTtsProvider.synthesize: unsupported outputFormat "${call.outputFormat}" (only 'wav' is supported in v1)`,
      );
    }
    if (call.sampleRate !== 24000) {
      throw new Error(
        `KokoroTtsProvider.synthesize: unsupported sampleRate ${call.sampleRate} (only 24000Hz is supported in v1)`,
      );
    }

    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'KokoroTtsProvider.synthesize: production wire-up deferred to T-426a (kokoro-js / ONNX runtime audit pending)',
      );
    }

    // --- stub mode -------------------------------------------------------
    const durationS = clamp(call.text.length / CHARS_PER_SECOND, MIN_DURATION_S, MAX_DURATION_S);
    const url = generateSilentWavDataUri(durationS, call.sampleRate);
    const key = await deriveCacheKey({
      modality: 'tts',
      model: `kokoro:${call.voiceId}`,
      voice: call.voiceId,
      prompt: call.text,
      params: {
        sampleRate: call.sampleRate,
        outputFormat: call.outputFormat,
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
