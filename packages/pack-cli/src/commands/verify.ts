// packages/pack-cli/src/commands/verify.ts
// T-497 — `stageflip-pack verify [<pack-id>[@<version>]]` — run every
// install-time gate for one (or all) installed pack(s).
//
// Returns 0 if every targeted pack loaded clean, 1 if any failed. One
// LF-* line printed per failure (the loader's failure detail is
// included so an operator can act).

import { type DiscoveredPack, discoverPacks, isPackLoadFailure } from '@stageflip/pack-loader';

import type { CliDependencies } from '../deps.js';
import { type PackRef, parsePackRef } from '../pack-ref.js';

/**
 * Run the `verify` subcommand. With no arg, verifies every installed
 * pack; with `<pack-id>[@<version>]`, only the matching pack(s).
 */
export async function runVerify(args: readonly string[], deps: CliDependencies): Promise<number> {
  const ref = parsePackRef(args[0]);
  const results = await discoverPacks(deps.rootPath, deps.loader);
  const targets = ref === null ? results : results.filter((row) => rowMatchesRef(row, ref));
  if (targets.length === 0) {
    if (ref === null) {
      deps.logger.info(`(no packs installed under ${deps.rootPath})`);
      return 0;
    }
    deps.logger.error(
      `stageflip-pack verify: no pack matches ${formatRef(ref)} under ${deps.rootPath}`,
    );
    return 1;
  }
  let failures = 0;
  for (const row of targets) {
    if (isPackLoadFailure(row.result)) {
      failures++;
      deps.logger.error(`FAIL ${row.installPath}: ${row.result.reason} — ${row.result.detail}`);
    } else {
      const { manifest } = row.result;
      deps.logger.info(`OK   ${manifest.id}@${manifest.version} (${row.installPath})`);
    }
  }
  deps.logger.info(
    `(${targets.length - failures}/${targets.length} pass${failures === 0 ? '' : `, ${failures} fail`})`,
  );
  return failures === 0 ? 0 : 1;
}

function rowMatchesRef(row: DiscoveredPack, ref: PackRef): boolean {
  if (isPackLoadFailure(row.result)) {
    const parts = row.installPath.split('/').filter((p) => p.length > 0);
    const version = parts.at(-1) ?? '';
    const id = parts.at(-2) ?? '';
    if (id !== ref.id) return false;
    if (ref.version !== undefined && version !== ref.version) return false;
    return true;
  }
  const { manifest } = row.result;
  if (manifest.id !== ref.id) return false;
  if (ref.version !== undefined && manifest.version !== ref.version) return false;
  return true;
}

function formatRef(ref: PackRef): string {
  return ref.version === undefined ? ref.id : `${ref.id}@${ref.version}`;
}
