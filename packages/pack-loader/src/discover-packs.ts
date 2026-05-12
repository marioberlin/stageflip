// packages/pack-loader/src/discover-packs.ts
// T-495 — Filesystem walker over the canonical pack install root
// (`~/.stageflip/packs/` per ADR-012 §D8). Yields one `loadPack` call
// per `<publisher>/<id>/<version>/` triple discovered.
//
// Per ADR-012 §D8 the on-disk layout is fixed:
//   <root>/<publisherId>/<packId>/<version>/
//     manifest.json
//     archive.tar.zst
//     signature.bin
//
// The discoverer does NOT itself parse manifests — it only enumerates
// candidate directories and delegates to `loadPack`. This keeps the
// gate semantics in one place; a malformed install surfaces as a
// `PackLoadFailure` carried through `discoverPacks`, not a thrown
// error mid-walk.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { PackLoaderDependencies } from './dependencies.js';
import { type PackInstallation, type PackLoadFailure, loadPack } from './load-pack.js';

/** One row of the discoverer's output. */
export interface DiscoveredPack {
  readonly installPath: string;
  readonly result: PackInstallation | PackLoadFailure;
}

/**
 * Walk the supplied install root, attempt to load every pack found,
 * and return the typed results. The walk is shallow + bounded:
 *   <root>/<publisher>/<id>/<version>/
 * — any directory not matching this depth is silently ignored (debris
 * tolerance: a partial `npm` extraction or a leftover `.tmp` dir does
 * not crash the loader).
 *
 * Returns one `DiscoveredPack` per `<version>` directory. Caller
 * branches on `isPackLoadFailure` to register successes + surface
 * failures.
 */
export async function discoverPacks(
  rootPath: string,
  deps: PackLoaderDependencies,
): Promise<readonly DiscoveredPack[]> {
  const installPaths = await enumerateInstallPaths(rootPath);
  return Promise.all(
    installPaths.map(async (installPath) => ({
      installPath,
      result: await loadPack(installPath, deps),
    })),
  );
}

async function enumerateInstallPaths(rootPath: string): Promise<readonly string[]> {
  const paths: string[] = [];
  const publishers = await safeReadDir(rootPath);
  for (const publisher of publishers) {
    const publisherPath = join(rootPath, publisher);
    const packs = await safeReadDir(publisherPath);
    for (const pack of packs) {
      const packPath = join(publisherPath, pack);
      const versions = await safeReadDir(packPath);
      for (const version of versions) {
        paths.push(join(packPath, version));
      }
    }
  }
  return paths;
}

/**
 * `readdir` returning `[]` on missing-dir / non-dir / permission-denied.
 * The discoverer is debris-tolerant by design (see header).
 */
async function safeReadDir(path: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
