// packages/music-acestep/src/provider.ts
// `AceStepMusicProvider` — implements `MusicGenerationProvider` from
// T-419 over the `aceStepDescriptor` from `./descriptor.ts`. T-432
// ships **stub mode** only: `generate()` derives the canonical cache
// key per ADR-008 §D1 + returns a deterministic silent-WAV `data:`
// URI. Production mode throws `NotYetImplementedError` (gated on
// T-432a — ACE-Step ONNX runtime / checkpoint redistribution audit
// pending).
//
// Validation (per AC #4):
//   - prompt must be non-empty (after trim).
//   - outputFormat must equal `'wav'` (mp3 declared on descriptor but
//     stub body emits wav only).
//   - durationS must be in `(0, 300]`.
//   - genre, when present, must be in `aceStepDescriptor.capability.genres`.
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

import { ACE_STEP_SAMPLE_RATE_HZ, aceStepDescriptor } from './descriptor.js';
import { generateSilentWavDataUri } from './stub-audio.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic silent-WAV
 *   payload at the declared sample rate. Used for tests + as a
 *   placeholder while T-432a's production wire-up audit pends.
 * - `'production'`: real ACE-Step library call. NOT IMPLEMENTED in
 *   T-432 — `generate()` throws `NotYetImplementedError`.
 */
export type AceStepProviderMode = 'stub' | 'production';

/**
 * Thrown by `AceStepMusicProvider.generate()` in `'production'` mode.
 * Production wire-up is deferred to T-432a (ACE-Step ONNX runtime /
 * checkpoint redistribution audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface AceStepMusicProviderOptions {
  readonly mode?: AceStepProviderMode;
}

/**
 * Reference ACE-Step music adapter (v1; stub-mode body). Implements
 * `MusicGenerationProvider` so the orchestrator may invoke it through
 * the same surface every other music-gen adapter exposes.
 */
export class AceStepMusicProvider implements MusicGenerationProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = aceStepDescriptor.id;
  readonly modality: { readonly kind: 'music-gen' } = { kind: 'music-gen' };
  readonly capability: MusicGenCapabilityDescriptor;
  readonly license = aceStepDescriptor.license;
  readonly sandbox: SandboxModel = aceStepDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: AceStepProviderMode;

  constructor(options: AceStepMusicProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (aceStepDescriptor.costPerCall !== undefined) {
      this.costPerCall = aceStepDescriptor.costPerCall;
    }
    if (aceStepDescriptor.latencyMs !== undefined) {
      this.latencyMs = aceStepDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `MusicGenCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary + differentiator
    // fields; the strict reader reads a structurally-compatible subset).
    const cap = aceStepDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      genres: cap.genres as MusicGenCapabilityDescriptor['genres'],
      maxDurationS: cap.maxDurationS as number,
      outputFormats: cap.outputFormats as MusicGenCapabilityDescriptor['outputFormats'],
      outputLicense: cap.outputLicense as MusicGenCapabilityDescriptor['outputLicense'],
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): AceStepProviderMode {
    return this.#mode;
  }

  /**
   * Generate music for `call`. Stub-mode returns a deterministic
   * silent-WAV `data:` URI; production mode throws
   * `NotYetImplementedError`.
   *
   * Throws synchronously (before mode dispatch) when:
   *   - `call.prompt` is empty or whitespace-only,
   *   - `call.outputFormat !== 'wav'`,
   *   - `call.durationS` is not in `(0, 300]`,
   *   - `call.genre` is present but not in the declared genre list.
   */
  async generate(call: MusicGenCall): Promise<MusicGenResult> {
    if (call.prompt.trim().length === 0) {
      throw new Error('AceStepMusicProvider.generate: prompt must be non-empty');
    }
    if (call.outputFormat !== 'wav') {
      throw new Error(
        `AceStepMusicProvider.generate: unsupported outputFormat "${call.outputFormat}" (only 'wav' is supported in v1; mp3 is declared on the descriptor but the stub body does not emit it)`,
      );
    }
    if (!(call.durationS > 0 && call.durationS <= this.capability.maxDurationS)) {
      throw new Error(
        `AceStepMusicProvider.generate: durationS ${call.durationS} out of range (must be > 0 and ≤ ${this.capability.maxDurationS})`,
      );
    }
    if (call.genre !== undefined && !this.capability.genres.includes(call.genre)) {
      throw new Error(
        `AceStepMusicProvider.generate: unknown genre "${call.genre}" (declared genres: ${this.capability.genres.join(', ')})`,
      );
    }

    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'AceStepMusicProvider.generate: production wire-up deferred to T-432a (ACE-Step ONNX runtime audit pending)',
      );
    }

    // --- stub mode -------------------------------------------------------
    const url = generateSilentWavDataUri(call.durationS, ACE_STEP_SAMPLE_RATE_HZ);
    const key = await deriveCacheKey({
      modality: 'music-gen',
      model: 'ace-step',
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
    };
  }
}
