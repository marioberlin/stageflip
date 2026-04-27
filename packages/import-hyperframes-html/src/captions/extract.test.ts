// packages/import-hyperframes-html/src/captions/extract.test.ts
// Unit tests for the inline transcript extractor. Pin AC #24 (recognized
// shape) + AC #25 (unrecognized shape).

import { describe, expect, it } from 'vitest';
import { extractTranscript } from './extract.js';

describe('extractTranscript', () => {
  it('AC #24: recognized {text, start, end} shape', () => {
    const script = `
      const TRANSCRIPT = [
        { "text": "We", "start": 0.119, "end": 0.259 },
        { "text": "asked", "start": 0.319, "end": 0.479 }
      ];
    `;
    const result = extractTranscript(script);
    expect(result.kind).toBe('captions');
    if (result.kind !== 'captions') return;
    expect(result.captions.lang).toBe('en');
    expect(result.captions.segments).toHaveLength(2);
    expect(result.captions.segments[0]).toEqual({ startMs: 119, endMs: 259, text: 'We' });
    expect(result.captions.segments[1]).toEqual({ startMs: 319, endMs: 479, text: 'asked' });
  });

  it('window.__transcript form is recognized', () => {
    const script = `
      window.__transcript = [
        { "text": "Hello", "start": 0, "end": 1 }
      ];
    `;
    const result = extractTranscript(script);
    expect(result.kind).toBe('captions');
  });

  it('AC #25: unrecognized shape (e.g. {word, t0, t1}) produces unrecognized', () => {
    const script = `
      const TRANSCRIPT = [
        { "word": "We", "t0": 0.119, "t1": 0.259 }
      ];
    `;
    const result = extractTranscript(script);
    expect(result.kind).toBe('unrecognized');
  });

  it('extra fields per entry skip that entry but don\u2019t fail the array', () => {
    const script = `
      const TRANSCRIPT = [
        { "text": "good", "start": 0, "end": 1 },
        { "text": "bad", "start": 1, "end": 2, "extra": 7 }
      ];
    `;
    const result = extractTranscript(script);
    expect(result.kind).toBe('captions');
    if (result.kind !== 'captions') return;
    expect(result.captions.segments).toHaveLength(1);
    expect(result.captions.segments[0]?.text).toBe('good');
  });

  it('returns kind=none when no TRANSCRIPT marker is present', () => {
    expect(extractTranscript('console.log("nothing here")').kind).toBe('none');
  });

  it('returns unrecognized when JSON.parse fails', () => {
    // Trailing commas would fail JSON.parse — but our regex captures the
    // whole array. Use a plainly invalid array body instead.
    const script = 'const TRANSCRIPT = [not-json];';
    const result = extractTranscript(script);
    expect(result.kind).toBe('unrecognized');
  });
});
