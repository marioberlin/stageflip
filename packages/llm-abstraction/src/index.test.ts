// packages/llm-abstraction/src/index.test.ts

import { describe, expect, it, vi } from 'vitest';
import { PROVIDER_NAMES, createProvider } from './index.js';

describe('createProvider', () => {
  it('creates an anthropic provider when spec.provider is anthropic', () => {
    const client = { messages: { create: vi.fn() } };
    const provider = createProvider({ provider: 'anthropic', client });
    expect(provider.name).toBe('anthropic');
  });

  it('creates a google provider when spec.provider is google', () => {
    const provider = createProvider({
      provider: 'google',
      client: {
        getGenerativeModel: () => ({
          generateContent: async () => ({ response: { candidates: [] } }),
          generateContentStream: async () => ({
            stream: (async function* () {})(),
            response: Promise.resolve({ candidates: [] }),
          }),
        }),
      },
    });
    expect(provider.name).toBe('google');
  });

  it('creates an openai provider when spec.provider is openai', () => {
    const provider = createProvider({
      provider: 'openai',
      client: { chat: { completions: { create: vi.fn() } } },
    });
    expect(provider.name).toBe('openai');
  });
});

describe('PROVIDER_NAMES', () => {
  it('exposes the three supported provider names', () => {
    expect(PROVIDER_NAMES).toEqual(['anthropic', 'google', 'openai']);
  });
});
