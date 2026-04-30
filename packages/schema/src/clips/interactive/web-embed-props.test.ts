// packages/schema/src/clips/interactive/web-embed-props.test.ts
// T-393 ACs #1–#4 — webEmbedClipPropsSchema parsing.
// T-394 ACs #1–#5 — posterImage optional field.

import { describe, expect, it } from 'vitest';

import { webEmbedClipPropsSchema } from './web-embed-props.js';

const validBase = {
  url: 'https://example.com/embed',
} as const;

describe('webEmbedClipPropsSchema (T-393 AC #1)', () => {
  it('AC #1 — accepts a complete web-embed-props payload', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      url: 'https://example.com/embed',
      sandbox: ['allow-scripts', 'allow-same-origin'],
      allowedOrigins: ['https://example.com', 'https://cdn.example.com'],
      width: 800,
      height: 600,
      posterFrame: 12,
    });
    expect(parsed.url).toBe('https://example.com/embed');
    expect(parsed.sandbox).toEqual(['allow-scripts', 'allow-same-origin']);
    expect(parsed.allowedOrigins).toEqual(['https://example.com', 'https://cdn.example.com']);
    expect(parsed.width).toBe(800);
    expect(parsed.height).toBe(600);
    expect(parsed.posterFrame).toBe(12);
  });

  it('AC #1 — defaults populate when optional fields omitted', () => {
    const parsed = webEmbedClipPropsSchema.parse(validBase);
    expect(parsed.sandbox).toEqual([]);
    expect(parsed.posterFrame).toBe(0);
    expect(parsed.allowedOrigins).toBeUndefined();
    expect(parsed.width).toBeUndefined();
    expect(parsed.height).toBeUndefined();
  });

  it('AC #2 — non-URL url throws', () => {
    expect(() => webEmbedClipPropsSchema.parse({ url: 'not-a-url' })).toThrow();
  });

  it('AC #2 — empty url throws', () => {
    expect(() => webEmbedClipPropsSchema.parse({ url: '' })).toThrow();
  });

  it('AC #3 — non-array sandbox throws', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({ ...validBase, sandbox: 'allow-scripts' }),
    ).toThrow();
  });

  it('AC #3 — non-string sandbox entry throws', () => {
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, sandbox: [42] })).toThrow();
  });

  it('AC #4 — non-URL entry inside allowedOrigins throws', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        allowedOrigins: ['https://valid.example', 'not-a-url'],
      }),
    ).toThrow();
  });

  it('AC #4 — empty allowedOrigins array is permitted', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      allowedOrigins: [],
    });
    expect(parsed.allowedOrigins).toEqual([]);
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, sneaky: true })).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, posterFrame: -1 })).toThrow();
  });

  it('rejects non-integer width', () => {
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, width: 320.5 })).toThrow();
  });

  it('rejects non-positive height (zero or negative)', () => {
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, height: 0 })).toThrow();
    expect(() => webEmbedClipPropsSchema.parse({ ...validBase, height: -10 })).toThrow();
  });

  it('rejects payload missing url entirely', () => {
    expect(() => webEmbedClipPropsSchema.parse({})).toThrow(/url/);
  });

  it('accepts http urls (not just https)', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      url: 'http://localhost:8080/embed',
    });
    expect(parsed.url).toBe('http://localhost:8080/embed');
  });
});

describe('webEmbedClipPropsSchema posterImage (T-394 AC #1–#5)', () => {
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';

  it('T-394 AC #1 — accepts a valid posterImage with a data: URL', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      posterImage: { src: dataUrl, contentType: 'image/png' },
    });
    expect(parsed.posterImage?.src).toBe(dataUrl);
    expect(parsed.posterImage?.contentType).toBe('image/png');
  });

  it('T-394 AC #1 — accepts posterImage without contentType', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      posterImage: { src: dataUrl },
    });
    expect(parsed.posterImage?.src).toBe(dataUrl);
    expect(parsed.posterImage?.contentType).toBeUndefined();
  });

  it('T-394 AC #2 — https URL throws (v1 rejects http(s) per the out-of-scope deferral)', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        posterImage: { src: 'https://cdn.example.com/poster.png' },
      }),
    ).toThrow();
  });

  it('T-394 AC #2 — http URL throws', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        posterImage: { src: 'http://example.com/poster.png' },
      }),
    ).toThrow();
  });

  it('T-394 AC #3 — relative path throws (refine rejects)', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        posterImage: { src: 'relative/path.png' },
      }),
    ).toThrow();
  });

  it('T-394 AC #4 — extra keys on posterImage rejected (strict shape)', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        posterImage: { src: dataUrl, extra: true },
      }),
    ).toThrow();
  });

  it('T-394 AC #4 — invalid contentType throws', () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        posterImage: { src: dataUrl, contentType: 'image/gif' },
      }),
    ).toThrow();
  });

  it('T-394 AC #5 — payload without posterImage still validates (backward-compat)', () => {
    const parsed = webEmbedClipPropsSchema.parse(validBase);
    expect(parsed.posterImage).toBeUndefined();
  });

  it('T-394 — accepts contentType image/jpeg', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      posterImage: { src: dataUrl, contentType: 'image/jpeg' },
    });
    expect(parsed.posterImage?.contentType).toBe('image/jpeg');
  });

  it('T-394 — accepts contentType image/webp', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      posterImage: { src: dataUrl, contentType: 'image/webp' },
    });
    expect(parsed.posterImage?.contentType).toBe('image/webp');
  });
});
