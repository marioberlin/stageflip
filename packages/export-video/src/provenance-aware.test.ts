// packages/export-video/src/provenance-aware.test.ts
// T-440 — exportProvenanceAware end-to-end opt-in tests.

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { exportProvenanceAware } from './provenance-aware.js';
import type { AiVideoElementInputRow, VariantRenderer, VariantTarget } from './types.js';

const fakeDocument = { meta: { id: 'doc' }, content: { mode: 'video' } } as unknown as Document;

const targets: VariantTarget[] = [
  { label: '16:9', aspectRatio: '16:9', width: 1920, height: 1080 },
];

function makeRenderer(): VariantRenderer {
  return {
    id: 'fake-renderer',
    async render({ variant }) {
      return {
        variant,
        mimeType: 'video/mp4',
        bytes: new Uint8Array([0]),
        durationMs: 10,
      };
    },
  };
}

describe('exportProvenanceAware', () => {
  it('opt-out (default) + zero AI elements → no manifest, no plan', async () => {
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
    });
    expect(result.aiContent).toBeUndefined();
    expect(result.watermarkPlan).toBeUndefined();
    expect(result.multiAspect.okCount).toBe(1);
  });

  it('opt-out + ≥1 AI element → no manifest, no plan (opt-out wins)', async () => {
    const aiElements: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-1', provenance: { kind: 'tts', provider: 'tts-kokoro' } },
    ];
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements,
    });
    expect(result.aiContent).toBeUndefined();
    expect(result.watermarkPlan).toBeUndefined();
  });

  it('opt-in + zero AI elements → no manifest, no plan', async () => {
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiWatermark: { enabled: true },
    });
    expect(result.aiContent).toBeUndefined();
    expect(result.watermarkPlan).toBeUndefined();
  });

  it('opt-in + only imported elements → no manifest, no plan', async () => {
    const aiElements: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
    ];
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements,
      aiWatermark: { enabled: true },
    });
    expect(result.aiContent).toBeUndefined();
    expect(result.watermarkPlan).toBeUndefined();
  });

  it('opt-in + ≥1 AI element → manifest + plan populated', async () => {
    const aiElements: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'el-1',
        provenance: {
          kind: 'tts',
          provider: 'tts-kokoro',
          model: 'kokoro-82m',
          prompt: 'hello',
          cacheKey: 'sha256-abc',
        },
        frameRange: { startFrame: 0, endFrame: 30 },
      },
    ];
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements,
      aiWatermark: { enabled: true },
    });
    expect(result.aiContent).toBeDefined();
    expect(result.aiContent?.elements).toHaveLength(1);
    expect(result.aiContent?.elements[0]?.elementId).toBe('el-1');
    expect(result.aiContent?.watermark.enabled).toBe(true);
    expect(result.watermarkPlan).toBeDefined();
    expect(result.watermarkPlan?.config.enabled).toBe(true);
    expect(result.watermarkPlan?.frameRanges).toEqual([{ startFrame: 0, endFrame: 30 }]);
  });

  it('multi-aspect outcomes pass through unchanged', async () => {
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements: [{ elementId: 'el-1', provenance: { kind: 'tts', provider: 'tts-kokoro' } }],
      aiWatermark: { enabled: true },
    });
    expect(result.multiAspect.rendererId).toBe('fake-renderer');
    expect(result.multiAspect.okCount).toBe(1);
    expect(result.multiAspect.errorCount).toBe(0);
    expect(result.multiAspect.outcomes).toHaveLength(1);
  });

  it('honors partial watermark config (merged with defaults)', async () => {
    const result = await exportProvenanceAware({
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements: [{ elementId: 'el-1', provenance: { kind: 'tts', provider: 'tts-kokoro' } }],
      aiWatermark: { enabled: true, text: 'Custom AI', position: 'top-left' },
    });
    expect(result.aiContent?.watermark.text).toBe('Custom AI');
    expect(result.aiContent?.watermark.position).toBe('top-left');
    // Defaults still applied.
    expect(result.aiContent?.watermark.opacity).toBe(0.1);
  });

  it('is deterministic — two runs produce equivalent manifest', async () => {
    const input = {
      document: fakeDocument,
      variants: targets,
      renderer: makeRenderer(),
      aiElements: [
        {
          elementId: 'el-1',
          provenance: {
            kind: 'tts' as const,
            provider: 'tts-kokoro',
            model: 'kokoro-82m',
          },
          frameRange: { startFrame: 0, endFrame: 30 },
        },
      ],
      aiWatermark: { enabled: true },
    };
    const a = await exportProvenanceAware(input);
    const b = await exportProvenanceAware(input);
    expect(a.aiContent).toEqual(b.aiContent);
    expect(a.watermarkPlan).toEqual(b.watermarkPlan);
  });
});
