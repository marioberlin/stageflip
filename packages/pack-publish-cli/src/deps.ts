// packages/pack-publish-cli/src/deps.ts
// T-500 — Dependency-injection surface for `stageflip-pack-publish`.
// Every IO touch (filesystem, HTTP, env vars, console) goes through
// this interface so tests can drive the CLI end-to-end with in-memory
// shims and no network calls.
//
// Determinism perimeter: `@stageflip/pack-publish-cli` lives OUTSIDE
// the determinism perimeter (publisher-side, ext-facing host code).

import { readFile, readdir, stat } from 'node:fs/promises';

/** Subset of `node:fs/promises` used by the publish commands. */
export interface PublishFs {
  readFile(path: string): Promise<Uint8Array>;
  readDir(path: string): Promise<readonly string[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
}

/** Minimal HTTP surface. Injected so tests don't make network calls. */
export interface PublishHttp {
  /** Performs an HTTP POST. */
  post(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{
    status: number;
    statusText: string;
    bodyText: string;
  }>;
}

/** Environment-variable reader. */
export interface PublishEnv {
  get(name: string): string | undefined;
}

/** Console abstraction. Tests record the call sequence. */
export interface PublishLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/** Bundle of CLI dependencies. Every command takes this as its second arg. */
export interface CliPublishDependencies {
  readonly fs: PublishFs;
  readonly http: PublishHttp;
  readonly env: PublishEnv;
  readonly logger: PublishLogger;
}

/**
 * Build the production dependency bundle. Wires real `node:fs/promises`,
 * the global `fetch`, `process.env`, and `process.stdout`/`stderr` via
 * `console`-style methods.
 */
export function createNodeDependencies(
  override?: Partial<CliPublishDependencies>,
): CliPublishDependencies {
  const fs: PublishFs = override?.fs ?? {
    async readFile(path) {
      const buf = await readFile(path);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
    async readDir(path) {
      return readdir(path);
    },
    async exists(path) {
      try {
        await stat(path);
        return true;
      } catch {
        return false;
      }
    },
    async stat(path) {
      const s = await stat(path);
      return {
        isFile: () => s.isFile(),
        isDirectory: () => s.isDirectory(),
      };
    },
  };
  const http: PublishHttp = override?.http ?? {
    async post(url, body, headers) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      });
      const bodyText = await res.text();
      return { status: res.status, statusText: res.statusText, bodyText };
    },
  };
  const env: PublishEnv = override?.env ?? {
    get(name) {
      return process.env[name];
    },
  };
  const logger: PublishLogger = override?.logger ?? {
    info: (msg) => process.stdout.write(`${msg}\n`),
    warn: (msg) => process.stderr.write(`${msg}\n`),
    error: (msg) => process.stderr.write(`${msg}\n`),
  };
  return { fs, http, env, logger };
}
