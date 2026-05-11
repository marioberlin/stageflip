// packages/captions/src/tts-bypass.test.ts
// Unit tests for the TTS→captions bypass extractor: whitelist check,
// provenance shape check, timestamp validation, sec→ms conversion.

import { describe, expect, it } from 'vitest';

import { TTS_BYPASS_WHITELIST, type TtsBypassInput, extractTtsBypassWords } from './tts-bypass.js';

const validKokoroInput: TtsBypassInput = {
  provenance: { kind: 'tts', provider: 'kokoro' },
  wordTimestamps: [
    { word: 'Hello', startS: 0, endS: 0.5 },
    { word: 'world', startS: 0.5, endS: 1.0 },
  ],
};

const validFishInput: TtsBypassInput = {
  provenance: { kind: 'tts', provider: 'fish-speech' },
  wordTimestamps: [{ word: 'Konnichiwa', startS: 0, endS: 0.8 }],
};

describe('TTS_BYPASS_WHITELIST', () => {
  it('contains kokoro and fish-speech', () => {
    expect(TTS_BYPASS_WHITELIST).toContain('kokoro');
    expect(TTS_BYPASS_WHITELIST).toContain('fish-speech');
  });

  it('has exactly two entries (T-436 ships with K+FS only)', () => {
    expect(TTS_BYPASS_WHITELIST).toHaveLength(2);
  });
});

describe('extractTtsBypassWords', () => {
  it('returns words for a whitelist provider with valid timestamps (kokoro)', () => {
    const out = extractTtsBypassWords(validKokoroInput);
    expect(out).not.toBeUndefined();
    expect(out).toHaveLength(2);
    expect(out?.[0]).toEqual({ text: 'Hello', startMs: 0, endMs: 500 });
    expect(out?.[1]).toEqual({ text: 'world', startMs: 500, endMs: 1000 });
  });

  it('returns words for fish-speech provenance', () => {
    const out = extractTtsBypassWords(validFishInput);
    expect(out).not.toBeUndefined();
    expect(out).toHaveLength(1);
    expect(out?.[0]).toEqual({ text: 'Konnichiwa', startMs: 0, endMs: 800 });
  });

  it('returns undefined when provenance kind is not "tts"', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'video-gen', provider: 'kokoro' },
      wordTimestamps: validKokoroInput.wordTimestamps,
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when provider is not on the whitelist', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'elevenlabs' },
      wordTimestamps: validKokoroInput.wordTimestamps,
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when provider field is absent', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts' },
      wordTimestamps: validKokoroInput.wordTimestamps,
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when wordTimestamps is absent', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when wordTimestamps is empty', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [],
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when any timestamp has startS < 0', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [{ word: 'oops', startS: -0.1, endS: 0.5 }],
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when any timestamp has endS <= startS', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [{ word: 'oops', startS: 0.5, endS: 0.5 }],
    });
    expect(out).toBeUndefined();
  });

  it('returns undefined when word field is empty', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [{ word: '', startS: 0, endS: 0.5 }],
    });
    expect(out).toBeUndefined();
  });

  it('floors fractional milliseconds deterministically', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [{ word: 'tick', startS: 0.0007, endS: 0.0019 }],
    });
    // 0.0007 * 1000 = 0.7  → floor = 0
    // 0.0019 * 1000 = 1.9  → floor = 1
    expect(out?.[0]).toEqual({ text: 'tick', startMs: 0, endMs: 1 });
  });

  it('preserves word order (no internal sort)', () => {
    const out = extractTtsBypassWords({
      provenance: { kind: 'tts', provider: 'kokoro' },
      wordTimestamps: [
        { word: 'one', startS: 0, endS: 0.3 },
        { word: 'two', startS: 0.3, endS: 0.6 },
        { word: 'three', startS: 0.6, endS: 0.9 },
      ],
    });
    expect(out?.map((w) => w.text)).toEqual(['one', 'two', 'three']);
  });
});
