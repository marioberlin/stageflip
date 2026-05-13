// packages/pack-signing/src/commands/generate-keys.ts
// T-498 — `stageflip-pack-sign generate-keys --out-dir <dir>` — generate
// a fresh Ed25519 keypair via `node:crypto.generateKeyPairSync` and
// write both PEMs into the supplied directory.
//
// Determinism perimeter: this package lives OUTSIDE.

import { generateKeyPairSync } from 'node:crypto';
import { join } from 'node:path';

import type { CliSignDependencies } from '../deps.js';

/** Filenames produced by `generateKeyPair`. */
export const PRIVATE_KEY_FILENAME = 'publisher.private.pem';
export const PUBLIC_KEY_FILENAME = 'publisher.public.pem';

/** Result of `generateKeyPair`: raw PEM strings (plus written paths). */
export interface KeyPairPem {
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly privateKeyPath: string;
  readonly publicKeyPath: string;
}

/** Options for `generateKeyPair`. */
export interface GenerateKeyPairOptions {
  readonly outDir: string;
  /** If true, overwrite existing PEMs in `outDir`. Default: false. */
  readonly force?: boolean;
}

/**
 * Generate an Ed25519 keypair and write the two PEM files into the
 * supplied directory. Refuses (throws) when either file already exists
 * unless `force` is true. Creates the directory recursively if missing.
 */
export async function generateKeyPair(
  opts: GenerateKeyPairOptions,
  deps: CliSignDependencies,
): Promise<KeyPairPem> {
  await deps.fs.mkdir(opts.outDir, { recursive: true });
  const privateKeyPath = join(opts.outDir, PRIVATE_KEY_FILENAME);
  const publicKeyPath = join(opts.outDir, PUBLIC_KEY_FILENAME);

  if (!opts.force) {
    if (await deps.fs.exists(privateKeyPath)) {
      throw new GenerateKeysRefusalError(
        `refusing to overwrite ${privateKeyPath}; pass --force to override`,
      );
    }
    if (await deps.fs.exists(publicKeyPath)) {
      throw new GenerateKeysRefusalError(
        `refusing to overwrite ${publicKeyPath}; pass --force to override`,
      );
    }
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const encoder = new TextEncoder();
  await deps.fs.writeFile(privateKeyPath, encoder.encode(privateKeyPem));
  await deps.fs.writeFile(publicKeyPath, encoder.encode(publicKeyPem));

  return { privateKeyPem, publicKeyPem, privateKeyPath, publicKeyPath };
}

/**
 * Run the `generate-keys` subcommand. Parses `--out-dir <dir>` +
 * `--force`. Returns 0 on success, 1 on usage error or overwrite refusal.
 */
export async function runGenerateKeysCommand(
  args: readonly string[],
  deps: CliSignDependencies,
): Promise<number> {
  let outDir: string | undefined;
  let force = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out-dir') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-sign generate-keys: --out-dir requires a value');
        return 1;
      }
      outDir = next;
      i += 1;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    deps.logger.error(`stageflip-pack-sign generate-keys: unknown argument: ${arg}`);
    return 1;
  }
  if (outDir === undefined) {
    deps.logger.error('stageflip-pack-sign generate-keys: --out-dir <dir> is required');
    return 1;
  }
  try {
    const result = await generateKeyPair({ outDir, force }, deps);
    deps.logger.info(`wrote ${result.privateKeyPath}`);
    deps.logger.info(`wrote ${result.publicKeyPath}`);
    return 0;
  } catch (err) {
    if (err instanceof GenerateKeysRefusalError) {
      deps.logger.error(`stageflip-pack-sign generate-keys: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

/** Thrown when `generateKeyPair` would overwrite an existing PEM without `--force`. */
export class GenerateKeysRefusalError extends Error {
  override readonly name = 'GenerateKeysRefusalError';
}
