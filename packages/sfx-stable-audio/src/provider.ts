// packages/sfx-stable-audio/src/provider.ts
// `StableAudioSfxProvider` — implements `SFXProvider` from T-419 over
// the `stableAudioDescriptor` from `./descriptor.ts`. T-434 ships
// **stub mode** only: `generate()` derives the canonical cache key
// per ADR-008 §D1 + returns a deterministic silent-WAV `data:` URI
// with `isLoopable` mirroring the call's `loop` flag. Production mode
// throws `NotYetImplementedError` (gated on T-434a — Stable Audio
// Open ONNX runtime / checkpoint redistribution audit pending).
//
// Validation (per AC #4):
//   - prompt must be non-empty (after trim).
//   - outputFormat must equal `'wav'` (mp3 declared on descriptor but
//     stub body emits wav only).
//   - durationS must be in `(0, 30]`.
//   - sampleRate must be in `stableAudioDescriptor.capability.sampleRates`.
//
// All failures throw a synchronous `Error` so the orchestrator's
// `FallbackChainExecutor` (T-418) treats them as adapter rejection.

import type {
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxModel,
} from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import type {
  SFXProvider,
  SfxCall,
  SfxCapabilityDescriptor,
  SfxResult,
} from '@stageflip/asset-gen-contract';

import { stableAudioDescriptor } from './descriptor.js';
import { generateSilentWavDataUri } from './stub-audio.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic silent-WAV
 *   payload at the declared sample rate. Used for tests + as a
 *   placeholder while T-434a's production wire-up audit pends.
 * - `'production'`: real Stable Audio Open library call. NOT
 *   IMPLEMENTED in T-434 — `generate()` throws
 *   `NotYetImplementedError`.
 */
export type StableAudioProviderMode = 'stub' | 'production';

/**
 * Thrown by `StableAudioSfxProvider.generate()` in `'production'`
 * mode. Production wire-up is deferred to T-434a (Stable Audio Open
 * ONNX runtime / checkpoint redistribution audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface StableAudioSfxProviderOptions {
  readonly mode?: StableAudioProviderMode;
}

/**
 * Reference Stable Audio Open SFX adapter (v1; stub-mode body).
 * Implements `SFXProvider` so the orchestrator may invoke it through
 * the same surface every other sfx adapter exposes.
 */
export class StableAudioSfxProvider implements SFXProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = stableAudioDescriptor.id;
  readonly modality: { readonly kind: 'sfx' } = { kind: 'sfx' };
  readonly capability: SfxCapabilityDescriptor;
  readonly license = stableAudioDescriptor.license;
  readonly sandbox: SandboxModel = stableAudioDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: StableAudioProviderMode;

  constructor(options: StableAudioSfxProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (stableAudioDescriptor.costPerCall !== undefined) {
      this.costPerCall = stableAudioDescriptor.costPerCall;
    }
    if (stableAudioDescriptor.latencyMs !== undefined) {
      this.latencyMs = stableAudioDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `SfxCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary + differentiator
    // fields; the strict reader reads a structurally-compatible subset).
    const cap = stableAudioDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      outputFormats: cap.outputFormats as SfxCapabilityDescriptor['outputFormats'],
      sampleRates: cap.sampleRates as SfxCapabilityDescriptor['sampleRates'],
      maxDurationS: cap.maxDurationS as number,
      supportsLoop: cap.supportsLoop as boolean,
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): StableAudioProviderMode {
    return this.#mode;
  }

  /**
   * Generate an SFX clip for `call`. Stub-mode returns a deterministic
   * silent-WAV `data:` URI with `isLoopable` mirroring the call's
   * `loop` flag; production mode throws `NotYetImplementedError`.
   *
   * Throws synchronously (before mode dispatch) when:
   *   - `call.prompt` is empty or whitespace-only,
   *   - `call.outputFormat !== 'wav'`,
   *   - `call.durationS` is not in `(0, 30]`,
   *   - `call.sampleRate` is not in the declared `sampleRates` list.
   */
  async generate(call: SfxCall): Promise<SfxResult> {
    if (call.prompt.trim().length === 0) {
      throw new Error('StableAudioSfxProvider.generate: prompt must be non-empty');
    }
    if (call.outputFormat !== 'wav') {
      throw new Error(
        `StableAudioSfxProvider.generate: unsupported outputFormat "${call.outputFormat}" (only 'wav' is supported in v1; mp3 is declared on the descriptor but the stub body does not emit it)`,
      );
    }
    if (!(call.durationS > 0 && call.durationS <= this.capability.maxDurationS)) {
      throw new Error(
        `StableAudioSfxProvider.generate: durationS ${call.durationS} out of range (must be > 0 and ≤ ${this.capability.maxDurationS})`,
      );
    }
    if (!this.capability.sampleRates.includes(call.sampleRate)) {
      throw new Error(
        `StableAudioSfxProvider.generate: unsupported sampleRate ${call.sampleRate} (declared sampleRates: ${this.capability.sampleRates.join(', ')})`,
      );
    }

    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'StableAudioSfxProvider.generate: production wire-up deferred to T-434a (Stable Audio Open ONNX runtime audit pending)',
      );
    }

    // --- stub mode -------------------------------------------------------
    const url = generateSilentWavDataUri(call.durationS, call.sampleRate);
    const isLoopable = call.loop === true;
    const key = await deriveCacheKey({
      modality: 'sfx',
      model: 'stable-audio-open',
      prompt: call.prompt,
      params: {
        outputFormat: call.outputFormat,
        durationS: call.durationS,
        sampleRate: call.sampleRate,
        ...(call.loop !== undefined ? { loop: call.loop } : {}),
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      durationS: call.durationS,
      isLoopable,
    };
  }
}
