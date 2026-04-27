// packages/auth-middleware/src/api-key-verify.ts
// API-key verification with in-process LRU-style cache (T-262 AC #8, #12, #13).
//
// Hash choice (D-T262-2): we use `node:crypto.scrypt` (built-in, no
// extra dependency, no native build, no licensing risk) instead of
// bcrypt. `bcrypt` would have shipped a native addon that adds
// non-trivial cold-start latency to Cloud Functions; scrypt with
// N=16384, r=8, p=1 hits a comparable ~50–100ms target while being
// 100% pure-Node. The bcrypt-cache contract from the spec applies
// verbatim — the slow-hash → fast-cache idiom is identical.
//
// Cache (AC #12): keyed by the *plaintext* api key string (never by
// hash). 60s TTL. The cache is process-local; a multi-instance
// deployment will see eventual-consistency on revoke, bounded by the
// 60s TTL — documented in skills/stageflip/concepts/auth/SKILL.md.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/** Promise-flavoured wrapper around `crypto.scrypt`. */
function scrypt(plaintext: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(
      plaintext,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, dk) => {
        if (err) reject(err);
        else resolve(dk);
      },
    );
  });
}

/** Format a scrypt hash as `scrypt$<salt-hex>$<hash-hex>` for storage. */
export async function hashApiKey(plaintext: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(plaintext, salt);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Compare a plaintext key against a stored `scrypt$salt$hash`. */
export async function compareApiKey(plaintext: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1] ?? '', 'hex');
  const expected = Buffer.from(parts[2] ?? '', 'hex');
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scrypt(plaintext, salt);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Cached api-key resolution. */
export interface ApiKeyResolution {
  readonly orgId: string;
  readonly keyId: string;
  readonly role: string;
}

interface CacheEntry {
  readonly value: ApiKeyResolution;
  readonly expiresAt: number;
}

/** Default TTL: 60 seconds. Revoke flushes the entry by key. */
export const API_KEY_CACHE_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry>();

/** Inject a clock for tests. */
export interface VerifyClock {
  readonly now: () => number;
}

const SYSTEM_CLOCK: VerifyClock = { now: () => Date.now() };

/** Read from the cache; returns undefined on miss or stale. */
export function readApiKeyCache(
  plaintext: string,
  clock: VerifyClock = SYSTEM_CLOCK,
): ApiKeyResolution | undefined {
  const entry = cache.get(plaintext);
  if (!entry) return undefined;
  if (entry.expiresAt <= clock.now()) {
    cache.delete(plaintext);
    return undefined;
  }
  return entry.value;
}

/** Write into the cache with the configured TTL. */
export function writeApiKeyCache(
  plaintext: string,
  value: ApiKeyResolution,
  clock: VerifyClock = SYSTEM_CLOCK,
): void {
  cache.set(plaintext, { value, expiresAt: clock.now() + API_KEY_CACHE_TTL_MS });
}

/**
 * Invalidate a single cached api-key (AC #13). Called by `revokeApiKey`.
 * Eventual consistency: only invalidates the local process cache; remote
 * instances see staleness up to the TTL (60s).
 */
export function invalidateApiKeyCache(plaintext: string): void {
  cache.delete(plaintext);
}

/** Test helper — flush everything. Not exported from index. */
export function _resetApiKeyCacheForTest(): void {
  cache.clear();
}
