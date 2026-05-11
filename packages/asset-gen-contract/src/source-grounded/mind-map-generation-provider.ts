// packages/asset-gen-contract/src/source-grounded/mind-map-generation-provider.ts
// `MindMapGenerationProvider` — source-grounded provider class per
// ADR-008 §D9. Extends `AdapterDescriptor` (T-418).
//
// Generates a `MindMapTree` consumed by the (deferred) MindMapClip
// runtime (Phase 14 γ / Phase 16). T-419 forward-declares the tree
// shape as opaque; the clip family ships the concrete shape.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

// ----------------------------------------------------------------------------
// Forward-declared MindMapTree (opaque)
// ----------------------------------------------------------------------------

/**
 * Opaque forward-declaration of the MindMapClip runtime's tree shape.
 * The clip ships the concrete shape (Phase 14 γ / Phase 16).
 */
export type MindMapTree = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export interface MindMapCapabilityDescriptor {
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export const mindMapCapabilityDescriptorSchema = z
  .object({
    maxDepth: z.number().int().positive(),
    maxNodes: z.number().int().positive(),
  })
  .strict();

export const validateMindMapCapability: CapabilityValidator = (capability) => {
  const result = mindMapCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface MindMapCall {
  readonly prompt: string;
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface MindMapResult {
  readonly mindMap: MindMapTree;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `MindMapGenerationProvider` per ADR-008 §D9. */
export interface MindMapGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'mind-map-gen' };
  readonly capability: MindMapCapabilityDescriptor;
  generate(call: MindMapCall): Promise<MindMapResult>;
}
