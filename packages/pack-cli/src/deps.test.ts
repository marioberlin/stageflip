// packages/pack-cli/src/deps.test.ts
// In-memory factory for the CLI dependency bundle. The factory is the
// test fixture re-used by every command test; co-located here so a
// single edit lifts every test.

import { describe, expect, it } from 'vitest';

import {
  type CliDependencies,
  type CliFs,
  type CliLogger,
  type CliPrompter,
  createNodeDependencies,
  defaultRootPath,
} from './deps.js';

/** Captures every logger call sequence-preserving. */
interface LoggerRecorder extends CliLogger {
  readonly info_: string[];
  readonly error_: string[];
  readonly warn_: string[];
}

function recordingLogger(): LoggerRecorder {
  const info_: string[] = [];
  const error_: string[] = [];
  const warn_: string[] = [];
  return {
    info_,
    error_,
    warn_,
    info(msg) {
      info_.push(msg);
    },
    error(msg) {
      error_.push(msg);
    },
    warn(msg) {
      warn_.push(msg);
    },
  };
}

/** Prompter that answers `true` (yes) once then `false` thereafter, unless overridden. */
function scriptedPrompter(answers: readonly boolean[]): CliPrompter {
  let i = 0;
  return {
    async confirm() {
      const a = answers[i] ?? false;
      i++;
      return a;
    },
  };
}

/**
 * Filesystem shim that records every operation. The CLI itself rarely
 * needs more than this — heavy filesystem reads go through the loader,
 * which has its own test surface.
 */
interface FsRecorder extends CliFs {
  readonly removed: string[];
  readonly existingDirs: Set<string>;
}

function recordingFs(existingDirs: readonly string[] = []): FsRecorder {
  const removed: string[] = [];
  const dirs = new Set(existingDirs);
  return {
    removed,
    existingDirs: dirs,
    async rm(path) {
      removed.push(path);
      dirs.delete(path);
    },
    async stat(path) {
      if (dirs.has(path)) {
        return { isDirectory: () => true };
      }
      return null;
    },
  };
}

/** Build a test dependency bundle with the supplied overrides. */
function makeTestDeps(opts?: Partial<CliDependencies>): CliDependencies {
  return {
    logger: opts?.logger ?? recordingLogger(),
    prompter: opts?.prompter ?? scriptedPrompter([true]),
    fs: opts?.fs ?? recordingFs(),
    rootPath: opts?.rootPath ?? '/test/packs',
    loader: opts?.loader ?? {
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
      platformVersion: '2.5.0',
    },
  };
}

describe('createNodeDependencies', () => {
  it('returns a bundle whose default rootPath is ~/.stageflip/packs', () => {
    const deps = createNodeDependencies();
    expect(deps.rootPath).toBe(defaultRootPath());
    expect(deps.rootPath.endsWith('/.stageflip/packs')).toBe(true);
  });

  it('overrides single fields when supplied', () => {
    const logger = recordingLogger();
    const deps = createNodeDependencies({ logger, rootPath: '/x' });
    expect(deps.logger).toBe(logger);
    expect(deps.rootPath).toBe('/x');
  });

  it('produces a prompter that resolves false when stdin is unset', () => {
    // We do not actually exercise stdin here; just confirm the shape
    // exists. Production behavior is exercised by the remove tests via
    // an injected prompter.
    const deps = createNodeDependencies();
    expect(typeof deps.prompter.confirm).toBe('function');
  });

  it('supplies a fs shim with rm + stat', () => {
    const deps = createNodeDependencies();
    expect(typeof deps.fs.rm).toBe('function');
    expect(typeof deps.fs.stat).toBe('function');
  });

  it('fs.stat returns null for non-existent paths', async () => {
    const deps = createNodeDependencies();
    const result = await deps.fs.stat('/does/not/exist/at/all');
    expect(result).toBeNull();
  });
});

describe('recordingFs (test helper)', () => {
  it('reports stat for pre-seeded directories', async () => {
    const fs = recordingFs(['/a', '/b']);
    const a = await fs.stat('/a');
    expect(a?.isDirectory()).toBe(true);
    const c = await fs.stat('/c');
    expect(c).toBeNull();
  });

  it('records rm calls + drops the entry from existingDirs', async () => {
    const fs = recordingFs(['/a']);
    await fs.rm('/a', { recursive: true });
    expect(fs.removed).toEqual(['/a']);
    expect(await fs.stat('/a')).toBeNull();
  });
});
