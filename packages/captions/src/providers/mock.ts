// packages/captions/src/providers/mock.ts
// Deterministic test/stub provider. Given a list of phrases (or defaulting
// to a single phrase decoded from the bytes), emits word-level timestamps
// spaced by a fixed cadence. Used by unit tests and dev harnesses.
//
// Exported as a factory so different tests can configure different phrases
// without reaching into shared state.

import type {
  TranscribeRequest,
  Transcript,
  TranscriptWord,
  TranscriptionProvider,
} from '../types.js';

export interface MockProviderOptions {
  /**
   * Phrases the provider emits, one word per array element. Falls back to
   * a placeholder sentence when omitted.
   */
  readonly words?: readonly string[];
  /** Milliseconds per word. Default 320. */
  readonly msPerWord?: number;
  /** Gap between words in ms (adds to msPerWord). Default 80. */
  readonly gapMs?: number;
  /** Language tag returned in the transcript. Default 'en'. */
  readonly language?: string;
}

const DEFAULT_WORDS = ['Hello', 'from', 'the', 'mock', 'provider'];

export function createMockProvider(options: MockProviderOptions = {}): TranscriptionProvider {
  const words = options.words ?? DEFAULT_WORDS;
  const msPerWord = options.msPerWord ?? 320;
  const gapMs = options.gapMs ?? 80;
  const language = options.language ?? 'en';
  return {
    id: 'mock',
    async transcribe(_request: TranscribeRequest): Promise<Transcript> {
      const out: TranscriptWord[] = [];
      let cursor = 0;
      for (const text of words) {
        const startMs = cursor;
        const endMs = cursor + msPerWord;
        out.push({ text, startMs, endMs });
        cursor = endMs + gapMs;
      }
      return { language, words: out };
    },
  };
}
