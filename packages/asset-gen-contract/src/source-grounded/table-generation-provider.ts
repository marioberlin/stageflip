// packages/asset-gen-contract/src/source-grounded/table-generation-provider.ts
// `TableGenerationProvider` — source-grounded provider class per ADR-008
// §D9. Output populates an existing `TableElement.content`.
//
// `TableElement` lives in `@stageflip/schema`. T-419 keeps the content
// shape opaque; concrete adapters import the real type.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

/**
 * Opaque forward-declaration of `TableElement['content']`. Concrete
 * adapters import the real shape from `@stageflip/schema`.
 */
export type TableElementContent = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export interface TableCapabilityDescriptor {
  readonly maxRows: number;
  readonly maxCols: number;
}

export const tableCapabilityDescriptorSchema = z
  .object({
    maxRows: z.number().int().positive(),
    maxCols: z.number().int().positive(),
  })
  .strict();

export const validateTableCapability: CapabilityValidator = (capability) => {
  const result = tableCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface TableCall {
  readonly prompt: string;
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface TableResult {
  readonly table: TableElementContent;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `TableGenerationProvider` per ADR-008 §D9. */
export interface TableGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'table-gen' };
  readonly capability: TableCapabilityDescriptor;
  generate(call: TableCall): Promise<TableResult>;
}
