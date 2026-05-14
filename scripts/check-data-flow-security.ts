// scripts/check-data-flow-security.ts
// CI gate (T-446 + R-17): every reference adapter ships a sidecar
// `security.json` matching `SecurityManifest`, AND the manifest is
// internally consistent with the adapter's `AdapterDescriptor.sandbox.kind`.
// R-17 closure (2026-05-15): the gate ALSO discovers + validates the
// 5 Phase 13 frontier-clip provider seams (voice / ai-chat / live-data
// / web-embed / ai-generative); these have no `AdapterDescriptor` so
// the descriptor-consistency step is skipped for them.
//
// Mirrors `scripts/check-asset-licenses.ts` in shape: discover
// candidates → extract → validate → report → exit.
//
// **Failure modes** (per docs/tasks/T-446.md §"Failure modes the gate
// catches"):
//   1. MISSING        — adapter package exists but no `security.json`.
//   2. PARSE-ERROR    — file present but not valid JSON.
//   3. INVALID        — JSON valid but rejected by Zod (missing field,
//                       wrong type, unknown key).
//   4. INCONSISTENT   — manifest disagrees with the descriptor.
//   5. ORPHAN         — `security.json` present but no descriptor.
//
// Frontier-clip seams reuse failure modes 1–3; ORPHAN + INCONSISTENT
// are not applicable (no descriptor).
//
// Determinism: pure script. Output is a deterministic function of
// workspace state. No `Date.now()`, `Math.random()`, `fetch()`.
// CLAUDE.md §3 scopes the determinism rules to clip/runtime code;
// scripts/ at the repo root are out of scope (same posture as
// `check-asset-licenses.ts`).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseAdapterDescriptor,
  parseSecurityManifest,
} from '../packages/adapters-core/src/index.js';
import type { AdapterDescriptor, SecurityManifest } from '../packages/adapters-core/src/index.js';

// ---------------------------------------------------------------------------
// Adapter package discovery convention (shared with check-asset-licenses)
// ---------------------------------------------------------------------------

const ADAPTER_PACKAGE_PREFIXES: ReadonlyArray<string> = [
  'tts-',
  'video-',
  'music-',
  'sfx-',
  '3d-',
  'slide-deck-',
  'mind-map-',
  'table-gen-',
  'quiz-',
  'flashcard-',
  'report-gen-',
  'infographic-',
  'research-session-',
  'audience-',
  'bundle-',
];

/**
 * Test whether a package name matches the adapter naming convention.
 * Third-party packages (no `@stageflip/` scope) are rejected.
 */
export function isAdapterPackageName(name: string): boolean {
  const SCOPE = '@stageflip/';
  if (!name.startsWith(SCOPE)) return false;
  const unscoped = name.slice(SCOPE.length);
  return ADAPTER_PACKAGE_PREFIXES.some((prefix) => unscoped.startsWith(prefix));
}

interface DiscoveredAdapterPackage {
  readonly name: string;
  readonly dir: string;
}

/**
 * Walk `packages/` for adapter-conforming `package.json` entries.
 * Returns alphabetically-ordered candidates (deterministic).
 */
