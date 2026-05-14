// scripts/check-feature-flag-wiring.ts
// T-402 — End-to-end coherence gate for the `features.interactive` 3-state
// toggle (`'disabled' | 'preview' | 'ga'`). Verifies that the seven layers
// of the composition shipped via T-411a..e (storage / HTTP route /
// authorization / runtime cache / browser host / admin UI) all agree on
// the canonical enum and that no out-of-band string literals have drifted
// across the source tree.
//
// Why a coherence gate and not a typecheck? The four layers are reachable
// only via separate type boundaries (Zod parse, Hono zValidator, function
// args, server-action FormData). A typecheck pass does not catch a stray
// literal that bypasses the type system at the parse boundary. This
// script is the cross-layer-string-equality safety net.
//
// Seven invariants:
//   1. schema-layer         — `packages/storage/src/tenant-settings.ts`
//                             must export `z.enum(['disabled', 'preview',
//                             'ga'])` for `features.interactive`.
//   2. http-route           — `apps/api/src/routes/tenant-settings.ts`
//                             must use the same enum.
//   3. authorization        — `apps/api/src/auth/can-set-interactive.ts`
//                             must accept exactly the same three values.
//   4. runtime-cache        — `packages/runtimes/interactive/src/host/
//                             tenant-flag-cache.ts` must accept those
//                             three values + map each to a matrix entry.
//   5. browser-host         — `packages/runtimes/interactive/src/host/
//                             browser-live-preview.tsx` must distinguish
//                             all three cases (via the matrix import).
//   6. admin-ui             — `apps/stageflip-slide/src/app/admin/tenant-
//                             settings/{page.tsx,update-action.ts}` must
//                             offer the same three enum values.
//   7. cross-layer-drift    — any other source-tree occurrence of the
//                             literal triple is flagged unless inline-
//                             allowlisted.
//
// Output shape mirrors `check-skill-drift.ts`: one PASS/FAIL line per
// invariant + a trailing summary. Exit 0 on PASS, 1 on FAIL.
//
// Pure Node script. No new deps; built-in `node:fs` + substring matching.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- canonical values ----------

/**
 * The canonical enum values. Source-of-truth lives at
 * `packages/storage/src/tenant-settings.ts`; this script verifies every
 * other layer agrees.
 */
export const CANONICAL_VALUES = ['disabled', 'preview', 'ga'] as const;
export type CanonicalValue = (typeof CANONICAL_VALUES)[number];

// ---------- file pointers (relative to workspace root) ----------

export const SCHEMA_FILE = 'packages/storage/src/tenant-settings.ts';
export const HTTP_ROUTE_FILE = 'apps/api/src/routes/tenant-settings.ts';
export const AUTH_FILE = 'apps/api/src/auth/can-set-interactive.ts';
export const RUNTIME_CACHE_FILE = 'packages/runtimes/interactive/src/host/tenant-flag-cache.ts';
export const BROWSER_HOST_FILE = 'packages/runtimes/interactive/src/host/browser-live-preview.tsx';
export const ADMIN_UI_PAGE_FILE = 'apps/stageflip-slide/src/app/admin/tenant-settings/page.tsx';
export const ADMIN_UI_ACTION_FILE =
  'apps/stageflip-slide/src/app/admin/tenant-settings/update-action.ts';

/**
 * Files that the seven layer-specific invariants own. The cross-layer
 * drift scan excludes these (any string-literal triple here is owned by
 * its respective invariant). The gate's own source + its test file are
 * also excluded — they necessarily contain the canonical triple as
 * verification target.
 */
export const LAYER_FILES: ReadonlyArray<string> = [
  SCHEMA_FILE,
  HTTP_ROUTE_FILE,
  AUTH_FILE,
  RUNTIME_CACHE_FILE,
  BROWSER_HOST_FILE,
  ADMIN_UI_PAGE_FILE,
  ADMIN_UI_ACTION_FILE,
  'scripts/check-feature-flag-wiring.ts',
  'scripts/check-feature-flag-wiring.test.ts',
];

