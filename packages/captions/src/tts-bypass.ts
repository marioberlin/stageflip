// packages/captions/src/tts-bypass.ts
// TTS→captions bypass-Whisper path (T-436).
//
// When audio comes from a whitelisted TTS adapter (Kokoro, Fish Speech)
// and the adapter shipped per-word timestamps alongside the synthesized
// bytes, we can build `CaptionSegment[]` directly from those
// timestamps — skipping the Whisper transcription call entirely.
//
// This file:
//   1. Declares the whitelist of TTS adapter ids whose word-timestamps
//      the host trusts.
//   2. Exposes `extractTtsBypassWords()` — a pure validator that turns
//      `(provenance, wordTimestamps)` into `TranscriptWord[]` when the
//      bypass is eligible, or `undefined` otherwise.
//   3. Exposes `transcribeAndPackWithTtsBypass()` — the public entry
//      point that consumers call: when the bypass is eligible, it packs
//      the synthetic transcript directly; when not, it falls through to
//      `transcribeAndPack()` unchanged.
//
// The captions package does NOT import from `@stageflip/tts-kokoro`,
// `@stageflip/tts-fish-speech`, or `@stageflip/asset-gen-contract`.
// We mirror the structural shape of the inputs we need (a `kind` +
// `provider` provenance discriminator, and a positional `{ word,
// startS, endS }` array) locally so the captions bundle stays a
// leaf consumer of the TTS surface.

import { packWords } from './pack.js';
import { type TranscribeAndPackRequest, transcribeAndPack } from './transcribe.js';
import type { CaptionPipelineResult, TranscriptWord } from './types.js';

/**
 * TTS adapter ids whose word-timestamps the captions pipeline trusts
 * for the Whisper-bypass path. Initial entries (T-436): T-426 Kokoro +
 * T-427 Fish Speech.
 *
 * Adding a third entry is a deliberate host-side trust signal —
 * `TtsCapabilityDescriptor.emitsWordTimestamps === true` alone is not
 * sufficient. Pair every whitelist change with a captions-skill update.
 */
export const TTS_BYPASS_WHITELIST = ['kokoro', 'fish-speech'] as const;
export type TtsBypassWhitelistedProvider = (typeof TTS_BYPASS_WHITELIST)[number];

/**
 * Local mirror of the relevant fields from
 * `@stageflip/schema#MediaProvenance` — kept structural to avoid a
 * captions→schema dep cycle and to keep the bypass entry point cheap
 * to call from arbitrary host code.
 */
export interface TtsBypassProvenance {
  /** Maps to `MediaProvenance.kind`. Bypass only fires on `'tts'`. */
  readonly kind: string;
  /** Maps to `MediaProvenance.provider` (the `AdapterDescriptor.id`). */
  readonly provider?: string;
}

/**
 * Local mirror of `TtsResult.wordTimestamps[number]` from
 * `@stageflip/asset-gen-contract`. Seconds-precision matches the
 * upstream shape; we floor to integer ms inside the extractor.
 */
export interface TtsBypassWord {
  readonly word: string;
  readonly startS: number;
  readonly endS: number;
}

/**
 * Bundle of `(provenance, wordTimestamps)` the bypass consumes.
 * Producers usually pull these straight off a `MediaElement` carrying
 * `provenance.kind: 'tts'` + the matching adapter's `TtsResult`.
 */
export interface TtsBypassInput {
  readonly provenance: TtsBypassProvenance;
  readonly wordTimestamps?: readonly TtsBypassWord[];
}

const isWhitelisted = (provider: string | undefined): provider is TtsBypassWhitelistedProvider => {
  if (provider === undefined) return false;
  return (TTS_BYPASS_WHITELIST as readonly string[]).includes(provider);
};

const isValidWordTimestamp = (w: TtsBypassWord): boolean => {
  if (typeof w.word !== 'string' || w.word.length === 0) return false;
  if (typeof w.startS !== 'number' || !Number.isFinite(w.startS) || w.startS < 0) return false;
  if (typeof w.endS !== 'number' || !Number.isFinite(w.endS) || w.endS <= w.startS) return false;
  return true;
};

