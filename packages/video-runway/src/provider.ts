// packages/video-runway/src/provider.ts
// `RunwayVideoProvider` — implements `VideoGenerationProvider` from
// T-419 over the `runwayDescriptor` from `./descriptor.ts`. T-431
// ships **stub mode** only: `generate()` derives the canonical cache
// key per ADR-008 §D1 + returns a deterministic placeholder MP4
// `data:` URI (byte-distinct from Seedance's). Production mode
// throws `NotYetImplementedError` (gated on T-431a — Runway Gen-4
// HTTPS API audit pending).
//
// Validation (per AC #4 / #7):
//   - prompt must be a non-empty string after trim.
//
// Defensive ordering inside `generate()`:
//   1. Prompt validation (empty / whitespace-only → throw `Error`).
//   2. Production-mode dispatch → throws `NotYetImplementedError`.
//   3. Stub-mode body: derive cache key, build placeholder MP4 URI,
//      return `{ cacheKey, url, durationS, aspectRatio, frameRate }`.

import type {
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxModel,
} from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import type {
  VideoGenCall,
  VideoGenCapabilityDescriptor,
  VideoGenResult,
  VideoGenerationProvider,
} from '@stageflip/asset-gen-contract';

import { runwayDescriptor } from './descriptor.js';
import { generateStubMp4DataUri } from './stub-video.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic placeholder MP4
 *   payload (minimal valid MP4 fixture; byte-distinct from Seedance's).
 *   Used for tests + as a placeholder while T-431a's production
 *   wire-up audit pends.
 * - `'production'`: real Runway HTTPS API call. NOT IMPLEMENTED in
 *   T-431 — `generate()` throws `NotYetImplementedError`.
 */
export type RunwayProviderMode = 'stub' | 'production';

/**
 * Thrown by `RunwayVideoProvider.generate()` in `'production'` mode.
 * Production wire-up is deferred to T-431a (Runway Gen-4 HTTPS API
 * surface audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface RunwayVideoProviderOptions {
  readonly mode?: RunwayProviderMode;
}

/**
 * Reference Runway Gen-4 video adapter (v1; stub-mode body).
 * Production-tier commercial text-to-video model: 10s @ up to 4K MP4
 * output (silent — no native audio; pair with TTS / music-gen
 * separately), broad aspect-ratio set, cinematic 24fps default.
 * Implements `VideoGenerationProvider` so the orchestrator may invoke
 * it through the same surface every other video-gen adapter exposes.
 */
export class RunwayVideoProvider implements VideoGenerationProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = runwayDescriptor.id;
  readonly modality: { readonly kind: 'video-gen' } = { kind: 'video-gen' };
  readonly capability: VideoGenCapabilityDescriptor;
  readonly license = runwayDescriptor.license;
  readonly sandbox: SandboxModel = runwayDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: RunwayProviderMode;

  constructor(options: RunwayVideoProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (runwayDescriptor.costPerCall !== undefined) {
      this.costPerCall = runwayDescriptor.costPerCall;
    }
    if (runwayDescriptor.latencyMs !== undefined) {
      this.latencyMs = runwayDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `VideoGenCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary + differentiator
    // fields; the strict reader reads a structurally-compatible subset).
    const cap = runwayDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      aspectRatios: cap.aspectRatios as VideoGenCapabilityDescriptor['aspectRatios'],
      frameRates: cap.frameRates as VideoGenCapabilityDescriptor['frameRates'],
      maxDurationS: cap.maxDurationS as number,
      outputFormats: cap.outputFormats as VideoGenCapabilityDescriptor['outputFormats'],
      emitsAudio: cap.emitsAudio as boolean,
      safetyFilters: cap.safetyFilters as VideoGenCapabilityDescriptor['safetyFilters'],
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): RunwayProviderMode {
    return this.#mode;
  }

  /**
   * Generate a video for `call`. Stub-mode returns a deterministic
   * placeholder MP4 `data:` URI; production mode throws
   * `NotYetImplementedError`.
   *
   * Throws (in this order):
   *   - `Error` when `call.prompt` is empty / whitespace-only;
   *   - `NotYetImplementedError` in production mode (after validation).
   */
  async generate(call: VideoGenCall): Promise<VideoGenResult> {
    // (1) Prompt validation.
    if (typeof call.prompt !== 'string' || call.prompt.trim().length === 0) {
      throw new Error(
        `RunwayVideoProvider.generate: prompt must be a non-empty string after trim; received ${JSON.stringify(call.prompt)}`,
      );
    }

    // (2) Production mode → not yet implemented.
    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'RunwayVideoProvider.generate: production wire-up deferred to T-431a (Runway Gen-4 HTTPS API audit pending)',
      );
    }

    // (3) Stub mode body. The MP4 bytes are byte-identical for ANY
    // input; cache-key differentiation lives in the canonical params
    // dict (outputFormat / aspectRatio / frameRate / durationS) + the
    // optional seed.
    const url = generateStubMp4DataUri(call.prompt, call.seed);
    const key = await deriveCacheKey({
      modality: 'video-gen',
      model: 'runway:gen-4',
      prompt: call.prompt,
      params: {
        outputFormat: call.outputFormat,
        aspectRatio: call.aspectRatio,
        frameRate: call.frameRate,
        durationS: call.durationS,
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      durationS: call.durationS,
      aspectRatio: call.aspectRatio,
      frameRate: call.frameRate,
    };
  }
}
