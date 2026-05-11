// scripts/check-asset-licenses.ts
// CI gate (T-422, ADR-008 §D13, ADR-007 §D1/§D3): every adapter shipped
// from the workspace must declare a `license.kind` that is in the
// per-modality whitelist defined by ADR-008 §D13. Mirrors
// `scripts/check-licenses.ts` (the dep-license gate from ADR-001 §D4)
// in shape: discover candidates → parse → classify → report → exit.
//
// **Inaugural state**: no reference adapters exist on `main` until
// T-426..T-434 land. The discovery step yields zero candidates; the
// gate exits 0 with the message "0 adapters registered; whitelist not
// yet exercised". Documented expectation per docs/tasks/T-422.md.
//
// **Failure modes** (per docs/tasks/T-422.md §"Failure modes"):
//   1. `license.kind === 'gpl-incompatible'` — always FORBIDDEN per
//      ADR-007 §D3 + CLAUDE.md §3 invariant.
//   2. `license.kind` not in the per-modality whitelist for the
//      adapter's `modality.kind` — FORBIDDEN.
//   3. `license.kind === 'proprietary-vendored'` without an ADR
//      reference recorded in `PROPRIETARY_OK` — NEEDS-ADR (FAIL).
//   4. Package matches the adapter naming convention but exports
//      neither `descriptor` nor `descriptors` — MISSING-DESCRIPTOR.
//   5. `parseAdapterDescriptor` rejects the descriptor (Zod error) —
//      PARSE-ERROR.
//
// Determinism: pure script. Output is a deterministic function of
// the workspace state. No `Date.now()`, `Math.random()`, `fetch()`.
// CLAUDE.md §3 determinism rules scope to clip/runtime code; gates
// at scripts/ are explicitly out of scope (same posture as
// `check-licenses.ts` and `check-export-parity.ts`).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTER_MODALITY_KINDS,
  AdapterRegistry,
  parseAdapterDescriptor,
} from '../packages/adapters-core/src/index.js';
import type {
  AdapterDescriptor,
  AdapterLicenseKind,
  AdapterModalityKind,
} from '../packages/adapters-core/src/index.js';

// ---------------------------------------------------------------------------
// Per-modality license whitelist (ADR-008 §D13)
// ---------------------------------------------------------------------------

/**
 * Permissive default for source-grounded modalities (slide-deck-gen
 * through infographic-gen + research-session) and Phase 15/16 modalities
 * (audience-backend, bundle). Per ADR-008 §D13 lines 658 + this script's
 * conservative default for non-asset-gen modalities. Reused below to
 * avoid re-typing the same 4-element array.
 */
const SOURCE_GROUNDED_DEFAULT: ReadonlyArray<AdapterLicenseKind> = [
  'apache-2.0',
  'mit',
  'proprietary-byo',
  'proprietary-vendored',
];

/**
 * Per-modality license whitelist. Sourced verbatim from ADR-008 §D13
 * (`docs/decisions/ADR-008-asset-generation.md` lines 647–660).
 *
 * - `tts` (line 653): apache-2.0, mit, proprietary-byo, proprietary-vendored.
 * - `video-gen` (line 654): apache-2.0, mit, proprietary-byo, proprietary-vendored.
 * - `music-gen` (line 655): adds `cc-by` (attribution recorded in MediaProvenance per §D2).
 * - `sfx` (line 656): adds `cc-by`.
 * - `three-d` (line 657): apache-2.0, mit, proprietary-byo, proprietary-vendored.
 * - source-grounded modalities (line 658): apache-2.0, mit, proprietary-byo, proprietary-vendored.
 * - `research-session` / `audience-backend` / `bundle`: not enumerated in §D13
 *   directly; conservative permissive default (no `cc-by`, no `gpl-incompatible`).
 *
 * `gpl-incompatible` is **never** in any whitelist (CLAUDE.md §3 invariant).
 */
export const PER_MODALITY_LICENSE_WHITELIST: Readonly<
  Record<AdapterModalityKind, ReadonlyArray<AdapterLicenseKind>>
