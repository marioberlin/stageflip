// scripts/check-pack-integrity.ts
// T-499 — CI gate that validates pack manifests, signatures, license claims,
// and version compatibility for any on-disk `.stageflip-pack` archives shipped
// in the repo (first-party packs + any test fixtures).
//
// Forward-compatible mode: in P16 β the first-party packs haven't shipped yet
// (those land in T-506+ in Phase γ). The gate walks a configurable root —
// default `packs/` at repo root — and exits 0 when that root does not exist,
// so the gate is green today but activates fully once packs ship.
//
// Mirrors `scripts/check-preset-integrity.ts` style: per-invariant progress
// lines, aggregating violations (no short-circuit), final PASS/FAIL summary.
//
// Determinism perimeter: scripts/** lives OUTSIDE the determinism perimeter
// (CLAUDE.md §3); using Node fs, node:crypto SHA-256, and process.exit is
// fine here.
//
// Imports use SOURCE paths (`../packages/.../src/index.js`) not built dist so
// the gate runs without requiring a prior `pnpm build` — matches the
// `check-preset-integrity.ts` convention.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ED25519_SIGNATURE_LENGTH, parsePackManifest } from '../packages/pack-format/src/index.js';
import {
  ARCHIVE_MAGIC,
  parseArchive,
  synthesizeArchive,
} from '../packages/pack-signing/src/archive.js';

// ---------- types ----------

/**
 * One detected invariant violation. The CI gate aggregates these and reports
 * every violation across every pack in a single run (matches the
 * check-preset-integrity posture).
 */
export interface Violation {
  readonly packPath: string;
  readonly invariant: string;
  readonly detail: string;
}

/**
 * Minimal filesystem surface the checker needs. Tests inject an in-memory
 * shim (Map<path, Buffer>) so the gate's logic is exercised without touching
 * the real disk.
 */
export interface FsShim {
  existsSync(path: string): boolean;
  readFileSync(path: string): Buffer;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
}

export interface CheckOptions {
  readonly roots: readonly string[];
  /** Injected for tests so we don't read the real filesystem. */
  readonly fs?: FsShim;
}

export interface CheckResult {
  readonly violations: readonly Violation[];
  readonly packsInspected: number;
  readonly rootsSkipped: readonly string[];
}

// ---------- constants ----------

/**
 * Workspace-relative default pack archive root. The directory does not yet
 * exist in P16 β; the gate is forward-compatible (exits 0 with a skip line
 * when missing). First-party packs land in T-506+.
 */
export const DEFAULT_PACKS_ROOT = 'packs';

/**
 * Same semver-range regex used by `packManifestSchema` in
 * `packages/pack-format/src/manifest.ts`. Duplicated here so invariant 6 can
 * surface syntactic violations even before invariant 1 (manifest-parse-error)
 * catches them — keeps the per-invariant report clean.
 */
const SEMVER_RANGE_REGEX = /^[\^~>=<*\d\s.,|-]+$/;

/**
 * Both `archive.tar.zst` (target marketplace shape) and `archive.sfpack`
 * (T-498 placeholder) are accepted in P16 β. Once the marketplace format
 * stabilizes post-T-499 the `.sfpack` shim drops out.
 */
const ARCHIVE_FILENAMES = ['archive.tar.zst', 'archive.sfpack'] as const;

const SIGNATURE_FILENAME = 'signature.bin';
const MANIFEST_FILENAME = 'manifest.json';

// ---------- helpers ----------

