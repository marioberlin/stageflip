// packages/pack-signing/src/commands/sign.ts
// T-498 — `stageflip-pack-sign sign <pack-dir> --key <private.pem>
// --out <archive-path>` — read all files under <pack-dir>, build a
// deterministic archive, write it to <archive-path>, sign with Ed25519,
// write <archive-path>.sig.
//
// Determinism perimeter: this package lives OUTSIDE.

import { createHash } from 'node:crypto';
import { dirname, join, posix, relative, sep } from 'node:path';

import { ED25519_SIGNATURE_LENGTH, signPackArchive } from '@stageflip/pack-format';

import { type ArchiveFile, synthesizeArchive } from '../archive.js';
import type { CliSignDependencies, SignFs } from '../deps.js';

/** Result of `signPackDirectory`. */
export interface SignedPackResult {
  readonly archivePath: string;
  readonly signaturePath: string;
  /** SHA-256 hex digest of the archive bytes (matches manifest.integrity.hash). */
  readonly integrityHash: string;
  /** Raw archive bytes that were signed. */
  readonly archiveBytes: Uint8Array;
  /** Raw 64-byte Ed25519 signature. */
  readonly signature: Uint8Array;
}

/** Options for `signPackDirectory`. */
export interface SignPackOptions {
  readonly packDir: string;
  readonly privateKeyPath: string;
  readonly archivePath: string;
}

/**
 * Read every file under `packDir`, build a deterministic archive,
 * write the archive + a `.sig` sidecar, and rewrite the manifest with
 * the computed `integrity.hash`. Returns paths + raw bytes for
 * downstream consumers (CLI prints; tests assert).
 *
 * Throws `SignPackError` on missing `manifest.json`, unreadable key,
 * or other recoverable failures.
 */
