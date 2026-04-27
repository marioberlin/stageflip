// packages/design-system/src/fonts/google-fonts-client.test.ts

import { describe, expect, it } from 'vitest';
import { buildCssUrl, parseGoogleFontsCss, resolveGoogleFontUrls } from './google-fonts-client.js';

describe('buildCssUrl', () => {
  it('builds a URL with sorted weights', () => {
    const url = buildCssUrl('Roboto', { weights: [700, 400], italics: [false] });
    expect(url).toBe('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
  });

  it('replaces spaces with + in the family name', () => {
    const url = buildCssUrl('Source Sans Pro', { weights: [400], italics: [false] });
    expect(url).toContain('family=Source+Sans+Pro');
  });

  it('emits ital,wght axis when italics requested', () => {
    const url = buildCssUrl('Roboto', { weights: [400, 700], italics: [true] });
    expect(url).toContain('ital,wght@0,400;0,700;1,400;1,700');
  });

  it('defaults to weight 400 when none provided', () => {
    const url = buildCssUrl('Roboto', { weights: [], italics: [] });
    expect(url).toContain('wght@400');
  });
});

describe('parseGoogleFontsCss', () => {
  it('extracts woff2 URLs from a CSS payload', () => {
    const css = `
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://example.com/r400.woff2) format('woff2');
}
@font-face {
  font-family: 'Roboto';
  font-style: italic;
  font-weight: 700;
  src: url(https://example.com/r700i.woff2) format('woff2');
}
`;
    const out = parseGoogleFontsCss(css, 'Roboto');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      family: 'Roboto',
      weight: 400,
      italic: false,
      url: 'https://example.com/r400.woff2',
      contentType: 'font/woff2',
    });
    expect(out[1]).toMatchObject({
      weight: 700,
      italic: true,
    });
  });

  it('skips blocks for other families', () => {
    const css = `
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://example.com/i400.woff2) format('woff2');
}
`;
    expect(parseGoogleFontsCss(css, 'Roboto')).toHaveLength(0);
  });
});

describe('resolveGoogleFontUrls', () => {
  it('threads the response through fetchImpl', async () => {
    const css = `
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://example.com/r.woff2) format('woff2');
}
`;
    let calledUrl = '';
    const fetchImpl = async (url: RequestInfo | URL): Promise<Response> => {
      calledUrl = String(url);
      return new Response(css, { status: 200 });
    };
    const out = await resolveGoogleFontUrls(
      'Roboto',
      { weights: [400], italics: [false] },
      { fetchImpl },
    );
    expect(calledUrl).toContain('Roboto');
    expect(out).toHaveLength(1);
  });

  it('throws on non-OK response', async () => {
    const fetchImpl = async (): Promise<Response> => new Response('', { status: 500 });
    await expect(
      resolveGoogleFontUrls('Roboto', { weights: [400], italics: [false] }, { fetchImpl }),
    ).rejects.toThrow();
  });
});
