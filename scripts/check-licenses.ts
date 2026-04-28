// scripts/check-licenses.ts
// CI gate (CLAUDE.md §3, THIRD_PARTY.md §1.1, ADR-001 §D4): every dependency
// in the installed tree — transitive included — must resolve to a permitted
// license. Uses `pnpm licenses list --json` because it reports the full pnpm
// workspace tree (direct + transitive, across every workspace member).
//
// Fails with exit 1 on any forbidden license, any LGPL without an ADR, or any
// unknown/UNLICENSED third-party dep. Workspace packages (`@stageflip/*`, root
// `stageflip`) are skipped; their posture is set by LICENSE + ADR-001.

import { spawnSync } from 'node:child_process';

interface PackageEntry {
  name: string;
  versions?: string[];
  license?: string;
  author?: string;
  description?: string;
}

/** Licenses allowed without any additional review. */
const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'Apache 2.0',
  'BlueOak-1.0.0',
  'BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'ISC',
  'MIT',
  'MIT*',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
]);

/**
 * Licenses that require an ADR before use (LGPL dynamic-linking only, per
 * ADR-001 §D4). A match is a soft failure until the ADR lands.
 */
const NEEDS_ADR = new Set([
  'LGPL-2.1',
  'LGPL-3.0',
  'LGPL-2.1-or-later',
  'LGPL-3.0-or-later',
]);

/** Hard-forbidden licenses; any match is an immediate gate failure. */
const FORBIDDEN = new Set([
  'AGPL-1.0',
  'AGPL-3.0',
  'AGPL-3.0-or-later',
  'AGPL-3.0-only',
  'GPL-2.0',
  'GPL-3.0',
  'GPL-2.0-or-later',
  'GPL-3.0-or-later',
  'GPL-2.0-only',
  'GPL-3.0-only',
  'SSPL-1.0',
  'CPAL-1.0',
  'Remotion License',
]);

/**
 * Narrow allowlist for packages whose `package.json` declares an ambiguous
 * license (e.g. "SEE LICENSE IN LICENSE") but whose actual LICENSE file has
 * been reviewed and verified to be in our permitted set. Each entry must
 * reference the reviewed LICENSE path and the observed SPDX identifier.
 *
 * Keep this list tiny. If it grows, revisit the policy.
 */
const REVIEWED_OK = new Map<string, string>([
  // spawndamnit 3.0.1 — LICENSE file is standard MIT text (copyright James Kyle).
  // Transitive dep of @changesets/cli. Reviewed 2026-04-20.
  ['spawndamnit', 'MIT (verified from LICENSE file)'],
  // gsap 3.15.0 — reports its license as a URL ("Standard 'no charge' license:
  // https://gsap.com/standard-license") rather than an SPDX id. Business Green
  // license also procured per docs/dependencies.md §3 Media/rendering row.
  // Consumed by @stageflip/runtimes-gsap (T-063). Reviewed 2026-04-21.
  ['gsap', "Standard 'no charge' license (URL form); Business Green procured"],
  // jsonify 0.0.1 — Douglas Crockford's reference json.org JSON.parse /
  // JSON.stringify implementation, declared "Public Domain" in package.json.
  // Functionally equivalent to Unlicense / CC0-1.0 (already in ALLOWED).
  // Transitive dep of pg-mem -> json-stable-stringify (T-270 storage-postgres
  // unit-test backend). Reviewed 2026-04-27.
  ['jsonify', 'Public Domain (json.org reference; equivalent to Unlicense)'],
]);

/**
 * Split a single license branch (no OR) into atomic SPDX tokens.
 * Handles AND + WITH + slash-separated lists; parens are stripped.
 */
