// packages/pack-cli/src/commands/remove.ts
// T-497 — `stageflip-pack remove <pack-id>[@<version>] [--yes]` — delete
// the install directory for one pack. Confirms via stdin unless `--yes`.
//
// Refuses if the install directory does not exist (exit 1) so an
// errant `remove` on a typo'd pack id never silently no-ops.

import { type DiscoveredPack, discoverPacks, isPackLoadFailure } from '@stageflip/pack-loader';

import type { CliDependencies } from '../deps.js';
import { type PackRef, parsePackRef } from '../pack-ref.js';

/**
 * Run the `remove` subcommand.
 *
 * Resolves the install path two ways:
 *   1. If `discoverPacks` finds a loaded pack matching the ref, use
 *      its `installPath` directly. This handles the happy path AND
 *      packs whose loader gate failed (debris that the operator wants
 *      to clean up).
 *   2. Else, if `<pack-id>@<version>` was supplied, fall back to
 *      `<root>/*\/<id>/<version>/` — but only when exactly one such
 *      directory exists, to avoid ambiguity between publishers.
 *
 * Returns 0 on success, 1 if the pack was not found, the user aborted,
 * or the version was omitted on a fallback-mode lookup.
 */
export async function runRemove(args: readonly string[], deps: CliDependencies): Promise<number> {
  const flags = parseRemoveFlags(args);
  if (flags === null) {
    deps.logger.error('stageflip-pack remove: missing <pack-id>[@<version>] argument');
    return 1;
  }
  const { ref, yes } = flags;
  const results = await discoverPacks(deps.rootPath, deps.loader);
  const matches = results.filter((row) => rowMatchesRef(row, ref));
  let installPath: string;
  if (matches.length === 1) {
    const onlyMatch = matches[0];
    if (onlyMatch === undefined) {
      // Defensive: length === 1 implies index 0 exists.
      deps.logger.error('stageflip-pack remove: unexpected empty match');
      return 1;
    }
    installPath = onlyMatch.installPath;
  } else if (matches.length > 1) {
    deps.logger.error(
      `stageflip-pack remove: ${matches.length} packs match ${formatRef(ref)}; specify @<version>`,
    );
    return 1;
  } else {
    deps.logger.error(
      `stageflip-pack remove: no pack matches ${formatRef(ref)} under ${deps.rootPath}`,
    );
    return 1;
  }

  const stat = await deps.fs.stat(installPath);
  if (stat === null || !stat.isDirectory()) {
    deps.logger.error(`stageflip-pack remove: install directory not found: ${installPath}`);
    return 1;
  }

  if (!yes) {
    const ok = await deps.prompter.confirm(`Remove ${installPath}? [y/N] `);
    if (!ok) {
      deps.logger.info('aborted');
      return 1;
    }
  }

  await deps.fs.rm(installPath, { recursive: true });
  deps.logger.info(`removed ${installPath}`);
  return 0;
}

interface RemoveFlags {
  readonly ref: PackRef;
  readonly yes: boolean;
}

/** Parse the remove-specific arg shape: one positional + optional `--yes`. */
function parseRemoveFlags(args: readonly string[]): RemoveFlags | null {
  let yes = false;
  let positional: string | undefined;
  for (const arg of args) {
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    if (arg.startsWith('--')) {
      // Unknown flag — treat as malformed input. Caller emits error.
      return null;
    }
    if (positional === undefined) {
      positional = arg;
    } else {
      return null;
    }
  }
  const ref = parsePackRef(positional);
  if (ref === null) return null;
  return { ref, yes };
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
