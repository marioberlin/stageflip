// packages/marketplace-npm/src/tokens/token-store.ts
// T-539 — Per-scope npm auth-token store for the marketplace
// npm-based distribution path per ADR-014 §D2 + §D4. Tokens are
// kept under their npm scope (e.g. `@stageflip-private`) so the
// license-claim verifier can look up "do I have a valid token for
// THIS publisher's scope?" at install time.
//
// In contrast to the marketplace-registry `TokenStore` (which hashes
// tokens server-side and validates bearer tokens against publish
// auth bindings), this is a CLIENT-side per-scope cache — the
// production wiring is the tenant's `stageflip-pack` CLI / desktop
// runtime, which holds plaintext npm tokens just like `npm` itself
// does in `~/.npmrc`. Plaintext is unavoidable here; the file-backed
// implementation lives at `tokens/file-backed.ts`.
//
// Determinism perimeter: outside (host / CLI side).

/**
 * Per-scope npm auth-token store. `scope` is the npm scope WITH the
 * leading `@` (e.g. `@stageflip-private`); callers must pass it
 * unchanged so the lookup is identity.
 */
export interface NpmTokenStore {
  /** Store / overwrite a token for the given scope. */
  readonly store: (scope: string, token: string) => Promise<void>;
  /** Look up a token for the given scope; `null` if none. */
  readonly lookup: (scope: string) => Promise<string | null>;
  /** Drop the token for the given scope (no-op if absent). */
  readonly revoke: (scope: string) => Promise<void>;
  /** Return all scopes with a stored token, in insertion order. */
  readonly listScopes: () => Promise<readonly string[]>;
}

/**
 * Throw on malformed scope strings. The npm scope syntax (per
 * https://docs.npmjs.com/cli/v10/using-npm/scope) requires the
 * leading `@`, ASCII-only, no `/`. We enforce the leading `@` +
 * non-empty body; full validation lives in npm itself.
 */
export function assertValidScope(scope: string): void {
  if (typeof scope !== 'string' || scope.length < 2 || scope[0] !== '@') {
    throw new Error(
      `invalid npm scope (must start with '@' and have non-empty body): ${JSON.stringify(scope)}`,
    );
  }
}

/**
 * Throw on empty / non-string tokens. We deliberately do not gate
 * on token shape — npm tokens come in two formats (legacy `npm_*`
 * and granular `npm_*`) and we treat them opaquely.
 */
export function assertValidToken(token: string): void {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('npm token must be a non-empty string');
  }
}

/**
 * In-memory `NpmTokenStore`. Used for tests + transient sessions.
 * Insertion order is preserved (relied on by `listScopes`).
 */
export class InMemoryNpmTokenStore implements NpmTokenStore {
  private readonly bindings = new Map<string, string>();

  readonly store = async (scope: string, token: string): Promise<void> => {
    assertValidScope(scope);
    assertValidToken(token);
    this.bindings.set(scope, token);
  };

  readonly lookup = async (scope: string): Promise<string | null> => {
    assertValidScope(scope);
    return this.bindings.get(scope) ?? null;
  };

  readonly revoke = async (scope: string): Promise<void> => {
    assertValidScope(scope);
    this.bindings.delete(scope);
  };

  readonly listScopes = async (): Promise<readonly string[]> => {
    return [...this.bindings.keys()];
  };
}
