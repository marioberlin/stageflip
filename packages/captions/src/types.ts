// packages/captions/src/types.ts
// Types for the caption pipeline. `TranscriptionProvider` is the seam the
// real OpenAI Whisper SDK (T-184b follow-up) and test mocks both plug into.
// Everything here is deterministic once a provider is selected.

import type { CaptionSegment } from '@stageflip/schema';

/** A single word in a Whisper-style transcription with millisecond timestamps. */
export interface TranscriptWord {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Raw Whisper-style output before line packing. Providers return this;
 * the packer turns it into {@link CaptionSegment}[] for a given
 * max-line-chars + max-lines budget.
 */
export interface Transcript {
  readonly language: string;
  readonly words: readonly TranscriptWord[];
}

/** Source of the audio to transcribe. */
export type AudioSource =
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array }
  | { readonly kind: 'url'; readonly url: string };

/** Input to a `TranscriptionProvider.transcribe` call. */
export interface TranscribeRequest {
  readonly source: AudioSource;
  /** BCP-47 language hint. Whisper auto-detects when omitted. */
  readonly language?: string;
}

/**
 * Contract every transcription provider implements. Implementations must
 * be pure with respect to their inputs: the same bytes + language must
 * produce byte-identical output (so the SHA-256 cache key is a valid
 * dedupe key).
 */
export interface TranscriptionProvider {
  readonly id: string;
  transcribe(request: TranscribeRequest): Promise<Transcript>;
}

/** Cache key derived from input. Exposed for tests + observability. */
export interface CacheKey {
  readonly sha256: string;
  readonly language: string;
}

/** In-memory + pluggable cache. Production wiring can swap in a disk backend. */
export interface TranscriptCache {
  get(key: CacheKey): Promise<Transcript | undefined>;
  set(key: CacheKey, value: Transcript): Promise<void>;
}

/**
 * Options for line packing. `maxCharsPerLine` + `maxLines` follow the
 * skill-doc defaults (2 lines, ~40 chars at 16:9; tighter at 9:16).
 */
export interface PackOptions {
  readonly maxCharsPerLine: number;
  readonly maxLines: number;
  /** Minimum segment duration in ms — prevents 1-frame flashes. Default 400. */
  readonly minSegmentMs?: number;
}

/** Full transcription + packing pipeline result. */
export interface CaptionPipelineResult {
  readonly language: string;
  readonly segments: readonly CaptionSegment[];
  readonly cacheHit: boolean;
}

export type { CaptionSegment };
