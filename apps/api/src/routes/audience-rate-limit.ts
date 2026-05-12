// apps/api/src/routes/audience-rate-limit.ts
// T-453 / T-458 — Token-bucket rate limiters per ADR-009 §D3. Three flavours:
//   - TokenBucketRateLimiter — generic token-bucket keyed on a string;
//     used as the building block for the three concrete limiters below.
//   - TenantRateLimiter — per-tenant ingest cap
//     (`maxIngestRateHz`; bursts up to `2× rate`); shared across all
//     live sessions for the tenant.
//   - VoterRateLimiter — per-voter cap. Default 2 Hz / voter (1 vote
//     per 500 ms) per ADR-009 §D3 line 231. Per-clip-kind overrides
//     (T-458): `setClipKindOverride('reaction-stream', 10)` admits up
//     to 10 events/sec for reaction-stream-class clips. Vendor adapters
//     inherit the vendor's policy.
//
// All limiters take an injected `now: () => number` so tests can
// advance time deterministically (per ADR-009 §D10 + the T-411a pattern
// for clock injection). Production wiring uses `() => Date.now()` —
// `apps/api` is outside the determinism perimeter per ADR-009 §D10.
//
// T-458 — every limiter optionally consults an `AbuseTrackingStore` BEFORE
// the bucket check. A flagged source whose cooldown has not yet expired
// is refused with `rejectReason: 'abuse-cooldown'`. On bucket-exhausted
// refusal (`rejectReason: 'rate-limited'`), the limiter records a hit
// against the source and, if the in-window hit count crosses the
// threshold, escalates the source's flag (level 1 → 2 → 3). Escalation
// past level 3 stays at level 3; a level-3 source falls back to level 1
// after `ABUSE_ESCALATION_WINDOW_MS` of cleared status.

import {
  ABUSE_ESCALATION_WINDOW_MS,
  type AbuseSource,
  type AbuseTrackingStore,
} from '@stageflip/storage';

import type { AudienceClipKind } from '@stageflip/audience-contract';

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
 * set `rejectReason`. T-458 adds the `'abuse-cooldown'` reason for sources
 * currently in escalating cooldown; the original `'rate-limited'` is
 * returned when the bucket is empty but the source is not flagged.
 *
 * `flagLevel` is set on `'abuse-cooldown'` refusals + on `'rate-limited'`
 * refusals that resulted in a fresh flag escalation; otherwise undefined.
 */
export interface RateLimitDecision {
  readonly accepted: boolean;
  readonly rejectReason?: 'rate-limited' | 'abuse-cooldown';
  readonly flagLevel?: 1 | 2 | 3;
}

/**
 * Token-bucket rate limiter keyed on a string identity (tenantId or
 * voterToken). The bucket refills continuously at `ratePerSecond`; the
 * cap is `burst`. `tryConsume(key)` advances the bucket for `key` based
 * on the wall-clock delta since the last call, then attempts to consume
 * one token. Returns `{ accepted: true }` on success, otherwise
 * `{ accepted: false, rejectReason: 'rate-limited' }`.
 *
 * The optional `ratePerSecondOverride` lets the caller temporarily admit
 * a higher rate for a single message (e.g. T-458's reaction-stream
 * 10 Hz override). When supplied, the bucket size is adjusted to
 * `2× override` for the refill calculation; subsequent calls without
 * the override revert to the configured base rate.
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
   *
   * `override` (T-458) lets the caller admit one message at a higher
   * rate — supplied as `{ ratePerSecond, burst }`. The override does
   * NOT mutate the bucket's base configuration: subsequent calls
   * without the override revert to the base rate. The in-flight bucket
   * state (`tokens`, `lastRefillMs`) is shared across both modes.
   */
  tryConsume(key: string, override?: TokenBucketConfig): RateLimitDecision {
    const ratePerSecond = override?.ratePerSecond ?? this.ratePerSecond;
    const burst = override?.burst ?? this.burst;
    const nowMs = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: burst, lastRefillMs: nowMs };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSec = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
      bucket.tokens = Math.min(burst, bucket.tokens + elapsedSec * ratePerSecond);
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
 * Inspect the source's flag and short-circuit if cooldown is active.
 * Returns the active decision when refusing, or `undefined` when the
 * caller should proceed to the bucket check. Pure helper shared by
 * `TenantRateLimiter` + `VoterRateLimiter` + `IpJoinRateLimiter`.
 */
async function checkAbuseCooldown(
  store: AbuseTrackingStore,
  source: AbuseSource,
  now: number,
): Promise<RateLimitDecision | undefined> {
  const flag = await store.getFlag(source);
  if (flag.level === 0) return undefined;
  if (flag.expiresAt <= now) return undefined;
  return {
    accepted: false,
    rejectReason: 'abuse-cooldown',
    flagLevel: flag.level,
  };
}

