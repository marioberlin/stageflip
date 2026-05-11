// packages/adapter-regression/src/canonical-input.test.ts
// Tests for the per-modality canonical-input fixtures (T-435).

import { describe, expect, it } from 'vitest';

import {
  ADAPTER_IDS,
  ADAPTER_MODALITY,
  type AdapterId,
  canonicalInputFor,
  isAdapterId,
} from './canonical-input.js';

describe('ADAPTER_IDS', () => {
  it('contains all 9 reference adapter ids', () => {
    expect(ADAPTER_IDS).toEqual([
      'kokoro',
      'fish-speech',
      'tripo',
      'meshy',
      'seedance',
      'runway',
      'ace-step',
      'yue',
      'stable-audio-open',
    ]);
  });
});

describe('ADAPTER_MODALITY', () => {
  it('maps each adapter id to its modality', () => {
    expect(ADAPTER_MODALITY.kokoro).toBe('tts');
    expect(ADAPTER_MODALITY['fish-speech']).toBe('tts');
    expect(ADAPTER_MODALITY.tripo).toBe('three-d');
    expect(ADAPTER_MODALITY.meshy).toBe('three-d');
    expect(ADAPTER_MODALITY.seedance).toBe('video-gen');
    expect(ADAPTER_MODALITY.runway).toBe('video-gen');
    expect(ADAPTER_MODALITY['ace-step']).toBe('music-gen');
    expect(ADAPTER_MODALITY.yue).toBe('music-gen');
    expect(ADAPTER_MODALITY['stable-audio-open']).toBe('sfx');
  });
});

describe('isAdapterId', () => {
  it('returns true for known ids', () => {
    expect(isAdapterId('kokoro')).toBe(true);
  });
  it('returns false for unknown ids', () => {
    expect(isAdapterId('not-an-adapter')).toBe(false);
  });
});

describe('canonicalInputFor', () => {
  it.each(ADAPTER_IDS)('returns a non-empty object for %s', (id) => {
    const input = canonicalInputFor(id as AdapterId);
    expect(Object.keys(input).length).toBeGreaterThan(0);
  });

  it('returns a valid TTS shape for kokoro', () => {
    const input = canonicalInputFor('kokoro');
    expect(input).toMatchObject({
      tenantId: 't-regression',
      voiceId: 'af_default',
      text: 'Hello world.',
      outputFormat: 'wav',
      sampleRate: 24000,
      seed: 1,
    });
  });

  it('returns a valid TTS shape for fish-speech with 22050Hz', () => {
    const input = canonicalInputFor('fish-speech');
    expect(input.sampleRate).toBe(22050);
    expect(input.voiceId).toBe('fs_en_default');
  });

  it('returns a valid video-gen shape for seedance', () => {
    const input = canonicalInputFor('seedance');
    expect(input).toMatchObject({
      prompt: 'A cat on a mat.',
      aspectRatio: '16:9',
      frameRate: 24,
      durationS: 5,
      outputFormat: 'mp4',
      seed: 1,
    });
  });

  it('returns a valid music-gen shape for ace-step', () => {
    const input = canonicalInputFor('ace-step');
    expect(input).toMatchObject({
      prompt: 'Ambient pad.',
      durationS: 30,
      outputFormat: 'wav',
      seed: 1,
    });
  });

  it('returns a valid sfx shape for stable-audio-open with 44100Hz', () => {
    const input = canonicalInputFor('stable-audio-open');
    expect(input).toMatchObject({
      prompt: 'A door creak.',
      durationS: 2,
      outputFormat: 'wav',
      sampleRate: 44100,
      seed: 1,
    });
  });

  it('returns a valid three-d shape for tripo', () => {
    const input = canonicalInputFor('tripo');
    expect(input).toMatchObject({
      prompt: 'A simple character.',
      rig: false,
      seed: 1,
    });
  });
});
