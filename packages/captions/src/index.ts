// packages/captions/src/index.ts
// @stageflip/captions — Whisper-style transcription + caption packing.
// Scoped T-184a first PR: provider contract, mock provider, deterministic
// packing, content-hash cache. The real OpenAI Whisper provider lands in
// T-184b.

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
export { type TranscribeAndPackRequest, transcribeAndPack } from './transcribe.js';
