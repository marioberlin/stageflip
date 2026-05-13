// packages/pack-signing/src/deps.ts
// T-498 — Dependency-injection surface for `stageflip-pack-sign`. Every
// IO touch (filesystem, console) goes through this interface so tests
// can drive the CLI end-to-end with in-memory shims.
//
// Determinism perimeter: `@stageflip/pack-signing` lives OUTSIDE the
// determinism perimeter (publisher-side host code).

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';

/** Subset of `node:fs/promises` used by the signing commands. */
export interface SignFs {
  readFile(path: string): Promise<Uint8Array>;
  readDir(path: string): Promise<readonly string[]>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
}

/** Console abstraction. Tests record the call sequence. */
export interface SignLogger {
  info(msg: string): void;
  error(msg: string): void;
}

/** Bundle of CLI dependencies. Every command takes this as its second arg. */
export interface CliSignDependencies {
  readonly fs: SignFs;
  readonly logger: SignLogger;
}

/**
 * Build the production dependency bundle. Wires real `node:fs/promises`
 * and `process.stdout` / `process.stderr` via `console`-style methods.
 */
export function createNodeDependencies(
  override?: Partial<CliSignDependencies>,
): CliSignDependencies {
  const fs: SignFs = override?.fs ?? {
    async readFile(path) {
      const buf = await readFile(path);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
    async readDir(path) {
      return readdir(path);
    },
    async writeFile(path, bytes) {
      await writeFile(path, bytes);
    },
    async mkdir(path, opts) {
      await mkdir(path, { recursive: opts?.recursive ?? false });
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
  const logger: SignLogger = override?.logger ?? {
    info: (msg) => process.stdout.write(`${msg}\n`),
    error: (msg) => process.stderr.write(`${msg}\n`),
  };
  return { fs, logger };
}
