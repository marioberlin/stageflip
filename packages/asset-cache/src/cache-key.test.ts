// packages/asset-cache/src/cache-key.test.ts
// Coverage for canonical cache-key derivation per ADR-008 §D1.

import { describe, expect, it } from 'vitest';

import { cacheKeyString, deriveCacheKey, normalizePrompt } from './cache-key.js';

describe('normalizePrompt', () => {
  it('trims leading + trailing whitespace', () => {
    expect(normalizePrompt('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizePrompt('a   b\t\tc\n\nd')).toBe('a b c d');
  });

  it('lowercases the result', () => {
    expect(normalizePrompt('HELLO World')).toBe('hello world');
  });

  it('NFC-normalizes Unicode (combining diacritics)', () => {
    // 'é' as decomposed (e + combining acute) vs precomposed.
    const decomposed = 'café';
    const precomposed = 'café';
    expect(normalizePrompt(decomposed)).toBe(normalizePrompt(precomposed));
  });

  it('chains all normalizations: trim + collapse + NFC + lowercase', () => {
    expect(normalizePrompt('  Hello   World  ')).toBe('hello world');
  });
});

describe('deriveCacheKey', () => {
  const baseInput = {
    modality: 'tts',
    model: 'kokoro-82m',
    prompt: 'hello world',
    params: { sampleRate: 24000 },
  } as const;

  it('returns a 64-hex sha256 hash', async () => {
    const key = await deriveCacheKey(baseInput);
    expect(key.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.modality).toBe('tts');
  });

  it('returns identical hashes for identical inputs', async () => {
    const a = await deriveCacheKey(baseInput);
    const b = await deriveCacheKey({ ...baseInput });
    expect(a.hash).toBe(b.hash);
  });

  it('returns identical hashes regardless of params key order', async () => {
    const a = await deriveCacheKey({
      modality: 'video-gen',
      model: 'seedance-2.0',
      prompt: 'a sunset',
      params: { aspectRatio: '16:9', frameRate: 30, duration: 15 },
    });
    const b = await deriveCacheKey({
      modality: 'video-gen',
      model: 'seedance-2.0',
      prompt: 'a sunset',
      params: { duration: 15, frameRate: 30, aspectRatio: '16:9' },
    });
    expect(a.hash).toBe(b.hash);
  });

  it('returns identical hashes for nested params in different key order', async () => {
    const a = await deriveCacheKey({
      ...baseInput,
      params: { outer: { z: 1, a: 2 }, alpha: 3 },
    });
    const b = await deriveCacheKey({
      ...baseInput,
      params: { alpha: 3, outer: { a: 2, z: 1 } },
    });
    expect(a.hash).toBe(b.hash);
  });

  it('treats array order as semantic — different array order → different hash', async () => {
    const a = await deriveCacheKey({ ...baseInput, params: { tags: ['a', 'b'] } });
    const b = await deriveCacheKey({ ...baseInput, params: { tags: ['b', 'a'] } });
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different hashes for different prompts', async () => {
    const a = await deriveCacheKey({ ...baseInput, prompt: 'hello' });
    const b = await deriveCacheKey({ ...baseInput, prompt: 'goodbye' });
    expect(a.hash).not.toBe(b.hash);
  });

  it('normalizes the prompt before hashing (whitespace + case)', async () => {
    const a = await deriveCacheKey({ ...baseInput, prompt: 'hello world' });
    const b = await deriveCacheKey({ ...baseInput, prompt: '  Hello   World  ' });
    expect(a.hash).toBe(b.hash);
  });

  it('produces different hashes for different models', async () => {
    const a = await deriveCacheKey({ ...baseInput, model: 'kokoro-82m' });
    const b = await deriveCacheKey({ ...baseInput, model: 'fish-speech-v1' });
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different hashes when voice is supplied vs absent', async () => {
    const withVoice = await deriveCacheKey({ ...baseInput, voice: 'voice-1' });
    const withoutVoice = await deriveCacheKey(baseInput);
    expect(withVoice.hash).not.toBe(withoutVoice.hash);
  });

  it('renders model:voice per ADR-008 §D1 — different voices → different hashes', async () => {
    const a = await deriveCacheKey({ ...baseInput, voice: 'voice-1' });
    const b = await deriveCacheKey({ ...baseInput, voice: 'voice-2' });
    expect(a.hash).not.toBe(b.hash);
  });

  it('renders seed=undefined as "none" — different from seed=0', async () => {
    const noSeed = await deriveCacheKey(baseInput);
    const seedZero = await deriveCacheKey({ ...baseInput, seed: 0 });
    expect(noSeed.hash).not.toBe(seedZero.hash);
  });

  it('produces different hashes for different seeds', async () => {
    const a = await deriveCacheKey({ ...baseInput, seed: 1 });
    const b = await deriveCacheKey({ ...baseInput, seed: 2 });
    expect(a.hash).not.toBe(b.hash);
  });

  it('accepts string seeds and renders them verbatim', async () => {
    const a = await deriveCacheKey({ ...baseInput, seed: 'abc-123' });
    const b = await deriveCacheKey({ ...baseInput, seed: 'abc-123' });
    expect(a.hash).toBe(b.hash);
  });

  it('renders numeric seed as base-10 string — equivalent to string-seed of same digits', async () => {
    // Per ADR-008 §D1: "seed is rendered as a base-10 integer". Numeric 42 →
    // "42"; string seed "42" passes through verbatim. The flat-string seed
    // representation is what enters the canonical hash, so the two collide.
    // This is the documented + intentional behaviour.
    const a = await deriveCacheKey({ ...baseInput, seed: 42 });
    const b = await deriveCacheKey({ ...baseInput, seed: '42' });
    expect(a.hash).toBe(b.hash);
  });

  it('produces different hashes across modalities for otherwise-identical inputs', async () => {
    const tts = await deriveCacheKey({ ...baseInput, modality: 'tts' });
    const sfx = await deriveCacheKey({ ...baseInput, modality: 'sfx' });
    expect(tts.hash).not.toBe(sfx.hash);
    expect(tts.modality).toBe('tts');
    expect(sfx.modality).toBe('sfx');
  });

  it('handles an empty params object deterministically', async () => {
    const a = await deriveCacheKey({ ...baseInput, params: {} });
    const b = await deriveCacheKey({ ...baseInput, params: {} });
    expect(a.hash).toBe(b.hash);
  });
});

describe('cacheKeyString', () => {
  it('joins modality and hash with "/"', () => {
    expect(cacheKeyString({ modality: 'tts', hash: 'abc123' })).toBe('tts/abc123');
  });

  it('keeps modality buckets distinct for the same hash', () => {
    const a = cacheKeyString({ modality: 'tts', hash: 'deadbeef' });
    const b = cacheKeyString({ modality: 'sfx', hash: 'deadbeef' });
    expect(a).not.toBe(b);
  });
});
