// packages/captions/src/index.ts
// @stageflip/captions — Whisper-style transcription + caption packing.
// T-184a: provider contract, mock provider, deterministic packing,
// content-hash cache. T-184b: real OpenAI Whisper provider.

export type {
  AudioSource,
  CacheKey,
  CaptionPipelineResult,
  CaptionSegment,
  PackOptions,
  Transcript,
  TranscribeRequest,
  TranscriptCache,
  TranscriptionProvider,
  TranscriptWord,
} from './types.js';

export { cacheKeyString, deriveCacheKey } from './hash.js';
export { createMemoryCache } from './cache.js';
export { packWords } from './pack.js';
export { type MockProviderOptions, createMockProvider } from './providers/mock.js';
export {
  type CreateOpenAIProviderOptions,
  type OpenAIAudioLike,
  type OpenAILike,
  type VerboseJsonResponse,
  createOpenAIProvider,
} from './providers/openai.js';
export { type TranscribeAndPackRequest, transcribeAndPack } from './transcribe.js';
