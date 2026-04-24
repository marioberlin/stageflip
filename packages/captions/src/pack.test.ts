// packages/captions/src/pack.test.ts
// Coverage for the word→segment packer (T-184).

import { describe, expect, it } from 'vitest';

import { packWords } from './pack.js';
import type { TranscriptWord } from './types.js';

function word(text: string, startMs: number, endMs: number): TranscriptWord {
  return { text, startMs, endMs };
}

describe('packWords', () => {
  it('returns [] for empty input', () => {
    expect(packWords([], { maxCharsPerLine: 40, maxLines: 2 })).toEqual([]);
  });

  it('returns [] when options are non-positive', () => {
    const words = [word('Hi', 0, 100)];
    expect(packWords(words, { maxCharsPerLine: 0, maxLines: 2 })).toEqual([]);
    expect(packWords(words, { maxCharsPerLine: 40, maxLines: 0 })).toEqual([]);
  });

  it('packs multiple words onto one line up to maxCharsPerLine', () => {
    const words = [word('Hello', 0, 300), word('world', 400, 700)];
    const out = packWords(words, { maxCharsPerLine: 40, maxLines: 2 });
    expect(out).toEqual([{ startMs: 0, endMs: 700, text: 'Hello world' }]);
  });

  it('wraps to a new line when the first is full', () => {
    const words = [word('Hello', 0, 300), word('world', 400, 700), word('!', 800, 900)];
    const out = packWords(words, { maxCharsPerLine: 11, maxLines: 2 });
    expect(out[0]?.text).toBe('Hello world\n!');
  });

  it('flushes to a new segment when maxLines is exhausted', () => {
    const words = [
      word('A', 0, 100),
      word('B', 200, 300),
      word('C', 400, 500),
      word('D', 600, 700),
    ];
    // 1 char per line × 1 line → one word per segment
    const out = packWords(words, { maxCharsPerLine: 1, maxLines: 1 });
    expect(out.map((s) => s.text)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('assigns startMs from the first word and endMs from the last', () => {
    const words = [word('One', 1000, 1300), word('two', 1500, 1800), word('three', 2000, 2400)];
    const out = packWords(words, { maxCharsPerLine: 40, maxLines: 2 });
    expect(out).toEqual([{ startMs: 1000, endMs: 2400, text: 'One two three' }]);
  });

  it('enforces minSegmentMs to avoid 1-frame flashes', () => {
    const words = [word('Flash', 0, 80)];
    const out = packWords(words, { maxCharsPerLine: 40, maxLines: 2, minSegmentMs: 400 });
    expect(out[0]).toEqual({ startMs: 0, endMs: 400, text: 'Flash' });
  });

  it('defaults minSegmentMs to 400 when unspecified', () => {
    const out = packWords([word('Hi', 0, 50)], { maxCharsPerLine: 40, maxLines: 2 });
    expect(out[0]?.endMs).toBe(400);
  });

  it('lets a too-long single word overflow rather than splitting it', () => {
    const words = [word('supercalifragilisticexpialidocious', 0, 500)];
    const out = packWords(words, { maxCharsPerLine: 10, maxLines: 2 });
    expect(out.length).toBe(1);
    expect(out[0]?.text).toBe('supercalifragilisticexpialidocious');
  });

  it('is deterministic across repeat calls with the same inputs', () => {
    const words = [
      word('One', 0, 200),
      word('two', 300, 500),
      word('three', 600, 900),
      word('four', 1000, 1200),
    ];
    const a = packWords(words, { maxCharsPerLine: 7, maxLines: 2 });
    const b = packWords(words, { maxCharsPerLine: 7, maxLines: 2 });
    expect(a).toEqual(b);
  });
});
