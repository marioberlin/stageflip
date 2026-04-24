// packages/captions/src/providers/openai.ts
// Real OpenAI Whisper provider (T-184b). Wraps
// `openai.audio.transcriptions.create` with `response_format: 'verbose_json'`
// and `timestamp_granularities: ['word']` so the caller gets word-level
// timestamps. The response is normalised to the internal `Transcript` shape.
//
// Design notes:
// - Exposes an `OpenAILike` seam so unit tests can inject a fake without
//   booting the real SDK; production wiring calls `new OpenAI({ apiKey })`.
// - Only `bytes` audio sources are supported for now — URL-sourced audio
//   must be fetched by the caller first (determinism + rate-limit concerns
//   live at that boundary, not here).
// - The wrapper is cache-friendly: the SDK call itself is the only side
//   effect; identical inputs produce byte-identical outputs after
//   normalisation.

import OpenAI from 'openai';

import type { TranscribeRequest, Transcript, TranscriptionProvider } from '../types.js';

/** Minimum surface the provider needs from the OpenAI SDK. */
export interface OpenAIAudioLike {
  readonly transcriptions: {
    create(
      params: {
        readonly file: unknown;
        readonly model: string;
        readonly response_format: 'verbose_json';
        readonly timestamp_granularities: readonly ['word'];
        readonly language?: string;
      },
      requestOptions?: { signal?: AbortSignal },
    ): Promise<VerboseJsonResponse>;
  };
}

export interface OpenAILike {
  readonly audio: OpenAIAudioLike;
}

/**
 * Shape of the `verbose_json + timestamp_granularities: ['word']` response
 * from the OpenAI Whisper API. Only the fields we normalise are typed —
 * the SDK returns more (segments, duration), which we ignore.
 */
export interface VerboseJsonResponse {
  readonly language: string;
  readonly words?: ReadonlyArray<{
    readonly word: string;
    readonly start: number;
    readonly end: number;
  }>;
}

export interface CreateOpenAIProviderOptions {
  /** OpenAI API key. Required when the SDK client is auto-constructed. */
  readonly apiKey?: string;
  /** Whisper model. Default 'whisper-1'. */
  readonly model?: string;
  /** Abort signal forwarded to the SDK call. */
  readonly signal?: AbortSignal;
  /**
   * Inject a test double implementing `OpenAILike`. When omitted, the
   * provider calls `new OpenAI({ apiKey })`.
   */
  readonly client?: OpenAILike;
  /**
   * Filename passed to the SDK's `toFile` helper. OpenAI needs an
   * extension so it can route to the right decoder. Default 'audio.wav'.
   */
  readonly filename?: string;
}

const DEFAULT_MODEL = 'whisper-1';
const DEFAULT_FILENAME = 'audio.wav';

function buildClient(options: CreateOpenAIProviderOptions): OpenAILike {
  if (options.client) return options.client;
  if (!options.apiKey || options.apiKey.length === 0) {
    throw new Error('createOpenAIProvider: apiKey is required when no `client` is provided');
  }
  return new OpenAI({ apiKey: options.apiKey }) as unknown as OpenAILike;
}

async function toFileForRequest(bytes: Uint8Array, filename: string): Promise<unknown> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return OpenAI.toFile(buffer, filename);
}

/**
 * Create an OpenAI Whisper provider. Only `bytes` audio sources are
 * accepted — callers fetching from a URL should buffer the body first.
 */
export function createOpenAIProvider(
  options: CreateOpenAIProviderOptions = {},
): TranscriptionProvider {
  const client = buildClient(options);
  const model = options.model ?? DEFAULT_MODEL;
  const filename = options.filename ?? DEFAULT_FILENAME;
  return {
    id: 'openai-whisper',
    async transcribe(request: TranscribeRequest): Promise<Transcript> {
      if (request.source.kind !== 'bytes') {
        throw new Error(
          "createOpenAIProvider: only 'bytes' audio sources are supported; fetch URL first",
        );
      }
      const file = await toFileForRequest(request.source.bytes, filename);
      const response = await client.audio.transcriptions.create(
        {
          file,
          model,
          response_format: 'verbose_json',
          timestamp_granularities: ['word'] as const,
          ...(request.language !== undefined ? { language: request.language } : {}),
        },
        options.signal ? { signal: options.signal } : undefined,
      );
      const words = (response.words ?? []).map((w) => ({
        text: w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      }));
      return { language: response.language, words };
    },
  };
}
