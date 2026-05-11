// packages/music-yue/src/provider.ts
// `YueMusicProvider` — implements `MusicGenerationProvider` from T-419
// over the `yueDescriptor` from `./descriptor.ts`. T-433 ships
// **stub mode** only: `generate()` derives the canonical cache key per
// ADR-008 §D1 + returns a deterministic silent-WAV `data:` URI with
// the YuE attribution string. Production mode throws
// `NotYetImplementedError` (gated on T-433a — YuE ONNX runtime /
// checkpoint redistribution audit pending).
//
// **Attribution-required delta vs ACE-Step** (T-432): every
// `MusicGenResult` from this provider carries `attribution:
// YUE_ATTRIBUTION`. Downstream consumers (T-423 handler bundle)
// propagate this string into `MediaProvenance.attribution` so the
// exporter / UI surfaces "Generated with YuE (Apache 2.0)" in the
// final output. Honors Apache 2.0's attribution clause.
//
// Validation (per AC #5):
//   - prompt must be non-empty (after trim).
//   - outputFormat must equal `'wav'` (mp3 declared on descriptor but
//     stub body emits wav only).
//   - durationS must be in `(0, 300]`.
//   - genre, when present, must be in `yueDescriptor.capability.genres`.
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
  MusicGenCall,
  MusicGenCapabilityDescriptor,
  MusicGenResult,
  MusicGenerationProvider,
} from '@stageflip/asset-gen-contract';

import { YUE_ATTRIBUTION, YUE_SAMPLE_RATE_HZ, yueDescriptor } from './descriptor.js';
import { generateSilentWavDataUri } from './stub-audio.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic silent-WAV
 *   payload at the declared sample rate. Used for tests + as a
 *   placeholder while T-433a's production wire-up audit pends.
 * - `'production'`: real YuE library call. NOT IMPLEMENTED in
 *   T-433 — `generate()` throws `NotYetImplementedError`.
 */
export type YueProviderMode = 'stub' | 'production';

/**
 * Thrown by `YueMusicProvider.generate()` in `'production'` mode.
 * Production wire-up is deferred to T-433a (YuE ONNX runtime /
 * checkpoint redistribution audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface YueMusicProviderOptions {
  readonly mode?: YueProviderMode;
}

/**
 * Reference YuE music adapter (v1; stub-mode body). Implements
 * `MusicGenerationProvider` so the orchestrator may invoke it through
 * the same surface every other music-gen adapter exposes.
 */
export class YueMusicProvider implements MusicGenerationProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = yueDescriptor.id;
  readonly modality: { readonly kind: 'music-gen' } = { kind: 'music-gen' };
  readonly capability: MusicGenCapabilityDescriptor;
  readonly license = yueDescriptor.license;
  readonly sandbox: SandboxModel = yueDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: YueProviderMode;

  constructor(options: YueMusicProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (yueDescriptor.costPerCall !== undefined) {
      this.costPerCall = yueDescriptor.costPerCall;
    }
    if (yueDescriptor.latencyMs !== undefined) {
      this.latencyMs = yueDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `MusicGenCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary + differentiator
    // fields; the strict reader reads a structurally-compatible subset).
    const cap = yueDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      genres: cap.genres as MusicGenCapabilityDescriptor['genres'],
      maxDurationS: cap.maxDurationS as number,
      outputFormats: cap.outputFormats as MusicGenCapabilityDescriptor['outputFormats'],
      outputLicense: cap.outputLicense as MusicGenCapabilityDescriptor['outputLicense'],
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): YueProviderMode {
    return this.#mode;
  }

  /**
   * Generate music for `call`. Stub-mode returns a deterministic
   * silent-WAV `data:` URI with the YuE attribution string; production
   * mode throws `NotYetImplementedError`.
   *
   * Throws synchronously (before mode dispatch) when:
   *   - `call.prompt` is empty or whitespace-only,
   *   - `call.outputFormat !== 'wav'`,
   *   - `call.durationS` is not in `(0, 300]`,
   *   - `call.genre` is present but not in the declared genre list.
   *
   * The returned `MusicGenResult` always carries
   * `attribution: YUE_ATTRIBUTION` — honors the
   * `attribution-required` output-license disposition declared on
   * the descriptor.
   */
  async generate(call: MusicGenCall): Promise<MusicGenResult> {
    if (call.prompt.trim().length === 0) {
      throw new Error('YueMusicProvider.generate: prompt must be non-empty');
    }
    if (call.outputFormat !== 'wav') {
      throw new Error(
        `YueMusicProvider.generate: unsupported outputFormat "${call.outputFormat}" (only 'wav' is supported in v1; mp3 is declared on the descriptor but the stub body does not emit it)`,
      );
    }
    if (!(call.durationS > 0 && call.durationS <= this.capability.maxDurationS)) {
      throw new Error(
        `YueMusicProvider.generate: durationS ${call.durationS} out of range (must be > 0 and ≤ ${this.capability.maxDurationS})`,
      );
    }
    if (call.genre !== undefined && !this.capability.genres.includes(call.genre)) {
      throw new Error(
        `YueMusicProvider.generate: unknown genre "${call.genre}" (declared genres: ${this.capability.genres.join(', ')})`,
      );
    }

    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'YueMusicProvider.generate: production wire-up deferred to T-433a (YuE ONNX runtime audit pending)',
      );
    }

    // --- stub mode -------------------------------------------------------
    const url = generateSilentWavDataUri(call.durationS, YUE_SAMPLE_RATE_HZ);
    const key = await deriveCacheKey({
      modality: 'music-gen',
      model: 'yue',
      prompt: call.prompt,
      params: {
        outputFormat: call.outputFormat,
        durationS: call.durationS,
        ...(call.genre !== undefined ? { genre: call.genre } : {}),
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      durationS: call.durationS,
      attribution: YUE_ATTRIBUTION,
    };
  }
}
