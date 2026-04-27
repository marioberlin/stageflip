// packages/rate-limit/src/config.ts
// Default bucket params per D-T263-3 + env-var override layer.
// Defaults are *spec-pinned* (CLAUDE.md §6 escalation: changing them
// requires Orchestrator approval). Per-tier overrides via env vars
// allow ops tuning without redeploy.

/** The three rate-limit tiers (D-T263-3). */
export type Tier = 'user' | 'org' | 'apiKey';

/** All tier identifiers, ordered for stable iteration. */
export const TIERS: readonly Tier[] = ['user', 'org', 'apiKey'] as const;

/** Bucket parameters for one tier. */
export interface BucketParams {
  /** Maximum tokens (burst capacity). */
  readonly capacity: number;
  /** Refill rate in tokens per second. */
  readonly refillPerSecond: number;
}

/** Spec-pinned defaults per D-T263-3. */
export const DEFAULT_BUCKET_PARAMS: Readonly<Record<Tier, BucketParams>> = {
  user: { capacity: 60, refillPerSecond: 1 },
  org: { capacity: 600, refillPerSecond: 10 },
  apiKey: { capacity: 300, refillPerSecond: 5 },
} as const;

/** Resolved bucket params keyed by tier, after env-var overrides applied. */
export type RateLimitConfig = Readonly<Record<Tier, BucketParams>>;

/** Map a tier → uppercased token used in env var names. */
function envToken(tier: Tier): string {
  // 'apiKey' becomes 'APIKEY' (matches T-263 doc convention).
  return tier === 'apiKey' ? 'APIKEY' : tier.toUpperCase();
}

/** Read + validate one positive number env var. Returns `undefined` when unset/empty. */
function readPositiveNumberEnv(name: string, env: NodeJS.ProcessEnv): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`rate-limit: env var ${name}="${raw}" is not a positive finite number`);
  }
  return n;
}

/**
 * Resolve the active config by overlaying env-var overrides onto
 * `DEFAULT_BUCKET_PARAMS`. Validates every override; throws on bad input.
 *
 * Env var naming:
 *   STAGEFLIP_RATE_LIMIT_USER_CAPACITY
 *   STAGEFLIP_RATE_LIMIT_USER_REFILL
 *   STAGEFLIP_RATE_LIMIT_ORG_CAPACITY
 *   STAGEFLIP_RATE_LIMIT_ORG_REFILL
 *   STAGEFLIP_RATE_LIMIT_APIKEY_CAPACITY
 *   STAGEFLIP_RATE_LIMIT_APIKEY_REFILL
 */
export function resolveConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const out: Record<Tier, BucketParams> = {
    user: { ...DEFAULT_BUCKET_PARAMS.user },
    org: { ...DEFAULT_BUCKET_PARAMS.org },
    apiKey: { ...DEFAULT_BUCKET_PARAMS.apiKey },
  };
  for (const tier of TIERS) {
    const tok = envToken(tier);
    const cap = readPositiveNumberEnv(`STAGEFLIP_RATE_LIMIT_${tok}_CAPACITY`, env);
    const refill = readPositiveNumberEnv(`STAGEFLIP_RATE_LIMIT_${tok}_REFILL`, env);
    if (cap !== undefined) out[tier] = { ...out[tier], capacity: cap };
    if (refill !== undefined) out[tier] = { ...out[tier], refillPerSecond: refill };
  }
  return out;
}