/**
 * Cross-layer-drift allowlist. Each entry is a workspace-relative path
 * whose literal triple is known-safe (test fixtures that legitimately
 * mirror the enum, sibling test files, the CLI command that mirrors the
 * HTTP route's enum, etc.). The allowlist is INTENTIONALLY narrow:
 * adding to it should require a comment justifying why the occurrence
 * is not a drift hazard.
 */
export const KNOWN_SAFE_OCCURRENCES: ReadonlyArray<{
  path: string;
  reason: string;
}> = [
  {
    path: 'packages/storage/src/tenant-settings.test.ts',
    reason: 'Test fixture for the schema layer; tests parse each value.',
  },
  {
    path: 'packages/runtimes/interactive/src/host/tenant-flag-cache.test.ts',
    reason: 'Test fixture for the runtime cache; tests every value.',
  },
  {
    path: 'apps/api/src/auth/can-set-interactive.test.ts',
    reason: 'Test fixture for the authorization predicate.',
  },
  {
    path: 'apps/cli/src/commands/tenant.ts',
    reason:
      'CLI wrapper for the HTTP route; deliberately mirrors the enum so --value validation happens client-side before the network round-trip.',
  },
  {
    path: 'apps/docs/src/content/docs/skills/stageflip/concepts/tenant-settings.md',
    reason: 'Auto-synced skill doc copy (scripts/sync-skills.ts).',
  },
];

// ---------- types ----------

export type Severity = 'error' | 'warn';

export interface InvariantIssue {
  readonly severity: Severity;
  readonly file?: string;
  readonly message: string;
}

export interface InvariantResult {
  readonly name: string;
  readonly issues: ReadonlyArray<InvariantIssue>;
  /** Optional extra context for the PASS-line annotation. */
  readonly annotation?: string;
}

export interface WiringReport {
  readonly results: ReadonlyArray<InvariantResult>;
  readonly exitCode: 0 | 1;
}

// ---------- helpers ----------

const ENUM_LITERAL_PATTERN = /['"]disabled['"]\s*,\s*['"]preview['"]\s*,\s*['"]ga['"]/;
const UNION_LITERAL_PATTERN = /['"]disabled['"]\s*\|\s*['"]preview['"]\s*\|\s*['"]ga['"]/;

/**
 * Match either the enum-array form (`'disabled', 'preview', 'ga'`) or the
 * type-union form (`'disabled' | 'preview' | 'ga'`). Both encode the same
 * canonical triple at different syntactic positions.
 */
export function containsCanonicalTriple(source: string): boolean {
  return ENUM_LITERAL_PATTERN.test(source) || UNION_LITERAL_PATTERN.test(source);
}

interface ReadFileResult {
  readonly content?: string;
  readonly missing?: true;
}

function safeReadFile(absPath: string): ReadFileResult {
  try {
    return { content: readFileSync(absPath, 'utf8') };
  } catch {
    return { missing: true };
  }
}

/**
 * Verify that a file contains the canonical triple; on absence, emit a
 * specific failure message.
 */
function expectCanonicalTriple(
  fileRel: string,
  rootDir: string,
  layerName: string,
): InvariantIssue | undefined {
  const abs = join(rootDir, fileRel);
  const res = safeReadFile(abs);
  if (res.missing === true) {
    return {
      severity: 'error',
      file: fileRel,
      message: `expected file not found at ${fileRel}; cannot verify ${layerName}`,
    };
  }
  if (!containsCanonicalTriple(res.content ?? '')) {
    return {
      severity: 'error',
      file: fileRel,
      message: `expected canonical enum 'disabled' | 'preview' | 'ga' at ${fileRel}; not found`,
    };
  }
  return undefined;
}

/**
 * Returns true iff `source` contains at least one substring match for each
 * of the three canonical values, looking inside string-literal contexts
 * (single-quoted forms). Used by layer checks that don't require the
 * tighter `'disabled', 'preview', 'ga'` order — e.g. matrix table rows.
 */
