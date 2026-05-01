// packages/runtimes/interactive/src/clips/ai-generative/ai-generative-provider.test.ts
// T-395 — AiGenerativeProvider seam contract: HostInjectedAiGenerativeProvider
// + InMemoryAiGenerativeProvider.

import { describe, expect, it, vi } from 'vitest';

import {
  type Generator,
  HostInjectedAiGenerativeProvider,
  InMemoryAiGenerativeProvider,
} from './ai-generative-provider.js';

function pngBlob(): Blob {
  return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
}

describe('HostInjectedAiGenerativeProvider', () => {
  it('forwards args to the host-injected generator', async () => {
    const generator: Generator = vi.fn(async () => ({
      blob: pngBlob(),
      contentType: 'image/png',
    }));
    const provider = new HostInjectedAiGenerativeProvider({ generator });
    await provider.generateOnce({
      prompt: 'a cat',
      negativePrompt: 'no dogs',
      model: 'dall-e-3',
      width: 1024,
      height: 1024,
      seed: 42,
      signal: new AbortController().signal,
    });
    expect(generator).toHaveBeenCalledTimes(1);
    const call = (generator as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      prompt: string;
      negativePrompt?: string;
      model: string;
      width?: number;
      height?: number;
      seed?: number;
      signal: AbortSignal;
    };
    expect(call.prompt).toBe('a cat');
    expect(call.negativePrompt).toBe('no dogs');
    expect(call.model).toBe('dall-e-3');
    expect(call.width).toBe(1024);
    expect(call.height).toBe(1024);
    expect(call.seed).toBe(42);
  });

  it('returns blob + contentType from the host result', async () => {
    const generator: Generator = async () => ({
      blob: pngBlob(),
      contentType: 'image/png',
    });
    const provider = new HostInjectedAiGenerativeProvider({ generator });
    const result = await provider.generateOnce({
      prompt: 'p',
      model: 'm',
      signal: new AbortController().signal,
    });
    expect(result.contentType).toBe('image/png');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('forwards the AbortSignal verbatim', async () => {
    const ctl = new AbortController();
    let observed: AbortSignal | undefined;
    const generator: Generator = async (args) => {
      observed = args.signal;
      return { blob: pngBlob(), contentType: 'image/png' };
    };
    const provider = new HostInjectedAiGenerativeProvider({ generator });
    await provider.generateOnce({
      prompt: 'p',
      model: 'm',
      signal: ctl.signal,
    });
    expect(observed).toBe(ctl.signal);
  });
});

describe('InMemoryAiGenerativeProvider', () => {
  it('resolves a scripted result keyed by prompt', async () => {
    const provider = new InMemoryAiGenerativeProvider({
      scripted: {
        'a cat': { blob: pngBlob(), contentType: 'image/png' },
      },
    });
    const result = await provider.generateOnce({
      prompt: 'a cat',
      model: 'm',
      signal: new AbortController().signal,
    });
    expect(result.contentType).toBe('image/png');
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('rejects with the configured error when a scripted entry has rejectWith', async () => {
    const err = new Error('quota-exceeded');
    const provider = new InMemoryAiGenerativeProvider({
      scripted: { 'a cat': { rejectWith: err } },
    });
    await expect(
      provider.generateOnce({
        prompt: 'a cat',
        model: 'm',
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(err);
  });

  it('rejects when the prompt has no scripted entry', async () => {
    const provider = new InMemoryAiGenerativeProvider({ scripted: {} });
    await expect(
      provider.generateOnce({
        prompt: 'unscripted',
        model: 'm',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/InMemoryAiGenerativeProvider/);
  });

  it('rejects immediately if the signal is already aborted', async () => {
    const provider = new InMemoryAiGenerativeProvider({
      scripted: { p: { blob: pngBlob(), contentType: 'image/png' } },
    });
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      provider.generateOnce({ prompt: 'p', model: 'm', signal: ctl.signal }),
    ).rejects.toThrow(/Abort/);
  });
});
