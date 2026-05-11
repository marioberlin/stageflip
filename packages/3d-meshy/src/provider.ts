// packages/3d-meshy/src/provider.ts
// `MeshyThreeDProvider` — implements `ThreeDAssetProvider` from T-419
// over the `meshyDescriptor` from `./descriptor.ts`. T-429 ships **stub
// mode** only: `generate()` derives the canonical cache key per ADR-008
// §D1 + returns a deterministic placeholder GLB `data:` URI. Production
// mode throws `NotYetImplementedError` (gated on T-429a — Meshy HTTPS
// API audit pending).
//
// Validation (per AC #4 / #7):
//   - prompt must be a non-empty string after trim.
//
// Defensive ordering inside `generate()`:
//   1. Prompt validation (empty / whitespace-only → throw `Error`).
//   2. Production-mode dispatch → throws `NotYetImplementedError`.
//   3. Stub-mode body: derive cache key, build placeholder GLB URI,
//      return `{ cacheKey, url, vertices: 12, rigged: false }`.
//
// **No-rig invariant**: `capability.supportsAutoRigging === false`, so
// `rigged` is ALWAYS `false` regardless of `call.rig`. The cache-key
// params dict also fixes `rig: false` so callers passing `rig: true`
// hash to the same cache key as `rig: false` (the request is silently
// refused at the rigging layer per ADR-008 §D6 — T-437 refuses rigging
// on `triangle-soup` topology regardless of the caller's intent).

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

import { meshyDescriptor } from './descriptor.js';
import { generateStubGlbDataUri } from './stub-glb.js';

/**
 * Discriminator for the provider mode.
 *
 * - `'stub'` (v1 default): synthesizes a deterministic placeholder GLB
 *   payload (regular icosahedron). Used for tests + as a placeholder
 *   while T-429a's production wire-up audit pends.
 * - `'production'`: real Meshy HTTPS API call. NOT IMPLEMENTED in
 *   T-429 — `generate()` throws `NotYetImplementedError`.
 */
export type MeshyProviderMode = 'stub' | 'production';

/**
 * Thrown by `MeshyThreeDProvider.generate()` in `'production'` mode.
 * Production wire-up is deferred to T-429a (Meshy HTTPS API surface
 * audit pending).
 */
export class NotYetImplementedError extends Error {
  override readonly name = 'NotYetImplementedError';
}

/** Construction options. Defaults to `{ mode: 'stub' }`. */
export interface MeshyThreeDProviderOptions {
  readonly mode?: MeshyProviderMode;
}

/** Vertex count of the icosahedron placeholder mesh. */
const STUB_VERTEX_COUNT = 12;

/**
 * Reference Meshy 3D adapter (v1; stub-mode body). Targets props +
 * environment + vehicles + hard-surface objects. Implements
 * `ThreeDAssetProvider` so the orchestrator may invoke it through the
 * same surface every other 3D adapter exposes.
 */
export class MeshyThreeDProvider implements ThreeDAssetProvider {
  // --- AdapterDescriptor passthrough --------------------------------------
  readonly id: string = meshyDescriptor.id;
  readonly modality: { readonly kind: 'three-d' } = { kind: 'three-d' };
  readonly capability: ThreeDCapabilityDescriptor;
  readonly license = meshyDescriptor.license;
  readonly sandbox: SandboxModel = meshyDescriptor.sandbox;
  // `exactOptionalPropertyTypes`: only declare optional fields when the
  // descriptor sets them; otherwise omit so the property is genuinely
  // absent (not `present-and-undefined`).
  readonly costPerCall?: CostHint;
  readonly latencyMs?: LatencyHint;

  readonly #mode: MeshyProviderMode;

  constructor(options: MeshyThreeDProviderOptions = {}) {
    this.#mode = options.mode ?? 'stub';
    if (meshyDescriptor.costPerCall !== undefined) {
      this.costPerCall = meshyDescriptor.costPerCall;
    }
    if (meshyDescriptor.latencyMs !== undefined) {
      this.latencyMs = meshyDescriptor.latencyMs;
    }
    // Narrow the descriptor's opaque `CapabilityDescriptor` envelope back
    // to the strict `ThreeDCapabilityDescriptor` shape (the descriptor
    // stores the strict subset PLUS the catalog-summary fields; the
    // strict reader reads a structurally-compatible subset).
    const cap = meshyDescriptor.capability as CapabilityDescriptor;
    this.capability = {
      outputFormats: cap.outputFormats as ThreeDCapabilityDescriptor['outputFormats'],
      topology: cap.topology as ThreeDCapabilityDescriptor['topology'],
      supportsAutoRigging: cap.supportsAutoRigging as boolean,
      maxVertices: cap.maxVertices as number,
    };
  }

  /** The current provider mode. Test-only accessor. */
  get mode(): MeshyProviderMode {
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
        `MeshyThreeDProvider.generate: prompt must be a non-empty string after trim; received ${JSON.stringify(call.prompt)}`,
      );
    }

    // (2) Production mode → not yet implemented.
    if (this.#mode === 'production') {
      throw new NotYetImplementedError(
        'MeshyThreeDProvider.generate: production wire-up deferred to T-429a (Meshy HTTPS API audit pending)',
      );
    }

    // (3) Stub mode body. `rigged` is forced false: capability declares
    // no auto-rigging, and triangle-soup topology is rigging-ineligible
    // per ADR-008 §D6 regardless. The cache-key params dict fixes
    // `rig: false` so callers passing `rig: true` hash identically.
    const url = generateStubGlbDataUri(call.prompt, call.seed);
    const key = await deriveCacheKey({
      modality: 'three-d',
      model: 'meshy:prop-environment',
      prompt: call.prompt,
      params: {
        outputFormat: 'glb',
        topology: this.capability.topology,
        rig: false,
      },
      ...(call.seed !== undefined ? { seed: call.seed } : {}),
    });

    return {
      cacheKey: cacheKeyString(key),
      url,
      vertices: STUB_VERTEX_COUNT,
      rigged: false,
    };
  }
}
