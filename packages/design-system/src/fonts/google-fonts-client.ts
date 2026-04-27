// packages/design-system/src/fonts/google-fonts-client.ts
// Hand-rolled minimal Google Fonts API v2 client. No `googleapis` dep —
// follows T-244's precedent for the Slides client. Only the CSS endpoint
// is wired: query the css2 endpoint with a `family=<name>:wght@<weights>`
// URL; the response is plain CSS containing `@font-face` blocks with woff2
// `src: url(...)` entries which we parse out. Fetching the actual font
// bytes is the caller's responsibility (passed in as `fetchImpl`).

const DEFAULT_CSS_BASE = 'https://fonts.googleapis.com/css2';

export interface GoogleFontsClientOptions {
  /** Override the css2 base URL (for tests). */
  cssBase?: string;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
}

export interface GoogleFontFaceUrl {
  family: string;
  weight: number;
  italic: boolean;
  url: string;
  /** 'font/woff2' | 'font/ttf'. */
  contentType: string;
}

/**
 * Build the css2 query URL. Weights come in as numbers; the CSS endpoint
 * accepts comma-separated weights (e.g. `wght@400;700`) plus optional ital
 * axis (`ital,wght@0,400;1,400;0,700`).
 */
export function buildCssUrl(
  family: string,
  spec: { weights: number[]; italics: boolean[] },
  base: string = DEFAULT_CSS_BASE,
): string {
  const weights = Array.from(new Set(spec.weights.length ? spec.weights : [400])).sort(
    (a, b) => a - b,
  );
  const wantItalic = spec.italics.some(Boolean);
  let axisSpec: string;
  if (wantItalic) {
    const pairs: string[] = [];
    for (const ital of [0, 1]) {
      for (const w of weights) {
        pairs.push(`${ital},${w}`);
      }
    }
    axisSpec = `ital,wght@${pairs.join(';')}`;
  } else {
    axisSpec = `wght@${weights.join(';')}`;
  }
  // The Google Fonts API requires `+` for spaces in family names.
  const familyParam = family.replace(/ /g, '+');
  return `${base}?family=${familyParam}:${axisSpec}&display=swap`;
}

/**
 * Parse @font-face blocks from a Google Fonts css2 response. Returns the
 * woff2 (or ttf) URL per (weight, italic) variant.
 */
export function parseGoogleFontsCss(css: string, family: string): GoogleFontFaceUrl[] {
  const out: GoogleFontFaceUrl[] = [];
  const blocks = css.split('@font-face').slice(1);
  for (const block of blocks) {
    const familyMatch = /font-family:\s*'([^']+)'/.exec(block);
    if (!familyMatch || familyMatch[1] !== family) continue;
    const styleMatch = /font-style:\s*(\w+)/.exec(block);
    const weightMatch = /font-weight:\s*(\d+)/.exec(block);
    const srcMatch = /src:\s*url\((https?:\/\/[^)]+)\)\s*format\('([^']+)'\)/.exec(block);
    if (!srcMatch) continue;
    const weight = weightMatch ? Number.parseInt(weightMatch[1] ?? '400', 10) : 400;
    const italic = styleMatch?.[1] === 'italic';
    const fmt = srcMatch[2] ?? '';
    const contentType = fmt === 'woff2' ? 'font/woff2' : 'font/ttf';
    out.push({
      family,
      weight,
      italic,
      url: srcMatch[1] ?? '',
      contentType,
    });
  }
  return out;
}

/**
 * Resolve a family + variants list to the underlying font-file URLs.
 * Returns one entry per (weight, italic) variant the CSS exposes; the
 * caller fetches the actual bytes.
 */
export async function resolveGoogleFontUrls(
  family: string,
  variants: { weights: number[]; italics: boolean[] },
  opts: GoogleFontsClientOptions = {},
): Promise<GoogleFontFaceUrl[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = buildCssUrl(family, variants, opts.cssBase);
  // Send a UA header that triggers woff2 responses. Without a modern UA the
  // Google Fonts service returns only TTF.
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  });
  if (!res.ok) {
    throw new Error(`Google Fonts CSS request failed: ${res.status}`);
  }
  const css = await res.text();
  return parseGoogleFontsCss(css, family);
}
