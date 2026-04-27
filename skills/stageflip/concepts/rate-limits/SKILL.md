---
title: Rate Limits
id: skills/stageflip/concepts/rate-limits
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-263
related:
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/mcp-integration/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
---

# Rate Limits

Three independent dimensions; the bucket with the longest retry wins.

## The three dimensions

| Dimension | Unit of scope | Why |
|---|---|---|
| Per-user | authenticated user id | prevents a single user from drowning their org |
| Per-org | tenant | protects capacity across users sharing a plan |
| Per-key | API-key id | isolates runaway integrations from interactive use |

Every request consumes from all applicable buckets. A bucket that hits 0
rejects with `429 Too Many Requests` plus a `Retry-After` header. When
multiple buckets are exhausted, the **longest** retry duration is
returned (T-263 AC #7) — clients wait that long.

## Algorithm: token bucket

T-263 (D-T263-1) chose **token bucket** over sliding window:

- Token bucket smooths bursts (allows brief spikes within capacity); sliding
  window does not.
- Industry-standard for API rate limiting (Stripe, GitHub, etc. converge here).

Each bucket has a `capacity` (burst tokens) and a `refillPerSecond` rate.
Math runs in JS; one redis read + one redis write per check.

## Defaults (D-T263-3)

Spec-pinned. Changing requires Orchestrator approval.

| Tier | Capacity | Refill | Notes |
|---|---|---|---|
| `user` | 60 tokens | 1 / sec | Per-authenticated-user. Spans all sessions. |
| `org` | 600 tokens | 10 / sec | Per-org aggregate (10× user). |
| `apiKey` | 300 tokens | 5 / sec | Per-API-key. Independent of user. |

Per-tier env-var overrides for ops tuning (no redeploy):

```
STAGEFLIP_RATE_LIMIT_USER_CAPACITY      STAGEFLIP_RATE_LIMIT_USER_REFILL
STAGEFLIP_RATE_LIMIT_ORG_CAPACITY       STAGEFLIP_RATE_LIMIT_ORG_REFILL
STAGEFLIP_RATE_LIMIT_APIKEY_CAPACITY    STAGEFLIP_RATE_LIMIT_APIKEY_REFILL
```

Invalid values (non-numeric, zero, negative, NaN, Infinity) throw at
module load.

## Hierarchical enforcement

A request consumes one token from each applicable bucket:

- **Authenticated user request**: `user` + `org`.
- **API-key request**: `apiKey` + `org` (the key is bound to an org via T-262).
- **MCP-session request**: same as authenticated user (`user` + `org`).
- **Anonymous request**: not allowed — auth (T-262) must run first.

If neither `user` nor `apiKey` is supplied, the limiter throws
(`rate-limit: at least one of user or apiKey required`) — fail-fast
guard so unauth'd requests can't reach this layer.

## Storage: Upstash Redis (D-T263-2)

Reuse the Upstash Redis instance provisioned for BullMQ queues
(`docs/architecture.md:148, :339`). No new infrastructure.

- **Key namespacing**: `ratelimit:{tier}:{id}` — e.g.
  `ratelimit:user:u_abc123`. Avoids collision with BullMQ's `bull:*`
  namespace.
- **TTL**: each bucket key expires after 2× its full-refill period
  when idle (Upstash auto-expires).

The `@stageflip/rate-limit` package depends on a `RedisLike` interface
(`get(key) → string | null`, `set(key, value, { px })`) — production
wires `@upstash/redis` (Apache-2.0); tests use an in-memory fake
(D-T263-5). The package itself ships no Upstash SDK dependency.

**v1 atomicity tradeoff**: the bucket math is CAS-free (`get` then
`set`, no Redis Lua / atomic decrement). Under concurrent requests on
the same bucket, brief refill races can over-credit by **at most one
request per bucket per concurrent burst** — the limiter sees a stale
`tokens` value between the read and write. Acceptable for v1 (rate
limits are statistical guards, not strict gates); a future task may
promote to atomic decrement via Lua / `INCR` once a real-Redis adapter
is wired and the over-credit window is measured against production
churn. Documented inline at `packages/rate-limit/src/limiter.ts:5-9`.

## Two enforcement surfaces (D-T263-4)

### HTTP middleware

```ts
import { RateLimiter, createRateLimitMiddleware } from '@stageflip/rate-limit';

const limiter = new RateLimiter({ redis });
app.use(requireAuth({...}));        // attaches req.principal (T-262)
app.use(createRateLimitMiddleware({ limiter })); // consumes the token bucket
```

Connect-style `(req, res, next)`. Reads `req.principal` (the discriminated
shape from `@stageflip/auth-middleware`); mirrors the `requireAuth`
pattern. The Hono app wraps it the same way `requireAuth` is wrapped in
`apps/api/src/auth/middleware.ts`.

On reject:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3
Content-Type: application/json

{ "code": "RATE_LIMITED", "tier": "user", "retryAfterSeconds": 3 }
```

The wire shape (T-263 AC #16) is **frozen** — once shipped, every
client retries against this contract. Do not change post-merge without
a major version bump.

### Engine boundary helper

```ts
import { checkAndConsume, RateLimitedError } from '@stageflip/rate-limit';

try {
  await checkAndConsume(limiter, { user: 'u', org: 'o' });
  // ...do the expensive thing
} catch (err) {
  if (err instanceof RateLimitedError) {
    // back off internally OR surface upstream
  }
}
```

Used by long-running engine handlers (e.g., AI call orchestration).
`RateLimitedError` carries `tier` + `retryAfterMs`; `toJSON()` produces
the same wire body as the HTTP middleware.

## Layered middleware idempotency (AC #14)

If two `createRateLimitMiddleware` instances are stacked (e.g., one for
the route and one for a sub-router), each consumes from its own
limiter's buckets. Pass distinct `namespace` to each `RateLimiter` for
fully-disjoint counters; pass the same namespace (and the same limiter
instance) to share state.

Common pitfall: stacking the **same** middleware instance twice burns
two tokens per request. Mount once.

## Determinism posture

`packages/rate-limit/**` is NOT clip / runtime code (D-T263-6).
`pnpm check-determinism` doesn't scan it. Token bucket reads `Date.now()`
for refill computation; `setTimeout` in retry/backoff paths is fine.

## Current state (Phase 12)

Implemented in [`@stageflip/rate-limit`](../../../../packages/rate-limit)
under T-263. Integration into existing API routes is a follow-up — T-263
ships the package + middleware + Vitest fixtures and pins the wire
shape; downstream tasks wire it into the public API surface.

## Related

- Auth: `concepts/auth/SKILL.md` — provides `req.principal` shape.
- Task: T-263.
- ADR-006 (D8 surface) — rate-limits are part of the public API surface posture.
- Skill update required if a new protected surface is added.
