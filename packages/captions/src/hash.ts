// packages/captions/src/hash.ts
// Content-addressed cache-key derivation. Uses the Web Crypto SubtleCrypto
// API (available in Node 20+ and every modern browser) — no Node-only
// imports so the package stays runtime-agnostic.
//
// Hash inputs:
//   - sha256(audio bytes) for `bytes` sources.
//   - sha256(utf-8(url)) for `url` sources. (The transcription itself
//     still fetches + re-hashes the bytes before calling Whisper; the
//     URL hash is a cheap pre-check that collapses identical URLs.)
//   - The language hint (or literal 'auto' when undefined) is included
//     in the key so 'en' vs 'de' transcriptions for the same bytes
//     don't collide.

import type { AudioSource, CacheKey } from './types.js';

const TEXT_ENCODER = new TextEncoder();

/** Lowercase hex of a byte array. */
function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function sha256(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(buf));
}

/**
 * Derive the cache key for a transcription request. Async because
 * `crypto.subtle.digest` is async on every runtime.
 */
export async function deriveCacheKey(source: AudioSource, language?: string): Promise<CacheKey> {
  const hash =
    source.kind === 'bytes'
      ? await sha256(source.bytes)
      : await sha256(TEXT_ENCODER.encode(source.url));
  return { sha256: hash, language: language ?? 'auto' };
}

/** Flatten a CacheKey into a single string (used by in-memory Map keys). */
export function cacheKeyString(key: CacheKey): string {
  return `${key.sha256}::${key.language}`;
}
