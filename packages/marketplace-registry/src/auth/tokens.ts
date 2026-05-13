// packages/marketplace-registry/src/auth/tokens.ts
// T-536 — Bearer-token store per ADR-014 §D5. Tokens are SHA-256-keyed
// on storage (never plaintext); the `validate` method hashes the
// supplied plaintext + looks up the binding. Each binding maps a
// hashed token → publisher id (server-side publish auth).
//
// The production wiring (T-540+) issues tokens at tenant onboarding;
// rotation lives there. T-536 only ships the lookup primitive.
//
// Determinism perimeter: outside (server-side).

import { createHash } from 'node:crypto';

/** Result of a token validation call. */
export interface TokenValidation {
  /** `true` if the supplied plaintext token resolves to a known publisher. */
  readonly ok: boolean;
  /** When `ok === true`, the publisher id the token is bound to. */
  readonly publisherId?: string;
}

/**
 * Token store. Concrete implementations may persist in Firestore
 * (production) or memory (tests). Plaintext tokens NEVER leave the
 * caller's request scope — they are hashed inside `validate` before
 * any lookup or storage.
 */
export interface TokenStore {
  /**
   * Compute the canonical SHA-256 hash of a plaintext bearer token.
   * Deterministic across calls.
   */
  readonly hash: (plainToken: string) => string;

  /**
   * Validate a plaintext bearer token. Hashes the input, looks up the
   * binding, and returns `{ ok: true, publisherId }` on match or
   * `{ ok: false }` on no match (or empty / malformed input).
   */
  readonly validate: (plainToken: string) => Promise<TokenValidation>;
}

/**
 * In-memory `TokenStore` for tests + dev. Construction takes
 * `{ token, publisherId }[]` pairs — each pair seeds a binding from
 * the hashed `token` to `publisherId`. The internal map ONLY ever
 * contains hashes, never plaintext.
 */
export class InMemoryTokenStore implements TokenStore {
  private readonly bindings = new Map<string, string>();

  constructor(seeds: readonly { token: string; publisherId: string }[] = []) {
    for (const { token, publisherId } of seeds) {
      this.bindings.set(this.hash(token), publisherId);
    }
  }

  readonly hash = (plainToken: string): string => {
    return createHash('sha256').update(plainToken, 'utf8').digest('hex');
  };

  readonly validate = async (plainToken: string): Promise<TokenValidation> => {
    if (typeof plainToken !== 'string' || plainToken.length === 0) {
      return { ok: false };
    }
    const hashed = this.hash(plainToken);
    const publisherId = this.bindings.get(hashed);
    if (publisherId === undefined) {
      return { ok: false };
    }
    return { ok: true, publisherId };
  };

  /**
   * Test-only inspection: returns the set of hashes currently stored.
   * Used by `tokens.test.ts` to assert plaintext NEVER leaks.
   */
  readonly _hashesForTestOnly = (): readonly string[] => {
    return [...this.bindings.keys()];
  };
}
