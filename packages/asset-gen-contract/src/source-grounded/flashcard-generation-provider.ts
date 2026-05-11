// packages/asset-gen-contract/src/source-grounded/flashcard-generation-provider.ts
// `FlashcardGenerationProvider` — source-grounded provider class per
// ADR-008 §D9.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

/**
 * Opaque forward-declaration of `FlashcardClipProps`. The FlashcardClip
 * family ships the concrete shape (Phase 14 γ / Phase 16).
 */
export type FlashcardClipProps = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export interface FlashcardCapabilityDescriptor {
  readonly maxCards: number;
  readonly supportsImages: boolean;
}

export const flashcardCapabilityDescriptorSchema = z
  .object({
    maxCards: z.number().int().positive(),
    supportsImages: z.boolean(),
  })
  .strict();

export const validateFlashcardCapability: CapabilityValidator = (capability) => {
  const result = flashcardCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface FlashcardCall {
  readonly prompt: string;
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface FlashcardResult {
  readonly flashcards: FlashcardClipProps;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `FlashcardGenerationProvider` per ADR-008 §D9. */
export interface FlashcardGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'flashcard-gen' };
  readonly capability: FlashcardCapabilityDescriptor;
  generate(call: FlashcardCall): Promise<FlashcardResult>;
}
