// packages/runtimes/interactive/src/index.ts
// @stageflip/runtimes-interactive — the interactive runtime tier per
// ADR-003 §D1 + T-306. The package mounts `liveMount` for HTML / live
// presentation / display-interactive / on-device-player exports. It is
// out-of-scope for `check-determinism` per ADR-003 §D5 (T-306 lands the
// exemption; T-309 lands the shader sub-rule).
//
// Public surface:
//   - Contract types — MountContext, MountHandle, ClipFactory, TenantPolicy.
//   - Registry — InteractiveClipRegistry + the singleton.
//   - PermissionShim — mount-time permission gate.
//   - InteractiveMountHarness — programmatic mount/unmount/dispose.
//   - renderStaticFallback — fallback render helper.
//   - contractTestSuite (via './contract-tests') — Vitest describe block
//     for Phase γ family validation.
//
// See `skills/stageflip/concepts/runtimes/SKILL.md`.

export {
  type ClipFactory,
  type MountContext,
  type MountHandle,
  PERMISSIVE_TENANT_POLICY,
  type TenantPolicy,
} from './contract.js';
export {
  renderStaticFallback,
  type StaticFallbackHandle,
} from './fallback-rendering.js';
export {
  InteractiveClipNotRegisteredError,
  InteractiveMountHarness,
  type InteractiveMountHarnessOptions,
  type InteractiveMountOptions,
  type PermissionPrePromptHandler,
  type PermissionPrePromptInvocation,
  registerInteractiveClip,
} from './mount-harness.js';
export {
  INITIAL_PERMISSION_FLOW_STATE,
  PermissionDenialBanner,
  type PermissionDenialBannerProps,
  type PermissionDenialMessages,
  type PermissionFlowAction,
  type PermissionFlowState,
  permissionFlowReducer,
  PermissionPrePromptModal,
  type PermissionPrePromptModalProps,
  type PermissionPrePromptMessages,
  usePermissionFlow,
  type UsePermissionFlowOptions,
  type UsePermissionFlowReturn,
} from './permission-flow/index.js';
export {
  defaultPermissionBrowserApi,
  type EmitTelemetry,
  NOOP_EMIT_TELEMETRY,
  type PermissionBrowserApi,
  type PermissionResult,
  PermissionShim,
  type PermissionShimOptions,
} from './permission-shim.js';
export {
  InteractiveClipFamilyAlreadyRegisteredError,
  InteractiveClipRegistry,
  interactiveClipRegistry,
} from './registry.js';
export {
  StaticFallbackGeneratorAlreadyRegisteredError,
  type StaticFallbackGenerator,
  type StaticFallbackGeneratorContext,
  StaticFallbackGeneratorRegistry,
  staticFallbackGeneratorRegistry,
} from './static-fallback-registry.js';
export { type FrameSource, MissingFrameSourceError } from './frame-source.js';
export { RAFFrameSource, type RAFFrameSourceOptions } from './frame-source-raf.js';
export { RecordModeFrameSource } from './frame-source-record.js';
export type {
  TranscriptEvent,
  TranscriptHandler,
  VoiceClipMountHandle,
  VoiceMountFailureReason,
} from './clips/voice/types.js';
export {
  defaultVoiceStaticFallback,
  type DefaultVoiceStaticFallbackArgs,
  voiceStaticFallbackGenerator,
} from './clips/voice/static-fallback.js';
export {
  InMemoryTranscriptionProvider,
  type InMemoryTranscriptionProviderOptions,
  type ScriptedTranscriptStep,
  type TranscriptionProvider,
  type TranscriptionStartArgs,
  WebSpeechApiTranscriptionProvider,
  type WebSpeechApiTranscriptionProviderOptions,
  WebSpeechApiUnavailableError,
} from './clips/voice/transcription-provider.js';
export type {
  AiChatClipMountHandle,
  AiChatMountFailureReason,
  TurnEvent,
  TurnHandler,
} from './clips/ai-chat/types.js';
export { MultiTurnDisabledError } from './clips/ai-chat/types.js';
export {
  InMemoryLLMChatProvider,
  type InMemoryLLMChatProviderOptions,
  type LLMChatProvider,
  type LLMChatStreamArgs,
  RealLLMChatProvider,
  type RealLLMChatProviderOptions,
  type ScriptedTokenStep,
} from './clips/ai-chat/llm-chat-provider.js';
export {
  aiChatStaticFallbackGenerator,
  defaultAiChatStaticFallback,
  type DefaultAiChatStaticFallbackArgs,
} from './clips/ai-chat/static-fallback.js';
export type {
  DataEvent,
  DataHandler,
  ErrorEvent,
  ErrorHandler,
  LiveDataClipMountHandle,
  LiveDataMountFailureReason,
} from './clips/live-data/types.js';
export { RefreshTriggerError } from './clips/live-data/types.js';
export {
  HostFetcherProvider,
  type HostFetcherProviderOptions,
  InMemoryLiveDataProvider,
  type InMemoryLiveDataProviderOptions,
  type Fetcher,
  type LiveDataFetchArgs,
  type LiveDataFetchResult,
  type LiveDataProvider,
  type ScriptedResponse,
} from './clips/live-data/live-data-provider.js';
export {
  defaultLiveDataStaticFallback,
  type DefaultLiveDataStaticFallbackArgs,
  liveDataStaticFallbackGenerator,
} from './clips/live-data/static-fallback.js';
export type {
  WebEmbedClipMountHandle,
  WebEmbedMessageDropReason,
  WebEmbedMessageEvent,
  WebEmbedMessageHandler,
  WebEmbedMountFailureReason,
} from './clips/web-embed/types.js';
export type {
  AiGenerativeClipMountHandle,
  AiGenerativeMountFailureReason,
  ErrorEvent as AiGenerativeErrorEvent,
  ErrorHandler as AiGenerativeErrorHandler,
  ResultEvent as AiGenerativeResultEvent,
  ResultHandler as AiGenerativeResultHandler,
} from './clips/ai-generative/types.js';
export {
  type AiGenerativeArgs,
  type AiGenerativeProvider,
  type AiGenerativeResult,
  type Generator as AiGenerator,
  HostInjectedAiGenerativeProvider,
  type HostInjectedAiGenerativeProviderOptions,
  InMemoryAiGenerativeProvider,
  type InMemoryAiGenerativeProviderOptions,
  type ScriptedAiGenerativeResult,
} from './clips/ai-generative/ai-generative-provider.js';
export {
  defaultAiGenerativeStaticFallback,
  type DefaultAiGenerativeStaticFallbackArgs,
  aiGenerativeStaticFallbackGenerator,
} from './clips/ai-generative/static-fallback.js';
export {
  defaultWebEmbedStaticFallback,
  type DefaultWebEmbedStaticFallbackArgs,
  webEmbedStaticFallbackGenerator,
} from './clips/web-embed/static-fallback.js';
