// packages/runtimes/audience/src/index.ts
// @stageflip/runtimes-audience — the audience runtime tier extending
// `@stageflip/runtimes-interactive` per ADR-003 §D1 + T-306. Ships the
// `AudienceMountContext` / `AudienceMountHandle` contract, the `AudienceClient`
// (WebSocket subscription wrapper with ADR-009 §D6 reconnect-budget +
// `LF-AUDIENCE-CONNECTION-LOST` emission), the per-kind clip-factory
// registry, the `StaticFallbackRenderer` dispatcher, the three-state
// router per ADR-010 §D8, and the `audienceRuntime` `ClipRuntime` plug
// for `findClip(kind)` dispatch.
//
// Concrete clip families (LivePoll / LiveQA / LiveQuiz / Leaderboard /
// WordCloud / Survey / Heatmap / ReactionStream / AudienceAiPrompt) are
// owned by T-461..T-471 — this package is the substrate they plug into.
//
// See `skills/stageflip/concepts/runtimes/SKILL.md` for the runtime-tier
// architecture overview.

export {
  type AudienceClipFactory,
  type AudienceClipKindUniverse,
  type AudienceEmitLossFlag,
  type AudienceLossFlagEmission,
  type AudienceMountContext,
  type AudienceMountHandle,
  type AudienceMountRoute,
  type AudienceSessionId,
  routeMountState,
} from './contract.js';
export {
  __clearAudienceClipDefinitions,
  __resetAudienceRuntime,
  audienceRuntime,
  registerAudienceClipDefinition,
} from './audience-runtime.js';
export {
  type AudienceClientOptions,
  type AudienceClientOutcome,
  type AudienceReconnectObserver,
  type AudienceSnapshotSink,
  type ClearTimeoutFn,
  computeBackoffMs,
  GRACEFUL_CLOSE_CODE,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_MAX_DELAY_MS,
  runAudienceClient,
  type SetTimeoutFn,
} from './audience-client.js';
export type { AudienceClipManifest } from './clip-manifest.js';
export {
  AudienceClipKindAlreadyRegisteredError,
  AudienceClipRegistry,
  audienceClipRegistry,
  findAudienceClip,
  registerAudienceClip,
  UnknownAudienceClipKindError,
} from './registry.js';
export {
  checkProvenanceIntegrity,
  type ProvenanceIntegrity,
  registerStaticFallback,
  StaticFallbackFactoryAlreadyRegisteredError,
  type StaticFallbackFactory,
  StaticFallbackFactoryNotRegisteredError,
  StaticFallbackRenderer,
  staticFallbackRenderer,
  type StaticFallbackResult,
} from './static-fallback.js';
export {
  dispatchMount,
  type ThreeStateHandlers,
  type ThreeStateMountResult,
} from './three-state-router.js';
