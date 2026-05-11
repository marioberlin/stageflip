// packages/asset-cache/src/cache-key.ts
// Content-addressed cache-key derivation per ADR-008 §D1.
//
// Hash inputs (canonicalized before hashing):
//   1. params → recursive key-sort via canonicalize().
//   2. prompt → trim + collapse internal whitespace runs to single space +
//      Unicode NFC + lowercase.
//   3. model:voice → concatenated as "model:voice" or "model:" when voice
//      is absent.
//   4. seed → base-10 integer (for numbers) or pass-through string (for
//      string seeds) or literal "none" (when absent).
//
// Hash input = utf-8(JSON.stringify({ modality, model, voice, prompt,
//                                      params, seed })) where the JSON form
// is itself the canonicalized representation produced by canonicalize().
// Hash       = SHA-256 via Web Crypto SubtleCrypto.digest.
// Output     = { modality, hash: <64-hex> }.
//
// Async because crypto.subtle.digest is async on every runtime. Pure +
// deterministic — no clocks, no random, no I/O.

import { canonicalize } from './canonicalize.js';

/** Inputs to the canonical cache-key derivation per ADR-008 §D1. */
export interface CanonicalCacheKeyInput {
  /** Modality of the asset being cached (e.g. 'tts', 'video-gen', 'sfx'). */
  readonly modality: string;
  /** Adapter-id + model-id combined string (e.g. 'kokoro-82m'). */
  readonly model: string;
  /** TTS-specific voice id; opaque string for non-TTS modalities. */
  readonly voice?: string;
  /** User-supplied prompt; normalized (trim + collapse + NFC + lowercase) before hashing. */
  readonly prompt: string;
  /** Provider call params; canonicalized (recursive key-sort) before hashing. */
  readonly params: Record<string, unknown>;
  /** Optional determinism seed; rendered as base-10 integer or "none". */
  readonly seed?: number | string;
}

/** Derived cache key — modality + 64-hex SHA-256. */
export interface AssetCacheKey {
  readonly modality: string;
  /** Lower-case hex SHA-256, length 64. */
  readonly hash: string;
}

const TEXT_ENCODER = new TextEncoder();

/** Lowercase hex of a byte array. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(buf));
}

/**
 * Normalize a prompt per ADR-008 §D1: trim leading/trailing whitespace,
 * collapse internal whitespace runs to a single space, apply Unicode NFC,
 * lowercase.
 *
 * Two prompts that differ only in whitespace, casing, or composition form
 * produce identical normalized output and therefore identical cache keys.
 */
export function normalizePrompt(prompt: string): string {
  return prompt.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Render a seed value for the canonical hash input per ADR-008 §D1. */
function renderSeed(seed: number | string | undefined): string {
  if (seed === undefined) return 'none';
  if (typeof seed === 'number') return seed.toString(10);
  return seed;
}

/** Render the model:voice concatenation per ADR-008 §D1. */
function renderModelVoice(model: string, voice: string | undefined): string {
  return `${model}:${voice ?? ''}`;
}

/**
 * Derive the canonical cache key per ADR-008 §D1. Async because
 * crypto.subtle.digest is async on every runtime.
 */
export async function deriveCacheKey(input: CanonicalCacheKeyInput): Promise<AssetCacheKey> {
  const canonical = canonicalize({
    modality: input.modality,
    model: input.model,
    voice: input.voice,
    modelVoice: renderModelVoice(input.model, input.voice),
    prompt: normalizePrompt(input.prompt),
    params: input.params,
    seed: renderSeed(input.seed),
  });
  const hash = await sha256Hex(TEXT_ENCODER.encode(canonical));
  return { modality: input.modality, hash };
}

/**
 * Flatten an `AssetCacheKey` into a single string suitable for `Map` keys
 * or storage paths. Format: `${modality}/${hash}`. Modality bucketing
 * matches ADR-008 §D1's storage-layer prefix convention.
 */
export function cacheKeyString(key: AssetCacheKey): string {
  return `${key.modality}/${key.hash}`;
}
