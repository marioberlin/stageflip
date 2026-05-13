// packages/pack-publish-cli/src/commands/validate.ts
// T-500 — `stageflip-pack-publish validate <pack-dir>` — run the same
// invariants as the T-499 CI gate against an UNSIGNED pack source
// directory (no signature.bin needed). Prints a per-invariant
// pass/warning/fail report.
//
// Determinism perimeter: this package lives OUTSIDE.

import { join } from 'node:path';

import { COMPATIBILITY_MATRIX, parsePackManifest } from '@stageflip/pack-format';

import type { CliPublishDependencies, PublishFs } from '../deps.js';

/** One detected issue. `level: 'warn'` does not affect exit code. */
export interface ValidateIssue {
  readonly invariant: string;
  readonly level: 'fail' | 'warn';
  readonly detail: string;
}

/** Result of `runValidate`. */
export interface ValidateResult {
  readonly issues: readonly ValidateIssue[];
  readonly ok: boolean;
}

/** Manifest semver-range regex — mirrors `pack-format/manifest.ts`. */
const SEMVER_RANGE_REGEX = /^[\^~>=<*\d\s.,|-]+$/;
/** Manifest version regex — mirrors `packManifestSchema.version`. */
const VERSION_REGEX = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i;

const MANIFEST_FILENAME = 'manifest.json';
const ACCEPTED_LICENSE_KINDS = new Set(['open', 'paid-per-tenant', 'enterprise']);

/**
 * Validate an unsigned pack directory. Returns a structured result with
 * one entry per invariant; never throws. `ok` is `false` if any issue
 * has level `'fail'`; warnings do not affect `ok`.
 */