export function containsAllValuesAsLiterals(source: string): {
  readonly ok: boolean;
  readonly missing: ReadonlyArray<CanonicalValue>;
} {
  const missing: CanonicalValue[] = [];
  for (const v of CANONICAL_VALUES) {
    if (!source.includes(`'${v}'`)) {
      missing.push(v);
    }
  }
  return { ok: missing.length === 0, missing };
}

// ---------- invariants ----------

export function schemaLayerCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const issue = expectCanonicalTriple(SCHEMA_FILE, rootDir, 'schema layer');
  if (issue) {
    issues.push(issue);
    return { name: 'schema-layer', issues };
  }
  // Also verify the schema file mentions z.enum (this is the
  // load-bearing Zod construct that produces the runtime validator).
  const src = readFileSync(join(rootDir, SCHEMA_FILE), 'utf8');
  if (!/z\.enum\s*\(/.test(src)) {
    issues.push({
      severity: 'error',
      file: SCHEMA_FILE,
      message: `expected z.enum(...) declaration in schema source; not found`,
    });
  }
  return { name: 'schema-layer', issues };
}

export function httpRouteCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const issue = expectCanonicalTriple(HTTP_ROUTE_FILE, rootDir, 'http route');
  if (issue) issues.push(issue);
  return { name: 'http-route', issues };
}

export function authorizationCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const abs = join(rootDir, AUTH_FILE);
  const res = safeReadFile(abs);
  if (res.missing === true) {
    issues.push({
      severity: 'error',
      file: AUTH_FILE,
      message: `expected file not found at ${AUTH_FILE}; cannot verify authorization layer`,
    });
    return { name: 'authorization', issues };
  }
  const content = res.content ?? '';
  // The auth predicate must declare the canonical triple either as type
  // union or as enum.
  if (!containsCanonicalTriple(content)) {
    issues.push({
      severity: 'error',
      file: AUTH_FILE,
      message: `expected canonical type 'disabled' | 'preview' | 'ga' at ${AUTH_FILE}; not found`,
    });
  }
  // Verify each canonical value appears at least once as a literal —
  // ensures the predicate has explicit branches for `'ga'`,
  // `'preview'`, and `'disabled'`. (The actual decision-matrix logic is
  // unit-tested by `can-set-interactive.test.ts`; this is the
  // cross-layer-literal sanity check.)
  const all = containsAllValuesAsLiterals(content);
  if (!all.ok) {
    issues.push({
      severity: 'error',
      file: AUTH_FILE,
      message: `authorization layer missing explicit literal branches for: ${all.missing.join(', ')}`,
    });
  }
  return { name: 'authorization', issues };
}

export function runtimeCacheCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const abs = join(rootDir, RUNTIME_CACHE_FILE);
  const res = safeReadFile(abs);
  if (res.missing === true) {
    issues.push({
      severity: 'error',
      file: RUNTIME_CACHE_FILE,
      message: `expected file not found at ${RUNTIME_CACHE_FILE}; cannot verify runtime cache layer`,
    });
    return { name: 'runtime-cache', issues };
  }
  const content = res.content ?? '';
  if (!containsCanonicalTriple(content)) {
    issues.push({
      severity: 'error',
      file: RUNTIME_CACHE_FILE,
      message: `expected canonical type 'disabled' | 'preview' | 'ga' at ${RUNTIME_CACHE_FILE}; not found`,
    });
  }
  // Runtime cache must define an explicit matrix entry per value:
  // `disabled:` / `preview:` / `ga:` keys on `TENANT_FLAG_GATING_MATRIX`.
  for (const v of CANONICAL_VALUES) {
    const keyPattern = new RegExp(`\\b${v}\\s*:\\s*\\{`);
    if (!keyPattern.test(content)) {
      issues.push({
        severity: 'error',
        file: RUNTIME_CACHE_FILE,
        message: `runtime cache missing matrix entry for '${v}' (expected '${v}: { ... }' shape)`,
      });
    }
  }
  return { name: 'runtime-cache', issues };
}

