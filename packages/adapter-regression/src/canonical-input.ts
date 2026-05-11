// packages/adapter-regression/src/canonical-input.ts
// Per-modality canonical sample inputs the regression suite feeds to each
// adapter (T-435). One canonical input per modality; per-adapter overrides
// (voiceId / sampleRate) live in the `ADAPTER_INPUT_OVERRIDES` table below
// because each adapter's strict input-validation rejects calls that
// don't match its declared capability.
//
// The fixtures are deliberately minimal — the goal is to exercise the
// stub-mode output-shaping path, NOT to fuzz the validation surface
// (which lives in each adapter's own test suite). One sample input per
// adapter is enough to catch any drift in:
//
//   - descriptor → snapshot.descriptorSha256
//   - capability → indirectly via descriptor hash
//   - stub-mode output shape (cacheKey + result body) → outputSha256
//   - cache-key derivation → cacheKey
//
// Pure module — no I/O, no clocks, no random. Pure data + a small lookup
// function.

import type { AdapterModalityKind } from '@stageflip/adapters-core';

/** All 9 adapter ids T-435 covers. Frozen. */
export const ADAPTER_IDS = [
  'kokoro',
  'fish-speech',
  'tripo',
  'meshy',
  'seedance',
  'runway',
  'ace-step',
  'yue',
  'stable-audio-open',
] as const satisfies readonly string[];

export type AdapterId = (typeof ADAPTER_IDS)[number];

/** Map every adapter id to its modality. Frozen. */
export const ADAPTER_MODALITY: Readonly<Record<AdapterId, AdapterModalityKind>> = {
  kokoro: 'tts',
  'fish-speech': 'tts',
  tripo: 'three-d',
  meshy: 'three-d',
  seedance: 'video-gen',
  runway: 'video-gen',
  'ace-step': 'music-gen',
  yue: 'music-gen',
  'stable-audio-open': 'sfx',
};

/**
 * Per-adapter overrides for modality-canonical defaults. Each adapter's
 * declared capability narrows the legal range of `voiceId`, `sampleRate`,
 * etc.; the override carries those.
 */
interface AdapterInputOverride {
  readonly voiceId?: string;
  readonly sampleRate?: number;
}

const ADAPTER_INPUT_OVERRIDES: Readonly<Record<AdapterId, AdapterInputOverride>> = {
  // TTS — voiceId + sampleRate are adapter-declared.
  kokoro: { voiceId: 'af_default', sampleRate: 24000 },
  'fish-speech': { voiceId: 'fs_en_default', sampleRate: 22050 },
  // SFX — sampleRate is adapter-declared.
  'stable-audio-open': { sampleRate: 44100 },
  // Other modalities inherit the modality default without override.
  tripo: {},
  meshy: {},
  seedance: {},
  runway: {},
  'ace-step': {},
  yue: {},
};

/**
 * Canonical sample input for an adapter. The shape is modality-specific
 * but always a plain JSON object (matches the per-call shapes in
 * `@stageflip/asset-gen-contract`).
 */
export type CanonicalInput = Readonly<Record<string, unknown>>;

/**
 * Return the canonical sample input for `adapterId`. Throws if the
 * adapter id is not in `ADAPTER_IDS`.
 *
 * The returned object is JSON-stable: object-key insertion order is
 * documented but the canonicalizer doesn't care.
 */
export function canonicalInputFor(adapterId: AdapterId): CanonicalInput {
  const modality = ADAPTER_MODALITY[adapterId];
  const overrides = ADAPTER_INPUT_OVERRIDES[adapterId];
  switch (modality) {
    case 'tts': {
      const voiceId = overrides.voiceId;
      const sampleRate = overrides.sampleRate;
      if (voiceId === undefined || sampleRate === undefined) {
        throw new Error(
          `canonicalInputFor: TTS adapter ${adapterId} requires voiceId + sampleRate overrides`,
        );
      }
      return {
        tenantId: 't-regression',
        voiceId,
        text: 'Hello world.',
        outputFormat: 'wav',
        sampleRate,
        seed: 1,
      };
    }
    case 'video-gen': {
      return {
        prompt: 'A cat on a mat.',
        aspectRatio: '16:9',
        frameRate: 24,
        durationS: 5,
        outputFormat: 'mp4',
        seed: 1,
      };
    }
    case 'music-gen': {
      return {
        prompt: 'Ambient pad.',
        durationS: 30,
        outputFormat: 'wav',
        seed: 1,
      };
    }
    case 'sfx': {
      const sampleRate = overrides.sampleRate;
      if (sampleRate === undefined) {
        throw new Error(
          `canonicalInputFor: SFX adapter ${adapterId} requires sampleRate override`,
        );
      }
      return {
        prompt: 'A door creak.',
        durationS: 2,
        outputFormat: 'wav',
        sampleRate,
        seed: 1,
      };
    }
    case 'three-d': {
      return {
        prompt: 'A simple character.',
        rig: false,
        seed: 1,
      };
    }
    default:
      // Modalities outside the 5 β set (e.g. source-grounded) are not
      // covered by Phase 14 β reference adapters. T-435 may grow new
      // cases when those modalities ship reference adapters.
      throw new Error(`canonicalInputFor: unsupported modality "${modality}" for ${adapterId}`);
  }
}

/** True iff `value` is one of the 9 reference adapter ids. */
export function isAdapterId(value: string): value is AdapterId {
  return (ADAPTER_IDS as readonly string[]).includes(value);
}
