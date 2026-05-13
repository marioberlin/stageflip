// packages/pack-cli/src/commands/list.ts
// T-497 — `stageflip-pack list` — enumerate installed packs.
//
// Walks `~/.stageflip/packs/` via `discoverPacks`, prints one row per
// installed pack with id, version, publisher, license-kind, and
// status (`loaded` or the LF-* code that gated install).

import { type DiscoveredPack, discoverPacks, isPackLoadFailure } from '@stageflip/pack-loader';

import type { CliDependencies } from '../deps.js';

/** Run the `list` subcommand. Returns the CLI exit code (always 0). */
export async function runList(deps: CliDependencies): Promise<number> {
  const results = await discoverPacks(deps.rootPath, deps.loader);
  if (results.length === 0) {
    deps.logger.info(`(no packs installed under ${deps.rootPath})`);
    return 0;
  }
  for (const row of results) {
    deps.logger.info(formatRow(row));
  }
  deps.logger.info(`(${results.length} pack${results.length === 1 ? '' : 's'})`);
  return 0;
}

/**
 * Format one discovered pack into a single line. Failures emit their
 * LF-* code in place of `loaded`; the install path comes second so a
 * grep-by-id stays readable.
 */
export function formatRow(row: DiscoveredPack): string {
  if (isPackLoadFailure(row.result)) {
    return `[${row.result.reason}] ${row.installPath} — ${row.result.detail}`;
  }
  const { manifest } = row.result;
  return [
    '[loaded]',
    manifest.id,
    manifest.version,
    `publisher=${manifest.publisher.id}`,
    `license=${manifest.license.kind}`,
    row.installPath,
  ].join(' ');
}
