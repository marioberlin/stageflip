// packages/rate-limit/src/redis.ts
// Minimal redis-like KV interface our limiter needs. Production wires
// @upstash/redis (Apache-2.0) — see docs/architecture.md:148, :339; tests
// wire an in-memory fake (per D-T263-5). Decoupling here keeps the package
// dependency-light and lets the auth-middleware-style "inject the client"
// pattern apply (no firebase-admin / no upstash sdk at install time).

/**
 * Subset of the @upstash/redis client surface we depend on. Each method
 * returns a `Promise` (Upstash is REST so every op is async).
 *
 * `eval` is intentionally omitted — the bucket math is small enough to
 * run in JS with a single read + single write per check; the cost is one
 * extra round-trip vs Lua-on-redis, which is acceptable for the v1
 * surface and trades zero infrastructure complexity.
 */
export interface RedisLike {
  /** Get a stringified value or `null` when absent. */
  get(key: string): Promise<string | null>;
  /**
   * Set a stringified value; `px` is the TTL in milliseconds.
   * The Upstash signature is `set(key, value, opts)` with `opts.px`; we
   * normalise to a small explicit shape.
   */
  set(key: string, value: string, opts?: { readonly px?: number }): Promise<unknown>;
}

/** Bucket state persisted as JSON under the limiter key. */
export interface BucketState {
  /** Current token count (float). */
  readonly tokens: number;
  /** Wall-clock millis at which `tokens` was last computed. */
  readonly updatedAt: number;
}

/** Parse a bucket state from redis or return `null` on absence/corruption. */
export function parseBucketState(raw: string | null): BucketState | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'tokens' in parsed &&
      'updatedAt' in parsed &&
      typeof (parsed as { tokens: unknown }).tokens === 'number' &&
      typeof (parsed as { updatedAt: unknown }).updatedAt === 'number'
    ) {
      const p = parsed as BucketState;
      return { tokens: p.tokens, updatedAt: p.updatedAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** Serialise bucket state for redis. */
export function serializeBucketState(state: BucketState): string {
  return JSON.stringify(state);
}
