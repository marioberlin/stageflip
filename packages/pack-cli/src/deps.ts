// packages/pack-cli/src/deps.ts
// T-497 — Dependency-injection surface for `stageflip-pack`. The CLI
// commands hold no references to `node:fs`, `process.stdout`, or
// `process.stdin` directly; every IO touch goes through this interface
// so tests can drive the CLI end-to-end with in-memory shims.
//
// Determinism perimeter: `@stageflip/pack-cli` lives OUTSIDE the
// determinism perimeter (operator tool, not runtime). `Date.now`,
// console output, and `process.argv` are all fine here.

import { rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

import type { PackLoaderDependencies } from '@stageflip/pack-loader';

/** Console abstraction. Tests record the call sequence; production wires `process.stdout` / `process.stderr`. */
export interface CliLogger {
  info(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

/**
 * stdin-prompt abstraction. Tests pre-seed an answer; production
 * reads one line from stdin via `node:readline/promises`.
 */
export interface CliPrompter {
  /**
   * Print `question` and resolve with `true` on `y` / `Y` / `yes`,
   * `false` on anything else (including empty input).
   */
  confirm(question: string): Promise<boolean>;
}

/**
 * Minimal filesystem surface the CLI needs beyond what
 * `@stageflip/pack-loader` already owns. The loader handles all
 * directory walking + manifest reads; this surface is for `remove`
 * (rm) and `info` / `verify` (stat).
 */
export interface CliFs {
  /** Recursively remove a path. Errors propagate. */
  rm(path: string, opts?: { recursive?: boolean }): Promise<void>;
  /**
   * Lightweight `stat`. Returns `null` if the path does not exist
   * rather than throwing — `remove` / `info` branch on this to emit
   * a typed error.
   */
  stat(path: string): Promise<{ isDirectory(): boolean } | null>;
}

/** Bundle of CLI dependencies. Every command takes this as its second arg. */
export interface CliDependencies {
  readonly logger: CliLogger;
  readonly prompter: CliPrompter;
  readonly loader: PackLoaderDependencies;
  /** Root install directory. Default: `~/.stageflip/packs`. */
  readonly rootPath: string;
  readonly fs: CliFs;
}

/**
 * Produce the default install root. Pulled out so tests can verify
 * it without poking `homedir()` themselves.
 */
export function defaultRootPath(): string {
  return join(homedir(), '.stageflip', 'packs');
}

/**
 * Build the production dependency bundle. Wires real `node:fs`,
 * `process.stdout` / `process.stderr`, and a readline prompter.
 *
 * The caller supplies a `PackLoaderDependencies` because the loader
 * needs an entitlements store + publisher key registry that the CLI
 * itself does not own. For end-user installs the binary entry point
 * picks no-op shims (TODO: wire real stores when T-499 lands); tests
 * supply in-memory shims directly.
 */
export function createNodeDependencies(override?: Partial<CliDependencies>): CliDependencies {
  const logger: CliLogger = override?.logger ?? {
    info: (msg) => process.stdout.write(`${msg}\n`),
    error: (msg) => process.stderr.write(`${msg}\n`),
    warn: (msg) => process.stderr.write(`${msg}\n`),
  };
  const prompter: CliPrompter = override?.prompter ?? {
    async confirm(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = await rl.question(question);
        const normalised = answer.trim().toLowerCase();
        return normalised === 'y' || normalised === 'yes';
      } finally {
        rl.close();
      }
    },
  };
  const fs: CliFs = override?.fs ?? {
    async rm(path, opts) {
      await rm(path, { recursive: opts?.recursive ?? false, force: false });
    },
    async stat(path) {
      try {
        const s = await stat(path);
        return { isDirectory: () => s.isDirectory() };
      } catch {
        return null;
      }
    },
  };
  const loader: PackLoaderDependencies = override?.loader ?? {
    entitlements: {
      async getEntitlement() {
        return null;
      },
    },
    publisherKeys: {
      async getPublisherKey() {
        return null;
      },
    },
    platformVersion: '0.0.0',
  };
  return {
    logger,
    prompter,
    loader,
    rootPath: override?.rootPath ?? defaultRootPath(),
    fs,
  };
}
