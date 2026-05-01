// packages/schema/src/clips/interactive/ai-generative-props.test.ts
// T-395 ACs #1–#5 — aiGenerativeClipPropsSchema parsing.
// T-396 ACs #1–#5 — curatedExample optional field.

import { describe, expect, it } from 'vitest';

import { aiGenerativeClipPropsSchema } from './ai-generative-props.js';

const validBase = {
  prompt: 'a watercolor painting of a sunrise',
  provider: 'openai',
  model: 'dall-e-3',
} as const;

describe('aiGenerativeClipPropsSchema (T-395 AC #1)', () => {
  it('AC #1 — accepts a complete payload', () => {
    const parsed = aiGenerativeClipPropsSchema.parse({
      prompt: 'a watercolor painting of a sunrise',
      provider: 'stability',
      model: 'stable-diffusion-xl',
      negativePrompt: 'no text, no watermark',
      seed: 12345,
      width: 1024,
      height: 1024,
      posterFrame: 7,
    });
    expect(parsed.prompt).toBe('a watercolor painting of a sunrise');
    expect(parsed.provider).toBe('stability');
    expect(parsed.model).toBe('stable-diffusion-xl');
    expect(parsed.negativePrompt).toBe('no text, no watermark');
    expect(parsed.seed).toBe(12345);
    expect(parsed.width).toBe(1024);
    expect(parsed.height).toBe(1024);
    expect(parsed.posterFrame).toBe(7);
  });

  it('AC #1 — defaults populate when optional fields omitted', () => {
    const parsed = aiGenerativeClipPropsSchema.parse(validBase);
    expect(parsed.posterFrame).toBe(0);
    expect(parsed.negativePrompt).toBeUndefined();
    expect(parsed.seed).toBeUndefined();
    expect(parsed.width).toBeUndefined();
    expect(parsed.height).toBeUndefined();
  });

  it('AC #2 — empty prompt throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, prompt: '' })).toThrow(/prompt/);
  });

  it('AC #3 — empty provider throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, provider: '' })).toThrow(
      /provider/,
    );
  });

  it('AC #3 — empty model throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, model: '' })).toThrow(/model/);
  });

  it('AC #4 — non-integer seed throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, seed: 1.5 })).toThrow();
  });

  it('AC #5 — non-positive width throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, width: 0 })).toThrow();
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, width: -10 })).toThrow();
  });

  it('AC #5 — non-positive height throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, height: 0 })).toThrow();
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, height: -10 })).toThrow();
  });

  it('AC #5 — non-integer width throws', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, width: 320.5 })).toThrow();
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, sneaky: true })).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() => aiGenerativeClipPropsSchema.parse({ ...validBase, posterFrame: -1 })).toThrow();
  });

  it('rejects payload missing prompt entirely', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({ provider: 'openai', model: 'dall-e-3' }),
    ).toThrow(/prompt/);
  });

  it('accepts negativePrompt as optional empty-string-rejection-not-applied (free-form prose)', () => {
    // negativePrompt is just a string; the schema does not enforce min(1).
    const parsed = aiGenerativeClipPropsSchema.parse({
      ...validBase,
      negativePrompt: '',
    });
    expect(parsed.negativePrompt).toBe('');
  });
});

describe('aiGenerativeClipPropsSchema curatedExample (T-396 AC #1–#5)', () => {
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

  it('T-396 AC #1 — accepts a valid curatedExample with a data: URL', () => {
    const parsed = aiGenerativeClipPropsSchema.parse({
      ...validBase,
      curatedExample: { src: dataUrl, contentType: 'image/png' },
    });
    expect(parsed.curatedExample?.src).toBe(dataUrl);
    expect(parsed.curatedExample?.contentType).toBe('image/png');
  });

  it('T-396 AC #1 — accepts curatedExample without contentType', () => {
    const parsed = aiGenerativeClipPropsSchema.parse({
      ...validBase,
      curatedExample: { src: dataUrl },
    });
    expect(parsed.curatedExample?.src).toBe(dataUrl);
    expect(parsed.curatedExample?.contentType).toBeUndefined();
  });

  it('T-396 AC #2 — https URL throws (v1 rejects http(s) per the out-of-scope deferral)', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({
        ...validBase,
        curatedExample: { src: 'https://cdn.example.com/example.png' },
      }),
    ).toThrow();
  });

  it('T-396 AC #2 — http URL throws', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({
        ...validBase,
        curatedExample: { src: 'http://example.com/example.png' },
      }),
    ).toThrow();
  });

  it('T-396 AC #3 — relative path throws (refine rejects)', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({
        ...validBase,
        curatedExample: { src: 'relative/path.png' },
      }),
    ).toThrow();
  });

  it('T-396 AC #4 — extra keys on curatedExample rejected (strict shape)', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({
        ...validBase,
        curatedExample: { src: dataUrl, extra: true },
      }),
    ).toThrow();
  });

  it('T-396 AC #4 — invalid contentType throws', () => {
    expect(() =>
      aiGenerativeClipPropsSchema.parse({
        ...validBase,
        curatedExample: { src: dataUrl, contentType: 'image/gif' },
      }),
    ).toThrow();
  });

  it('T-396 AC #5 — payload without curatedExample still validates (backward-compat)', () => {
    const parsed = aiGenerativeClipPropsSchema.parse(validBase);
    expect(parsed.curatedExample).toBeUndefined();
  });

  it('T-396 — accepts contentType image/jpeg', () => {
    const parsed = aiGenerativeClipPropsSchema.parse({
      ...validBase,
      curatedExample: { src: dataUrl, contentType: 'image/jpeg' },
    });
    expect(parsed.curatedExample?.contentType).toBe('image/jpeg');
  });

  it('T-396 — accepts contentType image/webp', () => {
    const parsed = aiGenerativeClipPropsSchema.parse({
      ...validBase,
      curatedExample: { src: dataUrl, contentType: 'image/webp' },
    });
    expect(parsed.curatedExample?.contentType).toBe('image/webp');
  });
});