function realFs(): FsShim {
  return {
    existsSync,
    readFileSync: (path: string): Buffer => readFileSync(path),
    readdirSync: (path: string): string[] => readdirSync(path),
    statSync: (path: string): { isDirectory(): boolean; isFile(): boolean } => {
      const s = statSync(path);
      return { isDirectory: () => s.isDirectory(), isFile: () => s.isFile() };
    },
  };
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Discover the on-disk `<root>/<publisher>/<id>/<version>/` pack directories
 * under a single root. Skips quietly when the root does not exist (forward-
 * compatible mode); returns the discovered directories sorted ascending.
 */
function discoverPackDirs(root: string, fs: FsShim): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  let publishers: string[];
  try {
    publishers = fs.readdirSync(root);
  } catch {
    return [];
  }
  for (const publisher of publishers.sort()) {
    const publisherPath = join(root, publisher);
    let publisherStat: ReturnType<FsShim['statSync']>;
    try {
      publisherStat = fs.statSync(publisherPath);
    } catch {
      continue;
    }
    if (!publisherStat.isDirectory()) continue;
    let ids: string[];
    try {
      ids = fs.readdirSync(publisherPath);
    } catch {
      continue;
    }
    for (const id of ids.sort()) {
      const idPath = join(publisherPath, id);
      let idStat: ReturnType<FsShim['statSync']>;
      try {
        idStat = fs.statSync(idPath);
      } catch {
        continue;
      }
      if (!idStat.isDirectory()) continue;
      let versions: string[];
      try {
        versions = fs.readdirSync(idPath);
      } catch {
        continue;
      }
      for (const version of versions.sort()) {
        const versionPath = join(idPath, version);
        let versionStat: ReturnType<FsShim['statSync']>;
        try {
          versionStat = fs.statSync(versionPath);
        } catch {
          continue;
        }
        if (!versionStat.isDirectory()) continue;
        out.push(versionPath);
      }
    }
  }
  return out;
}

/**
 * Validate a single pack directory against every invariant the gate enforces.
 * Aggregates violations into the supplied array; does NOT throw on the first
 * failure so the caller can report every issue at once.
 */
