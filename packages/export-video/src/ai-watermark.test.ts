// packages/export-video/src/ai-watermark.test.ts
// T-440 — ai-watermark unit tests: mergeFrameRanges + buildWatermarkPlan +
// serializeAiContentSidecar.

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_WATERMARK,
  buildWatermarkPlan,
  mergeFrameRanges,
  serializeAiContentSidecar,
} from './ai-watermark.js';
import type { AiContentManifest, AiVideoElementInputRow } from './types.js';

describe('mergeFrameRanges', () => {
  it('returns [] for an empty input', () => {
    expect(mergeFrameRanges([])).toEqual([]);
  });

  it('returns a single range untouched', () => {
    expect(mergeFrameRanges([{ startFrame: 0, endFrame: 30 }])).toEqual([
      { startFrame: 0, endFrame: 30 },
    ]);
  });

  it('merges overlapping ranges', () => {
    expect(
      mergeFrameRanges([
        { startFrame: 0, endFrame: 30 },
        { startFrame: 25, endFrame: 60 },
      ]),
    ).toEqual([{ startFrame: 0, endFrame: 60 }]);
  });

  it('joins touching ranges (half-open contract)', () => {
    expect(
      mergeFrameRanges([
        { startFrame: 0, endFrame: 30 },
        { startFrame: 30, endFrame: 60 },
      ]),
    ).toEqual([{ startFrame: 0, endFrame: 60 }]);
  });

  it('sorts unsorted input', () => {
    expect(
      mergeFrameRanges([
        { startFrame: 50, endFrame: 70 },
        { startFrame: 0, endFrame: 30 },
      ]),
    ).toEqual([
      { startFrame: 0, endFrame: 30 },
      { startFrame: 50, endFrame: 70 },
    ]);
  });

  it('keeps disjoint ranges separate', () => {
    expect(
      mergeFrameRanges([
        { startFrame: 0, endFrame: 30 },
        { startFrame: 100, endFrame: 150 },
      ]),
    ).toEqual([
      { startFrame: 0, endFrame: 30 },
      { startFrame: 100, endFrame: 150 },
    ]);
  });
});

describe('buildWatermarkPlan', () => {
  it('returns undefined when config.enabled === false', () => {
    const rows: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'el-1',
        provenance: { kind: 'tts', provider: 'tts-kokoro' },
        frameRange: { startFrame: 0, endFrame: 30 },
      },
    ];
    expect(buildWatermarkPlan(rows, { ...DEFAULT_AI_WATERMARK, enabled: false })).toBeUndefined();
  });

  it('returns undefined when no AI elements present', () => {
    const rows: readonly AiVideoElementInputRow[] = [
      { elementId: 'el-imported', provenance: { kind: 'imported' } },
    ];
    expect(buildWatermarkPlan(rows, { ...DEFAULT_AI_WATERMARK, enabled: true })).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    expect(buildWatermarkPlan([], { ...DEFAULT_AI_WATERMARK, enabled: true })).toBeUndefined();
  });

  it('emits merged frame ranges from AI rows', () => {
    const rows: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'a',
        provenance: { kind: 'tts', provider: 'tts-kokoro' },
        frameRange: { startFrame: 0, endFrame: 30 },
      },
      {
        elementId: 'b',
        provenance: { kind: 'image-gen', provider: 'image-flux' },
        frameRange: { startFrame: 25, endFrame: 60 },
      },
      {
        elementId: 'c',
        provenance: { kind: 'video-gen', provider: 'video-seedance' },
        frameRange: { startFrame: 100, endFrame: 150 },
      },
    ];
    const plan = buildWatermarkPlan(rows, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(plan?.frameRanges).toEqual([
      { startFrame: 0, endFrame: 60 },
      { startFrame: 100, endFrame: 150 },
    ]);
    expect(plan?.config.enabled).toBe(true);
  });

  it('treats an undefined frameRange row as always-on', () => {
    const rows: readonly AiVideoElementInputRow[] = [
      { elementId: 'a', provenance: { kind: 'tts', provider: 'tts-kokoro' } },
    ];
    const plan = buildWatermarkPlan(rows, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(plan?.frameRanges).toEqual([{ startFrame: 0, endFrame: Number.MAX_SAFE_INTEGER }]);
  });

  it('ignores frame ranges from imported / no-provenance rows', () => {
    const rows: readonly AiVideoElementInputRow[] = [
      {
        elementId: 'imported',
        provenance: { kind: 'imported' },
        frameRange: { startFrame: 0, endFrame: 30 },
      },
      {
        elementId: 'ai',
        provenance: { kind: 'tts', provider: 'tts-kokoro' },
        frameRange: { startFrame: 100, endFrame: 150 },
      },
    ];
    const plan = buildWatermarkPlan(rows, { ...DEFAULT_AI_WATERMARK, enabled: true });
    expect(plan?.frameRanges).toEqual([{ startFrame: 100, endFrame: 150 }]);
  });
});

describe('serializeAiContentSidecar', () => {
  const manifest: AiContentManifest = {
    elements: [
      {
        elementId: 'el-1',
        provider: 'tts-kokoro',
        modality: 'tts',
        cacheKey: 'sha256-tts-abc',
        prompt: 'hello world',
        frameRange: { startFrame: 0, endFrame: 30 },
      },
    ],
    watermark: {
      enabled: true,
      text: 'Made with AI',
      position: 'bottom-right',
      opacity: 0.1,
    },
  };

  it('returns deterministic UTF-8 JSON bytes', () => {
    const a = serializeAiContentSidecar(manifest);
    const b = serializeAiContentSidecar(manifest);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('output ends with a trailing newline', () => {
    const bytes = serializeAiContentSidecar(manifest);
    expect(bytes[bytes.length - 1]).toBe(0x0a);
  });

  it('output decodes to valid JSON matching the manifest', () => {
    const bytes = serializeAiContentSidecar(manifest);
    const text = new TextDecoder().decode(bytes);
    const decoded = JSON.parse(text) as AiContentManifest;
    expect(decoded).toEqual(manifest);
  });

  it('uses stable key ordering across re-serialization with shuffled construction', () => {
    const shuffled: AiContentManifest = {
      watermark: {
        position: 'bottom-right',
        text: 'Made with AI',
        opacity: 0.1,
        enabled: true,
      } as AiContentManifest['watermark'],
      elements: manifest.elements,
    };
    const a = serializeAiContentSidecar(manifest);
    const b = serializeAiContentSidecar(shuffled);
    expect(a).toEqual(b);
  });
});
