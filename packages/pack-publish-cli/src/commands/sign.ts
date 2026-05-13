// packages/pack-publish-cli/src/commands/sign.ts
// T-500 — `stageflip-pack-publish sign <pack-dir> --key <private.pem>
// --out <archive-path>` — thin wrapper around `signPackDirectory` from
// `@stageflip/pack-signing` with a pre-flight `validate` pass so a
// publisher can't sign an invalid pack.
//
// Determinism perimeter: this package lives OUTSIDE.

import { mkdir, writeFile } from 'node:fs/promises';

import {
  type SignFs,
  type SignLogger,
  SignPackError,
  type SignedPackResult,
  parseArchive,
  signPackDirectory,
} from '@stageflip/pack-signing';

import type { CliPublishDependencies } from '../deps.js';
import { runValidate } from './validate.js';

/** Result of `runSign`. */
export interface SignResult {
  readonly archivePath: string;
  readonly signaturePath: string;
  readonly archiveBytes: number;
  readonly fileCount: number;
  readonly integrityHash: string;
}

/**
 * Run the `sign` subcommand. Args: `<pack-dir> --key <private.pem>
 * --out <archive-path>`. Runs `validate` first; refuses to sign on
 * fail. Returns 0 on success, 1 on usage / validate / runtime error.
 */
export async function runSign(
  args: readonly string[],
  deps: CliPublishDependencies,
): Promise<number> {
  let packDir: string | undefined;
  let privateKeyPath: string | undefined;
  let archivePath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--key') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish sign: --key requires a value');
        return 1;
      }
      privateKeyPath = next;
      i += 1;
      continue;
    }
    if (arg === '--out') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish sign: --out requires a value');
        return 1;
      }
      archivePath = next;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--')) {
      deps.logger.error(`stageflip-pack-publish sign: unknown flag: ${arg}`);
      return 1;
    }
    if (packDir === undefined) {
      packDir = arg;
    } else {
      deps.logger.error(`stageflip-pack-publish sign: unexpected positional: ${arg}`);
      return 1;
    }
  }
  if (packDir === undefined) {
    deps.logger.error('stageflip-pack-publish sign: <pack-dir> is required');
    return 1;
  }
  if (privateKeyPath === undefined) {
    deps.logger.error('stageflip-pack-publish sign: --key <private.pem> is required');
    return 1;
  }
  if (archivePath === undefined) {
    deps.logger.error('stageflip-pack-publish sign: --out <archive-path> is required');
    return 1;
  }

  // Pre-flight validate.
  const validation = await runValidate(packDir, deps.fs);
  if (!validation.ok) {
    for (const issue of validation.issues) {
      if (issue.level === 'fail') {
        deps.logger.error(`FAIL [${issue.invariant}] ${issue.detail}`);
      }
    }
    deps.logger.error('stageflip-pack-publish sign: refusing to sign; validate failed');
    return 1;
  }

  // Key existence check — surface a cleaner error than the underlying
  // signing layer's I/O exception.
  if (!(await deps.fs.exists(privateKeyPath))) {
    deps.logger.error(`stageflip-pack-publish sign: private key not found: ${privateKeyPath}`);
    return 1;
  }

  let result: SignedPackResult;
  try {
    result = await signPackDirectory(
      { packDir, privateKeyPath, archivePath },
      adaptDepsForSigning(deps),
    );
  } catch (err) {
    if (err instanceof SignPackError) {
      deps.logger.error(`stageflip-pack-publish sign: ${err.message}`);
      return 1;
    }
    throw err;
  }

  const summary: SignResult = {
    archivePath: result.archivePath,
    signaturePath: result.signaturePath,
    archiveBytes: result.archiveBytes.length,
    fileCount: countFilesInArchive(result.archiveBytes),
    integrityHash: result.integrityHash,
  };
  deps.logger.info(
    `signed ${summary.archivePath} + ${summary.signaturePath} (${summary.archiveBytes} bytes archive, ${summary.fileCount} files)`,
  );
  return 0;
}

/**
 * Adapt our DI deps to the shape `@stageflip/pack-signing` expects.
 * The signing package needs `writeFile` + `mkdir`; the publish CLI's
 * `PublishFs` deliberately omits write surface so the read-only commands
 * (validate, publish) can't accidentally mutate disk. We bridge here.
 */
function adaptDepsForSigning(deps: CliPublishDependencies): {
  fs: SignFs;
  logger: SignLogger;
} {
  return {
    fs: {
      readFile: (path) => deps.fs.readFile(path),
      readDir: (path) => deps.fs.readDir(path),
      writeFile: async (path, bytes) => {
        await writeFile(path, bytes);
      },
      mkdir: async (path, opts) => {
        await mkdir(path, { recursive: opts?.recursive ?? false });
      },
      exists: (path) => deps.fs.exists(path),
      stat: (path) => deps.fs.stat(path),
    },
    logger: {
      info: (msg) => deps.logger.info(msg),
      error: (msg) => deps.logger.error(msg),
    },
  };
}

/**
 * Parse the deterministic archive header to count entries. Bridges
 * out to `@stageflip/pack-signing`'s parser to avoid duplicating
 * format knowledge.
 */
function countFilesInArchive(bytes: Uint8Array): number {
  return parseArchive(bytes).length;
}
