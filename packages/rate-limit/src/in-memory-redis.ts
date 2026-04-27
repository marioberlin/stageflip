// packages/rate-limit/src/in-memory-redis.ts
// Test-only in-memory fake implementing `RedisLike` (D-T263-5). NOT exported
// from index.ts; consumed by tests via direct import. CI must not hit a real
// Upstash Redis from unit tests.

import type { RedisLike } from './redis.js';

interface Entry {
  value: string;
  expiresAt: number | null;
}

/**
 * In-memory `RedisLike` for tests. TTL semantics are best-effort — keys
 * with `px` set are cleared lazily on read.
 */
export class InMemoryRedis implements RedisLike {
  private readonly store = new Map<string, Entry>();
  private now: () => number;

  constructor(now?: () => number) {
    this.now = now ?? (() => Date.now());
  }

  /** Override the clock — tests can advance time deterministically. */
  setClock(now: () => number): void {
    this.now = now;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, opts?: { readonly px?: number }): Promise<'OK'> {
    const expiresAt = opts?.px !== undefined && opts.px > 0 ? this.now() + opts.px : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  /** Test helper — strip everything. */
  reset(): void {
    this.store.clear();
  }

  /** Test helper — peek raw entries. */
  snapshot(): ReadonlyMap<string, Entry> {
    return new Map(this.store);
  }
}
