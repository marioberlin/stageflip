// packages/determinism/src/index.ts
// @stageflip/determinism — runtime shim that enforces invariant I-2 by
// intercepting non-deterministic JS APIs. See
// skills/stageflip/concepts/determinism/SKILL.md and docs/implementation-plan.md
// T-027. The ESLint plugin that gates these APIs at source time is T-028.

export { installShim, isShimInstalled, type InterceptedApi, type ShimOptions } from './shim.js';
