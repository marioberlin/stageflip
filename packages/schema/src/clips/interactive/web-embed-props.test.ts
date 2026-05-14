// packages/schema/src/clips/interactive/web-embed-props.test.ts
// T-393 ACs #1–#4 — webEmbedClipPropsSchema parsing.
// T-394 ACs #1–#5 — posterImage optional field.
// T-404 — security hardening: sandbox-combination guard (R-3). The
// pre-T-404 happy-path test used the now-forbidden
// `['allow-scripts', 'allow-same-origin']` combination; it has been
// rewritten to use a safe combination + dedicated R-3 tests cover the
// rejection paths.

import { describe, expect, it } from 'vitest';

import { FORBIDDEN_SANDBOX_COMBINATIONS, webEmbedClipPropsSchema } from './web-embed-props.js';

const validBase = {
  url: 'https://example.com/embed',
} as const;

describe('webEmbedClipPropsSchema (T-393 AC #1)', () => {
  it('AC #1 — accepts a complete web-embed-props payload (T-404: safe sandbox combination)', () => {
    const parsed = webEmbedClipPropsSchema.parse({
      url: 'https://example.com/embed',
      sandbox: ['allow-scripts', 'allow-popups'],
      allowedOrigins: ['https://example.com', 'https://cdn.example.com'],
      width: 800,
      height: 600,
      posterFrame: 12,
    });
    expect(parsed.url).toBe('https://example.com/embed');
    expect(parsed.sandbox).toEqual(['allow-scripts', 'allow-popups']);
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

describe('webEmbedClipPropsSchema — sandbox combination guard (T-404 R-3)', () => {
  it("R-3 — string 'allow-scripts allow-same-origin' rejected (not an array; type-check fails)", () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        sandbox: 'allow-scripts allow-same-origin',
      }),
    ).toThrow();
  });

  it("R-3 — ['allow-scripts', 'allow-same-origin'] rejected (cancels sandbox)", () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        sandbox: ['allow-scripts', 'allow-same-origin'],
      }),
    ).toThrow(/effectively disables the sandbox/);
  });

  it("R-3 — ['allow-same-origin', 'allow-scripts'] rejected (order-independent)", () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        sandbox: ['allow-same-origin', 'allow-scripts'],
      }),
    ).toThrow(/effectively disables the sandbox/);
  });

  it("R-3 — ['allow-scripts', 'allow-popups'] accepted (safe combination)", () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      sandbox: ['allow-scripts', 'allow-popups'],
    });
    expect(parsed.sandbox).toEqual(['allow-scripts', 'allow-popups']);
  });

  it("R-3 — ['allow-same-origin'] alone accepted", () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      sandbox: ['allow-same-origin'],
    });
    expect(parsed.sandbox).toEqual(['allow-same-origin']);
  });

  it('R-3 — empty sandbox array accepted (the default)', () => {
    const parsed = webEmbedClipPropsSchema.parse({ ...validBase, sandbox: [] });
    expect(parsed.sandbox).toEqual([]);
  });

  it("R-3 — ['allow-scripts'] alone accepted", () => {
    const parsed = webEmbedClipPropsSchema.parse({
      ...validBase,
      sandbox: ['allow-scripts'],
    });
    expect(parsed.sandbox).toEqual(['allow-scripts']);
  });

  it('R-3 — FORBIDDEN_SANDBOX_COMBINATIONS exported for downstream tooling', () => {
    expect(FORBIDDEN_SANDBOX_COMBINATIONS.length).toBeGreaterThan(0);
    expect(FORBIDDEN_SANDBOX_COMBINATIONS[0]?.requires).toEqual([
      'allow-scripts',
      'allow-same-origin',
    ]);
  });

  it("R-3 — full combination ['allow-scripts', 'allow-same-origin', 'allow-popups'] rejected (extra tokens do not bypass)", () => {
    expect(() =>
      webEmbedClipPropsSchema.parse({
        ...validBase,
        sandbox: ['allow-scripts', 'allow-same-origin', 'allow-popups'],
      }),
    ).toThrow(/effectively disables the sandbox/);
  });
});