export function browserHostCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const abs = join(rootDir, BROWSER_HOST_FILE);
  const res = safeReadFile(abs);
  if (res.missing === true) {
    issues.push({
      severity: 'error',
      file: BROWSER_HOST_FILE,
      message: `expected file not found at ${BROWSER_HOST_FILE}; cannot verify browser host layer`,
    });
    return { name: 'browser-host', issues };
  }
  const content = res.content ?? '';
  // Browser host imports `TENANT_FLAG_GATING_MATRIX` + `TenantFlagValue`
  // and indexes the matrix at runtime — that's the cross-value-distinction
  // we want to verify. Direct grep on the import + the matrix index.
  if (!content.includes('TENANT_FLAG_GATING_MATRIX')) {
    issues.push({
      severity: 'error',
      file: BROWSER_HOST_FILE,
      message: `browser host must import TENANT_FLAG_GATING_MATRIX to honour all 3 enum values`,
    });
  }
  if (!/featuresInteractive/.test(content)) {
    issues.push({
      severity: 'error',
      file: BROWSER_HOST_FILE,
      message: `browser host must reference 'featuresInteractive' (the tenant-policy field)`,
    });
  }
  return { name: 'browser-host', issues };
}

export function adminUiCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  for (const fileRel of [ADMIN_UI_PAGE_FILE, ADMIN_UI_ACTION_FILE]) {
    const abs = join(rootDir, fileRel);
    const res = safeReadFile(abs);
    if (res.missing === true) {
      issues.push({
        severity: 'error',
        file: fileRel,
        message: `expected file not found at ${fileRel}; cannot verify admin UI layer`,
      });
      continue;
    }
    const content = res.content ?? '';
    if (!containsCanonicalTriple(content)) {
      issues.push({
        severity: 'error',
        file: fileRel,
        message: `expected canonical enum 'disabled' | 'preview' | 'ga' at ${fileRel}; not found`,
      });
    }
    const all = containsAllValuesAsLiterals(content);
    if (!all.ok) {
      issues.push({
        severity: 'error',
        file: fileRel,
        message: `admin UI missing literal value(s): ${all.missing.join(', ')}`,
      });
    }
  }
  return { name: 'admin-ui', issues };
}

/**
 * Walk the source tree (packages/, apps/, scripts/) for occurrences of
 * the canonical triple. Files in `LAYER_FILES` are excluded (owned by
 * specific invariants); files matching `KNOWN_SAFE_OCCURRENCES` are
 * counted but not flagged. Any other occurrence is a drift candidate.
 */
export function crossLayerDriftCheck(rootDir: string): InvariantResult {
  const issues: InvariantIssue[] = [];
  const layerSet = new Set(LAYER_FILES);
  const allowSet = new Set(KNOWN_SAFE_OCCURRENCES.map((e) => e.path));
  const scanRoots: ReadonlyArray<string> = ['packages', 'apps', 'scripts'];

  let allowlistedHits = 0;
  for (const r of scanRoots) {
    walkDir(join(rootDir, r), (absPath) => {
      const rel = relative(rootDir, absPath).split('\\').join('/');
      if (layerSet.has(rel)) return; // owned by layer invariants
      if (!isScanCandidate(rel)) return;
      const src = safeReadFile(absPath).content;
      if (src === undefined) return;
      if (!containsCanonicalTriple(src)) return;
      if (allowSet.has(rel)) {
        allowlistedHits += 1;
        return;
      }
      issues.push({
        severity: 'error',
        file: rel,
        message: `unexpected canonical triple ['disabled', 'preview', 'ga'] occurrence; either own it via a layer invariant or add to KNOWN_SAFE_OCCURRENCES with justification`,
      });
    });
  }
  return {
    name: 'cross-layer-drift',
    issues,
    annotation: `${allowlistedHits} known-safe occurrence${allowlistedHits === 1 ? '' : 's'} allowlisted`,
  };
}