function tokenizeBranch(branch: string): string[] {
  return branch
    .replace(/[()]/g, ' ')
    .split(/\s+(?:AND|WITH)\s+|,|\//i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Split a composite SPDX expression into OR branches. Each branch
 * is a license the licensor offers us the choice of — if ANY branch
 * is fully allowed, the package is allowed (we pick that branch).
 * Parens at the top level are stripped before the split.
 */
function splitOrBranches(license: string): string[] {
  return license
    .replace(/[()]/g, ' ')
    .split(/\s+OR\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Verdict = 'allowed' | 'needs-adr' | 'forbidden' | 'unknown';

function classifyBranch(branch: string): Verdict {
  const tokens = tokenizeBranch(branch);
  if (tokens.length === 0) return 'unknown';
  if (tokens.some((t) => FORBIDDEN.has(t))) return 'forbidden';
  if (tokens.every((t) => ALLOWED.has(t))) return 'allowed';
  if (tokens.some((t) => NEEDS_ADR.has(t))) return 'needs-adr';
  if (tokens.some((t) => ALLOWED.has(t))) return 'allowed';
  return 'unknown';
}

function classify(licenseKey: string): Verdict {
  if (!licenseKey || licenseKey === 'UNKNOWN') return 'unknown';
  const branches = splitOrBranches(licenseKey);
  if (branches.length === 0) return 'unknown';
  const verdicts = branches.map(classifyBranch);
  // OR semantics: any allowed branch wins.
  if (verdicts.some((v) => v === 'allowed')) return 'allowed';
  if (verdicts.every((v) => v === 'forbidden')) return 'forbidden';
  if (verdicts.some((v) => v === 'needs-adr')) return 'needs-adr';
  if (verdicts.some((v) => v === 'forbidden')) return 'forbidden';
  return 'unknown';
}

function isWorkspacePkg(name: string): boolean {
  return name === 'stageflip' || name.startsWith('@stageflip/');
}

function runPnpmLicenses(): Record<string, PackageEntry[]> {
  const result = spawnSync('pnpm', ['licenses', 'list', '--json'], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`pnpm licenses list exited ${result.status}`);
  }
  const parsed = JSON.parse(result.stdout) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('pnpm licenses list returned non-object JSON');
  }
  return parsed as Record<string, PackageEntry[]>;
}

function main(): void {
  const grouped = runPnpmLicenses();

  const forbidden: Array<[string, string]> = [];
  const needsAdr: Array<[string, string]> = [];
  const unknown: Array<[string, string]> = [];
  let checked = 0;

  for (const [licenseKey, entries] of Object.entries(grouped)) {
    const verdict = classify(licenseKey);
    for (const entry of entries) {
      if (isWorkspacePkg(entry.name)) continue;
      checked += 1;
      const version = entry.versions?.[0] ?? '?';
      const id = `${entry.name}@${version}`;
      // A reviewed-OK entry overrides the classifier's verdict for this package.
      if (REVIEWED_OK.has(entry.name)) continue;
      if (verdict === 'forbidden') forbidden.push([id, licenseKey]);
      else if (verdict === 'needs-adr') needsAdr.push([id, licenseKey]);
      else if (verdict === 'unknown') unknown.push([id, licenseKey]);
    }
  }

  const exitCode =
    forbidden.length > 0 || unknown.length > 0 || needsAdr.length > 0 ? 1 : 0;

  process.stdout.write(`check-licenses: ${checked} external deps inspected\n`);

  if (forbidden.length > 0) {
    process.stderr.write(`\n  FORBIDDEN (${forbidden.length}):\n`);
    for (const [id, lic] of forbidden) process.stderr.write(`    ${id}  ->  ${lic}\n`);
  }
  if (needsAdr.length > 0) {
    process.stderr.write(`\n  NEEDS-ADR (${needsAdr.length}):\n`);
    for (const [id, lic] of needsAdr) process.stderr.write(`    ${id}  ->  ${lic}\n`);
    process.stderr.write(
      '  -> file an ADR permitting dynamic-link LGPL, or remove the dep.\n',
    );
  }
  if (unknown.length > 0) {
    process.stderr.write(`\n  UNKNOWN (${unknown.length}):\n`);
    for (const [id, lic] of unknown) process.stderr.write(`    ${id}  ->  ${lic}\n`);
    process.stderr.write(
      '  -> unknown/UNLICENSED third-party license. Whitelist with review, or remove.\n',
    );
  }

  if (exitCode === 0) process.stdout.write('check-licenses: PASS\n');
  else process.stderr.write('\ncheck-licenses: FAIL\n');

  process.exit(exitCode);
}

try {
  main();
} catch (err) {
  process.stderr.write(`check-licenses: crashed: ${String(err)}\n`);
  process.exit(2);
}
