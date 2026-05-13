// packages/pack-cli/src/commands/info.ts
// T-497 — `stageflip-pack info <pack-id>[@<version>]` — print full
// manifest + load status for one installed pack.
//
// Filters the `discoverPacks` walk by manifest id (and optional
// version). Failed loads still print: the manifest may be unparseable,
// in which case the reported LF-* code IS the answer to "what's wrong
// with this pack?".

import { type DiscoveredPack, discoverPacks, isPackLoadFailure } from '@stageflip/pack-loader';

import type { CliDependencies } from '../deps.js';
import { type PackRef, parsePackRef } from '../pack-ref.js';

/**
 * Run the `info` subcommand. Returns 0 on success, 1 if no matching
 * pack was found.
 */
export async function runInfo(args: readonly string[], deps: CliDependencies): Promise<number> {
  const ref = parsePackRef(args[0]);
  if (ref === null) {
    deps.logger.error('stageflip-pack info: missing <pack-id>[@<version>] argument');
    return 1;
  }
  const results = await discoverPacks(deps.rootPath, deps.loader);
  const matches = results.filter((row) => rowMatchesRef(row, ref));
  if (matches.length === 0) {
    deps.logger.error(
      `stageflip-pack info: no pack matches ${formatRef(ref)} under ${deps.rootPath}`,
    );
    return 1;
  }
  for (const match of matches) {
    deps.logger.info(formatDetail(match));
  }
  return 0;
}

/** Match a discovered pack against the requested ref. */
function rowMatchesRef(row: DiscoveredPack, ref: PackRef): boolean {
  if (isPackLoadFailure(row.result)) {
    // Best-effort id+version extraction from the install path
    // (`<root>/<publisher>/<id>/<version>/`). The discoverer guarantees
    // this layout.
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

/** Format the multi-line detail block for one installed pack. */
export function formatDetail(row: DiscoveredPack): string {
  const lines: string[] = [];
  lines.push(`install: ${row.installPath}`);
  if (isPackLoadFailure(row.result)) {
    lines.push(`status: ${row.result.reason}`);
    lines.push(`detail: ${row.result.detail}`);
    return lines.join('\n');
  }
  const { manifest } = row.result;
  lines.push('status: loaded (signature verified, entitlement ok)');
  lines.push(`id: ${manifest.id}`);
  lines.push(`name: ${manifest.name}`);
  lines.push(`version: ${manifest.version}`);
  lines.push(`publisher: ${manifest.publisher.displayName} (${manifest.publisher.id})`);
  lines.push(`platformCompatibility: ${manifest.platformCompatibility}`);
  lines.push(`license.kind: ${manifest.license.kind}`);
  if (manifest.license.kind === 'open') {
    lines.push(`license.spdx: ${manifest.license.spdx}`);
  } else {
    lines.push(`license.sku: ${manifest.license.sku}`);
  }
  if (manifest.description !== undefined) lines.push(`description: ${manifest.description}`);
  const c = manifest.contributes;
  lines.push(
    `contributes: presets=${c.presets?.length ?? 0}, clipKinds=${c.clipKinds?.length ?? 0}, fonts=${c.fonts?.length ?? 0}, fixtures=${c.fixtures?.length ?? 0}, assets=${c.assets?.length ?? 0}, tools=${c.tools?.length ?? 0}, adapters=${c.adapters?.length ?? 0}, themePacks=${c.themePacks?.length ?? 0}`,
  );
  return lines.join('\n');
}
