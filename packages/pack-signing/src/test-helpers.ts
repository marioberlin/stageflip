// packages/pack-signing/src/test-helpers.ts
// Shared scaffolding for command tests: temp-dir creation, recording
// logger, a minimal pack directory ready for signing.

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type CliSignDependencies, type SignLogger, createNodeDependencies } from './deps.js';

/** Recording logger; each list captures the call sequence verbatim. */
export interface LoggerRecorder extends SignLogger {
  readonly info_: string[];
  readonly error_: string[];
  joined(): string;
}

export function recordingLogger(): LoggerRecorder {
  const info_: string[] = [];
  const error_: string[] = [];
  return {
    info_,
    error_,
    info(msg) {
      info_.push(msg);
    },
    error(msg) {
      error_.push(msg);
    },
    joined() {
      return [...info_, ...error_].join('\n');
    },
  };
}

/** Assemble a `CliSignDependencies` backed by real node:fs + a recording logger. */
export function makeNodeDepsWithRecorder(): CliSignDependencies & {
  readonly logger: LoggerRecorder;
} {
  const logger = recordingLogger();
  const real = createNodeDependencies({ logger });
  return { fs: real.fs, logger };
}

/** Temp dir + automatic cleanup hook. */
export interface TempDir {
  readonly path: string;
  cleanup(): Promise<void>;
}

export async function makeTempDir(prefix = 'pack-signing-'): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return {
    path,
    async cleanup() {
      await rm(path, { recursive: true, force: true });
    },
  };
}

/** Generate a fresh Ed25519 keypair as PEM strings (no disk IO). */
export function makeKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/**
 * Write a minimal valid pack directory containing manifest.json + a
 * few support files. Returns the directory path.
 */
export async function writeMinimalPack(
  root: string,
  opts?: { extraFiles?: boolean },
): Promise<string> {
  const dir = join(root, 'pack');
  await mkdir(dir, { recursive: true });
  const manifest = {
    manifestVersion: '1',
    id: 'demo',
    name: 'demo',
    version: '1.0.0',
    publisher: { id: 'pub-1', displayName: 'Pub 1' },
    platformCompatibility: '^2.0.0',
    license: { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: '0'.repeat(64) },
    contributes: {},
  };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (opts?.extraFiles !== false) {
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, 'assets', 'a.txt'), 'hello');
    await writeFile(join(dir, 'assets', 'b.txt'), 'world');
  }
  return dir;
}

/** Write a PEM file at `path` and return the absolute path. */
export async function writePem(path: string, pem: string): Promise<string> {
  await writeFile(path, pem);
  return path;
}
