// packages/rate-limit/src/index.ts
// @stageflip/rate-limit — token-bucket rate limiter for HTTP and engine
// boundaries (T-263). Source of truth:
// skills/stageflip/concepts/rate-limits/SKILL.md.

export {
  DEFAULT_BUCKET_PARAMS,
  TIERS,
  resolveConfig,
} from './config.js';
export type { BucketParams, RateLimitConfig, Tier } from './config.js';
export { RateLimitedError } from './errors.js';
export type { RateLimitedBody } from './errors.js';
export { RateLimiter } from './limiter.js';
export type {
  ConsumeInput,
  ConsumeResult,
  RateLimiterOptions,
} from './limiter.js';
export {
  checkAndConsume,
  createRateLimitMiddleware,
  principalToInput,
} from './middleware.js';
export type {
  CreateRateLimitMiddlewareOptions,
  NextFn,
  RateLimitPrincipal,
  RateLimitRequest,
  RateLimitResponse,
} from './middleware.js';
export type { BucketState, RedisLike } from './redis.js';