/**
 * Compute the next escalation level for `source`. Reads the current
 * flag; if cooldown elapsed > ABUSE_ESCALATION_WINDOW_MS ago, drops
 * back to level 1; otherwise bumps by 1 (capped at 3).
 */
function nextEscalationLevel(
  currentLevel: 0 | 1 | 2 | 3,
  expiresAt: number,
  now: number,
): 1 | 2 | 3 {
  if (currentLevel === 0) return 1;
  // The escalation window starts at the flag's `expiresAt` moment.
  // If `now` is past `expiresAt + ABUSE_ESCALATION_WINDOW_MS`, the
  // source has been "good" long enough to reset to level 1.
  if (now > expiresAt + ABUSE_ESCALATION_WINDOW_MS) return 1;
  if (currentLevel === 1) return 2;
  if (currentLevel === 2) return 3;
  return 3; // already at max
}

/**
 * Record a refusal hit on the abuse store + escalate the source's flag
 * if the in-window hit count crossed the configured threshold. Pure
 * helper shared by every limiter. Returns the new flag level (or 0 if
 * no escalation occurred).
 */
async function recordRefusalAndMaybeEscalate(
  store: AbuseTrackingStore,
  threshold: number,
  source: AbuseSource,
  now: number,
): Promise<0 | 1 | 2 | 3> {
  await store.recordHit(source);
  const counter = await store.getCounter(source);
  if (counter.hits < threshold) return 0;
  const flag = await store.getFlag(source);
  const next = nextEscalationLevel(flag.level, flag.expiresAt, now);
  await store.flag(source, next);
  return next;
}

/**
 * Per-tenant rate limiter — bursts up to `2× maxIngestRateHz` per
 * ADR-009 §D3. Lookup key is the tenantId. Built from a
 * `TenantSettings.features.audience.maxIngestRateHz` value.
 *
 * T-458: optional `abuseStore` consults `AbuseTrackingStore` for the
 * tenant before the bucket check; refusals contribute to the tenant's
 * abuse counter, and crossing the threshold escalates the tenant's
 * flag. Tenants are tracked under `kind: 'voter-token'` (the discriminated
 * source's value field is reused for tenantId) — they're a separate
 * axis from per-IP join abuse, but share the same store contract.
 */
export class TenantRateLimiter {
  private readonly limiter: TokenBucketRateLimiter;
  private readonly abuseStore?: AbuseTrackingStore;
  private readonly threshold: number;
  private readonly now: () => number;

  constructor(options: {
    readonly maxIngestRateHz: number;
    readonly now?: () => number;
    readonly abuseStore?: AbuseTrackingStore;
  }) {
    this.now = options.now ?? (() => Date.now());
    this.limiter = new TokenBucketRateLimiter({
      ratePerSecond: options.maxIngestRateHz,
      burst: options.maxIngestRateHz * 2,
      now: this.now,
    });
    if (options.abuseStore) this.abuseStore = options.abuseStore;
    this.threshold = options.abuseStore?.threshold ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Try to consume one tenant-rate token. When an abuse store is
   * configured, the source is checked for an active cooldown first;
   * refusals contribute hits + may escalate.
   */
  async tryConsume(tenantId: string): Promise<RateLimitDecision> {
    const source: AbuseSource = { kind: 'voter-token', value: `tenant:${tenantId}` };
    const t = this.now();
    if (this.abuseStore) {
      const cooldown = await checkAbuseCooldown(this.abuseStore, source, t);
      if (cooldown) return cooldown;
    }
    const decision = this.limiter.tryConsume(tenantId);
    if (decision.accepted) return decision;
    if (this.abuseStore) {
      const newLevel = await recordRefusalAndMaybeEscalate(
        this.abuseStore,
        this.threshold,
        source,
        t,
      );
      if (newLevel !== 0) {
        return { accepted: false, rejectReason: 'rate-limited', flagLevel: newLevel };
      }
    }
    return decision;
  }

  reset(): void {
    this.limiter.reset();
  }
}

/**
 * Per-voter rate limiter. Default 2 Hz / voter (bursts up to 4) — per
 * ADR-009 §D3 line 231 (1 vote / 500 ms). Per-clip-kind overrides
 * (T-458): `setClipKindOverride('reaction-stream', 10)` admits up to
 * 10 events/sec for reaction-stream-class clips. Lookup key is the
 * voter token.
 *
 * T-458: optional `abuseStore` consults `AbuseTrackingStore` for the
 * voter before the bucket check; refusals contribute hits + may
 * escalate.
 */
export class VoterRateLimiter {
  private readonly limiter: TokenBucketRateLimiter;
  private readonly abuseStore?: AbuseTrackingStore;
  private readonly threshold: number;
  private readonly now: () => number;
  private readonly defaultRateHz: number;
  private readonly clipKindOverrides = new Map<AudienceClipKind, number>();

