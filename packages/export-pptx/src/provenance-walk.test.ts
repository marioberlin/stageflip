// packages/export-pptx/src/provenance-walk.test.ts
// T-441 — provenance-walk unit tests: classifyAiKind + extractAiPptxManifest.

import type { MediaProvenance } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  type AiPptxElementInput,
  classifyAiKind,
  extractAiPptxManifest,
} from './provenance-walk.js';

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

describe('classifyAiKind (T-441)', () => {
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

describe('extractAiPptxManifest (T-441)', () => {
  it('AC #1: returns undefined for empty input', () => {
    expect(extractAiPptxManifest([])).toBeUndefined();
  });

  it('AC #2: returns undefined for only imported rows', () => {
    const inputs: readonly AiPptxElementInput[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
      { elementId: 'el-no-prov' },
    ];
    expect(extractAiPptxManifest(inputs)).toBeUndefined();
  });

  it('AC #3: extracts a TTS element with all provenance fields copied', () => {
    const inputs: readonly AiPptxElementInput[] = [
      { elementId: 'el-1', slideId: 'slide_1', provenance: ttsProvenance() },
    ];
    const out = extractAiPptxManifest(inputs);
    expect(out).toBeDefined();
    expect(out?.elements).toHaveLength(1);
    expect(out?.elements[0]).toEqual({
      elementId: 'el-1',
      slideId: 'slide_1',
      provider: 'tts-kokoro',
      modality: 'tts',
      cacheKey: 'sha256-tts-abc',
      prompt: 'hello world',
    });
  });

  it('AC #4: uses literal "unknown" for provider when absent; omits prompt / cacheKey', () => {
    const inputs: readonly AiPptxElementInput[] = [
      { elementId: 'el-1', provenance: { kind: 'image-gen' } },
    ];
    const out = extractAiPptxManifest(inputs);
    expect(out?.elements[0]).toEqual({
      elementId: 'el-1',
      provider: 'unknown',
      modality: 'image-gen',
    });
  });

  it('AC #5: preserves input order across multiple AI elements', () => {
    const inputs: readonly AiPptxElementInput[] = [
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
    const out = extractAiPptxManifest(inputs);
    expect(out?.elements.map((e) => e.elementId)).toEqual(['b', 'a', 'c']);
  });

  it('AC #6: treats asset-gen-pending as AI (T-438 non-terminal kind)', () => {
    const inputs: readonly AiPptxElementInput[] = [
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
    const out = extractAiPptxManifest(inputs);
    expect(out?.elements).toHaveLength(1);
    expect(out?.elements[0]?.modality).toBe('asset-gen-pending');
  });

  it('filters mixed input down to AI rows', () => {
    const inputs: readonly AiPptxElementInput[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
      { elementId: 'el-no-prov' },
      { elementId: 'el-tts', provenance: ttsProvenance() },
      { elementId: 'el-img', provenance: { kind: 'image-gen', provider: 'image-flux' } },
    ];
    const out = extractAiPptxManifest(inputs);
    expect(out?.elements).toHaveLength(2);
    expect(out?.elements.map((e) => e.elementId)).toEqual(['el-tts', 'el-img']);
  });

  it('omits slideId when absent on the input row', () => {
    const inputs: readonly AiPptxElementInput[] = [
      { elementId: 'el-1', provenance: ttsProvenance() },
    ];
    const out = extractAiPptxManifest(inputs);
    expect(out?.elements[0]).not.toHaveProperty('slideId');
  });
});
