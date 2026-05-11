// packages/export-video/src/provenance-walk.test.ts
// T-440 — provenance-walk unit tests: classifyAiKind + extractAiContentManifest.

import type { MediaProvenance } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  type AiVideoElementInputRow,
  classifyAiKind,
  extractAiContentManifest,
} from './provenance-walk.js';
import { DEFAULT_AI_WATERMARK } from './ai-watermark.js';

function ttsProvenance(overrides: Partial<MediaProvenance> = {}): MediaProvenance {
  return {
    kind: 'tts',
    provider: 'tts-kokoro',
    model: 'kokoro-82m',
    prompt: 'hello world',
    cacheKey: 'sha256-tts-abc',
    voiceProvider: 'kokoro',
    voiceId: 'af-bella',
    ...overrides,
  };
}

describe('classifyAiKind', () => {
  it('returns true for each AI-generated kind', () => {
    for (const kind of [
      'tts',
      'video-gen',
      'music-gen',
      'sfx',
      'three-d',
      'image-gen',
      'asset-gen-pending',
    ] as const) {
      expect(classifyAiKind(kind)).toBe(true);
    }
  });

  it('returns false for imported', () => {
    expect(classifyAiKind('imported')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(classifyAiKind(undefined)).toBe(false);
  });

  it('returns false for unknown kinds (defensive)', () => {
    expect(classifyAiKind('mystery-kind' as never)).toBe(false);
  });
});

describe('extractAiContentManifest', () => {
  it('returns undefined for an empty input', () => {
    const out = extractAiContentManifest([], { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out).toBeUndefined();
  });

  it('returns undefined when no AI elements present', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
      { elementId: 'el-no-prov' },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out).toBeUndefined();
  });

  it('extracts a single TTS element with all provenance fields copied', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'el-1',
        provenance: ttsProvenance(),
        frameRange: { startFrame: 5, endFrame: 30 },
      },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out).toBeDefined();
    expect(out?.elements).toHaveLength(1);
    expect(out?.elements[0]).toEqual({
      elementId: 'el-1',
      provider: 'tts-kokoro',
      modality: 'tts',
      cacheKey: 'sha256-tts-abc',
      prompt: 'hello world',
      frameRange: { startFrame: 5, endFrame: 30 },
    });
  });

  it('filters out imported / no-provenance elements', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
      { elementId: 'el-no-prov' },
      { elementId: 'el-tts', provenance: ttsProvenance() },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out?.elements).toHaveLength(1);
    expect(out?.elements[0]?.elementId).toBe('el-tts');
  });

  it('preserves input order across multiple AI elements', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'b', provenance: ttsProvenance() },
      {
        elementId: 'a',
        provenance: { kind: 'image-gen', provider: 'image-flux', model: 'flux-1' },
      },
      {
        elementId: 'c',
        provenance: { kind: 'video-gen', provider: 'video-seedance', model: 'seedance-1' },
      },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out?.elements.map((e) => e.elementId)).toEqual(['b', 'a', 'c']);
  });

  it('omits prompt / cacheKey / frameRange when absent on the provenance', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'el-1',
        provenance: { kind: 'three-d', provider: 'three-d-tripo', model: 'tripo-1' },
      },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out?.elements[0]).toEqual({
      elementId: 'el-1',
      provider: 'three-d-tripo',
      modality: 'three-d',
    });
  });

  it('uses literal "unknown" for provider when provenance.provider is absent', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-1', provenance: { kind: 'tts' } },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out?.elements[0]?.provider).toBe('unknown');
  });

  it('flows partial watermark config + defaults into manifest.watermark', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-1', provenance: ttsProvenance() },
    ];
    const out = extractAiContentManifest(inputs, {
      ...DEFAULT_AI_WATERMARK,
      enabled: true,
      text: 'Custom AI',
      position: 'top-left',
      opacity: 0.25,
    });
    expect(out?.watermark).toEqual({
      enabled: true,
      text: 'Custom AI',
      position: 'top-left',
      opacity: 0.25,
    });
  });

  it('emits manifest even when watermark disabled (consumer reads enabled flag)', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-1', provenance: ttsProvenance() },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: false });
    expect(out).toBeDefined();
    expect(out?.watermark.enabled).toBe(false);
  });

  it('treats asset-gen-pending as AI (T-438 non-terminal kind)', () => {
    const inputs: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'el-pending',
        provenance: {
          kind: 'asset-gen-pending',
          provider: 'tts-kokoro',
          model: 'kokoro-82m',
          placeholderId: 'p-1',
          cacheKey: 'sha256-pending',
        },
      },
    ];
    const out = extractAiContentManifest(inputs, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(out?.elements).toHaveLength(1);
    expect(out?.elements[0]?.modality).toBe('asset-gen-pending');
  });
});
