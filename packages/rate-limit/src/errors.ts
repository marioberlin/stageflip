// packages/rate-limit/src/errors.ts
// Wire-shape error for rejected requests. AC #16 pins the JSON contract;
// once shipped, every client retries against this shape — do not change
// post-merge without a major version bump.

import type { Tier } from './config.js';

/** Wire-shape body for HTTP 429 responses (AC #16). */
export interface RateLimitedBody {
  readonly code: 'RATE_LIMITED';
  readonly tier: Tier;
  readonly retryAfterSeconds: number;
}

/**
 * Thrown by the engine-boundary helper (D-T263-4) and serialised by the
 * HTTP middleware. `retryAfterMs` is the precise time to wait; the wire
 * shape rounds up to whole seconds for the `Retry-After` header (RFC 7231).
 */
export class RateLimitedError extends Error {
  readonly tier: Tier;
  readonly retryAfterMs: number;
  constructor(args: { readonly tier: Tier; readonly retryAfterMs: number }) {
    super(`rate-limit exceeded on tier=${args.tier}; retry after ${args.retryAfterMs}ms`);
    this.name = 'RateLimitedError';
    this.tier = args.tier;
    this.retryAfterMs = args.retryAfterMs;
  }
  toJSON(): RateLimitedBody {
    return {
      code: 'RATE_LIMITED',
      tier: this.tier,
      retryAfterSeconds: Math.ceil(this.retryAfterMs / 1000),
    };
  }
}
