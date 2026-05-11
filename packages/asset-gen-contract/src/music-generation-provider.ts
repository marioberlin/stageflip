// packages/asset-gen-contract/src/music-generation-provider.ts
// `MusicGenerationProvider` interface + capability Zod schema + capability
// validator. Verbatim from ADR-008 §D6. Extends `AdapterDescriptor` (T-418).
//
// `outputLicense` is critical for the monetization story (ADR-008 §D13):
// ACE-Step (MIT) emits commercially-usable output; YuE (Apache + attribution)
// records attribution in MediaProvenance. T-422 (check-asset-licenses)
// enforces the modality-aware whitelist.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Enums (ADR-008 §D6)
// ----------------------------------------------------------------------------

/** Audio container formats music-gen adapters may emit. */
export const MUSIC_GEN_OUTPUT_FORMATS = ['wav', 'mp3', 'flac'] as const;
export type MusicGenOutputFormat = (typeof MUSIC_GEN_OUTPUT_FORMATS)[number];

/**
 * License disposition of the generated track. Drives T-422's per-tenant
 * license-posture filter:
 *   - `permissive`            — commercially usable, no attribution.
 *   - `attribution-required`  — commercially usable with attribution
 *                                recorded in `MediaProvenance`.
 *   - `non-commercial`        — refused unless tenant explicitly opts in.
 */
export const MUSIC_GEN_OUTPUT_LICENSES = [
  'permissive',
  'attribution-required',
  'non-commercial',
] as const;
export type MusicGenOutputLicense = (typeof MUSIC_GEN_OUTPUT_LICENSES)[number];

// ----------------------------------------------------------------------------
// Capability descriptor
// ----------------------------------------------------------------------------

export interface MusicGenCapabilityDescriptor {
  /**
   * Genres / moods the model can target. Descriptive; not a closed enum
   * because vocabularies vary across vendors.
   */
  readonly genres: readonly string[];
  /** Maximum duration per call (seconds). */
  readonly maxDurationS: number;
  /** Output formats. */
  readonly outputFormats: readonly MusicGenOutputFormat[];
  /** License disposition of the generated track (drives T-422 enforcement). */
  readonly outputLicense: MusicGenOutputLicense;
}

export const musicGenCapabilityDescriptorSchema = z
  .object({
    genres: z.array(z.string().min(1)).min(1).readonly(),
    maxDurationS: z.number().positive(),
    outputFormats: z.array(z.enum(MUSIC_GEN_OUTPUT_FORMATS)).min(1).readonly(),
    outputLicense: z.enum(MUSIC_GEN_OUTPUT_LICENSES),
  })
  .strict();

export const validateMusicGenCapability: CapabilityValidator = (capability) => {
  const result = musicGenCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface MusicGenCall {
  readonly prompt: string;
  readonly genre?: string;
  readonly durationS: number;
  readonly outputFormat: MusicGenOutputFormat;
  readonly seed?: number;
}

export interface MusicGenResult {
  readonly cacheKey: string;
  readonly url: string;
  readonly durationS: number;
  /**
   * Attribution string the exporter MUST surface when the adapter's
   * `outputLicense` is `'attribution-required'`. Absent for other
   * dispositions.
   */
  readonly attribution?: string;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D6)
// ----------------------------------------------------------------------------

/**
 * `MusicGenerationProvider` extends `AdapterDescriptor` with music-gen-
 * specific call shape and capability. Per ADR-008 §D6.
 */
export interface MusicGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'music-gen' };
  readonly capability: MusicGenCapabilityDescriptor;
  generate(call: MusicGenCall): Promise<MusicGenResult>;
}
