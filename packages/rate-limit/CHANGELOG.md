# @stageflip/rate-limit

## 0.1.0

### Minor Changes

- 4695711: T-263 — initial release. Token-bucket rate limiter for HTTP middleware
  and engine boundaries. Tiered enforcement per user / org / api-key with
  longest-retry semantics on rejection. Connect-style
  `createRateLimitMiddleware` reads `req.principal` (per
  `@stageflip/auth-middleware` T-262 conventions); `checkAndConsume`
  helper for engine handlers. Stateless against an injected `RedisLike`
  client (Upstash REST in production, in-memory fake in tests).
  Spec-pinned defaults and `STAGEFLIP_RATE_LIMIT_*` env-var overrides.
  Wire shape `{ code: 'RATE_LIMITED', tier, retryAfterSeconds }` is
  frozen — see `skills/stageflip/concepts/rate-limits/SKILL.md`.