/**
 * Decide whether `input` qualifies for the TTS→captions bypass.
 *
 * Returns the `TranscriptWord[]` (ms-precision) the pipeline should
 * feed straight to `packWords()` when eligible; returns `undefined`
 * when ineligible (so callers can fall back to the Whisper path).
 *
 * Eligibility rules (all must hold):
 *   - `provenance.kind === 'tts'`
 *   - `provenance.provider` is on `TTS_BYPASS_WHITELIST`
 *   - `wordTimestamps` is a non-empty array
 *   - every entry has a non-empty `word`, `startS >= 0`, `endS > startS`
 *
 * Conversion: `startMs = Math.floor(startS * 1000)`, same for `endMs`.
 * Floor (not round) keeps repeated calls byte-identical even when the
 * provider re-emits a slightly tweaked second-precision number across
 * runs that would round to a different ms.
 */
export function extractTtsBypassWords(input: TtsBypassInput): TranscriptWord[] | undefined {
  if (input.provenance.kind !== 'tts') return undefined;
  if (!isWhitelisted(input.provenance.provider)) return undefined;
  const ts = input.wordTimestamps;
  if (ts === undefined || ts.length === 0) return undefined;

  const out: TranscriptWord[] = [];
  for (const w of ts) {
    if (!isValidWordTimestamp(w)) return undefined;
    out.push({
      text: w.word,
      startMs: Math.floor(w.startS * 1000),
      endMs: Math.floor(w.endS * 1000),
    });
  }
  return out;
}

/**
 * Extended pipeline result that flags whether the synthetic
 * TTS-bypass path produced these segments. Consumers inspect this to
 * render "Auto-generated from TTS provider X" UX or to decide whether
 * to expose a "Re-run Whisper" override.
 */
export interface CaptionPipelineResultWithBypass extends CaptionPipelineResult {
  /** Set only when the segments were derived via the TTS bypass. */
  readonly viaTtsBypass?: true;
  /** The TTS provider id when `viaTtsBypass`; absent otherwise. */
  readonly ttsBypassProvider?: TtsBypassWhitelistedProvider;
}

/** Request to {@link transcribeAndPackWithTtsBypass}. */
export interface TranscribeAndPackWithTtsBypassRequest extends TranscribeAndPackRequest {
  /**
   * Provenance + word-timestamps from the upstream TTS adapter.
   * When omitted, behavior is identical to plain
   * `transcribeAndPack()` — the bypass never fires.
   */
  readonly tts?: TtsBypassInput;
}

/**
 * Public entry point for TTS-provenanced audio. Bypasses the Whisper
 * call when {@link extractTtsBypassWords} approves the supplied
 * provenance + timestamps; otherwise falls through to
 * `transcribeAndPack()` so live-recorded / imported / unknown-provider
 * audio still gets Whispered as before.
 *
 * Determinism: same inputs → same outputs. The bypass path doesn't
 * read or write the cache (the cache key is content-addressed to the
 * audio bytes; bypass output is already a deterministic function of
 * the upstream `TtsResult.wordTimestamps`, so caching adds no
 * dedupe leverage).
 */
export async function transcribeAndPackWithTtsBypass(
  request: TranscribeAndPackWithTtsBypassRequest,
): Promise<CaptionPipelineResultWithBypass> {
  const bypassWords = request.tts !== undefined ? extractTtsBypassWords(request.tts) : undefined;

  if (bypassWords !== undefined && request.tts !== undefined) {
    // Whitelist check inside extractTtsBypassWords already narrowed
    // the provider; re-narrow for the typed return.
    const provider = request.tts.provenance.provider;
    if (provider === undefined || !(TTS_BYPASS_WHITELIST as readonly string[]).includes(provider)) {
      // Unreachable per extractTtsBypassWords contract; fall through.
    } else {
      return {
        language: request.language ?? 'en',
        segments: packWords(bypassWords, request.pack),
        cacheHit: false,
        viaTtsBypass: true,
        ttsBypassProvider: provider as TtsBypassWhitelistedProvider,
      };
    }
  }

  // Fallback: standard Whisper-backed pipeline.
  return transcribeAndPack(request);
}
