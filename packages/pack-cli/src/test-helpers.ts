// packages/pack-cli/src/test-helpers.ts
// Shared scaffolding for command tests: writes a signed pack to a
// temp install root in the canonical `<root>/<publisher>/<id>/<version>/`
// layout. Real loader runs against the result so tests exercise the
// same gates production does.

import { generateKeyPairSync } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signPackArchive } from '@stageflip/pack-format';
import type { PackLoaderDependencies } from '@stageflip/pack-loader';

import type { CliDependencies, CliFs, CliLogger, CliPrompter } from './deps.js';

/** A test install root + the publisher key needed to sign packs against it. */
export interface TempInstallRoot {
  readonly rootPath: string;
  readonly publicKeyPem: string;
  readonly privateKeyPem: string;
  /** Remove the temp dir. Idempotent. */
  cleanup(): Promise<void>;
}

/** Create a temp install root + a fresh Ed25519 key pair. */
export async function makeInstallRoot(): Promise<TempInstallRoot> {
  const rootPath = await mkdtemp(join(tmpdir(), 'pack-cli-'));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return {
    rootPath,
    publicKeyPem,
    privateKeyPem,
    async cleanup() {
      await rm(rootPath, { recursive: true, force: true });
    },
  };
}

/** Manifest fields the test caller wants to control. */
export interface WritePackOptions {
  readonly publisher: string;
  readonly id: string;
  readonly version: string;
  readonly license?: {
    readonly kind: 'open' | 'paid-per-tenant' | 'enterprise';
    readonly spdx?: 'MIT' | 'Apache-2.0' | 'CC-BY-4.0' | 'CC0-1.0';
    readonly sku?: string;
    readonly entitlementType?: 'subscription' | 'one-time';
  };
  readonly platformCompatibility?: string;
  /** Skip writing the archive file (triggers loader gate-3 failure). */
  readonly skipArchive?: boolean;
}

/** Write a signed pack into `<root>/<publisher>/<id>/<version>/`. */
export async function writePack(root: TempInstallRoot, opts: WritePackOptions): Promise<string> {
  const dir = join(root.rootPath, opts.publisher, opts.id, opts.version);
  await mkdir(dir, { recursive: true });
  const archive = new TextEncoder().encode(`${opts.id}@${opts.version}`);
  const license =
    opts.license?.kind === 'paid-per-tenant'
      ? {
          kind: 'paid-per-tenant',
          sku: opts.license.sku ?? 'sku-1',
          entitlementType: opts.license.entitlementType ?? 'subscription',
        }
      : opts.license?.kind === 'enterprise'
        ? { kind: 'enterprise', sku: opts.license.sku ?? 'sku-ent' }
        : { kind: 'open', spdx: opts.license?.spdx ?? 'MIT' };
  const manifest = {
    manifestVersion: '1',
    id: opts.id,
    name: opts.id,
    version: opts.version,
    publisher: { id: opts.publisher, displayName: opts.publisher },
    platformCompatibility: opts.platformCompatibility ?? '^2.0.0',
    license,
    integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
    contributes: {},
  };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  if (!opts.skipArchive) {
    await writeFile(join(dir, 'archive.tar.zst'), archive);
    await writeFile(join(dir, 'signature.bin'), signPackArchive(archive, root.privateKeyPem));
  }
  return dir;
}

/** Build a `PackLoaderDependencies` against a known root + key. */
export function loaderDeps(
  root: TempInstallRoot,
  overrides?: Partial<PackLoaderDependencies>,
): PackLoaderDependencies {
  return {
    entitlements: overrides?.entitlements ?? {
      async getEntitlement() {
        return null;
      },
    },
    publisherKeys: overrides?.publisherKeys ?? {
      async getPublisherKey() {
        return root.publicKeyPem;
      },
    },
    platformVersion: overrides?.platformVersion ?? '2.5.0',
  };
}

/** Recording logger; each list captures the call sequence verbatim. */
export interface LoggerRecorder extends CliLogger {
  readonly info_: string[];
  readonly error_: string[];
  readonly warn_: string[];
  joined(): string;
}

export function recordingLogger(): LoggerRecorder {
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
    joined() {
      return [...info_, ...error_, ...warn_].join('\n');
    },
  };
}

/** Prompter that returns pre-seeded answers in order. */
export function scriptedPrompter(answers: readonly boolean[]): CliPrompter {
  let i = 0;
  return {
    async confirm() {
      const answer = answers[i] ?? false;
      i++;
      return answer;
    },
  };
}

/** Fs shim that delegates to real node fs but records every rm call. */
export function recordingNodeFs(): CliFs & { readonly removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    async rm(path, opts) {
      removed.push(path);
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
}

/** Assemble a `CliDependencies` rooted at a real temp install root. */
export function makeCliDeps(
  root: TempInstallRoot,
  overrides?: Partial<CliDependencies>,
): CliDependencies & {
  readonly logger: LoggerRecorder;
  readonly fs: CliFs & { readonly removed: string[] };
} {
  const logger = (overrides?.logger as LoggerRecorder | undefined) ?? recordingLogger();
  const fs =
    (overrides?.fs as (CliFs & { readonly removed: string[] }) | undefined) ?? recordingNodeFs();
  return {
    logger,
    fs,
    rootPath: overrides?.rootPath ?? root.rootPath,
    prompter: overrides?.prompter ?? scriptedPrompter([true]),
    loader: overrides?.loader ?? loaderDeps(root),
  };
}
