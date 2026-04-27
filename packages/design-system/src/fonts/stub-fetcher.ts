// packages/design-system/src/fonts/stub-fetcher.ts
// Test-only `FontFetcher` that returns canned bytes per family. Avoids
// network calls in tests and makes byte-determinism trivial.

import type { FontFetchResult, FontFetcher } from '../types.js';

export interface StubFontFetcherOptions {
  /** Per-family canned bytes. Default empty → all families fail. */
  bytesByFamily?: Record<string, Uint8Array>;
  /** Families that should throw on fetch (used to test loss-flag emission). */
  failFamilies?: string[];
}

/**
 * Minimal stub fetcher. Returns one variant per family with the canned
 * bytes; throws for families in `failFamilies`.
 */
export class StubFontFetcher implements FontFetcher {
  private readonly bytesByFamily: Record<string, Uint8Array>;
  private readonly failFamilies: Set<string>;

  constructor(opts: StubFontFetcherOptions = {}) {
    this.bytesByFamily = opts.bytesByFamily ?? {};
    this.failFamilies = new Set(opts.failFamilies ?? []);
  }

  async fetch(input: {
    family: string;
    weights: number[];
    italics: boolean[];
  }): Promise<FontFetchResult[]> {
    if (this.failFamilies.has(input.family)) {
      throw new Error(`stub: family "${input.family}" configured to fail`);
    }
    const bytes = this.bytesByFamily[input.family];
    if (!bytes) {
      throw new Error(`stub: no bytes for family "${input.family}"`);
    }
    const weight = input.weights[0] ?? 400;
    return [
      {
        family: input.family,
        weight,
        italic: false,
        bytes,
        contentType: 'font/woff2',
      },
    ];
  }
}