> = {
  // β asset-gen modalities (ADR-008 §D5):
  tts: ['apache-2.0', 'mit', 'proprietary-byo', 'proprietary-vendored'],
  'video-gen': ['apache-2.0', 'mit', 'proprietary-byo', 'proprietary-vendored'],
  'music-gen': ['apache-2.0', 'mit', 'cc-by', 'proprietary-byo', 'proprietary-vendored'],
  sfx: ['apache-2.0', 'mit', 'cc-by', 'proprietary-byo', 'proprietary-vendored'],
  'three-d': ['apache-2.0', 'mit', 'proprietary-byo', 'proprietary-vendored'],
  // Source-grounded modalities (ADR-008 §D9 / §D13 line 658):
  'slide-deck-gen': SOURCE_GROUNDED_DEFAULT,
  'mind-map-gen': SOURCE_GROUNDED_DEFAULT,
  'table-gen': SOURCE_GROUNDED_DEFAULT,
  'quiz-gen': SOURCE_GROUNDED_DEFAULT,
  'flashcard-gen': SOURCE_GROUNDED_DEFAULT,
  'report-gen': SOURCE_GROUNDED_DEFAULT,
  'infographic-gen': SOURCE_GROUNDED_DEFAULT,
  // Source-grounded session meta-provider (ADR-007 §D5):
  'research-session': SOURCE_GROUNDED_DEFAULT,
  // Phase 15:
  'audience-backend': SOURCE_GROUNDED_DEFAULT,
  // Phase 16 (marketplace bundles):
  bundle: SOURCE_GROUNDED_DEFAULT,
};

/**
 * Adapter ids (keyed by descriptor.id, with cleared-by-ADR comment) that
 * may declare `proprietary-vendored` license posture without triggering
 * NEEDS-ADR. Mirrors `REVIEWED_OK` in `scripts/check-licenses.ts`. Empty
 * on inaugural ship; populated as license-clearance ADRs are filed
 * during the T-426..T-434 reference-adapter sequence.
 *
 * Each entry must reference the cleared ADR + clearance date.
 */
export const PROPRIETARY_OK: ReadonlyMap<string, string> = new Map<string, string>([
  // No entries yet. Populated as proprietary-vendored adapters land
  // with their license-clearance ADRs.
]);

// ---------------------------------------------------------------------------
// Pure verdict helpers
// ---------------------------------------------------------------------------

/**
 * Per-adapter classification verdict.
 *
 * - `allowed`            — license is in the per-modality whitelist.
 * - `gpl-incompatible`   — license is `gpl-incompatible` (always denied).
 * - `not-in-whitelist`   — license is not in the modality's whitelist.
 * - `needs-adr`          — license is `proprietary-vendored` and adapter
 *                          id not on the `PROPRIETARY_OK` allowlist.
 */
export type AdapterLicenseVerdict =
  | 'allowed'
  | 'gpl-incompatible'
  | 'not-in-whitelist'
  | 'needs-adr';

/**
 * Classify a single (modality, license) pair against the per-modality
 * whitelist. Pure function. Does NOT consult the `PROPRIETARY_OK`
 * allowlist — that step lives in `validateRegistry` because it depends
 * on the adapter's `id`.
 */
export function classifyAdapterLicense(
  modality: AdapterModalityKind,
  license: AdapterLicenseKind,
): AdapterLicenseVerdict {
  if (license === 'gpl-incompatible') return 'gpl-incompatible';
  if (license === 'proprietary-vendored') return 'needs-adr';
  const whitelist = PER_MODALITY_LICENSE_WHITELIST[modality];
  if (whitelist.includes(license)) return 'allowed';
  return 'not-in-whitelist';
}

// ---------------------------------------------------------------------------
// validateRegistry — pure validation core
// ---------------------------------------------------------------------------

export interface ForbiddenEntry {
  readonly adapterId: string;
  readonly modality: AdapterModalityKind;
  readonly license: AdapterLicenseKind;
  readonly reason: 'gpl-incompatible' | 'not-in-whitelist';
  readonly permitted: ReadonlyArray<AdapterLicenseKind>;
}

export interface NeedsAdrEntry {
  readonly adapterId: string;
  readonly modality: AdapterModalityKind;
  readonly license: AdapterLicenseKind;
}

export interface UnknownModalityEntry {
  readonly adapterId: string;
  readonly modality: string;
}

export interface ValidationReport {
  readonly adaptersInspected: number;
  readonly forbidden: ReadonlyArray<ForbiddenEntry>;
  readonly needsAdr: ReadonlyArray<NeedsAdrEntry>;
  readonly unknownModality: ReadonlyArray<UnknownModalityEntry>;
  readonly missingDescriptor: ReadonlyArray<string>;
  readonly parseErrors: ReadonlyArray<{ readonly source: string; readonly cause: string }>;
  readonly exitCode: 0 | 1;
}

const ADAPTER_MODALITY_KIND_SET: ReadonlySet<string> = new Set(ADAPTER_MODALITY_KINDS);

/**
 * Validate every adapter in the registry against the per-modality
 * whitelist + the proprietary-vendored allowlist. Pure function — no
 * filesystem, no dynamic-import, no I/O. Tested directly by
 * `check-asset-licenses.test.ts`.
 *
 * `proprietaryAllowlist` defaults to `PROPRIETARY_OK`; tests may inject
 * a synthetic allowlist to exercise the cleared-vendored path.
 */
