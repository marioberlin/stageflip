// packages/asset-gen-contract/src/three-d-asset-provider.ts
// `ThreeDAssetProvider` interface + capability Zod schema + capability
// validator. Verbatim from ADR-008 §D6. Extends `AdapterDescriptor` (T-418).
//
// GLB is the only output format ThreeSceneClip / T-437 consumes (per §D6).
// `topology` discriminates quad-clean (Tripo characters; rigging-eligible)
// vs. triangle-soup (most prop generators); T-437 refuses rigging on
// triangle-soup output.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums (ADR-008 §D6)
// ----------------------------------------------------------------------------

/** Output formats. GLB is mandatory; the array literally contains only `glb`. */
export const THREE_D_OUTPUT_FORMATS = ['glb'] as const;
export type ThreeDOutputFormat = (typeof THREE_D_OUTPUT_FORMATS)[number];

/**
 * Topology of the emitted mesh. Drives T-437's rigging eligibility:
 * - `quad-clean`     — clean quads, rigging-pipeline-eligible.
 * - `triangle-soup`  — triangle output from prop generators; rigging refused.
 * - `mixed`          — adapter may emit either; T-437 inspects per-asset.
 */
export const THREE_D_TOPOLOGIES = ['quad-clean', 'triangle-soup', 'mixed'] as const;
export type ThreeDTopology = (typeof THREE_D_TOPOLOGIES)[number];

// ----------------------------------------------------------------------------
// Capability descriptor
// ----------------------------------------------------------------------------

export interface ThreeDCapabilityDescriptor {
  /** GLB output is mandatory (ADR-008 §D6). */
  readonly outputFormats: readonly ['glb'];
  /** Topology of emitted meshes. */
  readonly topology: ThreeDTopology;
  /** Whether the adapter can rig characters (skeleton + skinning weights). */
  readonly supportsAutoRigging: boolean;
  /**
   * Approximate maximum mesh complexity in vertices. Declarative; the
   * agent uses this to refuse callers asking for over-budget assets.
   */
  readonly maxVertices: number;
}

export const threeDCapabilityDescriptorSchema = z
  .object({
    outputFormats: z.tuple([z.literal('glb')]).readonly(),
    topology: z.enum(THREE_D_TOPOLOGIES),
    supportsAutoRigging: z.boolean(),
    maxVertices: z.number().int().positive(),
  })
  .strict();

export const validateThreeDCapability: CapabilityValidator = (capability) => {
  const result = threeDCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface ThreeDCall {
  readonly prompt: string;
  /**
   * When set true AND `capability.supportsAutoRigging` is true, the
   * adapter rigs the emitted mesh. Otherwise the mesh is unrigged.
   */
  readonly rig?: boolean;
  readonly seed?: number;
}

export interface ThreeDResult {
  readonly cacheKey: string;
  /** URL to the GLB asset. */
  readonly url: string;
  /** Approximate vertex count of the emitted mesh. */
  readonly vertices: number;
  /** True when the asset includes skeleton + skinning weights. */
  readonly rigged: boolean;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D6)
// ----------------------------------------------------------------------------

/** `ThreeDAssetProvider` per ADR-008 §D6. */
export interface ThreeDAssetProvider extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'three-d' };
  readonly capability: ThreeDCapabilityDescriptor;
  generate(call: ThreeDCall): Promise<ThreeDResult>;
}
