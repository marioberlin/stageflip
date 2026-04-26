// packages/import-google-slides/src/cv/stub.ts
// Test-only StubCvProvider. Reads canned candidate JSON keyed by `fixtureKey`
// and returns it verbatim. Bit-deterministic (no I/O at detect time after
// construction). AC #9.

import { CvProviderError } from '../types.js';
import {
  type CvCandidateProvider,
  type CvCandidates,
  type CvDetectOptions,
  cvCandidatesSchema,
} from './types.js';

/**
 * Construct a stub from an in-memory map of fixtureKey → candidates JSON. The
 * map values are validated through the same Zod schema the HTTP provider
 * uses, so test fixtures and production responses share one contract.
 */
export class StubCvProvider implements CvCandidateProvider {
  readonly #map: Map<string, CvCandidates>;

  constructor(entries: Record<string, unknown>) {
    this.#map = new Map();
    for (const [key, raw] of Object.entries(entries)) {
      const parsed = cvCandidatesSchema.safeParse(raw);
      if (!parsed.success) {
        throw new CvProviderError({
          code: 'BAD_RESPONSE',
          message: `StubCvProvider: fixture "${key}" failed validation: ${parsed.error.message}`,
        });
      }
      this.#map.set(key, parsed.data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async detect(_pageImage: Uint8Array, opts: CvDetectOptions): Promise<CvCandidates> {
    const key = opts.fixtureKey;
    if (!key) {
      throw new CvProviderError({
        code: 'BAD_RESPONSE',
        message: 'StubCvProvider requires opts.fixtureKey',
      });
    }
    const data = this.#map.get(key);
    if (!data) {
      throw new CvProviderError({
        code: 'BAD_RESPONSE',
        message: `StubCvProvider: no fixture for key "${key}"`,
      });
    }
    return data;
  }
}