  constructor(
    options: {
      readonly now?: () => number;
      readonly abuseStore?: AbuseTrackingStore;
      readonly defaultRateHz?: number;
    } = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.defaultRateHz = options.defaultRateHz ?? 2;
    this.limiter = new TokenBucketRateLimiter({
      ratePerSecond: this.defaultRateHz,
      burst: this.defaultRateHz * 2,
      now: this.now,
    });
    if (options.abuseStore) this.abuseStore = options.abuseStore;
    this.threshold = options.abuseStore?.threshold ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Register a per-clip-kind rate override. Subsequent `tryConsume(...,
   * clipKind)` calls for `clipKind` admit at `rateHz` (burst `2× rateHz`)
   * instead of the default. T-458 v1 wires only the `'reaction-stream'`
   * 10 Hz override; the map is extensible for future kinds.
   */
  setClipKindOverride(clipKind: AudienceClipKind, rateHz: number): void {
    if (rateHz <= 0) {
      throw new Error('VoterRateLimiter.setClipKindOverride: rateHz must be > 0');
    }
    this.clipKindOverrides.set(clipKind, rateHz);
  }

  /**
   * Try to consume one voter-rate token. `clipKind` (T-458) selects an
   * override rate when registered; otherwise the default `defaultRateHz`
   * applies. When an abuse store is configured, the voter is checked
   * for an active cooldown first; refusals contribute hits + may
   * escalate.
   */
  async tryConsume(voterToken: string, clipKind?: AudienceClipKind): Promise<RateLimitDecision> {
    const source: AbuseSource = { kind: 'voter-token', value: voterToken };
    const t = this.now();
    if (this.abuseStore) {
      const cooldown = await checkAbuseCooldown(this.abuseStore, source, t);
      if (cooldown) return cooldown;
    }
    const overrideRate = clipKind ? this.clipKindOverrides.get(clipKind) : undefined;
    const override =
      overrideRate !== undefined
        ? { ratePerSecond: overrideRate, burst: overrideRate * 2 }
        : undefined;
    const decision = this.limiter.tryConsume(voterToken, override);
    if (decision.accepted) return decision;
    if (this.abuseStore) {
      const newLevel = await recordRefusalAndMaybeEscalate(
        this.abuseStore,
        this.threshold,
        source,
        t,
      );
      if (newLevel !== 0) {
        return { accepted: false, rejectReason: 'rate-limited', flagLevel: newLevel };
      }
    }
    return decision;
  }

  reset(): void {
    this.limiter.reset();
  }
}

/**
 * Per-IP rate limiter for the audience join endpoint (T-458 wraps the
 * generic TokenBucketRateLimiter so the per-IP path consults the abuse
 * store on the same axis). The default bucket matches T-453's posture:
 * 5 joins/sec / 10 burst per IP (conservative; matches ADR-009 §D8).
 */
export class IpJoinRateLimiter {
  private readonly limiter: TokenBucketRateLimiter;
  private readonly abuseStore?: AbuseTrackingStore;
  private readonly threshold: number;
  private readonly now: () => number;

  constructor(
    options: {
      readonly now?: () => number;
      readonly abuseStore?: AbuseTrackingStore;
      readonly ratePerSecond?: number;
      readonly burst?: number;
    } = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.limiter = new TokenBucketRateLimiter({
      ratePerSecond: options.ratePerSecond ?? 5,
      burst: options.burst ?? 10,
      now: this.now,
    });
    if (options.abuseStore) this.abuseStore = options.abuseStore;
    this.threshold = options.abuseStore?.threshold ?? Number.POSITIVE_INFINITY;
  }

  async tryConsume(ip: string): Promise<RateLimitDecision> {
    const source: AbuseSource = { kind: 'ip', value: ip };
    const t = this.now();
    if (this.abuseStore) {
      const cooldown = await checkAbuseCooldown(this.abuseStore, source, t);
      if (cooldown) return cooldown;
    }
    const decision = this.limiter.tryConsume(ip);
    if (decision.accepted) return decision;
    if (this.abuseStore) {
      const newLevel = await recordRefusalAndMaybeEscalate(
        this.abuseStore,
        this.threshold,
        source,
        t,
      );
      if (newLevel !== 0) {
        return { accepted: false, rejectReason: 'rate-limited', flagLevel: newLevel };
      }
    }
    return decision;
  }

  reset(): void {
    this.limiter.reset();
  }
}