export function discoverAdapterPackages(packagesRoot: string): DiscoveredAdapterPackage[] {
  const out: DiscoveredAdapterPackage[] = [];
  let entries: string[];
  try {
    entries = readdirSync(packagesRoot);
  } catch {
    return out;
  }
  entries.sort();
  for (const entry of entries) {
    const dir = join(packagesRoot, entry);
    let isDir: boolean;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    const pkgJsonPath = join(dir, 'package.json');
    let raw: string;
    try {
      raw = readFileSync(pkgJsonPath, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    const name = (parsed as { name?: unknown }).name;
    if (typeof name !== 'string') continue;
    if (!isAdapterPackageName(name)) continue;
    out.push({ name, dir });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Manifest + descriptor extraction
// ---------------------------------------------------------------------------

interface ExtractionResult {
  readonly manifest: SecurityManifest | undefined;
  readonly descriptors: ReadonlyArray<AdapterDescriptor>;
  readonly errors: ReadonlyArray<PerPackageError>;
}

interface PerPackageError {
  readonly source: string;
  readonly kind: 'MISSING' | 'PARSE-ERROR' | 'INVALID' | 'ORPHAN' | 'DESCRIPTOR-LOAD-FAILED';
  readonly cause: string;
}

/**
 * Load `security.json` (if any) and the descriptor(s) from `src/index.ts`.
 * Each step is independently captured; downstream consistency check
 * runs only when BOTH manifest and at least one descriptor parsed.
 */
export async function extractFromPackage(pkg: DiscoveredAdapterPackage): Promise<ExtractionResult> {
  const errors: PerPackageError[] = [];

  // --- security.json --------------------------------------------------------
  const manifestPath = join(pkg.dir, 'security.json');
  let manifest: SecurityManifest | undefined;
  let manifestPresent = false;
  let raw: string | undefined;
  try {
    raw = readFileSync(manifestPath, 'utf8');
    manifestPresent = true;
  } catch {
    // file absent — captured below once we know whether the package
    // has any descriptors.
  }
  if (manifestPresent && raw !== undefined) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      errors.push({
        source: pkg.name,
        kind: 'PARSE-ERROR',
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    if (json !== undefined) {
      try {
        manifest = parseSecurityManifest(json);
      } catch (err) {
        errors.push({
          source: pkg.name,
          kind: 'INVALID',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // --- descriptors via dynamic import --------------------------------------
  const indexPath = join(pkg.dir, 'src', 'index.ts');
  let mod: Record<string, unknown> | undefined;
  try {
    mod = (await import(indexPath)) as Record<string, unknown>;
  } catch (err) {
    errors.push({
      source: pkg.name,
      kind: 'DESCRIPTOR-LOAD-FAILED',
      cause: `dynamic-import failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const descriptors: AdapterDescriptor[] = [];
  if (mod !== undefined) {
    const candidates: unknown[] = [];
    if ('descriptor' in mod && mod.descriptor !== undefined) {
      candidates.push(mod.descriptor);
    }
    if ('descriptors' in mod && Array.isArray(mod.descriptors)) {
      for (const d of mod.descriptors as unknown[]) candidates.push(d);
    }
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        descriptors.push(parseAdapterDescriptor(candidates[i]));
      } catch (err) {
        errors.push({
          source: `${pkg.name} [descriptor #${i}]`,
          kind: 'INVALID',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // --- now classify manifest-vs-descriptor presence ------------------------
  if (!manifestPresent && descriptors.length > 0) {
    errors.push({
      source: pkg.name,
      kind: 'MISSING',
      cause: `expected ${manifestPath} — no security.json found`,
    });
  } else if (manifestPresent && descriptors.length === 0 && errors.length === 0) {
    // No descriptor (and no other parse errors) — manifest is orphaned.
    errors.push({
      source: pkg.name,
      kind: 'ORPHAN',
      cause: 'security.json present but package exports no descriptor',
    });
  }

  return { manifest, descriptors, errors };
}

// ---------------------------------------------------------------------------
// Frontier-clip seam discovery (R-17)
// ---------------------------------------------------------------------------

/**
 * Phase 13 frontier-clip families that ship a sidecar `security.json`
 * next to the clip source. Per `docs/security-review-track-a.md` §5
 * R-17 (closed 2026-05-15), each of these clip families has a
 * host-injected provider seam (or, for web-embed, an iframe seam) that
 * crosses the StageFlip trust boundary. Each ships its own manifest at
 * `packages/runtimes/interactive/src/clips/<family>/security.json`.
 *
 * Discovery here is by-family-name, not by-package-prefix: the seams
 * live INSIDE `@stageflip/runtimes-interactive`, so the
 * `ADAPTER_PACKAGE_PREFIXES` convention doesn't apply.
 */
export const FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST: ReadonlyArray<string> = [
  'voice',
  'ai-chat',
  'live-data',
  'web-embed',
  'ai-generative',
];

interface DiscoveredFrontierClipSeam {
  /** The clip-family name (matches the directory under clips/). */
  readonly family: string;
  /** Tag used in error / row output to distinguish from adapter sources. */
  readonly tag: string;
  /** Absolute path to the clip family directory. */
  readonly dir: string;
}

/**
 * Walk `packages/runtimes/interactive/src/clips/` for the configured
 * frontier-clip family directories. Returns alphabetically-ordered
 * candidates (deterministic). Missing directories are silently skipped
 * (caller logs none-found state).
 */
export function discoverFrontierClipSeams(
  interactiveClipsRoot: string,
): DiscoveredFrontierClipSeam[] {
  const out: DiscoveredFrontierClipSeam[] = [];
  const sortedFamilies = [...FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST].sort();
  for (const family of sortedFamilies) {
    const dir = join(interactiveClipsRoot, family);
    let isDir: boolean;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    out.push({ family, tag: `frontier-clip:${family}`, dir });
  }
  return out;
}

interface FrontierClipExtractionResult {
  readonly manifest: SecurityManifest | undefined;
  readonly errors: ReadonlyArray<PerPackageError>;
}

/**
 * Load `security.json` for a single frontier-clip family. Failure modes
 * mirror `extractFromPackage` (MISSING / PARSE-ERROR / INVALID); ORPHAN
 * and DESCRIPTOR-LOAD-FAILED are inapplicable because frontier-clip
 * seams have no `AdapterDescriptor`.
 *
 * Pure I/O: no descriptor consistency check is run.
 */
export function extractFromFrontierClipSeam(
  seam: DiscoveredFrontierClipSeam,
): FrontierClipExtractionResult {
  const errors: PerPackageError[] = [];
  const manifestPath = join(seam.dir, 'security.json');

  let raw: string | undefined;
  let manifestPresent = false;
  try {
    raw = readFileSync(manifestPath, 'utf8');
    manifestPresent = true;
  } catch {
    // file absent — captured below.
  }

  let manifest: SecurityManifest | undefined;
  if (manifestPresent && raw !== undefined) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      errors.push({
        source: seam.tag,
        kind: 'PARSE-ERROR',
        cause: err instanceof Error ? err.message : String(err),
      });
    }
    if (json !== undefined) {
      try {
        manifest = parseSecurityManifest(json);
      } catch (err) {
        errors.push({
          source: seam.tag,
          kind: 'INVALID',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    errors.push({
      source: seam.tag,
      kind: 'MISSING',
      cause: `expected ${manifestPath} — no security.json found`,
    });
  }

  return { manifest, errors };
}

// ---------------------------------------------------------------------------
// Consistency check (pure)
// ---------------------------------------------------------------------------

export interface ConsistencyIssue {
  readonly source: string;
  readonly cause: string;
}

/**
 * Validate that the manifest's perimeter classification is consistent
 * with the adapter's declared `sandbox.kind`, AND that the manifest's
 * `adapterId` matches `descriptor.id`. Pure function; tested directly.
 *
 * Rules:
 *   - `descriptor.sandbox.kind === 'in-process'` →
 *       `manifest.perimeter === 'in-process'`
 *       AND `dataLeavingPerimeter.{prompt, inputBytes, tenantId, cacheKey}`
 *           all false (in-process implies nothing exits).
 *       AND `networkEndpoint` absent.
 *   - `descriptor.sandbox.kind === 'sidecar'` →
 *       `manifest.perimeter === 'sidecar-local'`
 *       AND `networkEndpoint` absent.
 *   - `descriptor.sandbox.kind === 'remote-service'` →
 *       `manifest.perimeter === 'remote-network'`
 *       AND `networkEndpoint` present.
 *   - `descriptor.sandbox.kind === 'wasm-sandbox'` →
 *       `manifest.perimeter === 'in-process'`  (WASM is process-local).
 */
export function checkManifestDescriptorConsistency(
  manifest: SecurityManifest,
  descriptor: AdapterDescriptor,
  packageName: string,
): ReadonlyArray<ConsistencyIssue> {
  const issues: ConsistencyIssue[] = [];
  const source = `${packageName} [${descriptor.id}]`;

  if (manifest.adapterId !== descriptor.id) {
    issues.push({
      source,
      cause: `manifest.adapterId=${manifest.adapterId} does not match descriptor.id=${descriptor.id}`,
    });
  }

  const sandboxKind = descriptor.sandbox.kind;
  switch (sandboxKind) {
    case 'in-process': {
      if (manifest.perimeter !== 'in-process') {
        issues.push({
          source,
          cause: `descriptor.sandbox.kind='in-process' requires manifest.perimeter='in-process' (got '${manifest.perimeter}')`,
        });
      }
      const { prompt, inputBytes, tenantId, cacheKey } = manifest.dataLeavingPerimeter;
      if (prompt || inputBytes || tenantId || cacheKey) {
        issues.push({
          source,
          cause:
            'in-process adapter must not declare any dataLeavingPerimeter flag (nothing exits the host process)',
        });
      }
      if (manifest.networkEndpoint !== undefined) {
        issues.push({
          source,
          cause: 'in-process adapter must not declare a networkEndpoint',
        });
      }
      break;
    }
    case 'sidecar': {
      if (manifest.perimeter !== 'sidecar-local') {
        issues.push({
          source,
          cause: `descriptor.sandbox.kind='sidecar' requires manifest.perimeter='sidecar-local' (got '${manifest.perimeter}')`,
        });
      }
      if (manifest.networkEndpoint !== undefined) {
        issues.push({
          source,
          cause:
            'sidecar adapter must not declare a networkEndpoint (local subprocess; no network exit)',
        });
      }
      break;
    }
    case 'remote-service': {
      if (manifest.perimeter !== 'remote-network') {
        issues.push({
          source,
          cause: `descriptor.sandbox.kind='remote-service' requires manifest.perimeter='remote-network' (got '${manifest.perimeter}')`,
        });
      }
      if (manifest.networkEndpoint === undefined) {
        issues.push({
          source,
          cause: 'remote-service adapter must declare a networkEndpoint',
        });
      }
      break;
    }
    case 'wasm-sandbox': {
      if (manifest.perimeter !== 'in-process') {
        issues.push({
          source,
          cause: `descriptor.sandbox.kind='wasm-sandbox' requires manifest.perimeter='in-process' (got '${manifest.perimeter}')`,
        });
      }
      if (manifest.networkEndpoint !== undefined) {
        issues.push({
          source,
          cause: 'wasm-sandbox adapter must not declare a networkEndpoint',
        });
      }
      break;
    }
    default: {
      const exhaustive: never = sandboxKind;
      issues.push({
        source,
        cause: `unknown sandbox.kind: ${String(exhaustive)}`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Validation aggregate
// ---------------------------------------------------------------------------

export interface PerAdapterRow {
  readonly packageName: string;
  readonly adapterId: string;
  readonly perimeter: string;
  readonly verdict: 'PASS' | 'FAIL';
}

export interface ValidationReport {
  readonly packagesInspected: number;
  /**
   * Number of frontier-clip seams (R-17) inspected. Reported alongside
   * `packagesInspected` in `formatReport` so adapter coverage and
   * frontier-clip coverage are independently visible.
   */
  readonly frontierClipSeamsInspected: number;
  readonly rows: ReadonlyArray<PerAdapterRow>;
  readonly errors: ReadonlyArray<PerPackageError>;
  readonly inconsistencies: ReadonlyArray<ConsistencyIssue>;
  readonly exitCode: 0 | 1;
}

// ---------------------------------------------------------------------------
// formatReport — stdout/stderr surface
// ---------------------------------------------------------------------------

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];

  if (
    report.packagesInspected === 0 &&
    report.frontierClipSeamsInspected === 0 &&
    report.errors.length === 0 &&
    report.inconsistencies.length === 0
  ) {
    lines.push('check-data-flow-security: 0 adapter packages discovered');
  } else {
    const noun = report.packagesInspected === 1 ? 'package' : 'packages';
    lines.push(`check-data-flow-security: ${report.packagesInspected} adapter ${noun} inspected`);
    const seamNoun = report.frontierClipSeamsInspected === 1 ? 'seam' : 'seams';
    lines.push(
      `check-data-flow-security: ${report.frontierClipSeamsInspected} frontier-clip ${seamNoun} inspected (R-17)`,
    );
  }

  if (report.rows.length > 0) {
    lines.push('');
    for (const row of report.rows) {
      lines.push(
        `  ${row.verdict}  ${row.adapterId.padEnd(20)}  perimeter=${row.perimeter}  (${row.packageName})`,
      );
    }
  }

  if (report.errors.length > 0) {
    lines.push('');
    lines.push(`  ERRORS (${report.errors.length}):`);
    for (const e of report.errors) {
      lines.push(`    [${e.kind}] ${e.source}`);
      lines.push(`      cause: ${e.cause}`);
    }
  }

  if (report.inconsistencies.length > 0) {
    lines.push('');
    lines.push(`  INCONSISTENT (${report.inconsistencies.length}):`);
    for (const i of report.inconsistencies) {
      lines.push(`    ${i.source}`);
      lines.push(`      cause: ${i.cause}`);
    }
  }

  lines.push('');
  lines.push(`check-data-flow-security: ${report.exitCode === 0 ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// validate — wire extracted state into a report
// ---------------------------------------------------------------------------

export function buildReport(
  packages: ReadonlyArray<DiscoveredAdapterPackage>,
  extractions: ReadonlyArray<ExtractionResult>,
  frontierClipSeams: ReadonlyArray<DiscoveredFrontierClipSeam> = [],
  frontierClipExtractions: ReadonlyArray<FrontierClipExtractionResult> = [],
): ValidationReport {
  const rows: PerAdapterRow[] = [];
  const errors: PerPackageError[] = [];
  const inconsistencies: ConsistencyIssue[] = [];

  for (let i = 0; i < packages.length; i += 1) {
    const pkg = packages[i];
    const ext = extractions[i];
    if (pkg === undefined || ext === undefined) continue;

    for (const e of ext.errors) errors.push(e);

    if (ext.manifest === undefined) {
      // Per-package error already recorded as MISSING / PARSE-ERROR /
      // INVALID; nothing to row. Still record a FAIL row for visibility
      // when descriptors loaded but manifest didn't.
      if (ext.descriptors.length > 0) {
        const first = ext.descriptors[0];
        if (first !== undefined) {
          rows.push({
            packageName: pkg.name,
            adapterId: first.id,
            perimeter: '(none)',
            verdict: 'FAIL',
          });
        }
      }
      continue;
    }

    if (ext.descriptors.length === 0) {
      // ORPHAN error recorded; emit a row for visibility.
      rows.push({
        packageName: pkg.name,
        adapterId: ext.manifest.adapterId,
        perimeter: ext.manifest.perimeter,
        verdict: 'FAIL',
      });
      continue;
    }

    let pkgPass = true;
    for (const descriptor of ext.descriptors) {
      const issues = checkManifestDescriptorConsistency(ext.manifest, descriptor, pkg.name);
      for (const issue of issues) inconsistencies.push(issue);
      if (issues.length > 0) pkgPass = false;
      rows.push({
        packageName: pkg.name,
        adapterId: descriptor.id,
        perimeter: ext.manifest.perimeter,
        verdict: issues.length === 0 ? 'PASS' : 'FAIL',
      });
    }
    void pkgPass;
  }

  // ---- frontier-clip seams (R-17) -----------------------------------------
  for (let i = 0; i < frontierClipSeams.length; i += 1) {
    const seam = frontierClipSeams[i];
    const ext = frontierClipExtractions[i];
    if (seam === undefined || ext === undefined) continue;

    for (const e of ext.errors) errors.push(e);

    if (ext.manifest === undefined) {
      // Per-seam error already recorded as MISSING / PARSE-ERROR /
      // INVALID; emit a FAIL row for visibility.
      rows.push({
        packageName: seam.tag,
        adapterId: `(frontier-clip-${seam.family})`,
        perimeter: '(none)',
        verdict: 'FAIL',
      });
      continue;
    }

    rows.push({
      packageName: seam.tag,
      adapterId: ext.manifest.adapterId,
      perimeter: ext.manifest.perimeter,
      verdict: 'PASS',
    });
  }

  const exitCode: 0 | 1 = errors.length === 0 && inconsistencies.length === 0 ? 0 : 1;

  return {
    packagesInspected: packages.length,
    frontierClipSeamsInspected: frontierClipSeams.length,
    rows,
    errors,
    inconsistencies,
    exitCode,
  };
}

// ---------------------------------------------------------------------------
// main — wire discovery → extraction → validation → output → exit
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const PACKAGES_ROOT_DEFAULT = resolve(REPO_ROOT, 'packages');
const INTERACTIVE_CLIPS_ROOT_DEFAULT = resolve(
  REPO_ROOT,
  'packages',
  'runtimes',
  'interactive',
  'src',
  'clips',
);

export async function main(
  packagesRoot: string = PACKAGES_ROOT_DEFAULT,
  interactiveClipsRoot: string = INTERACTIVE_CLIPS_ROOT_DEFAULT,
): Promise<number> {
  const packages = discoverAdapterPackages(packagesRoot);
  const extractions: ExtractionResult[] = [];
  for (const pkg of packages) {
    extractions.push(await extractFromPackage(pkg));
  }

  const frontierClipSeams = discoverFrontierClipSeams(interactiveClipsRoot);
  const frontierClipExtractions: FrontierClipExtractionResult[] = [];
  for (const seam of frontierClipSeams) {
    frontierClipExtractions.push(extractFromFrontierClipSeam(seam));
  }

  const report = buildReport(packages, extractions, frontierClipSeams, frontierClipExtractions);
  const out = formatReport(report);
  if (report.exitCode === 0) {
    process.stdout.write(`${out}\n`);
  } else {
    process.stderr.write(`${out}\n`);
  }
  return report.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      process.stderr.write(
        `check-data-flow-security: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    });
}
