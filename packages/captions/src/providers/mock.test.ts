// packages/captions/src/providers/mock.test.ts
// Mock provider — deterministic word timing.

import { describe, expect, it } from 'vitest';

import { createMockProvider } from './mock.js';

const req = { source: { kind: 'bytes' as const, bytes: new Uint8Array([1]) } };

describe('createMockProvider', () => {
  it('defaults to a built-in phrase when no words are supplied', async () => {
    const provider = createMockProvider();
    const out = await provider.transcribe(req);
    expect(out.words.map((w) => w.text)).toEqual(['Hello', 'from', 'the', 'mock', 'provider']);
  });

  it('emits word timing at the configured cadence', async () => {
    const provider = createMockProvider({ words: ['a', 'b'], msPerWord: 200, gapMs: 100 });
    const out = await provider.transcribe(req);
    expect(out.words).toEqual([
      { text: 'a', startMs: 0, endMs: 200 },
      { text: 'b', startMs: 300, endMs: 500 },
    ]);
  });

  it('honors a custom language', async () => {
    const provider = createMockProvider({ language: 'de' });
    const out = await provider.transcribe(req);
    expect(out.language).toBe('de');
  });

  it('returns an empty word array when configured with no words', async () => {
    const provider = createMockProvider({ words: [] });
    const out = await provider.transcribe(req);
    expect(out.words).toEqual([]);
  });

  it('registers under id "mock"', () => {
    expect(createMockProvider().id).toBe('mock');
  });
});
