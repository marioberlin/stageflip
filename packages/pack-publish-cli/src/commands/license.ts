// packages/pack-publish-cli/src/commands/license.ts
// T-501 — `stageflip-pack-publish license <tier-id> [--out-dir <dir>]
// [--var k=v]... [--force]` — emit canned LICENSE.md / NOTICE.md /
// MANIFEST_LICENSE_SNIPPET.json files for one of the four canonical
// license tiers documented in `skills/stageflip/concepts/licensing/`.
//
// Pack-publish-cli lives OUTSIDE the determinism perimeter (publisher
// tooling, host code, runs on a developer machine). `new Date()` is
// fine here.
//
// Determinism perimeter: this package lives OUTSIDE.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CliPublishDependencies } from '../deps.js';
import {
  TEMPLATES,
  TIER_IDS,
  type TierId,
  renderManifestSnippet,
  substitute,
} from './license-templates.js';

/** Result of `runLicense`. */
export interface LicenseResult {
  readonly outDir: string;
  readonly tier: TierId;
  readonly files: readonly string[];
}

/** Default output directory when `--out-dir` is omitted. */
export const DEFAULT_OUT_DIR = './license-templates/';

/** Default substitution variables before user `--var` overrides. */
function defaultVars(): Record<string, string> {
  return {
    packName: 'Your Pack',
    publisherDisplayName: 'Your Org',
    contactEmail: 'licensing@example.com',
    year: new Date().getFullYear().toString(),
    sku: 'your-pack-sku',
    spdx: 'Apache-2.0',
  };
}

/** Verify a string is one of TIER_IDS. */
function isTierId(value: string): value is TierId {
  return (TIER_IDS as readonly string[]).includes(value);
}

/**
 * Run the `license` subcommand. Args: `<tier-id> [--out-dir <dir>]
 * [--var k=v]... [--force]`.
 *
 * Writes three files into `<out-dir>` (default `./license-templates/`):
 * `LICENSE.md`, `NOTICE.md`, `MANIFEST_LICENSE_SNIPPET.json`. Refuses
 * to overwrite existing files unless `--force` is passed.
 *
 * Exits 0 on success, 1 on usage / I/O / template error.
 */
export async function runLicense(
  args: readonly string[],
  deps: CliPublishDependencies,
): Promise<number> {
  let tier: string | undefined;
  let outDir: string = DEFAULT_OUT_DIR;
  let force = false;
  const userVars: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out-dir') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish license: --out-dir requires a value');
        return 1;
      }
      outDir = next;
      i += 1;
      continue;
    }
    if (arg === '--var') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish license: --var requires a k=v value');
        return 1;
      }
      const eq = next.indexOf('=');
      if (eq <= 0) {
        deps.logger.error(
          `stageflip-pack-publish license: --var expects 'key=value'; got '${next}'`,
        );
        return 1;
      }
      const k = next.slice(0, eq);
      const v = next.slice(eq + 1);
      userVars[k] = v;
      i += 1;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg?.startsWith('--')) {
      deps.logger.error(`stageflip-pack-publish license: unknown flag: ${arg}`);
      return 1;
    }
    if (tier === undefined) {
      tier = arg;
    } else {
      deps.logger.error(`stageflip-pack-publish license: unexpected positional: ${arg}`);
      return 1;
    }
  }

  if (tier === undefined) {
    deps.logger.error('stageflip-pack-publish license: <tier-id> is required');
    deps.logger.error(`  valid tier IDs: ${TIER_IDS.join(' | ')}`);
    return 1;
  }
  if (!isTierId(tier)) {
    deps.logger.error(`stageflip-pack-publish license: unknown tier: '${tier}'`);
    deps.logger.error(`  valid tier IDs: ${TIER_IDS.join(' | ')}`);
    return 1;
  }

  const vars: Record<string, string> = { ...defaultVars(), ...userVars };
  const template = TEMPLATES[tier];

  // Verify required vars are present. Defaults satisfy most; this
  // guards against a user explicitly overriding a required var to ''.
  for (const requiredKey of template.requiredVars) {
    const value = vars[requiredKey];
    if (value === undefined || value === '') {
      deps.logger.error(
        `stageflip-pack-publish license: required variable '${requiredKey}' is empty for tier '${tier}'`,
      );
      return 1;
    }
  }

  // Render content.
  let licenseBody: string;
  let noticeBody: string;
  let manifestSnippet: Record<string, unknown>;
  try {
    licenseBody = substitute(template.licenseMarkdown, vars);
    noticeBody = substitute(template.noticeMarkdown, vars);
    manifestSnippet = renderManifestSnippet(tier, vars);
  } catch (err) {
    deps.logger.error(`stageflip-pack-publish license: ${(err as Error).message}`);
    return 1;
  }

  const targets: ReadonlyArray<{ relPath: string; body: string }> = [
    { relPath: 'LICENSE.md', body: licenseBody },
    { relPath: 'NOTICE.md', body: noticeBody },
    {
      relPath: 'MANIFEST_LICENSE_SNIPPET.json',
      body: `${JSON.stringify(manifestSnippet, null, 2)}\n`,
    },
  ];

  // Pre-flight existence check so we refuse atomically (don't write
  // file 1 then refuse on file 2).
  if (!force) {
    for (const { relPath } of targets) {
      const fullPath = join(outDir, relPath);
      if (await deps.fs.exists(fullPath)) {
        deps.logger.error(
          `stageflip-pack-publish license: ${fullPath} already exists; pass --force to overwrite`,
        );
        return 1;
      }
    }
  }

  // Write.
  try {
    await mkdir(outDir, { recursive: true });
    for (const { relPath, body } of targets) {
      const fullPath = join(outDir, relPath);
      await writeFile(fullPath, body);
    }
  } catch (err) {
    deps.logger.error(`stageflip-pack-publish license: write failed: ${(err as Error).message}`);
    return 1;
  }

  const written = targets.map(({ relPath }) => join(outDir, relPath));
  for (const path of written) {
    deps.logger.info(`wrote ${path}`);
  }
  deps.logger.info(`license: emitted ${targets.length} files for tier '${tier}' in ${outDir}`);
  return 0;
}