export function validateRegistry(
  registry: AdapterRegistry,
  proprietaryAllowlist: ReadonlyMap<string, string> = PROPRIETARY_OK,
  missingDescriptor: ReadonlyArray<string> = [],
  parseErrors: ReadonlyArray<{ readonly source: string; readonly cause: string }> = [],
): ValidationReport {
  const forbidden: ForbiddenEntry[] = [];
  const needsAdr: NeedsAdrEntry[] = [];
  const unknownModality: UnknownModalityEntry[] = [];
  const adapters = registry.list();

  for (const adapter of adapters) {
    const modalityKind = adapter.modality.kind;
    if (!ADAPTER_MODALITY_KIND_SET.has(modalityKind)) {
      unknownModality.push({ adapterId: adapter.id, modality: modalityKind });
      continue;
    }
    const license = adapter.license.kind;
    const verdict = classifyAdapterLicense(modalityKind, license);
    switch (verdict) {
      case 'allowed':
        break;
      case 'gpl-incompatible':
        forbidden.push({
          adapterId: adapter.id,
          modality: modalityKind,
          license,
          reason: 'gpl-incompatible',
          permitted: PER_MODALITY_LICENSE_WHITELIST[modalityKind],
        });
        break;
      case 'not-in-whitelist':
        forbidden.push({
          adapterId: adapter.id,
          modality: modalityKind,
          license,
          reason: 'not-in-whitelist',
          permitted: PER_MODALITY_LICENSE_WHITELIST[modalityKind],
        });
        break;
      case 'needs-adr':
        if (!proprietaryAllowlist.has(adapter.id)) {
          needsAdr.push({ adapterId: adapter.id, modality: modalityKind, license });
        }
        break;
    }
  }

  const exitCode: 0 | 1 =
    forbidden.length > 0 ||
    needsAdr.length > 0 ||
    unknownModality.length > 0 ||
    missingDescriptor.length > 0 ||
    parseErrors.length > 0
      ? 1
      : 0;

  return {
    adaptersInspected: adapters.length,
    forbidden,
    needsAdr,
    unknownModality,
    missingDescriptor,
    parseErrors,
    exitCode,
  };
}

// ---------------------------------------------------------------------------
// formatReport — stdout/stderr surface
// ---------------------------------------------------------------------------

