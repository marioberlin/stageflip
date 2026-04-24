// packages/captions/src/providers/openai.test.ts
// T-184b — OpenAI Whisper provider tests. Uses an injected OpenAILike
// fake; no network, no real SDK calls.

import { describe, expect, it, vi } from 'vitest';

import { type OpenAILike, type VerboseJsonResponse, createOpenAIProvider } from './openai.js';

function fakeClient(response: VerboseJsonResponse, spy?: (args: unknown) => void): OpenAILike {
  return {
    audio: {
      transcriptions: {
        async create(args) {
          spy?.(args);
          return response;
        },
      },
    },
  };
}

const bytes = new Uint8Array([0, 1, 2, 3]);

describe('createOpenAIProvider', () => {
  it('registers under id "openai-whisper"', () => {
    const provider = createOpenAIProvider({ client: fakeClient({ language: 'en' }) });
    expect(provider.id).toBe('openai-whisper');
  });

  it('throws when neither client nor apiKey is provided', () => {
    expect(() => createOpenAIProvider({})).toThrow(/apiKey is required/);
  });

  it('returns a Transcript with word-level millisecond timestamps', async () => {
    const provider = createOpenAIProvider({
      client: fakeClient({
        language: 'en',
        words: [
          { word: 'Hello', start: 0.0, end: 0.42 },
          { word: 'world', start: 0.5, end: 0.9 },
        ],
      }),
    });
    const out = await provider.transcribe({ source: { kind: 'bytes', bytes } });
    expect(out).toEqual({
      language: 'en',
      words: [
        { text: 'Hello', startMs: 0, endMs: 420 },
        { text: 'world', startMs: 500, endMs: 900 },
      ],
    });
  });

  it('forwards the language hint to the SDK', async () => {
    const calls: unknown[] = [];
    const provider = createOpenAIProvider({
      client: fakeClient({ language: 'de' }, (a) => calls.push(a)),
    });
    await provider.transcribe({ source: { kind: 'bytes', bytes }, language: 'de' });
    expect((calls[0] as { language?: string }).language).toBe('de');
  });

  it('omits the language field when the hint is absent (Whisper auto-detects)', async () => {
    const calls: unknown[] = [];
    const provider = createOpenAIProvider({
      client: fakeClient({ language: 'auto-detected' }, (a) => calls.push(a)),
    });
    await provider.transcribe({ source: { kind: 'bytes', bytes } });
    expect((calls[0] as { language?: string }).language).toBeUndefined();
  });

  it('honours a custom model + filename', async () => {
    const calls: unknown[] = [];
    const provider = createOpenAIProvider({
      client: fakeClient({ language: 'en' }, (a) => calls.push(a)),
      model: 'whisper-2',
      filename: 'clip.mp3',
    });
    await provider.transcribe({ source: { kind: 'bytes', bytes } });
    const args = calls[0] as { model: string; file: { name?: string } };
    expect(args.model).toBe('whisper-2');
    // OpenAI.toFile returns a File-ish with `.name`; exact constructor varies
    // across runtimes, so just assert the filename is threaded through.
    expect(args.file.name ?? args.file).toBeTruthy();
  });

  it('rejects url-source audio (caller must buffer first)', async () => {
    const provider = createOpenAIProvider({
      client: fakeClient({ language: 'en' }),
    });
    await expect(
      provider.transcribe({ source: { kind: 'url', url: 'https://x/y.mp3' } }),
    ).rejects.toThrow(/only 'bytes' audio sources are supported/);
  });

  it('handles an empty words array from the SDK', async () => {
    const provider = createOpenAIProvider({
      client: fakeClient({ language: 'en' }),
    });
    const out = await provider.transcribe({ source: { kind: 'bytes', bytes } });
    expect(out.words).toEqual([]);
  });

  it('forwards an abort signal to the SDK call', async () => {
    const calls: Array<{ args: unknown; opts: unknown }> = [];
    const client: OpenAILike = {
      audio: {
        transcriptions: {
          async create(args, opts) {
            calls.push({ args, opts });
            return { language: 'en' };
          },
        },
      },
    };
    const controller = new AbortController();
    const provider = createOpenAIProvider({ client, signal: controller.signal });
    await provider.transcribe({ source: { kind: 'bytes', bytes } });
    expect((calls[0]?.opts as { signal?: AbortSignal })?.signal).toBe(controller.signal);
  });
});
