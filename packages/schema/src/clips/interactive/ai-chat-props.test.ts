// packages/schema/src/clips/interactive/ai-chat-props.test.ts
// T-389 ACs #1–#4 — aiChatClipPropsSchema parsing.

import { describe, expect, it } from 'vitest';

import { aiChatClipPropsSchema } from './ai-chat-props.js';

const validBase = {
  systemPrompt: 'You are a helpful assistant.',
  provider: 'openai',
  model: 'gpt-4o-mini',
} as const;

describe('aiChatClipPropsSchema (T-389 AC #1)', () => {
  it('AC #1 — accepts a complete ai-chat-props payload', () => {
    const parsed = aiChatClipPropsSchema.parse({
      ...validBase,
      maxTokens: 256,
      temperature: 0.4,
      multiTurn: false,
      posterFrame: 7,
    });
    expect(parsed.systemPrompt).toBe('You are a helpful assistant.');
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('gpt-4o-mini');
    expect(parsed.maxTokens).toBe(256);
    expect(parsed.temperature).toBe(0.4);
    expect(parsed.multiTurn).toBe(false);
    expect(parsed.posterFrame).toBe(7);
  });

  it('AC #1 — defaults populate when optional fields omitted', () => {
    const parsed = aiChatClipPropsSchema.parse(validBase);
    expect(parsed.maxTokens).toBe(512);
    expect(parsed.temperature).toBe(0.7);
    expect(parsed.multiTurn).toBe(true);
    expect(parsed.posterFrame).toBe(0);
  });

  it('AC #2 — empty systemPrompt throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        systemPrompt: '',
      }),
    ).toThrow(/systemPrompt/);
  });

  it('AC #3 — temperature above 1.5 throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        temperature: 1.6,
      }),
    ).toThrow(/temperature/);
  });

  it('AC #3 — temperature below 0 throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        temperature: -0.1,
      }),
    ).toThrow(/temperature/);
  });

  it('AC #3 — temperature 0 and 1.5 are allowed (boundaries inclusive)', () => {
    expect(() => aiChatClipPropsSchema.parse({ ...validBase, temperature: 0 })).not.toThrow();
    expect(() => aiChatClipPropsSchema.parse({ ...validBase, temperature: 1.5 })).not.toThrow();
  });

  it('AC #4 — maxTokens of 0 throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        maxTokens: 0,
      }),
    ).toThrow(/maxTokens/);
  });

  it('AC #4 — negative maxTokens throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        maxTokens: -1,
      }),
    ).toThrow(/maxTokens/);
  });

  it('AC #4 — non-integer maxTokens throws', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        maxTokens: 1.5,
      }),
    ).toThrow();
  });

  it('rejects empty provider', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        provider: '',
      }),
    ).toThrow(/provider/);
  });

  it('rejects empty model', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        model: '',
      }),
    ).toThrow(/model/);
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        sneaky: true,
      }),
    ).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        posterFrame: -1,
      }),
    ).toThrow();
  });

  it('rejects non-boolean multiTurn', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        ...validBase,
        multiTurn: 'yes',
      }),
    ).toThrow();
  });

  it('rejects payload missing systemPrompt entirely', () => {
    expect(() =>
      aiChatClipPropsSchema.parse({
        provider: 'openai',
        model: 'gpt-4o-mini',
      }),
    ).toThrow(/systemPrompt/);
  });
});
