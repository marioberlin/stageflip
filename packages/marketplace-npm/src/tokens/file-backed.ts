// packages/marketplace-npm/src/tokens/file-backed.ts
// T-539 — Persistent `NpmTokenStore` backed by a single JSON file
// (typically `~/.stageflip/npm-tokens.json`). Writes are atomic:
// the new payload is written to a sibling tempfile and then
// `rename(2)`d over the target so a crash mid-write cannot corrupt
// the store.
//
// Determinism perimeter: outside (CLI / host side).

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { type NpmTokenStore, assertValidScope, assertValidToken } from './token-store.js';

/** Construction options for `FileBackedNpmTokenStore`. */
export interface FileBackedNpmTokenStoreOptions {
  /** Absolute path to the JSON file the store persists to. */
  readonly path: string;
}

/**
 * On-disk format: `{ scopes: { "@scope": "token", ... } }`. We wrap
 * the map in a top-level object so future migrations can add a
 * version field without breaking the parser.
 */
interface OnDiskFormat {
  readonly scopes: Record<string, string>;
}

/**
 * Persistent `NpmTokenStore`. Construction is synchronous; on first
 * read / write the store loads (or, if missing / corrupt, treats as
 * empty) the on-disk payload lazily.
 *
 * Atomic-write protocol: writes go to `<path>.tmp-<rand>`, then
 * `rename` over `<path>`. POSIX guarantees `rename` is atomic on the
 * same filesystem.
 */
export class FileBackedNpmTokenStore implements NpmTokenStore {
  private readonly path: string;
  private cache: Map<string, string> | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(opts: FileBackedNpmTokenStoreOptions) {
    if (typeof opts.path !== 'string' || opts.path.length === 0) {
      throw new Error('FileBackedNpmTokenStore: opts.path must be a non-empty string');
    }
    this.path = opts.path;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cache !== null) return;
    if (this.loadPromise !== null) {
      await this.loadPromise;
      return;
    }
    this.loadPromise = this.load();
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (err) {
      // Missing file → empty cache (first run).
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this.cache = new Map();
        return;
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt JSON → treat as empty (production wiring may surface a
      // user-visible warning at this layer; the store recovers).
      this.cache = new Map();
      return;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('scopes' in parsed) ||
      typeof (parsed as { scopes: unknown }).scopes !== 'object' ||
      (parsed as { scopes: unknown }).scopes === null
    ) {
      this.cache = new Map();
      return;
    }

    const scopes = (parsed as OnDiskFormat).scopes;
    const next = new Map<string, string>();
    for (const [scope, token] of Object.entries(scopes)) {
      if (typeof token !== 'string' || token.length === 0) continue;
      if (typeof scope !== 'string' || scope.length < 2 || scope[0] !== '@') continue;
      next.set(scope, token);
    }
    this.cache = next;
  }

  private async persist(): Promise<void> {
    if (this.cache === null) throw new Error('persist() called before load()');
    const payload: OnDiskFormat = { scopes: Object.fromEntries(this.cache.entries()) };
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    await mkdir(dirname(this.path), { recursive: true });
    // Random-suffix tempfile to avoid collisions when two store
    // instances share a directory (rare but valid for tests).
    const tmpSuffix = `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const tmpPath = `${this.path}.${tmpSuffix}`;
    await writeFile(tmpPath, serialized, { encoding: 'utf8', mode: 0o600 });
    await rename(tmpPath, this.path);
  }

  readonly store = async (scope: string, token: string): Promise<void> => {
    assertValidScope(scope);
    assertValidToken(token);
    await this.ensureLoaded();
    // ensureLoaded() establishes the cache; tighten the type for the
    // compiler.
    const cache = this.cache as Map<string, string>;
    cache.set(scope, token);
    await this.persist();
  };

  readonly lookup = async (scope: string): Promise<string | null> => {
    assertValidScope(scope);
    await this.ensureLoaded();
    const cache = this.cache as Map<string, string>;
    return cache.get(scope) ?? null;
  };

  readonly revoke = async (scope: string): Promise<void> => {
    assertValidScope(scope);
    await this.ensureLoaded();
    const cache = this.cache as Map<string, string>;
    if (cache.delete(scope)) {
      await this.persist();
    }
  };

  readonly listScopes = async (): Promise<readonly string[]> => {
    await this.ensureLoaded();
    const cache = this.cache as Map<string, string>;
    return [...cache.keys()];
  };
}
