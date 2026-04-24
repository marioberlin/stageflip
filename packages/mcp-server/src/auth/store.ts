// packages/mcp-server/src/auth/store.ts
// T-223 — filesystem-based token store at `~/.config/stageflip/auth.json`.
// Keytar was deliberately rejected — its default backend (Gnome keyring
// via `libsecret`) is LGPL-3.0 on Linux, which fails our license gate.
// The OS-keychain integration is a Phase-12 follow-up when a
// permissively-licensed option exists (ADR placeholder).

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StoredToken {
  readonly jwt: string;
  readonly refreshToken: string;
  /** Absolute unix-seconds expiration of the `jwt` (not the refresh token). */
  readonly expiresAt: number;
  /** Issuer identifier — which StageFlip deployment minted the token. */
  readonly issuer: string;
  /**
   * Named profile. Users with multiple StageFlip orgs or deployments keep
   * a separate file per profile; single-profile installs pass `"default"`.
   */
  readonly profile: string;
}

export interface TokenStore {
  load(): Promise<StoredToken | null>;
  save(token: StoredToken): Promise<void>;
  clear(): Promise<void>;
}

export interface CreateFileTokenStoreArgs {
  /** Absolute path. Parent directories are created with 0700. */
  readonly path: string;
}

/**
 * File-backed token store. Write path: mkdir -p parent dir, then
 * write + chmod 0600 so only the owner can read tokens. Load path:
 * parse + schema-check; invalid files throw so callers see corruption
 * rather than silently falling back to "logged out".
 */
export function createFileTokenStore(args: CreateFileTokenStoreArgs): TokenStore {
  const target = args.path;
  const dir = path.dirname(target);
  return {
    async load() {
      let raw: string;
      try {
        raw = await fs.readFile(target, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`token store: invalid JSON at ${target}: ${(err as Error).message}`);
      }
      const asToken = parsed as Partial<StoredToken>;
      if (
        typeof asToken.jwt !== 'string' ||
        typeof asToken.refreshToken !== 'string' ||
        typeof asToken.expiresAt !== 'number' ||
        typeof asToken.issuer !== 'string' ||
        typeof asToken.profile !== 'string'
      ) {
        throw new Error(
          `token store: invalid schema at ${target} (missing one of jwt/refreshToken/expiresAt/issuer/profile)`,
        );
      }
      return {
        jwt: asToken.jwt,
        refreshToken: asToken.refreshToken,
        expiresAt: asToken.expiresAt,
        issuer: asToken.issuer,
        profile: asToken.profile,
      };
    },

    async save(token) {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      const body = JSON.stringify(token, null, 2);
      // Write then chmod — fs.writeFile's mode argument is honoured only
      // on file creation, not on overwrite, so an explicit chmod makes
      // re-saves safe.
      await fs.writeFile(target, body, { encoding: 'utf8', mode: 0o600 });
      await fs.chmod(target, 0o600);
    },

    async clear() {
      try {
        await fs.unlink(target);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    },
  };
}

/**
 * Resolve the default store path for this platform, honouring
 * `XDG_CONFIG_HOME` on Unix and `APPDATA` on Windows. Node-only.
 */
export function defaultTokenStorePath(home?: string): string {
  const override = process.env.STAGEFLIP_AUTH_FILE;
  if (override) return override;
  const xdg = process.env.XDG_CONFIG_HOME;
  const appdata = process.env.APPDATA;
  const resolvedHome = home ?? process.env.HOME ?? process.cwd();
  const base = xdg ?? appdata ?? path.join(resolvedHome, '.config');
  return path.join(base, 'stageflip', 'auth.json');
}
