// packages/pack-publish-cli/src/test-helpers.ts
// Shared scaffolding for command tests: temp-dir creation, recording
// logger, recording HTTP shim, recording env shim, and a minimal pack
// directory ready for validate / sign / publish.

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  type CliPublishDependencies,
  type PublishEnv,
  type PublishHttp,
  type PublishLogger,
  createNodeDependencies,
} from './deps.js';

/** Recording logger; each list captures the call sequence verbatim. */
export interface LoggerRecorder extends PublishLogger {
  readonly info_: string[];
  readonly warn_: string[];
  readonly error_: string[];
  joined(): string;
}

/** Build a recording logger. */
export function recordingLogger(): LoggerRecorder {
  const info_: string[] = [];
  const warn_: string[] = [];
  const error_: string[] = [];
  return {
    info_,
    warn_,
    error_,
    info(msg) {
      info_.push(msg);
    },
    warn(msg) {
      warn_.push(msg);
    },
    error(msg) {
      error_.push(msg);
    },
    joined() {
      return [...info_, ...warn_, ...error_].join('\n');
    },
  };
}

/** Recording env shim — tests set entries via the inner Map. */
export interface EnvRecorder extends PublishEnv {
  readonly entries: Map<string, string>;
}

/** Build a recording env shim seeded with `seed`. */
export function recordingEnv(seed?: Record<string, string>): EnvRecorder {
  const entries = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    entries,
    get(name) {
      return entries.get(name);
    },
  };
}

/** Recording HTTP shim — captures each call; `respond` controls reply. */
export interface HttpRecorder extends PublishHttp {
  readonly calls: Array<{ url: string; body: unknown; headers: Record<string, string> }>;
  respond: (
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ) => Promise<{ status: number; statusText: string; bodyText: string }>;
}

/** Build a recording HTTP shim with a default 200 OK reply. */
export function recordingHttp(): HttpRecorder {
  const calls: HttpRecorder['calls'] = [];
  const recorder: HttpRecorder = {
    calls,
    async respond() {
      return { status: 200, statusText: 'OK', bodyText: '{}' };
    },
    async post(url, body, headers) {
      calls.push({ url, body, headers });
      return recorder.respond(url, body, headers);
    },
  };
  return recorder;
}

/** Bundle of recording deps backed by real fs. */
export interface RecorderDeps extends CliPublishDependencies {
  readonly logger: LoggerRecorder;
  readonly env: EnvRecorder;
  readonly http: HttpRecorder;
}

/** Assemble recording deps backed by real `node:fs` + a recording logger / http / env. */
export function makeRecorderDeps(opts?: { env?: Record<string, string> }): RecorderDeps {
  const logger = recordingLogger();
  const env = recordingEnv(opts?.env);
  const http = recordingHttp();
  const real = createNodeDependencies({ logger, env, http });
  return { fs: real.fs, logger, env, http };
}

/** Temp dir + automatic cleanup hook. */
export interface TempDir {
  readonly path: string;
  cleanup(): Promise<void>;
}

/** Create a temp directory under `tmpdir()` with the supplied prefix. */
export async function makeTempDir(prefix = 'pack-publish-cli-'): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return {
    path,
    async cleanup() {
      await rm(path, { recursive: true, force: true });
    },
  };
}

/** Generate a fresh Ed25519 keypair as PEM strings. */
export function makeKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** Write a PEM file at `path` and return the absolute path. */
export async function writePem(path: string, pem: string): Promise<string> {
  await writeFile(path, pem);
  return path;
}

/** Manifest overrides for `writeMinimalPack`. */
export interface MinimalPackOptions {
  readonly id?: string;
  readonly version?: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly repository?: string;
  readonly keywords?: readonly string[];
  readonly license?: Record<string, unknown>;
  readonly platformCompatibility?: string;
  /** Skip writing manifest.json entirely (negative-path tests). */
  readonly skipManifest?: boolean;
  /** Write malformed JSON for the manifest (negative-path tests). */
  readonly malformedJson?: boolean;
}

/**
 * Write a minimal valid pack directory containing manifest.json + a
 * couple of asset files. Returns the directory path. Override fields
 * via `opts` to construct invalid / paid / enterprise variants.
 */
export async function writeMinimalPack(
  root: string,
  opts: MinimalPackOptions = {},
): Promise<string> {
  const dir = join(root, 'pack');
  await mkdir(dir, { recursive: true });
  const manifest: Record<string, unknown> = {
    manifestVersion: '1',
    id: opts.id ?? 'demo',
    name: 'demo',
    version: opts.version ?? '1.0.0',
    publisher: { id: 'pub-1', displayName: 'Pub 1' },
    platformCompatibility: opts.platformCompatibility ?? '^2.0.0',
    license: opts.license ?? { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: '0'.repeat(64) },
    contributes: {},
  };
  if (opts.description !== undefined) manifest.description = opts.description;
  if (opts.homepage !== undefined) manifest.homepage = opts.homepage;
  if (opts.repository !== undefined) manifest.repository = opts.repository;
  if (opts.keywords !== undefined) manifest.keywords = opts.keywords;
  if (!opts.skipManifest) {
    if (opts.malformedJson) {
      await writeFile(join(dir, 'manifest.json'), '{ this is not json');
    } else {
      await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
  }
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(join(dir, 'assets', 'a.txt'), 'hello');
  await writeFile(join(dir, 'assets', 'b.txt'), 'world');
  return dir;
}
