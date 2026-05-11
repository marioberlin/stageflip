// packages/asset-gen-contract/src/sfx-provider.ts
// `SFXProvider` interface + capability Zod schema + capability validator.
// Verbatim from ADR-008 §D6. Extends `AdapterDescriptor` (T-418).
//
// SFX adapters typically emit short (1–15s) clips; `supportsLoop` flags
// the ability to emit a seamlessly-loopable clip (e.g. ambient pad).

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Output formats
// ----------------------------------------------------------------------------

/** Audio container formats sfx adapters may emit per ADR-008 §D6. */
export const SFX_OUTPUT_FORMATS = ['wav', 'mp3', 'flac'] as const;
export type SfxOutputFormat = (typeof SFX_OUTPUT_FORMATS)[number];

// ----------------------------------------------------------------------------
// Capability descriptor
// ----------------------------------------------------------------------------

export interface SfxCapabilityDescriptor {
  readonly outputFormats: readonly SfxOutputFormat[];
  readonly sampleRates: readonly number[];
  /** Maximum duration per call (seconds). SFX typically 1–15 s. */
  readonly maxDurationS: number;
  /** Whether the adapter can emit a seamlessly-loopable clip. */
  readonly supportsLoop: boolean;
}

export const sfxCapabilityDescriptorSchema = z
  .object({
    outputFormats: z.array(z.enum(SFX_OUTPUT_FORMATS)).min(1).readonly(),
    sampleRates: z.array(z.number().int().positive()).min(1).readonly(),
    maxDurationS: z.number().positive(),
    supportsLoop: z.boolean(),
  })
  .strict();

export const validateSfxCapability: CapabilityValidator = (capability) => {
  const result = sfxCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface SfxCall {
  readonly prompt: string;
  readonly durationS: number;
  readonly outputFormat: SfxOutputFormat;
  readonly sampleRate: number;
  /** When set, request a loopable clip (only valid if capability.supportsLoop). */
  readonly loop?: boolean;
  readonly seed?: number;
}

export interface SfxResult {
  readonly cacheKey: string;
  readonly url: string;
  readonly durationS: number;
  readonly isLoopable: boolean;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D6)
// ----------------------------------------------------------------------------

/** `SFXProvider` per ADR-008 §D6. */
export interface SFXProvider extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'sfx' };
  readonly capability: SfxCapabilityDescriptor;
  generate(call: SfxCall): Promise<SfxResult>;
}
