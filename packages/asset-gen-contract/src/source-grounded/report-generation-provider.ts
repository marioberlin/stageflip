// packages/asset-gen-contract/src/source-grounded/report-generation-provider.ts
// `ReportGenerationProvider` — source-grounded provider class per
// ADR-008 §D9. Output populates a TextElement (or several).

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

/**
 * Opaque forward-declaration of `TextElement['content']`. Concrete
 * adapters import the real shape from `@stageflip/schema`.
 */
export type TextElementContent = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Enums + capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export const REPORT_FORMATS = ['briefing-doc', 'study-guide', 'blog-post', 'custom'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export interface ReportCapabilityDescriptor {
  readonly formats: readonly ReportFormat[];
  readonly maxTokens: number;
}

export const reportCapabilityDescriptorSchema = z
  .object({
    formats: z.array(z.enum(REPORT_FORMATS)).min(1).readonly(),
    maxTokens: z.number().int().positive(),
  })
  .strict();

export const validateReportCapability: CapabilityValidator = (capability) => {
  const result = reportCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface ReportCall {
  readonly prompt: string;
  readonly format: ReportFormat;
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface ReportResult {
  readonly text: TextElementContent;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `ReportGenerationProvider` per ADR-008 §D9. */
export interface ReportGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'report-gen' };
  readonly capability: ReportCapabilityDescriptor;
  generate(call: ReportCall): Promise<ReportResult>;
}
