// packages/import-google-slides/src/aiqc/stub-provider.test.ts

import { describe, expect, it } from 'vitest';
import { createStubGeminiProvider } from './stub-provider.js';

describe('createStubGeminiProvider', () => {
  it('returns canned text via complete()', async () => {
    const provider = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: 'hello' }),
    });
    const response = await provider.complete({
      model: 'gemini-2.0-flash',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(response.content).toEqual([{ type: 'text', text: 'hello' }]);
    expect(response.role).toBe('assistant');
  });

  it('records request count + the requests themselves', async () => {
    const provider = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: 'x' }),
    });
    await provider.complete({ model: 'm', max_tokens: 1, messages: [] });
    await provider.complete({ model: 'm', max_tokens: 1, messages: [] });
    expect(provider.callCount).toBe(2);
    expect(provider.requests).toHaveLength(2);
  });

  it('throws when factory returns kind=throw', async () => {
    const provider = createStubGeminiProvider({
      factory: () => ({ kind: 'throw', error: new Error('boom') }),
    });
    await expect(provider.complete({ model: 'm', max_tokens: 1, messages: [] })).rejects.toThrow(
      'boom',
    );
  });

  it('stream() throws (not supported in T-246 v1)', async () => {
    const provider = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: 'x' }),
    });
    const run = async () => {
      for await (const _ of provider.stream({ model: 'm', max_tokens: 1, messages: [] })) {
        // would consume
      }
    };
    await expect(run()).rejects.toThrow(/not implemented/);
  });
});
