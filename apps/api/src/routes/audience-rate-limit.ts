// apps/api/src/routes/audience-rate-limit.ts
// T-453 — Token-bucket rate limiters per ADR-009 §D3. Two flavours:
//   - TenantRateLimiter — per-tenant ingest cap
//     (`maxIngestRateHz`; bursts up to `2× rate`); shared across all
//     live sessions for the tenant.
//   - VoterRateLimiter — per-voter cap (hardcoded 10 Hz / voter for the
//     native backend; vendor adapters inherit the vendor's policy).
//
// Both limiters take an injected `now: () => number` so tests can
// advance time deterministically (per ADR-009 §D10 + the T-411a pattern
// for clock injection). Production wiring uses `() => Date.now()` —
// `apps/api` is outside the determinism perimeter per ADR-009 §D10.
//
// Refusal returns `{ accepted: false, rejectReason: 'rate-limited' }`;
// the caller emits the corresponding loss flag.

/**
 * Configuration for a single token-bucket. `ratePerSecond` is the steady
 * refill rate; `burst` is the bucket capacity. The bucket admits a
 * token when at least one is available.
 */
export interface TokenBucketConfig {
  readonly ratePerSecond: number;
  readonly burst: number;
}

/**
 * Internal bucket state. Tokens are stored as a continuous floating-point
 * value so partial refills accrue between calls.
 */
interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * Decision returned by every `tryConsume` call. `accepted === false` MUST
 * set `rejectReason`; the rate-limiter's only rejection reason is
 * `'rate-limited'`.
 */
export interface RateLimitDecision {
  readonly accepted: boolean;
  readonly rejectReason?: 'rate-limited';
}

/**
 * Token-bucket rate limiter keyed on a string identity (tenantId or
 * voterToken). The bucket refills continuously at `ratePerSecond`; the
 * cap is `burst`. `tryConsume(key)` advances the bucket for `key` based
 * on the wall-clock delta since the last call, then attempts to consume
 * one token. Returns `{ accepted: true }` on success, otherwise
 * `{ accepted: false, rejectReason: 'rate-limited' }`.
 */
export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly ratePerSecond: number;
  private readonly burst: number;
  private readonly now: () => number;

  constructor(config: TokenBucketConfig & { readonly now?: () => number }) {
    if (config.ratePerSecond <= 0) {
      throw new Error('TokenBucketRateLimiter: ratePerSecond must be > 0');
    }
    if (config.burst <= 0) {
      throw new Error('TokenBucketRateLimiter: burst must be > 0');
    }
    this.ratePerSecond = config.ratePerSecond;
    this.burst = config.burst;
    this.now = config.now ?? (() => Date.now());
  }

  /**
   * Try to consume one token for `key`. Bucket is created on first
   * access (starts full). Returns `{ accepted: true }` if a token was
   * available; otherwise refuses.
   */
  tryConsume(key: string): RateLimitDecision {
    const nowMs = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.burst, lastRefillMs: nowMs };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSec = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
      bucket.tokens = Math.min(this.burst, bucket.tokens + elapsedSec * this.ratePerSecond);
      bucket.lastRefillMs = nowMs;
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { accepted: true };
    }
    return { accepted: false, rejectReason: 'rate-limited' };
  }

  /** Test-only: clear all buckets. */
  reset(): void {
    this.buckets.clear();
  }

  /** Test-only: read the current token count for a key (0 if unseen). */
  peekTokens(key: string): number {
    return this.buckets.get(key)?.tokens ?? 0;
  }
}

/**
 * Per-tenant rate limiter — bursts up to `2× maxIngestRateHz` per
 * ADR-009 §D3. Lookup key is the tenantId. Built from a
 * `TenantSettings.features.audience.maxIngestRateHz` value.
 */
export class TenantRateLimiter {
  private readonly limiter: TokenBucketRateLimiter;

  constructor(options: { readonly maxIngestRateHz: number; readonly now?: () => number }) {
    this.limiter = new TokenBucketRateLimiter({
      ratePerSecond: options.maxIngestRateHz,
      burst: options.maxIngestRateHz * 2,
      ...(options.now !== undefined ? { now: options.now } : {}),
    });
  }

  /** Try to consume one tenant-rate token for the given tenant. */
  tryConsume(tenantId: string): RateLimitDecision {
    return this.limiter.tryConsume(tenantId);
  }

  reset(): void {
    this.limiter.reset();
  }
}

/**
 * Per-voter rate limiter. Hardcoded 10 Hz / voter (bursts up to 20)
 * for the native backend per ADR-009 §D3. Lookup key is the voter token
 * (plaintext — the limiter does NOT persist anything, so plaintext is
 * acceptable in memory; the durable log uses the hashed token).
 */
export class VoterRateLimiter {
  private readonly limiter: TokenBucketRateLimiter;

  constructor(options: { readonly now?: () => number } = {}) {
    this.limiter = new TokenBucketRateLimiter({
      ratePerSecond: 10,
      burst: 20,
      ...(options.now !== undefined ? { now: options.now } : {}),
    });
  }

  /** Try to consume one voter-rate token for the given voter. */
  tryConsume(voterToken: string): RateLimitDecision {
    return this.limiter.tryConsume(voterToken);
  }

  reset(): void {
    this.limiter.reset();
  }
}