export function formatReport(report: ValidationReport): string {
  const lines: string[] = [];

  if (
    report.adaptersInspected === 0 &&
    report.missingDescriptor.length === 0 &&
    report.parseErrors.length === 0
  ) {
    lines.push('check-asset-licenses: 0 adapters registered; whitelist not yet exercised');
  } else {
    const noun = report.adaptersInspected === 1 ? 'adapter' : 'adapters';
    lines.push(`check-asset-licenses: ${report.adaptersInspected} ${noun} inspected`);
  }

  if (report.forbidden.length > 0) {
    lines.push('');
    lines.push(`  FORBIDDEN (${report.forbidden.length}):`);
    for (const entry of report.forbidden) {
      lines.push(
        `    ${entry.adapterId}  [modality=${entry.modality}]  ->  ${entry.license}  (${entry.reason})`,
      );
      lines.push(`      permitted: ${entry.permitted.join(', ')}`);
    }
  }

  if (report.needsAdr.length > 0) {
    lines.push('');
    lines.push(`  NEEDS-ADR (${report.needsAdr.length}):`);
    for (const entry of report.needsAdr) {
      lines.push(`    ${entry.adapterId}  [modality=${entry.modality}]  ->  ${entry.license}`);
    }
    lines.push(
      '  -> proprietary-vendored adapters require a license-clearance ADR. File the ADR and add the adapter id to PROPRIETARY_OK.',
    );
  }

  if (report.unknownModality.length > 0) {
    lines.push('');
    lines.push(`  UNKNOWN-MODALITY (${report.unknownModality.length}):`);
    for (const entry of report.unknownModality) {
      lines.push(`    ${entry.adapterId}  ->  modality=${entry.modality}`);
    }
    lines.push(
      `  -> modality.kind not in ADAPTER_MODALITY_KINDS (${ADAPTER_MODALITY_KINDS.join(', ')}).`,
    );
  }

  if (report.missingDescriptor.length > 0) {
    lines.push('');
    lines.push(`  MISSING-DESCRIPTOR (${report.missingDescriptor.length}):`);
    for (const pkg of report.missingDescriptor) {
      lines.push(`    ${pkg}`);
    }
    lines.push(
      '  -> package matches the adapter naming convention but exports neither `descriptor` nor `descriptors`.',
    );
  }

  if (report.parseErrors.length > 0) {
    lines.push('');
    lines.push(`  PARSE-ERROR (${report.parseErrors.length}):`);
    for (const entry of report.parseErrors) {
      lines.push(`    ${entry.source}`);
      lines.push(`      cause: ${entry.cause}`);
    }
  }

  lines.push('');
  if (report.exitCode === 0) {
    lines.push('check-asset-licenses: PASS');
  } else {
    lines.push('check-asset-licenses: FAIL');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Adapter-package discovery (filesystem)
// ---------------------------------------------------------------------------

/**
 * Adapter package naming convention. The script discovers adapter
 * packages by matching the unscoped name (the part after `@stageflip/`)
 * against these prefixes. Documented in docs/tasks/T-422.md
 * §"Adapter discovery convention".
 *
 * The list is intentionally not derived from `ADAPTER_MODALITY_KINDS`
 * because some modalities have shorter conventional package prefixes
 * (e.g. `three-d` modality → `3d-*` package prefix).
 */
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
 * Package names lacking the `@stageflip/` scope are rejected (third-
 * party packages cannot be in-tree adapters).
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
 * Walk `packages/` for directories containing a `package.json` whose
 * `name` matches the adapter convention. Returns the list of candidates
 * in alphabetical order (deterministic).
 */
export function discoverAdapterPackages(packagesRoot: string): DiscoveredAdapterPackage[] {
  const out: DiscoveredAdapterPackage[] = [];
  let entries: string[];
  try {
    entries = readdirSync(packagesRoot);
  } catch {
    // packages/ doesn't exist (unusual but tolerated; gate exits PASS).
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
// Per-package descriptor extraction (dynamic import)
// ---------------------------------------------------------------------------

interface ExtractionResult {
  readonly descriptors: ReadonlyArray<AdapterDescriptor>;
  readonly missingDescriptor: boolean;
  readonly parseError: { readonly source: string; readonly cause: string } | undefined;
}

/**
 * Dynamic-import the package's barrel (`src/index.ts`) and extract
 * `descriptor` (single) or `descriptors` (array) named exports. Each
 * candidate is parsed via `parseAdapterDescriptor` (Zod). Parse errors
 * are surfaced as a `parseError`; missing-descriptor packages flagged.
 */
export async function extractDescriptorsFromPackage(
  pkg: DiscoveredAdapterPackage,
): Promise<ExtractionResult> {
  const indexPath = join(pkg.dir, 'src', 'index.ts');
  let mod: Record<string, unknown>;
  try {
    mod = (await import(indexPath)) as Record<string, unknown>;
  } catch (err) {
    return {
      descriptors: [],
      missingDescriptor: false,
      parseError: {
        source: pkg.name,
        cause: `dynamic-import failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  const candidates: unknown[] = [];
  if ('descriptor' in mod && mod.descriptor !== undefined) {
    candidates.push(mod.descriptor);
  }
  if ('descriptors' in mod && Array.isArray(mod.descriptors)) {
    for (const d of mod.descriptors as unknown[]) candidates.push(d);
  }

  if (candidates.length === 0) {
    return { descriptors: [], missingDescriptor: true, parseError: undefined };
  }

  const parsed: AdapterDescriptor[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    try {
      parsed.push(parseAdapterDescriptor(candidates[i]));
    } catch (err) {
      return {
        descriptors: [],
        missingDescriptor: false,
        parseError: {
          source: `${pkg.name} [descriptor #${i}]`,
          cause: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  return { descriptors: parsed, missingDescriptor: false, parseError: undefined };
}

// ---------------------------------------------------------------------------
// main — wire discovery → extraction → validation → output → exit
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/ is at repo root.
const REPO_ROOT = resolve(__dirname, '..');
const PACKAGES_ROOT_DEFAULT = resolve(REPO_ROOT, 'packages');

export async function main(packagesRoot: string = PACKAGES_ROOT_DEFAULT): Promise<number> {
  const candidates = discoverAdapterPackages(packagesRoot);
  const registry = new AdapterRegistry();
  const missingDescriptor: string[] = [];
  const parseErrors: { source: string; cause: string }[] = [];

  for (const pkg of candidates) {
    const result = await extractDescriptorsFromPackage(pkg);
    if (result.parseError) {
      parseErrors.push(result.parseError);
      continue;
    }
    if (result.missingDescriptor) {
      missingDescriptor.push(pkg.name);
      continue;
    }
    for (const descriptor of result.descriptors) {
      try {
        registry.register(descriptor);
      } catch (err) {
        parseErrors.push({
          source: `${pkg.name} [register]`,
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const report = validateRegistry(registry, PROPRIETARY_OK, missingDescriptor, parseErrors);
  const out = formatReport(report);
  if (report.exitCode === 0) {
    process.stdout.write(`${out}\n`);
  } else {
    process.stderr.write(`${out}\n`);
  }
  return report.exitCode;
}

// Only run as a CLI when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      process.stderr.write(
        `check-asset-licenses: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    });
}
