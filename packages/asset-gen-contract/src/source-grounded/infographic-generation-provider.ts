// packages/asset-gen-contract/src/source-grounded/infographic-generation-provider.ts
// `InfographicGenerationProvider` — source-grounded provider class per
// ADR-008 §D9. Output is image bytes; populates an ImageElement.
// MediaProvenance.kind is `'image-gen'` (per §D2 enumeration).

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

/**
 * Opaque forward-declaration of `ImageElement['src']`. Concrete adapters
 * import the real shape from `@stageflip/schema`.
 */
export type ImageElementSrc = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Enums + capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export const INFOGRAPHIC_OUTPUT_FORMATS = ['png', 'svg'] as const;
export type InfographicOutputFormat = (typeof INFOGRAPHIC_OUTPUT_FORMATS)[number];

export interface InfographicCapabilityDescriptor {
  readonly aspectRatios: readonly string[];
  readonly outputFormats: readonly InfographicOutputFormat[];
  readonly maxResolutionPx: number;
}

export const infographicCapabilityDescriptorSchema = z
  .object({
    aspectRatios: z.array(z.string().min(1)).min(1).readonly(),
    outputFormats: z.array(z.enum(INFOGRAPHIC_OUTPUT_FORMATS)).min(1).readonly(),
    maxResolutionPx: z.number().int().positive(),
  })
  .strict();

export const validateInfographicCapability: CapabilityValidator = (capability) => {
  const result = infographicCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface InfographicCall {
  readonly prompt: string;
  readonly aspectRatio: string;
  readonly outputFormat: InfographicOutputFormat;
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface InfographicResult {
  readonly image: ImageElementSrc;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `InfographicGenerationProvider` per ADR-008 §D9. */
export interface InfographicGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'infographic-gen' };
  readonly capability: InfographicCapabilityDescriptor;
  generate(call: InfographicCall): Promise<InfographicResult>;
}
