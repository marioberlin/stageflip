// apps/render-worker/src/job.test.ts

import { describe, expect, it } from 'vitest';

import { parseRenderJob } from './job.js';

describe('parseRenderJob', () => {
  it('parses a valid html5-zip job', () => {
    const job = parseRenderJob({
      format: 'html5-zip',
      documentId: 'doc-1',
      sizes: ['300x250', '728x90'],
      budgetKb: 120,
      output: { bucket: 'renders', prefix: 'doc-1/' },
    });
    expect(job.format).toBe('html5-zip');
    if (job.format === 'html5-zip') {
      expect(job.sizes).toEqual(['300x250', '728x90']);
      expect(job.budgetKb).toBe(120);
    }
  });

  it('parses a valid video job with default codec + crf', () => {
    const job = parseRenderJob({
      format: 'video',
      documentId: 'doc-2',
      aspects: ['9:16', '16:9'],
      output: { bucket: 'renders', prefix: '' },
    });
    if (job.format === 'video') {
      expect(job.codec).toBe('h264');
      expect(job.crf).toBe(23);
    }
  });

  it('rejects an unknown format', () => {
    expect(() => parseRenderJob({ format: 'pptx', documentId: 'x', output: {} })).toThrow();
  });

  it('rejects an html5-zip job with a malformed size', () => {
    expect(() =>
      parseRenderJob({
        format: 'html5-zip',
        documentId: 'd',
        sizes: ['not-a-size'],
        output: { bucket: 'b' },
      }),
    ).toThrow();
  });

  it('rejects a video job with an unsupported aspect ratio', () => {
    expect(() =>
      parseRenderJob({
        format: 'video',
        documentId: 'd',
        aspects: ['2:3'],
        output: { bucket: 'b' },
      }),
    ).toThrow();
  });

  it('rejects empty sizes + aspects arrays', () => {
    expect(() =>
      parseRenderJob({ format: 'html5-zip', documentId: 'd', sizes: [], output: { bucket: 'b' } }),
    ).toThrow();
    expect(() =>
      parseRenderJob({ format: 'video', documentId: 'd', aspects: [], output: { bucket: 'b' } }),
    ).toThrow();
  });
});
