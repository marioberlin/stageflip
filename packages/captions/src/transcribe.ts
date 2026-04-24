// packages/captions/src/transcribe.ts
// The high-level caption pipeline: cache lookup → provider → pack.
// Every step is deterministic given fixed inputs and a fixed provider.

import { createMemoryCache } from './cache.js';
import { deriveCacheKey } from './hash.js';
import { packWords } from './pack.js';
import type {
  AudioSource,
  CaptionPipelineResult,
  PackOptions,
  TranscribeRequest,
  TranscriptCache,
  TranscriptionProvider,
} from './types.js';

export interface TranscribeAndPackRequest {
  readonly source: AudioSource;
  readonly language?: string;
  readonly pack: PackOptions;
  readonly provider: TranscriptionProvider;
  /** Optional shared cache. A fresh memory cache is used when omitted. */
  readonly cache?: TranscriptCache;
}

/**
 * Transcribe audio, cache the transcript by content hash, then pack words
 * into `CaptionSegment[]`. Re-running with identical bytes + language +
 * cache returns the cached transcript and re-packs without touching the
 * provider.
 */
export async function transcribeAndPack(
  request: TranscribeAndPackRequest,
): Promise<CaptionPipelineResult> {
  const cache = request.cache ?? createMemoryCache();
  const key = await deriveCacheKey(request.source, request.language);

  const cached = await cache.get(key);
  if (cached) {
    return {
      language: cached.language,
      segments: packWords(cached.words, request.pack),
      cacheHit: true,
    };
  }

  const providerRequest: TranscribeRequest =
    request.language !== undefined
      ? { source: request.source, language: request.language }
      : { source: request.source };
  const transcript = await request.provider.transcribe(providerRequest);
  await cache.set(key, transcript);

  return {
    language: transcript.language,
    segments: packWords(transcript.words, request.pack),
    cacheHit: false,
  };
}
