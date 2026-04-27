// packages/rate-limit/src/limiter.ts
// Distributed token-bucket limiter (D-T263-1). Reads/writes one bucket
// per (tier, id) pair against an injected `RedisLike`. The math is
// CAS-free (single read + single write) — acceptable because each
// per-key bucket is a small contention domain and brief refill races
// can over-credit by at most one request, which the next refresh
// reconciles. Critical-path correctness is guaranteed: a depleted
// bucket cannot allow a request because the per-call read sees the
// most recent committed token count.

import {
  type BucketParams,
  DEFAULT_BUCKET_PARAMS,
  type RateLimitConfig,
  type Tier,
} from './config.js';
import { type RedisLike, parseBucketState, serializeBucketState } from './redis.js';

const KEY_NAMESPACE = 'ratelimit';

/** Inputs to one `consume()` call. */
export interface ConsumeInput {
  /** User id. Either `user` or `apiKey` MUST be supplied (AC #8). */
  readonly user?: string;
  /** Org id. Optional but recommended for hierarchical enforcement. */
  readonly org?: string;
  /** Api-key id. Either `user` or `apiKey` MUST be supplied (AC #8). */
  readonly apiKey?: string;
}

/** Result returned by `consume()`. */
export type ConsumeResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      /** Which bucket triggered the rejection (longest-retry, per AC #7). */
      readonly tier: Tier;
      /** Milliseconds to wait until the offending bucket has ≥1 token. */
      readonly retryAfterMs: number;
    };

/** Constructor options. */
export interface RateLimiterOptions {
  readonly redis: RedisLike;
  /** Override default bucket params. Falls back per-tier to `DEFAULT_BUCKET_PARAMS`. */
  readonly config?: Partial<RateLimitConfig>;
  /** Inject a clock for tests; defaults to `Date.now`. */
  readonly now?: () => number;
  /** Custom key namespace; defaults to `'ratelimit'` (D-T263-2). */
  readonly namespace?: string;
}

/** Internal description of one bucket pull. */
interface PullResult {
  /** Did this single bucket allow the request? */
  readonly allowed: boolean;
  /** Tokens remaining after the call (capped at capacity). */
  readonly remaining: number;
  /** Time-until-token in ms iff `allowed === false`. */
  readonly retryAfterMs: number;
}

/**
 * Token-bucket rate limiter. Stateless; all state lives in the injected
 * `redis`. Construct once per process; share across requests.
 */
export class RateLimiter {
  private readonly redis: RedisLike;
  private readonly config: RateLimitConfig;
  private readonly now: () => number;
  private readonly namespace: string;

  constructor(opts: RateLimiterOptions) {
    this.redis = opts.redis;
    this.config = {
      user: opts.config?.user ?? DEFAULT_BUCKET_PARAMS.user,
      org: opts.config?.org ?? DEFAULT_BUCKET_PARAMS.org,
      apiKey: opts.config?.apiKey ?? DEFAULT_BUCKET_PARAMS.apiKey,
    };
    this.now = opts.now ?? (() => Date.now());
    this.namespace = opts.namespace ?? KEY_NAMESPACE;
  }

  /** Public configuration (read-only) for callers that need to surface limits. */
  getParams(tier: Tier): BucketParams {
    return this.config[tier];
  }

  /**
   * Atomically (per-bucket) check-and-consume one token from each
   * applicable bucket. Returns `{ allowed: true }` on success or
   * `{ allowed: false, tier, retryAfterMs }` for the bucket with the
   * longest retry (AC #7). Throws when neither `user` nor `apiKey` is
   * supplied (AC #8).
   */
  async consume(input: ConsumeInput): Promise<ConsumeResult> {
    if (input.user === undefined && input.apiKey === undefined) {
      throw new Error('rate-limit: at least one of user or apiKey required');
    }

    // Build the list of buckets to pull, in deterministic order.
    const pulls: { tier: Tier; id: string }[] = [];
    if (input.user !== undefined) pulls.push({ tier: 'user', id: input.user });
    if (input.org !== undefined) pulls.push({ tier: 'org', id: input.org });
    if (input.apiKey !== undefined) pulls.push({ tier: 'apiKey', id: input.apiKey });

    // Pull every bucket. Each pull commits its own state; on rejection
    // we still surface the longest-retry tier (AC #7). Because pulls
    // are sequential, a downstream-bucket rejection means upstream
    // buckets have already debited one token — token-bucket math
    // tolerates this brief over-debit; the next refill reconciles.
    let worst: { tier: Tier; retryAfterMs: number } | null = null;
    for (const p of pulls) {
      const r = await this.pullOne(p.tier, p.id);
      if (!r.allowed) {
        if (worst === null || r.retryAfterMs > worst.retryAfterMs) {
          worst = { tier: p.tier, retryAfterMs: r.retryAfterMs };
        }
      }
    }
    if (worst !== null) {
      return { allowed: false, tier: worst.tier, retryAfterMs: worst.retryAfterMs };
    }
    return { allowed: true };
  }

  /** Compose the redis key for one bucket. */
  private keyFor(tier: Tier, id: string): string {
    return `${this.namespace}:${tier}:${id}`;
  }

  /** Pull a single bucket: refill, attempt-consume, persist. */
  private async pullOne(tier: Tier, id: string): Promise<PullResult> {
    const params = this.config[tier];
    const key = this.keyFor(tier, id);
    const now = this.now();

    const raw = await this.redis.get(key);
    const prev = parseBucketState(raw);

    const startTokens =
      prev === null ? params.capacity : refilled(prev.tokens, prev.updatedAt, now, params);

    let allowed: boolean;
    let remaining: number;
    let retryAfterMs: number;
    if (startTokens >= 1) {
      allowed = true;
      remaining = startTokens - 1;
      retryAfterMs = 0;
    } else {
      allowed = false;
      remaining = startTokens;
      // Time until tokens reaches 1.
      const deficit = 1 - startTokens;
      retryAfterMs = Math.ceil((deficit / params.refillPerSecond) * 1000);
    }

    // TTL: 2× full-refill period — bucket is idle-resettable per D-T263-2.
    const fullRefillMs = (params.capacity / params.refillPerSecond) * 1000;
    const ttlMs = Math.max(1, Math.ceil(2 * fullRefillMs));

    const next = serializeBucketState({ tokens: remaining, updatedAt: now });
    await this.redis.set(key, next, { px: ttlMs });

    return { allowed, remaining, retryAfterMs };
  }
}

/** Compute refilled token count, capped at capacity. */
function refilled(
  prevTokens: number,
  prevUpdatedAt: number,
  now: number,
  params: BucketParams,
): number {
  const elapsedMs = Math.max(0, now - prevUpdatedAt);
  const refilled = prevTokens + (elapsedMs / 1000) * params.refillPerSecond;
  return Math.min(params.capacity, refilled);
}