function checkOnePack(packPath: string, fs: FsShim, violations: Violation[]): void {
  const manifestPath = join(packPath, MANIFEST_FILENAME);
  const signaturePath = join(packPath, SIGNATURE_FILENAME);

  // ---- Invariant 1: manifest parses under packManifestSchema. -------------
  if (!fs.existsSync(manifestPath)) {
    violations.push({
      packPath,
      invariant: 'manifest-parse-error',
      detail: `${MANIFEST_FILENAME} not found at ${manifestPath}`,
    });
    // Without a manifest the rest is unverifiable — skip downstream invariants
    // for this pack but continue with the next pack (caller loops).
    return;
  }

  let manifestBytes: Buffer;
  try {
    manifestBytes = fs.readFileSync(manifestPath);
  } catch (err) {
    violations.push({
      packPath,
      invariant: 'manifest-parse-error',
      detail: `failed to read ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(manifestBytes.toString('utf8'));
  } catch (err) {
    violations.push({
      packPath,
      invariant: 'manifest-parse-error',
      detail: `invalid JSON in ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // Cache the parsed object so we can still run the licence-claim shape and
  // platform-compat invariants (which look at the *raw* shape) even when the
  // strict schema rejects the full manifest.
  const rawObj = (rawJson ?? {}) as Record<string, unknown>;

  // Invariant 7: version regex (called out separately even though invariant 1
  // also catches it — keeps the report readable when only the version is bad).
  const versionRegex = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i;
  if (typeof rawObj.version === 'string' && !versionRegex.test(rawObj.version)) {
    violations.push({
      packPath,
      invariant: 'version-regex-mismatch',
      detail: `manifest 'version' '${rawObj.version}' does not match semver regex ${versionRegex}`,
    });
  }

  // Invariant 5: license claim shape — check the raw license object's `kind`
  // before delegating to the Zod schema. The Zod failure path still surfaces
  // via invariant 1 if the schema rejects; this gives a cleaner per-invariant
  // bucket when the license is the only thing wrong.
  const rawLicense = rawObj.license as Record<string, unknown> | undefined;
  const acceptedKinds = new Set(['open', 'paid-per-tenant', 'enterprise']);
  if (rawLicense === undefined || typeof rawLicense !== 'object' || rawLicense === null) {
    violations.push({
      packPath,
      invariant: 'license-claim-invalid',
      detail: `manifest 'license' is missing or not an object`,
    });
  } else if (typeof rawLicense.kind !== 'string' || !acceptedKinds.has(rawLicense.kind)) {
    violations.push({
      packPath,
      invariant: 'license-claim-invalid',
      detail: `manifest 'license.kind' must be one of 'open' | 'paid-per-tenant' | 'enterprise'; got ${JSON.stringify(rawLicense.kind)}`,
    });
  }

  // Invariant 6: platformCompatibility must be a parseable semver range.
  // The workspace regex is the authoritative shape check (mirrors
  // `pack-format/manifest.ts`); satisfiesRange itself never throws — it
  // returns `false` for malformed input at lookup time. So the regex check
  // alone is sufficient + tight.
  const platformCompat = rawObj.platformCompatibility;
  if (typeof platformCompat !== 'string' || platformCompat.length === 0) {
    violations.push({
      packPath,
      invariant: 'platform-compat-invalid',
      detail: `manifest 'platformCompatibility' is missing or not a string`,
    });
  } else if (!SEMVER_RANGE_REGEX.test(platformCompat)) {
    violations.push({
      packPath,
      invariant: 'platform-compat-invalid',
      detail: `manifest 'platformCompatibility' '${platformCompat}' fails workspace semver-range regex ${SEMVER_RANGE_REGEX}`,
    });
  }

  // Now drive the full strict schema. Anything that slipped past the per-
  // invariant probes above gets caught here under invariant 1.
  let parseOk = true;
  try {
    parsePackManifest(rawJson);
  } catch (err) {
    parseOk = false;
    violations.push({
      packPath,
      invariant: 'manifest-parse-error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Invariant 2: signature file exists at signature.bin (64 bytes). ----
  if (!fs.existsSync(signaturePath)) {
    violations.push({
      packPath,
      invariant: 'signature-shape-invalid',
      detail: `${SIGNATURE_FILENAME} not found at ${signaturePath}`,
    });
  } else {
    let sigBytes: Buffer;
    try {
      sigBytes = fs.readFileSync(signaturePath);
      if (sigBytes.length !== ED25519_SIGNATURE_LENGTH) {
        violations.push({
          packPath,
          invariant: 'signature-shape-invalid',
          detail: `${SIGNATURE_FILENAME} is ${sigBytes.length} bytes; expected exactly ${ED25519_SIGNATURE_LENGTH}`,
        });
      }
    } catch (err) {
      violations.push({
        packPath,
        invariant: 'signature-shape-invalid',
        detail: `failed to read ${signaturePath}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ---- Invariant 3: archive file exists. ----------------------------------
  // Accept either `archive.tar.zst` (target format) or `archive.sfpack`
  // (T-498 placeholder) — first match wins. The accepted set is intentionally
  // small; documented in spec so reviewers know the temporary acceptance.
  let archivePath: string | undefined;
  for (const candidate of ARCHIVE_FILENAMES) {
    const p = join(packPath, candidate);
    if (fs.existsSync(p)) {
      archivePath = p;
      break;
    }
  }
  if (archivePath === undefined) {
    violations.push({
      packPath,
      invariant: 'archive-missing',
      detail: `no archive found; tried ${ARCHIVE_FILENAMES.join(', ')} under ${packPath}`,
    });
    // Without an archive we can't compute the integrity hash — skip
    // invariant 4 for this pack.
    return;
  }

  // ---- Invariant 4: integrity hash matches SHA-256 of archive bytes. ------
  // Only run when parse succeeded — otherwise integrity.hash may be absent
  // or malformed and the report is already noisy enough.
  if (parseOk) {
    const integrity = (rawObj.integrity ?? {}) as Record<string, unknown>;
    const claimedHash = typeof integrity.hash === 'string' ? integrity.hash : undefined;
    if (claimedHash === undefined) {
      violations.push({
        packPath,
        invariant: 'integrity-hash-mismatch',
        detail: `manifest 'integrity.hash' is missing or not a string`,
      });
    } else {
      let archiveBytes: Buffer;
      try {
        archiveBytes = fs.readFileSync(archivePath);
      } catch (err) {
        violations.push({
          packPath,
          invariant: 'integrity-hash-mismatch',
          detail: `failed to read archive at ${archivePath}: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      // Hash domain semantics per ADR-012 §D3 + pack-signing T-498:
      // integrity.hash covers the archive bytes EXCLUDING the manifest
      // entry itself (so signing can compute the hash before the manifest
      // it must embed). For SFPACK1 archives we parseArchive, strip the
      // manifest entry, re-synthesize, and hash that. For unknown archive
      // formats (currently none) we fall back to hashing the raw bytes —
      // this is the T-498 placeholder; replace when tar+zstd lands.
      const isSfpack =
        archiveBytes.length >= ARCHIVE_MAGIC.length &&
        ARCHIVE_MAGIC.every((b, i) => archiveBytes[i] === b);
      let hashedBytes: Uint8Array;
      if (isSfpack) {
        try {
          const entries = parseArchive(new Uint8Array(archiveBytes));
          const withoutManifest = entries.filter((e) => e.path !== 'manifest.json');
          hashedBytes = synthesizeArchive(withoutManifest);
        } catch (err) {
          violations.push({
            packPath,
            invariant: 'integrity-hash-mismatch',
            detail: `failed to parse SFPACK1 archive at ${archivePath} for hash recomputation: ${err instanceof Error ? err.message : String(err)}`,
          });
          return;
        }
      } else {
        hashedBytes = new Uint8Array(archiveBytes);
      }
      const computed = sha256Hex(Buffer.from(hashedBytes));
      if (computed !== claimedHash) {
        violations.push({
          packPath,
          invariant: 'integrity-hash-mismatch',
          detail: `manifest 'integrity.hash' = ${claimedHash}, computed SHA-256 of ${archivePath} (manifest excluded per ADR-012 §D3) = ${computed}`,
        });
      }
    }
  }
}

// ---------- public entry ----------

/**
 * Walk every supplied root, discover pack archives, and run every invariant
 * against each. Aggregates violations across packs and returns a structured
 * result. Never throws — IO + parse failures are reported via `violations`.
 */
export function checkPackIntegrity(opts: CheckOptions): CheckResult {
  const fs = opts.fs ?? realFs();
  const violations: Violation[] = [];
  const rootsSkipped: string[] = [];
  let packsInspected = 0;

  for (const root of opts.roots) {
    if (!fs.existsSync(root)) {
      rootsSkipped.push(root);
      continue;
    }
    const packDirs = discoverPackDirs(root, fs);
    for (const packDir of packDirs) {
      packsInspected += 1;
      checkOnePack(packDir, fs, violations);
    }
  }

  return { violations, packsInspected, rootsSkipped };
}

// ---------- CLI ----------

/* v8 ignore start */
// `main()` + CLI guard run only when the script is invoked as a process.
// In-process v8 coverage does not record subprocess execution.

function parseArgv(argv: readonly string[]): { roots: string[] } {
  const roots: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--root requires a value (comma-separated paths allowed)');
      }
      for (const part of next
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)) {
        roots.push(part);
      }
      i += 1;
    }
  }
  return { roots: roots.length > 0 ? roots : [DEFAULT_PACKS_ROOT] };
}

function main(): void {
  const { roots } = parseArgv(process.argv.slice(2));
  process.stdout.write(`check-pack-integrity: scanning ${roots.join(', ')}...\n`);

  const result = checkPackIntegrity({ roots });

  for (const skipped of result.rootsSkipped) {
    process.stdout.write(
      `check-pack-integrity: no packs to verify (root '${skipped}' does not exist)\n`,
    );
  }

  // Group violations by invariant for a tidy per-invariant report.
  const byInvariant = new Map<string, Violation[]>();
  for (const v of result.violations) {
    const existing = byInvariant.get(v.invariant);
    if (existing) existing.push(v);
    else byInvariant.set(v.invariant, [v]);
  }
  const invariants = [
    'manifest-parse-error',
    'signature-shape-invalid',
    'archive-missing',
    'integrity-hash-mismatch',
    'license-claim-invalid',
    'platform-compat-invalid',
    'version-regex-mismatch',
  ];
  for (const invariant of invariants) {
    const list = byInvariant.get(invariant) ?? [];
    const status = list.length === 0 ? 'PASS' : `FAIL (${list.length})`;
    process.stdout.write(`check-pack-integrity [${invariant}]: ${status}\n`);
  }

  if (result.violations.length === 0) {
    process.stdout.write(`check-pack-integrity: PASS (${result.packsInspected} pack(s))\n`);
    process.exit(0);
  }

  for (const invariant of invariants) {
    const list = byInvariant.get(invariant) ?? [];
    if (list.length === 0) continue;
    process.stderr.write(`\ncheck-pack-integrity [${invariant}]: FAIL\n`);
    for (const v of list) {
      process.stderr.write(`  - ${v.packPath}: ${v.detail}\n`);
    }
  }
  process.stderr.write(
    `\ncheck-pack-integrity: FAIL (${result.violations.length} violation${result.violations.length === 1 ? '' : 's'} across ${result.packsInspected} pack${result.packsInspected === 1 ? '' : 's'})\n`,
  );
  process.exit(1);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-pack-integrity.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`check-pack-integrity: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  }
}
/* v8 ignore stop */
