// packages/asset-gen-contract/src/source-grounded/slide-deck-generation-provider.ts
// `SlideDeckGenerationProvider` — source-grounded provider class per
// ADR-008 §D9. Extends `AdapterDescriptor` (T-418).
//
// Generates a `Document` (full canonical structure, not asset bytes).
// `Document` lives in `@stageflip/schema` — T-419 forward-declares as a
// minimal opaque type to avoid a hard dep on the schema package; T-421's
// schema work doesn't change this surface (the adapter side already
// imports from @stageflip/schema).

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

// ----------------------------------------------------------------------------
// Forward-declared opaque Document
// ----------------------------------------------------------------------------

/**
 * Opaque forward-declaration of `@stageflip/schema`'s `Document` type.
 * Concrete adapters import the real type; the contract surface is opaque
 * to keep T-419 dep-free. Per ADR-008 §D9.
 */
export type SlideDeckDocument = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export interface SlideDeckCapabilityDescriptor {
  readonly maxSlides: number;
  /** Themes / templates the provider can apply at generation time. */
  readonly templates: readonly string[];
}

export const slideDeckCapabilityDescriptorSchema = z
  .object({
    maxSlides: z.number().int().positive(),
    templates: z.array(z.string().min(1)).readonly(),
  })
  .strict();

export const validateSlideDeckCapability: CapabilityValidator = (capability) => {
  const result = slideDeckCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface SlideDeckCall {
  readonly prompt: string;
  readonly template?: string;
  /** Set when the call runs inside a research session (per ADR-008 §D7). */
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface SlideDeckResult {
  readonly document: SlideDeckDocument;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `SlideDeckGenerationProvider` per ADR-008 §D9. */
export interface SlideDeckGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'slide-deck-gen' };
  readonly capability: SlideDeckCapabilityDescriptor;
  generate(call: SlideDeckCall): Promise<SlideDeckResult>;
}
