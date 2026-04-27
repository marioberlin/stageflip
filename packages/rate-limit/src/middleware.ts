// packages/rate-limit/src/middleware.ts
// Connect-style HTTP middleware (D-T263-4). Reads the resolved Principal
// off `req.principal` (per @stageflip/auth-middleware T-262 conventions);
// calls the limiter; on rejection writes 429 + `Retry-After` header +
// JSON body matching the AC #16 wire shape.
//
// Hono compatibility: this middleware is Connect-shaped `(req, res, next)`
// because that mirrors the project's auth-middleware pattern; the
// app-api Hono layer wraps it as needed (see apps/api/src/auth/middleware.ts
// for the same pattern applied to requireAuth).

import { RateLimitedError } from './errors.js';
import type { ConsumeInput, RateLimiter } from './limiter.js';

/**
 * The Principal shape we read off `req`. We accept any structurally-
 * matching shape so this package doesn't have to depend on
 * `@stageflip/auth-middleware`. The fields we read are documented in
 * `packages/auth-middleware/src/principal.ts`.
 */
export interface RateLimitPrincipal {
  readonly kind: 'user' | 'apiKey' | 'mcp-session';
  readonly userId?: string;
  readonly orgId?: string;
  readonly keyId?: string;
}

/** Minimal request shape — Connect/Express compatible. */
export interface RateLimitRequest {
  principal?: RateLimitPrincipal;
}

/** Minimal response shape, matched to auth-middleware's `AuthResponse`. */
export interface RateLimitResponse {
  status(code: number): RateLimitResponse;
  json(body: unknown): RateLimitResponse;
  setHeader(name: string, value: string): void;
}

export type NextFn = (err?: unknown) => void;

export interface CreateRateLimitMiddlewareOptions {
  readonly limiter: RateLimiter;
}

/**
 * Map a `Principal` to the `consume()` input. Returns `null` when the
 * principal is missing every keyable id — caller throws (AC #12).
 */
export function principalToInput(p: RateLimitPrincipal): ConsumeInput | null {
  const out: { user?: string; org?: string; apiKey?: string } = {};
  if (p.kind === 'apiKey') {
    if (p.keyId !== undefined) out.apiKey = p.keyId;
  } else if (p.userId !== undefined) {
    // 'user' and 'mcp-session' both key on userId.
    out.user = p.userId;
  }
  if (p.orgId !== undefined) out.org = p.orgId;
  if (out.user === undefined && out.apiKey === undefined) return null;
  return out;
}

/**
 * Build a `(req, res, next)` middleware that consumes rate-limit tokens
 * for the resolved Principal, calling `next()` on allow or writing 429
 * on reject.
 *
 * Each call to `createRateLimitMiddleware` yields an independent
 * middleware bound to its own `RateLimiter`; layered usage (one for the
 * route, one for a sub-router) consumes from each instance's own
 * buckets (AC #14). Pass distinct `namespace` to `RateLimiter` if you
 * need fully-disjoint counters; default namespace shares state across
 * instances bound to the same redis (correct for AC #14 idempotency
 * when both layers carry the same intent).
 */
export function createRateLimitMiddleware(opts: CreateRateLimitMiddlewareOptions) {
  const { limiter } = opts;
  return async function rateLimitMiddleware(
    req: RateLimitRequest,
    res: RateLimitResponse,
    next: NextFn,
  ): Promise<void> {
    const principal = req.principal;
    if (principal === undefined) {
      next(new Error('rate-limit: req.principal missing — auth must run before rate-limit'));
      return;
    }
    const input = principalToInput(principal);
    if (input === null) {
      next(new Error('rate-limit: at least one of user or apiKey required'));
      return;
    }
    let result: Awaited<ReturnType<RateLimiter['consume']>>;
    try {
      result = await limiter.consume(input);
    } catch (err) {
      next(err);
      return;
    }
    if (result.allowed) {
      next();
      return;
    }
    const err = new RateLimitedError({
      tier: result.tier,
      retryAfterMs: result.retryAfterMs,
    });
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json(err.toJSON());
  };
}

/**
 * Engine-boundary helper (D-T263-4). Throws `RateLimitedError` on
 * rejection so long-running handlers can `try / catch` and decide
 * whether to surface upstream or back off internally.
 */
export async function checkAndConsume(limiter: RateLimiter, input: ConsumeInput): Promise<void> {
  const r = await limiter.consume(input);
  if (!r.allowed) {
    throw new RateLimitedError({ tier: r.tier, retryAfterMs: r.retryAfterMs });
  }
}
