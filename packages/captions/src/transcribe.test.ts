// packages/captions/src/transcribe.test.ts
// End-to-end pipeline: cache hit/miss + provider invocation + packing.

import { describe, expect, it, vi } from 'vitest';

import { createMemoryCache } from './cache.js';
import { createMockProvider } from './providers/mock.js';
import { transcribeAndPack } from './transcribe.js';
import { type TtsBypassInput, transcribeAndPackWithTtsBypass } from './tts-bypass.js';
import type { TranscribeRequest, TranscriptionProvider } from './types.js';

const source = { kind: 'bytes' as const, bytes: new Uint8Array([1, 2, 3]) };
const pack = { maxCharsPerLine: 40, maxLines: 2 } as const;

describe('transcribeAndPack', () => {
  it('calls the provider and returns packed segments on cache miss', async () => {
    const provider = createMockProvider({ words: ['Hello', 'world'] });
    const result = await transcribeAndPack({ source, pack, provider });
    expect(result.cacheHit).toBe(false);
    expect(result.language).toBe('en');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe('Hello world');
  });

  it('hits the cache on a repeat call with a shared cache', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'cached', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'spy', transcribe: spy };
    const cache = createMemoryCache();
    const first = await transcribeAndPack({ source, pack, provider, cache });
    expect(first.cacheHit).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    const second = await transcribeAndPack({ source, pack, provider, cache });
    expect(second.cacheHit).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.segments[0]?.text).toBe('cached');
  });

  it('does not hit the cache across different language hints', async () => {
    const spy = vi.fn(async (req: TranscribeRequest) => ({
      language: req.language ?? 'en',
      words: [{ text: 'x', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'spy', transcribe: spy };
    const cache = createMemoryCache();
    await transcribeAndPack({ source, language: 'en', pack, provider, cache });
    await transcribeAndPack({ source, language: 'de', pack, provider, cache });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('re-packs on cache hit so pack options can change between calls', async () => {
    const provider = createMockProvider({
      words: ['aaa', 'bbb', 'ccc', 'ddd'],
      msPerWord: 200,
      gapMs: 0,
    });
    const cache = createMemoryCache();
    const wide = await transcribeAndPack({
      source,
      provider,
      cache,
      pack: { maxCharsPerLine: 40, maxLines: 2 },
    });
    const tight = await transcribeAndPack({
      source,
      provider,
      cache,
      pack: { maxCharsPerLine: 3, maxLines: 1 },
    });
    expect(tight.cacheHit).toBe(true);
    expect(wide.segments).toHaveLength(1);
    expect(tight.segments).toHaveLength(4);
  });

  it('creates a fresh cache when none is passed', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'one', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'spy', transcribe: spy };
    await transcribeAndPack({ source, pack, provider });
    await transcribeAndPack({ source, pack, provider });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('transcribeAndPackWithTtsBypass', () => {
  const kokoroTts: TtsBypassInput = {
    provenance: { kind: 'tts', provider: 'kokoro' },
    wordTimestamps: [
      { word: 'Hello', startS: 0, endS: 0.5 },
      { word: 'world', startS: 0.5, endS: 1.0 },
    ],
  };

  const fishTts: TtsBypassInput = {
    provenance: { kind: 'tts', provider: 'fish-speech' },
    wordTimestamps: [{ word: 'Konnichiwa', startS: 0, endS: 0.8 }],
  };

  it('bypasses Whisper on Kokoro provenance with valid timestamps', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'whisper', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'whisper-spy', transcribe: spy };
    const result = await transcribeAndPackWithTtsBypass({
      source,
      pack,
      provider,
      tts: kokoroTts,
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.viaTtsBypass).toBe(true);
    expect(result.ttsBypassProvider).toBe('kokoro');
    expect(result.segments[0]?.text).toBe('Hello world');
  });

  it('bypasses Whisper on Fish Speech provenance with valid timestamps', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'ja',
      words: [{ text: 'whisper', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'whisper-spy', transcribe: spy };
    const result = await transcribeAndPackWithTtsBypass({
      source,
      pack,
      provider,
      tts: fishTts,
      language: 'ja',
    });
    expect(spy).not.toHaveBeenCalled();
    expect(result.viaTtsBypass).toBe(true);
    expect(result.ttsBypassProvider).toBe('fish-speech');
    expect(result.language).toBe('ja');
    expect(result.segments[0]?.text).toBe('Konnichiwa');
  });

  it('falls back to Whisper when provenance provider is not whitelisted', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'whispered', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'whisper-spy', transcribe: spy };
    const result = await transcribeAndPackWithTtsBypass({
      source,
      pack,
      provider,
      tts: {
        provenance: { kind: 'tts', provider: 'elevenlabs' },
        wordTimestamps: kokoroTts.wordTimestamps,
      },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.viaTtsBypass).toBeUndefined();
    expect(result.ttsBypassProvider).toBeUndefined();
    expect(result.segments[0]?.text).toBe('whispered');
  });

  it('falls back to Whisper when wordTimestamps are missing', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'whispered', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'whisper-spy', transcribe: spy };
    const result = await transcribeAndPackWithTtsBypass({
      source,
      pack,
      provider,
      tts: { provenance: { kind: 'tts', provider: 'kokoro' } },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.viaTtsBypass).toBeUndefined();
    expect(result.segments[0]?.text).toBe('whispered');
  });

  it('falls back to Whisper when tts arg is absent (regression-safe default)', async () => {
    const spy = vi.fn(async (_req: TranscribeRequest) => ({
      language: 'en',
      words: [{ text: 'whispered', startMs: 0, endMs: 400 }],
    }));
    const provider: TranscriptionProvider = { id: 'whisper-spy', transcribe: spy };
    const result = await transcribeAndPackWithTtsBypass({ source, pack, provider });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.viaTtsBypass).toBeUndefined();
  });
});