export async function signPackDirectory(
  opts: SignPackOptions,
  deps: CliSignDependencies,
): Promise<SignedPackResult> {
  const { packDir, privateKeyPath, archivePath } = opts;

  // 1. Read the manifest first — fail fast if absent.
  const manifestPath = join(packDir, 'manifest.json');
  if (!(await deps.fs.exists(manifestPath))) {
    throw new SignPackError(`pack directory missing manifest.json: ${manifestPath}`);
  }

  // 2. Read the private key.
  let privateKeyPem: string;
  try {
    const keyBytes = await deps.fs.readFile(privateKeyPath);
    privateKeyPem = new TextDecoder().decode(keyBytes);
  } catch (err) {
    throw new SignPackError(
      `private key unreadable at ${privateKeyPath}: ${(err as Error).message}`,
    );
  }

  // 3. Walk the pack directory, gather files (excluding the manifest —
  //    we'll re-inject it last with the integrity-hash patched).
  const filesExcludingManifest = await readAllFilesExcept(deps.fs, packDir, 'manifest.json');

  // 4. Compute integrity.hash as SHA-256 over the archive contents
  //    EXCLUDING the manifest itself (self-reference would otherwise be
  //    impossible). Then patch the parsed manifest with that hash and
  //    synthesize the FINAL archive WITH the patched manifest. The
  //    final archive is what gets signed + stored.
  const originalManifestBytes = await deps.fs.readFile(manifestPath);
  const parsedManifest = parseManifestJson(originalManifestBytes);
  const archiveWithoutManifest = synthesizeArchive(filesExcludingManifest);
  const integrityHash = sha256Hex(archiveWithoutManifest);
  const patchedManifest = applyIntegrityHash(parsedManifest, integrityHash);
  const manifestBytes = encodeManifest(patchedManifest);
  const allFiles: ArchiveFile[] = [
    ...filesExcludingManifest,
    { path: 'manifest.json', content: manifestBytes },
  ];
  const finalArchive = synthesizeArchive(allFiles);

  // 5. Sign.
  const signature = signPackArchive(finalArchive, privateKeyPem);
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    throw new SignPackError(
      `unexpected signature length ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
    );
  }

  // 6. Write archive + signature.
  await deps.fs.mkdir(dirname(archivePath), { recursive: true });
  await deps.fs.writeFile(archivePath, finalArchive);
  const signaturePath = `${archivePath}.sig`;
  await deps.fs.writeFile(signaturePath, signature);

  return {
    archivePath,
    signaturePath,
    integrityHash,
    archiveBytes: finalArchive,
    signature,
  };
}

/**
 * Run the `sign` subcommand. Args: `<pack-dir> --key <private.pem>
 * --out <archive-path>`. Returns 0 on success, 1 on usage / runtime
 * error.
 */
export async function runSignCommand(
  args: readonly string[],
  deps: CliSignDependencies,
): Promise<number> {
  let packDir: string | undefined;
  let privateKeyPath: string | undefined;
  let archivePath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--key') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-sign sign: --key requires a value');
        return 1;
      }
      privateKeyPath = next;
      i += 1;
      continue;
    }
    if (arg === '--out') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-sign sign: --out requires a value');
        return 1;
      }
      archivePath = next;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--')) {
      deps.logger.error(`stageflip-pack-sign sign: unknown flag: ${arg}`);
      return 1;
    }
    if (packDir === undefined) {
      packDir = arg;
    } else {
      deps.logger.error(`stageflip-pack-sign sign: unexpected positional: ${arg}`);
      return 1;
    }
  }
  if (packDir === undefined) {
    deps.logger.error('stageflip-pack-sign sign: <pack-dir> is required');
    return 1;
  }
  if (privateKeyPath === undefined) {
    deps.logger.error('stageflip-pack-sign sign: --key <private.pem> is required');
    return 1;
  }
  if (archivePath === undefined) {
    deps.logger.error('stageflip-pack-sign sign: --out <archive-path> is required');
    return 1;
  }
  try {
    const result = await signPackDirectory({ packDir, privateKeyPath, archivePath }, deps);
    deps.logger.info(`wrote ${result.archivePath}`);
    deps.logger.info(`wrote ${result.signaturePath}`);
    deps.logger.info(`integrity ${result.integrityHash}`);
    return 0;
  } catch (err) {
    if (err instanceof SignPackError) {
      deps.logger.error(`stageflip-pack-sign sign: ${err.message}`);
      return 1;
    }
    throw err;
  }
}

/** Thrown by `signPackDirectory` on recoverable failures. */
export class SignPackError extends Error {
  override readonly name = 'SignPackError';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively gather every file under `root` (excluding entries whose
 * top-level path matches `excludeTopLevel`). Paths are normalised to
 * POSIX separators and made relative to `root` so the archive is
 * cross-platform-deterministic.
 */
async function readAllFilesExcept(
  fs: SignFs,
  root: string,
  excludeTopLevel: string,
): Promise<ArchiveFile[]> {
  const out: ArchiveFile[] = [];
  await walk(fs, root, root, excludeTopLevel, out);
  return out;
}

async function walk(
  fs: SignFs,
  root: string,
  current: string,
  excludeTopLevel: string,
  out: ArchiveFile[],
): Promise<void> {
  const entries = await fs.readDir(current);
  for (const entry of entries) {
    const full = join(current, entry);
    const rel = relative(root, full).split(sep).join(posix.sep);
    if (rel === excludeTopLevel) continue;
    const s = await fs.stat(full);
    if (s.isDirectory()) {
      await walk(fs, root, full, excludeTopLevel, out);
    } else if (s.isFile()) {
      const content = await fs.readFile(full);
      out.push({ path: rel, content });
    }
  }
}

function sha256Hex(bytes: Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

interface ManifestObject {
  readonly integrity?: { algorithm: string; hash: string };
  [key: string]: unknown;
}

function parseManifestJson(bytes: Uint8Array): ManifestObject {
  const text = new TextDecoder().decode(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SignPackError(`manifest.json is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new SignPackError('manifest.json must be a JSON object');
  }
  return parsed as ManifestObject;
}

function applyIntegrityHash(manifest: ManifestObject, hash: string): ManifestObject {
  return {
    ...manifest,
    integrity: { algorithm: 'sha256', hash },
  };
}

function encodeManifest(manifest: ManifestObject): Uint8Array {
  // Pretty-print with 2-space indent so the on-disk file is readable
  // AND deterministic across runs (JSON.stringify with sorted keys
  // would be even tighter but that's a refinement for a later task).
  return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
}