export async function runValidate(packDir: string, fs: PublishFs): Promise<ValidateResult> {
  const issues: ValidateIssue[] = [];
  const manifestPath = join(packDir, MANIFEST_FILENAME);

  // Pre-flight: manifest must exist.
  if (!(await fs.exists(manifestPath))) {
    issues.push({
      invariant: 'manifest-parse-error',
      level: 'fail',
      detail: `${MANIFEST_FILENAME} not found at ${manifestPath}`,
    });
    return { issues, ok: false };
  }

  let manifestBytes: Uint8Array;
  try {
    manifestBytes = await fs.readFile(manifestPath);
  } catch (err) {
    issues.push({
      invariant: 'manifest-parse-error',
      level: 'fail',
      detail: `failed to read ${manifestPath}: ${(err as Error).message}`,
    });
    return { issues, ok: false };
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (err) {
    issues.push({
      invariant: 'manifest-parse-error',
      level: 'fail',
      detail: `invalid JSON in ${manifestPath}: ${(err as Error).message}`,
    });
    return { issues, ok: false };
  }

  const rawObj = (rawJson ?? {}) as Record<string, unknown>;

  // Invariant: version regex (separate from schema parse so the
  // report is clean when version is the only thing wrong).
  if (typeof rawObj.version === 'string' && !VERSION_REGEX.test(rawObj.version)) {
    issues.push({
      invariant: 'version-regex-mismatch',
      level: 'fail',
      detail: `manifest 'version' '${rawObj.version}' does not match semver regex`,
    });
  }

  // Invariant: license-claim shape.
  const rawLicense = rawObj.license as Record<string, unknown> | undefined;
  if (rawLicense === undefined || typeof rawLicense !== 'object' || rawLicense === null) {
    issues.push({
      invariant: 'license-claim-invalid',
      level: 'fail',
      detail: `manifest 'license' is missing or not an object`,
    });
  } else if (typeof rawLicense.kind !== 'string' || !ACCEPTED_LICENSE_KINDS.has(rawLicense.kind)) {
    issues.push({
      invariant: 'license-claim-invalid',
      level: 'fail',
      detail: `manifest 'license.kind' must be one of 'open' | 'paid-per-tenant' | 'enterprise'; got ${JSON.stringify(rawLicense.kind)}`,
    });
  }

  // Invariant: platformCompatibility shape.
  const platformCompat = rawObj.platformCompatibility;
  if (typeof platformCompat !== 'string' || platformCompat.length === 0) {
    issues.push({
      invariant: 'platform-compat-invalid',
      level: 'fail',
      detail: `manifest 'platformCompatibility' is missing or not a string`,
    });
  } else if (!SEMVER_RANGE_REGEX.test(platformCompat)) {
    issues.push({
      invariant: 'platform-compat-invalid',
      level: 'fail',
      detail: `manifest 'platformCompatibility' '${platformCompat}' fails workspace semver-range regex`,
    });
  }

  // Drive the full strict schema. Catches anything the targeted probes
  // above missed (e.g. uppercase id, missing publisher, unknown keys).
  try {
    parsePackManifest(rawJson);
  } catch (err) {
    issues.push({
      invariant: 'manifest-parse-error',
      level: 'fail',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // Optional warnings — encourage polish, never fail the validate gate.
  if (typeof rawObj.repository !== 'string' && typeof rawObj.homepage !== 'string') {
    issues.push({
      invariant: 'metadata-incomplete',
      level: 'warn',
      detail: `neither 'repository' nor 'homepage' URL provided`,
    });
  }
  if (typeof rawObj.description !== 'string' || rawObj.description.length < 10) {
    issues.push({
      invariant: 'metadata-incomplete',
      level: 'warn',
      detail: `'description' missing or shorter than 10 characters`,
    });
  }
  if (!Array.isArray(rawObj.keywords) || rawObj.keywords.length === 0) {
    issues.push({
      invariant: 'metadata-incomplete',
      level: 'warn',
      detail: `'keywords' is empty`,
    });
  }

  // T-502 — compatibility-matrix advisory. Warns (never fails) when the
  // pack's `manifestVersion` does not appear in any row of the
  // workspace compatibility matrix. Warning-only because the publisher
  // does not know which engine versions consumers will run, and the
  // matrix can lag behind the schema literal.
  const rawManifestVersion = rawObj.manifestVersion;
  if (typeof rawManifestVersion === 'string' && rawManifestVersion.length > 0) {
    const matchingRow = COMPATIBILITY_MATRIX.find((row) =>
      row.manifestVersions.includes(rawManifestVersion),
    );
    if (matchingRow === undefined) {
      issues.push({
        invariant: 'compatibility-advisory',
        level: 'warn',
        detail: `no matching engine row for manifestVersion '${rawManifestVersion}' in the workspace compatibility matrix`,
      });
    } else if (matchingRow.note !== undefined) {
      issues.push({
        invariant: 'compatibility-advisory',
        level: 'warn',
        detail: `manifestVersion '${rawManifestVersion}' matches matrix row: ${matchingRow.note}`,
      });
    }
  }

  const ok = !issues.some((i) => i.level === 'fail');
  return { issues, ok };
}

/**
 * Run the `validate` subcommand. Args: `<pack-dir>`. Exit 0 if no
 * `fail` issues; exit 1 if any. Prints per-issue lines for both
 * warnings and fails so the publisher gets actionable feedback.
 */
export async function runValidateCommand(
  args: readonly string[],
  deps: CliPublishDependencies,
): Promise<number> {
  let packDir: string | undefined;
  for (const arg of args) {
    if (arg.startsWith('--')) {
      deps.logger.error(`stageflip-pack-publish validate: unknown flag: ${arg}`);
      return 1;
    }
    if (packDir === undefined) {
      packDir = arg;
    } else {
      deps.logger.error(`stageflip-pack-publish validate: unexpected positional: ${arg}`);
      return 1;
    }
  }
  if (packDir === undefined) {
    deps.logger.error('stageflip-pack-publish validate: <pack-dir> is required');
    return 1;
  }

  const result = await runValidate(packDir, deps.fs);
  for (const issue of result.issues) {
    if (issue.level === 'fail') {
      deps.logger.error(`FAIL [${issue.invariant}] ${issue.detail}`);
    } else {
      deps.logger.warn(`WARN [${issue.invariant}] ${issue.detail}`);
    }
  }
  if (result.ok) {
    const warnCount = result.issues.filter((i) => i.level === 'warn').length;
    deps.logger.info(
      warnCount === 0
        ? `validate: PASS (${packDir})`
        : `validate: PASS with ${warnCount} warning${warnCount === 1 ? '' : 's'} (${packDir})`,
    );
    return 0;
  }
  const failCount = result.issues.filter((i) => i.level === 'fail').length;
  deps.logger.error(
    `validate: FAIL (${failCount} issue${failCount === 1 ? '' : 's'}) (${packDir})`,
  );
  return 1;
}