/**
 * Recursively walk `dir`, invoking `onFile` for each regular file under
 * the tree. Skips `node_modules`, `dist`, `coverage`, `.turbo`, `.next`,
 * `.git` — directories whose contents are build artefacts not source.
 */
function walkDir(dir: string, onFile: (abs: string) => void): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === 'coverage' ||
      name === '.turbo' ||
      name === '.next' ||
      name === '.git' ||
      name === '.changeset'
    ) {
      continue;
    }
    const abs = join(dir, name);
    let isDir = false;
    let isFile = false;
    if (entry.isDirectory()) isDir = true;
    else if (entry.isFile()) isFile = true;
    else {
      // Symlink or unknown — stat to disambiguate.
      try {
        const st = statSync(abs);
        if (st.isDirectory()) isDir = true;
        else if (st.isFile()) isFile = true;
      } catch {
        continue;
      }
    }
    if (isDir) {
      walkDir(abs, onFile);
    } else if (isFile) {
      onFile(abs);
    }
  }
}

function isScanCandidate(rel: string): boolean {
  // Restrict scan to TS / TSX / JS / MJS source files. Markdown / JSON
  // / YAML drift is not the concern of this gate; the skill-drift gate
  // owns doc consistency.
  return (
    rel.endsWith('.ts') ||
    rel.endsWith('.tsx') ||
    rel.endsWith('.mjs') ||
    rel.endsWith('.cjs') ||
    rel.endsWith('.js') ||
    rel.endsWith('.jsx')
  );
}

// ---------- aggregator + formatter ----------

export interface RunOpts {
  /** Workspace root to scan; defaults to repo root resolved from this file. */
  rootDir?: string;
}

export function runChecks(opts: RunOpts = {}): WiringReport {
  const rootDir = opts.rootDir ?? resolveDefaultRoot();
  const results: InvariantResult[] = [
    schemaLayerCheck(rootDir),
    httpRouteCheck(rootDir),
    authorizationCheck(rootDir),
    runtimeCacheCheck(rootDir),
    browserHostCheck(rootDir),
    adminUiCheck(rootDir),
    crossLayerDriftCheck(rootDir),
  ];
  const totalErrors = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'error').length,
    0,
  );
  return { results, exitCode: totalErrors > 0 ? 1 : 0 };
}

function resolveDefaultRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  return resolve(dirname(__filename), '..');
}

export function formatReport(report: WiringReport): {
  readonly stdout: string;
  readonly stderr: string;
} {
  let stdout = '';
  let stderr = '';
  let totalErrors = 0;

  for (const r of report.results) {
    const errors = r.issues.filter((i) => i.severity === 'error');
    if (errors.length === 0) {
      stdout += `check-feature-flag-wiring [${r.name}]: PASS`;
      if (r.annotation !== undefined) {
        stdout += ` (${r.annotation})`;
      }
      stdout += '\n';
      continue;
    }
    stdout += `check-feature-flag-wiring [${r.name}]: FAIL (${errors.length} error${errors.length === 1 ? '' : 's'})\n`;
    for (const issue of errors) {
      const where = issue.file !== undefined ? `${issue.file}: ` : '';
      stderr += `  ERROR: ${where}${issue.message}\n`;
    }
    totalErrors += errors.length;
  }

  if (totalErrors > 0) {
    stderr += `\ncheck-feature-flag-wiring: FAIL (${totalErrors} error${totalErrors === 1 ? '' : 's'})\n`;
  } else {
    stdout += '\ncheck-feature-flag-wiring: PASS\n';
  }
  return { stdout, stderr };
}

// ---------- CLI entry ----------

/* v8 ignore start */
function main(): void {
  const report = runChecks();
  const { stdout, stderr } = formatReport(report);
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);
  process.exit(report.exitCode);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-feature-flag-wiring.ts')
) {
  try {
    main();
  } catch (err: unknown) {
    process.stderr.write(`check-feature-flag-wiring: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  }
}
/* v8 ignore stop */
