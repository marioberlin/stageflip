// packages/3d-tripo/src/provider.ts
// `TripoThreeDProvider` — implements `ThreeDAssetProvider` from T-419
// over the `tripoDescriptor` from `./descriptor.ts`. T-428 ships **stub
// mode** only: `generate()` derives the canonical cache key per ADR-008
// §D1 + returns a deterministic placeholder GLB `data:` URI. Production
// mode throws `NotYetImplementedError` (gated on T-428a — Tripo HTTPS
// API audit pending).
//
// Validation (per AC #4 / #7):
//   - prompt must be a non-empty string after trim.
//
// Defensive ordering inside `generate()`:
//   1. Prompt validation (empty / whitespace-only → throw `Error`).
//   2. Production-mode dispatch → throws `NotYetImplementedError`.
//   3. Stub-mode body: derive cache key, build placeholder GLB URI,
//      return `{ cacheKey, url, vertices: 8, rigged }`.

import type {
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxModel,
} from '@stageflip/adapters-core';
import { cacheKeyString, deriveCacheKey } from '@stageflip/asset-cache';
import type {
  ThreeDAssetProvider,
  ThreeDCall,
  ThreeDCapabilityDescriptor,
  ThreeDResult,
} from '@stageflip/asset-gen-contract';

import { tripoDescriptor } from './descriptor.js';
import { generateStubGlbDataUri } from './stub-glb.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic placeholder GLB
 *   payload (unit cube + optional single bone). Used for tests + as a
 *   placeholder while T-428a's production wire-up audit pends.
 * - `'production'`: real Tripo HTTPS API call. NOT IMPLEMENTED in
 *   T-428 — `generate()` throws `NotYetImplementedError`.
 */
export type TripoProviderMode = 'stub' | 'production';

/**
 * Thrown by `TripoThreeDProvider.generate()` in `'production'` mode.
 * Production wire-up is deferred to T-428a (Tripo HTTPS API surface
 * audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface TripoThreeDProviderOptions {
  readonly mode?: TripoProviderMode;
}

/** Vertex count of the unit-cube placeholder mesh. */
const STUB_VERTEX_COUNT = 8;

/**
 * Reference Tripo3D character adapter (v1; stub-mode body). Implements
 * `ThreeDAssetProvider` so the orchestrator may invoke it through the
 * same surface every other 3D adapter exposes.
 */
export class TripoThreeDProvider implements ThreeDAssetProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = tripoDescriptor.id;
  readonly modality: { readonly kind: 'three-d' } = { kind: 'three-d' };
  readonly capability: ThreeDCapabilityDescriptor;
  readonly license = tripoDescriptor.license;
  readonly sandbox: SandboxModel = tripoDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: TripoProviderMode;

  constructor(options: TripoThreeDProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (tripoDescriptor.costPerCall !== undefined) {
      this.costPerCall = tripoDescriptor.costPerCall;
    }
    if (tripoDescriptor.latencyMs !== undefined) {
      this.latencyMs = tripoDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `ThreeDCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary fields; the
    // strict reader reads a structurally-compatible subset).
    const cap = tripoDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      outputFormats: cap.outputFormats as ThreeDCapabilityDescriptor['outputFormats'],
      topology: cap.topology as ThreeDCapabilityDescriptor['topology'],
      supportsAutoRigging: cap.supportsAutoRigging as boolean,
      maxVertices: cap.maxVertices as number,
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): TripoProviderMode {
    return this.#mode;
  }

  /**
   * Generate a 3D asset for `call`. Stub-mode returns a deterministic
   * placeholder GLB `data:` URI; production mode throws
   * `NotYetImplementedError`.
   *
   * Throws (in this order):
   *   - `Error` when `call.prompt` is empty / whitespace-only;
   *   - `NotYetImplementedError` in production mode (after validation).
   */
  async generate(call: ThreeDCall): Promise<ThreeDResult> {
    // (1) Prompt validation.
    if (typeof call.prompt !== 'string' || call.prompt.trim().length === 0) {
      throw new Error(
        `TripoThreeDProvider.generate: prompt must be a non-empty string after trim; received ${JSON.stringify(call.prompt)}`,
      );
    }

    // (2) Production mode → not yet implemented.
    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'TripoThreeDProvider.generate: production wire-up deferred to T-428a (Tripo HTTPS API audit pending)',
      );
    }

    // (3) Stub mode body.
    const rigRequested = call.rig === true;
    const rigged = rigRequested && this.capability.supportsAutoRigging;
    const url = generateStubGlbDataUri(call.prompt, rigged, call.seed);
    const key = await deriveCacheKey({
      modality: 'three-d',
      model: 'tripo:character',
      prompt: call.prompt,
      params: {
        outputFormat: 'glb',
        topology: this.capability.topology,
        rig: rigged,
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      vertices: STUB_VERTEX_COUNT,
      rigged,
    };
  }
}
