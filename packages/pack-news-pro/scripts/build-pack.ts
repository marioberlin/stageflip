// packages/pack-news-pro/scripts/build-pack.ts
// T-506 — Build script for `@stageflip/pack-news-pro`. Walks the pack
// source dir, synthesizes a deterministic SFPACK1 archive (per
// `@stageflip/pack-signing/archive`), signs the archive with the
// supplied Ed25519 private key (per `@stageflip/pack-format/signature`),
// computes the SHA-256 integrity hash, materializes the final
// `manifest.json` with the correct hash, and emits
// `archive.sfpack` + `signature.bin` + `manifest.json` to the
// configured output directory (default `packs/stageflip/news-pro/0.1.0/`).
//
// Auditable + reproducible: this script encodes the signing workflow
// in code rather than relying on out-of-band manual steps. The
// orchestrator runs it once and commits the outputs; the
// `check-pack-integrity` gate validates the result.
//
// Determinism perimeter: tooling — lives OUTSIDE per CLAUDE.md §3.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ED25519_SIGNATURE_LENGTH, signPackArchive } from '@stageflip/pack-format';
import { type ArchiveFile, synthesizeArchive } from '@stageflip/pack-signing';

import { withIntegrityHash } from '../src/manifest.js';

/** Options for `buildPack`. */
export interface BuildPackOptions {
  /** Directory containing presets/, LICENSE.md, NOTICE.md (the pack source). */
  readonly sourceDir: string;
  /** Directory the archive + signature + manifest are written to. */
  readonly outDir: string;
  /** PEM-encoded Ed25519 private key used to sign the archive. */
  readonly privateKeyPem: string;
}

/** Result of `buildPack`. */
export interface BuildPackResult {
  readonly manifestPath: string;
  readonly archivePath: string;
  readonly signaturePath: string;
  /** SHA-256 hex digest of the synthesized archive (matches `manifest.integrity.hash`). */
  readonly integrityHash: string;
}

/** Thrown by `buildPack` on missing inputs / malformed source dir. */
export class BuildPackError extends Error {
  override readonly name = 'BuildPackError';
}

/**
 * Walk `sourceDir`, synthesize + sign the pack archive, and write the
 * outputs to `outDir`. The manifest emitted under `outDir/manifest.json`
 * has its `integrity.hash` set to SHA-256 over the archive WITHOUT the
 * manifest itself (self-reference is otherwise impossible — same
 * approach `@stageflip/pack-signing/commands/sign.ts` takes).
 *
 * Dot-files at any level of `sourceDir` are skipped (e.g. `.DS_Store`).
 * The `presets/` subdirectory is required; missing it throws.
 *
 * @param opts See `BuildPackOptions`.
 * @returns Paths written + the computed integrity hash.
 */
export function buildPack(opts: BuildPackOptions): BuildPackResult {
  const { sourceDir, outDir, privateKeyPem } = opts;

  // 1. Validate the source dir has a presets/ subdirectory.
  const presetsDir = join(sourceDir, 'presets');
  let presetsStat: ReturnType<typeof statSync>;
  try {
    presetsStat = statSync(presetsDir);
  } catch {
    throw new BuildPackError(`pack source missing presets/ directory: ${presetsDir}`);
  }
  if (!presetsStat.isDirectory()) {
    throw new BuildPackError(`pack source presets/ is not a directory: ${presetsDir}`);
  }

  // 2. Walk the source dir, gather files (skip dot-files, skip the
  //    manifest if one is present — we always emit a freshly-rendered
  //    manifest from the TS skeleton).
  const files = readAllFilesSkippingDotsAndManifest(sourceDir);

  // 3. Synthesize the archive WITHOUT the manifest first; compute the
  //    integrity hash over those bytes.
  const archiveWithoutManifest = synthesizeArchive(files);
  const integrityHash = sha256Hex(archiveWithoutManifest);

  // 4. Render the final manifest with the integrity hash patched in.
  const finalManifest = withIntegrityHash(integrityHash);
  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(finalManifest, null, 2)}\n`);

  // 5. Re-synthesize the archive INCLUDING the manifest. This is the
  //    final bytes that get signed + written.
  const allFiles: ArchiveFile[] = [...files, { path: 'manifest.json', content: manifestBytes }];
  const finalArchive = synthesizeArchive(allFiles);

  // 6. Sign.
  const signature = signPackArchive(finalArchive, privateKeyPem);
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    throw new BuildPackError(
      `unexpected signature length ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
    );
  }

  // 7. Write outputs.
  mkdirSync(outDir, { recursive: true });
  const archivePath = join(outDir, 'archive.sfpack');
  const signaturePath = join(outDir, 'signature.bin');
  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(archivePath, finalArchive);
  writeFileSync(signaturePath, signature);
  writeFileSync(manifestPath, manifestBytes);

  return { manifestPath, archivePath, signaturePath, integrityHash };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively gather every file under `root`. Dot-files at any depth
 * are skipped. If a top-level `manifest.json` is present it is also
 * skipped (the build always emits a freshly-rendered manifest).
 */
function readAllFilesSkippingDotsAndManifest(root: string): ArchiveFile[] {
  const out: ArchiveFile[] = [];
  walk(root, root, out);
  return out;
}

function walk(root: string, current: string, out: ArchiveFile[]): void {
  for (const entry of readdirSync(current)) {
    if (entry.startsWith('.')) continue;
    const full = join(current, entry);
    const s = statSync(full);
    const rel = relative(root, full).split(sep).join(posix.sep);
    if (rel === 'manifest.json') continue;
    if (s.isDirectory()) {
      walk(root, full, out);
    } else if (s.isFile()) {
      const content = readFileSync(full);
      out.push({ path: rel, content: new Uint8Array(content) });
    }
  }
}

function sha256Hex(bytes: Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const isMainModule = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  // tsx runs the file directly; compare resolved paths.
  try {
    return resolve(argv1) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return argv1.endsWith('build-pack.ts');
  }
})();

if (isMainModule) {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(here, '..');
  const keyPath = process.env.STAGEFLIP_NEWS_PRO_KEY
    ? resolve(process.env.STAGEFLIP_NEWS_PRO_KEY)
    : resolve(packageRoot, 'keys/news-pro-dev.private.pem');
  const sourceDir = process.env.STAGEFLIP_NEWS_PRO_SRC
    ? resolve(process.env.STAGEFLIP_NEWS_PRO_SRC)
    : resolve(packageRoot, 'packs');
  const outDir = process.env.STAGEFLIP_NEWS_PRO_OUT
    ? resolve(process.env.STAGEFLIP_NEWS_PRO_OUT)
    : resolve(packageRoot, '../../packs/stageflip/news-pro/0.1.0');
  const privateKeyPem = readFileSync(keyPath, 'utf-8');
  const result = buildPack({ sourceDir, outDir, privateKeyPem });
  process.stdout.write(
    `built pack: ${result.archivePath} (hash ${result.integrityHash.slice(0, 16)}…)\n`,
  );
}
