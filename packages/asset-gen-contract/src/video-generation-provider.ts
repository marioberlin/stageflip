// packages/asset-gen-contract/src/video-generation-provider.ts
// `VideoGenerationProvider` interface + capability Zod schema + capability
// validator. Verbatim from ADR-008 §D6. Extends `AdapterDescriptor` (T-418).
//
// Per ADR-008 §D6: aspect-ratio + frame-rate + max-duration + output-format
// + emits-audio + safety-filters. Routing layer surfaces `safetyFilters` to
// the agent UI; it does not interpret them.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

// ----------------------------------------------------------------------------
// Output formats
// ----------------------------------------------------------------------------

/** Video container formats per ADR-008 §D6. */
export const VIDEO_GEN_OUTPUT_FORMATS = ['mp4', 'webm'] as const;
export type VideoGenOutputFormat = (typeof VIDEO_GEN_OUTPUT_FORMATS)[number];

// ----------------------------------------------------------------------------
// Capability descriptor (ADR-008 §D6)
// ----------------------------------------------------------------------------

/**
 * Capability shape video-gen adapters declare. `aspectRatios` are
 * descriptive strings (e.g. `'16:9'`, `'9:16'`, `'1:1'`); the routing
 * engine filters by exact match against caller intent.
 *
 * `emitsAudio` reflects whether the adapter produces audio alongside the
 * video track (Seedance 2.0 does; most others don't). The captions
 * pipeline (T-436) consumes this hint to decide whether to run Whisper.
 *
 * `safetyFilters` is opaque to the routing layer — adapters declare which
 * filters they support (e.g. `'no-faces'`, `'no-text'`); the agent UI
 * surfaces them so the user can pick.
 */
export interface VideoGenCapabilityDescriptor {
  /** Aspect ratios this adapter can emit. */
  readonly aspectRatios: readonly string[];
  /** Frame rates (fps). */
  readonly frameRates: readonly number[];
  /** Maximum duration per call (seconds). */
  readonly maxDurationS: number;
  /** Output container formats. */
  readonly outputFormats: readonly VideoGenOutputFormat[];
  /** Whether the adapter emits audio. */
  readonly emitsAudio: boolean;
  /**
   * Adapter-declared safety filters (descriptive; routing layer surfaces,
   * does not interpret).
   */
  readonly safetyFilters: readonly string[];
}

export const videoGenCapabilityDescriptorSchema = z
  .object({
    aspectRatios: z.array(z.string().min(1)).min(1).readonly(),
    frameRates: z.array(z.number().positive()).min(1).readonly(),
    maxDurationS: z.number().positive(),
    outputFormats: z.array(z.enum(VIDEO_GEN_OUTPUT_FORMATS)).min(1).readonly(),
    emitsAudio: z.boolean(),
    safetyFilters: z.array(z.string()).readonly(),
  })
  .strict();

/** Capability validator plugging into T-418's `CapabilityDescriptorParser`. */
export const validateVideoGenCapability: CapabilityValidator = (capability) => {
  const result = videoGenCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

/**
 * Per-call input. Minimal-viable; reference adapters refine via consumer-
 * side narrowing if they need more fields (per ADR-008 §D6 closing note).
 */
export interface VideoGenCall {
  readonly prompt: string;
  readonly aspectRatio: string;
  readonly frameRate: number;
  readonly durationS: number;
  readonly outputFormat: VideoGenOutputFormat;
  readonly safetyFilters?: readonly string[];
  readonly seed?: number;
}

/** Per-call output. `cacheKey` matches ADR-008 §D1's cache-key shape. */
export interface VideoGenResult {
  readonly cacheKey: string;
  readonly url: string;
  readonly durationS: number;
  readonly aspectRatio: string;
  readonly frameRate: number;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D6)
// ----------------------------------------------------------------------------

/**
 * `VideoGenerationProvider` extends `AdapterDescriptor` with video-gen-
 * specific call shape and capability. Per ADR-008 §D6.
 */
export interface VideoGenerationProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'video-gen' };
  readonly capability: VideoGenCapabilityDescriptor;
  generate(call: VideoGenCall): Promise<VideoGenResult>;
}
