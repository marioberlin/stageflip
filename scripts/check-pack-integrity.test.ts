// scripts/check-pack-integrity.test.ts
// T-499 — Tests for the `check-pack-integrity` CI gate. Each invariant gets
// at least one positive + one negative test; the whole runner is exercised
// through an in-memory filesystem shim so no real packs need to exist on
// disk to drive the logic.

import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { type CheckOptions, type FsShim, checkPackIntegrity } from './check-pack-integrity.js';

// ---------- in-memory fs shim ----------

/**
 * Tiny in-memory filesystem shim that satisfies the `FsShim` contract used
 * by `checkPackIntegrity`. Directories are inferred from path prefixes — any
 * path that is a strict prefix of a registered file path counts as a
 * directory.
 */
function makeFs(entries: Record<string, Buffer | string>): FsShim {
  const files = new Map<string, Buffer>();
  for (const [path, value] of Object.entries(entries)) {
    files.set(path, typeof value === 'string' ? Buffer.from(value) : value);
  }
  const dirs = new Set<string>();
  for (const filePath of files.keys()) {
    const parts = filePath.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }

  function existsSync(path: string): boolean {
    return files.has(path) || dirs.has(path);
  }

  function readFileSync(path: string): Buffer {
    const buf = files.get(path);
    if (buf === undefined) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return buf;
  }

  function readdirSync(path: string): string[] {
    if (!dirs.has(path)) {
      // Treat missing dir as empty for parity with the real fs's ENOENT.
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    const children = new Set<string>();
    const prefix = `${path}/`;
    for (const key of [...files.keys(), ...dirs]) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const next = rest.split('/')[0];
      if (next !== undefined && next.length > 0) children.add(next);
    }
    return [...children].sort();
  }

  function statSync(path: string): { isDirectory(): boolean; isFile(): boolean } {
    const isDir = dirs.has(path);
    const isFile = files.has(path);
    if (!isDir && !isFile) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
    return {
      isDirectory: () => isDir,
      isFile: () => isFile,
    };
  }

  return { existsSync, readFileSync, readdirSync, statSync };
}

// ---------- manifest factory ----------

interface ManifestOverrides {
  manifestVersion?: unknown;
  id?: unknown;
  name?: unknown;
  version?: unknown;
  publisher?: unknown;
  platformCompatibility?: unknown;
  license?: unknown;
  integrity?: unknown;
  contributes?: unknown;
  extra?: Record<string, unknown>;
}

function makeValidManifest(overrides: ManifestOverrides = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    manifestVersion: '1',
    id: 'sample-pack',
    name: 'Sample Pack',
    version: '1.0.0',
    publisher: { id: 'acme', displayName: 'Acme Co' },
    platformCompatibility: '^1.0.0',
    license: { kind: 'open', spdx: 'MIT' },
    integrity: {
      algorithm: 'sha256',
      hash: '0'.repeat(64),
    },
    contributes: {},
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'extra') continue;
    if (value === undefined) delete base[key];
    else base[key] = value;
  }
  if (overrides.extra) Object.assign(base, overrides.extra);
  return base;
}

/**
 * Build the `<root>/<publisher>/<id>/<version>/` fs entries for a single
 * pack with the supplied manifest + archive bytes + signature shape.
 */
function buildPack(opts: {
  root?: string;
  publisher?: string;
  id?: string;
  version?: string;
  manifestObj?: Record<string, unknown> | string; // string lets tests inject raw JSON
  archive?: Buffer | null; // null = no archive file
  archiveFilename?: string;
  signature?: Buffer | null; // null = no signature file
}): { root: string; packPath: string; entries: Record<string, Buffer | string> } {
  const root = opts.root ?? 'packs';
  const publisher = opts.publisher ?? 'acme';
  const id = opts.id ?? 'sample-pack';
  const version = opts.version ?? '1.0.0';
  const packPath = join(root, publisher, id, version);
  const archiveBytes = opts.archive === undefined ? Buffer.from('archive-bytes') : opts.archive;
  const archiveFilename = opts.archiveFilename ?? 'archive.sfpack';

  let manifestObj: Record<string, unknown> | undefined;
  let manifestRaw: string | undefined;
  if (typeof opts.manifestObj === 'string') {
    manifestRaw = opts.manifestObj;
  } else if (opts.manifestObj !== undefined) {
    manifestObj = opts.manifestObj;
  }

  // If the caller passed a real archive AND a manifest object that asks us to
  // fill in the integrity hash, compute it. The signal: integrity.hash ===
  // '__COMPUTE__'.
  if (manifestObj && archiveBytes) {
    const integrity = manifestObj.integrity as Record<string, unknown> | undefined;
    if (integrity && integrity.hash === '__COMPUTE__') {
      integrity.hash = createHash('sha256').update(archiveBytes).digest('hex');
    }
  }

  const finalManifest =
    manifestRaw !== undefined ? manifestRaw : JSON.stringify(manifestObj ?? makeValidManifest());

  const entries: Record<string, Buffer | string> = {};
  entries[join(packPath, 'manifest.json')] = finalManifest;
  if (archiveBytes !== null) entries[join(packPath, archiveFilename)] = archiveBytes;
  if (opts.signature === undefined) {
    entries[join(packPath, 'signature.bin')] = Buffer.alloc(64, 0);
  } else if (opts.signature !== null) {
    entries[join(packPath, 'signature.bin')] = opts.signature;
  }
  return { root, packPath, entries };
}

function run(
  entries: Record<string, Buffer | string>,
  roots: readonly string[],
): ReturnType<typeof checkPackIntegrity> {
  const fs = makeFs(entries);
  const opts: CheckOptions = { roots, fs };
  return checkPackIntegrity(opts);
}

// ---------- 1. empty root ----------

describe('check-pack-integrity: empty roots', () => {
  it('returns no violations on an empty (existing) root', () => {
    // Register an empty root by adding a sentinel directory marker.
    const result = run({ 'packs/.keep': Buffer.alloc(0) }, ['packs']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(0);
  });

  it('forward-compatible: returns 0 violations + 0 packs when root does not exist', () => {
    const result = run({}, ['packs']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(0);
    expect(result.rootsSkipped).toEqual(['packs']);
  });
});

// ---------- 2. valid open-licensed pack passes ----------

describe('check-pack-integrity: valid pack', () => {
  it('returns no violations on a single open-licensed valid pack', () => {
    const archive = Buffer.from('open-archive-bytes');
    const { entries } = buildPack({
      manifestObj: makeValidManifest({
        integrity: {
          algorithm: 'sha256',
          hash: '__COMPUTE__',
        },
      }),
      archive,
    });
    const result = run(entries, ['packs']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(1);
  });

  it('accepts both archive.tar.zst and archive.sfpack', () => {
    const archive = Buffer.from('tar-zst-bytes');
    const { entries } = buildPack({
      archiveFilename: 'archive.tar.zst',
      manifestObj: makeValidManifest({
        integrity: { algorithm: 'sha256', hash: '__COMPUTE__' },
      }),
      archive,
    });
    const result = run(entries, ['packs']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(1);
  });
});

// ---------- 3. invalid JSON ----------

describe('check-pack-integrity: manifest-parse-error', () => {
  it('reports manifest-parse-error for a pack with invalid JSON', () => {
    const { entries } = buildPack({
      manifestObj: 'this is { not valid json',
    });
    const result = run(entries, ['packs']);
    const parseErrors = result.violations.filter((v) => v.invariant === 'manifest-parse-error');
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors[0]?.detail).toMatch(/invalid JSON/);
  });

  // 4. valid JSON, but fails Zod
  it('reports manifest-parse-error for valid JSON that fails the schema', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({ manifestVersion: '2' }),
    });
    const result = run(entries, ['packs']);
    const parseErrors = result.violations.filter((v) => v.invariant === 'manifest-parse-error');
    expect(parseErrors.length).toBeGreaterThan(0);
  });
});

// ---------- 5/6. signature shape ----------

describe('check-pack-integrity: signature-shape-invalid', () => {
  it('reports signature-shape-invalid when sig is 32 bytes', () => {
    const { entries } = buildPack({
      signature: Buffer.alloc(32, 0),
    });
    const result = run(entries, ['packs']);
    const sigErrors = result.violations.filter((v) => v.invariant === 'signature-shape-invalid');
    expect(sigErrors.length).toBe(1);
    expect(sigErrors[0]?.detail).toMatch(/32 bytes/);
  });

  it('reports signature-shape-invalid when sig file is missing', () => {
    const { entries } = buildPack({ signature: null });
    const result = run(entries, ['packs']);
    const sigErrors = result.violations.filter((v) => v.invariant === 'signature-shape-invalid');
    expect(sigErrors.length).toBe(1);
    expect(sigErrors[0]?.detail).toMatch(/not found/);
  });
});

// ---------- 7. archive missing ----------

describe('check-pack-integrity: archive-missing', () => {
  it('reports archive-missing when archive file is missing', () => {
    const { entries } = buildPack({ archive: null });
    const result = run(entries, ['packs']);
    const archiveErrors = result.violations.filter((v) => v.invariant === 'archive-missing');
    expect(archiveErrors.length).toBe(1);
  });
});

// ---------- 8. integrity hash mismatch ----------

describe('check-pack-integrity: integrity-hash-mismatch', () => {
  it('reports integrity-hash-mismatch when manifest hash differs from archive content', () => {
    const archive = Buffer.from('archive-content-A');
    const { entries } = buildPack({
      archive,
      manifestObj: makeValidManifest({
        integrity: {
          algorithm: 'sha256',
          // hash for a DIFFERENT string — guaranteed not to match.
          hash: createHash('sha256').update(Buffer.from('archive-content-B')).digest('hex'),
        },
      }),
    });
    const result = run(entries, ['packs']);
    const hashErrors = result.violations.filter((v) => v.invariant === 'integrity-hash-mismatch');
    expect(hashErrors.length).toBe(1);
    expect(hashErrors[0]?.detail).toMatch(/computed SHA-256/);
  });
});

// ---------- 9. license claim invalid ----------

describe('check-pack-integrity: license-claim-invalid', () => {
  it('reports license-claim-invalid for a manifest whose license fails the discriminated-union shape', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({
        license: { kind: 'free-as-in-beer', spdx: 'MIT' },
      }),
    });
    const result = run(entries, ['packs']);
    const licenseErrors = result.violations.filter((v) => v.invariant === 'license-claim-invalid');
    expect(licenseErrors.length).toBe(1);
    expect(licenseErrors[0]?.detail).toMatch(/free-as-in-beer/);
  });

  it('reports license-claim-invalid when license is missing entirely', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({ license: undefined }),
    });
    const result = run(entries, ['packs']);
    const licenseErrors = result.violations.filter((v) => v.invariant === 'license-claim-invalid');
    expect(licenseErrors.length).toBe(1);
  });
});

// ---------- 10. platform compat invalid ----------

describe('check-pack-integrity: platform-compat-invalid', () => {
  it('reports platform-compat-invalid for a manifest with garbage in platformCompatibility', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({ platformCompatibility: '@@@not-a-range@@@' }),
    });
    const result = run(entries, ['packs']);
    const compatErrors = result.violations.filter((v) => v.invariant === 'platform-compat-invalid');
    expect(compatErrors.length).toBeGreaterThan(0);
  });

  it('reports platform-compat-invalid when platformCompatibility is missing', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({ platformCompatibility: undefined }),
    });
    const result = run(entries, ['packs']);
    const compatErrors = result.violations.filter((v) => v.invariant === 'platform-compat-invalid');
    expect(compatErrors.length).toBeGreaterThan(0);
  });
});

// ---------- 11. aggregation across multiple packs ----------

describe('check-pack-integrity: aggregation', () => {
  it('aggregates violations across multiple packs (returns ALL of them)', () => {
    // Pack A: bad license.
    const packA = buildPack({
      id: 'pack-a',
      manifestObj: makeValidManifest({ license: { kind: 'bogus' } }),
    });
    // Pack B: bad signature shape.
    const packB = buildPack({
      id: 'pack-b',
      signature: Buffer.alloc(10, 0),
    });
    // Pack C: hash mismatch.
    const archiveC = Buffer.from('pack-c-archive');
    const packC = buildPack({
      id: 'pack-c',
      archive: archiveC,
      manifestObj: makeValidManifest({
        integrity: {
          algorithm: 'sha256',
          hash: createHash('sha256').update(Buffer.from('something-else')).digest('hex'),
        },
      }),
    });
    const entries = { ...packA.entries, ...packB.entries, ...packC.entries };
    const result = run(entries, ['packs']);

    expect(result.packsInspected).toBe(3);
    const invariants = new Set(result.violations.map((v) => v.invariant));
    expect(invariants.has('license-claim-invalid')).toBe(true);
    expect(invariants.has('signature-shape-invalid')).toBe(true);
    expect(invariants.has('integrity-hash-mismatch')).toBe(true);
    // Each pack's violations are surfaced — no short-circuit.
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------- 12. forward-compatible mode (already covered above; retained for spec mapping)

// ---------- 13. multiple roots ----------

describe('check-pack-integrity: multiple roots', () => {
  it('walks each root passed in the array', () => {
    const packA = buildPack({
      root: 'packs',
      id: 'in-packs',
      archive: Buffer.from('A'),
      manifestObj: makeValidManifest({
        integrity: { algorithm: 'sha256', hash: '__COMPUTE__' },
      }),
    });
    const packB = buildPack({
      root: '__fixtures__/packs',
      id: 'in-fixtures',
      archive: Buffer.from('B'),
      manifestObj: makeValidManifest({
        integrity: { algorithm: 'sha256', hash: '__COMPUTE__' },
      }),
    });
    const result = run({ ...packA.entries, ...packB.entries }, ['packs', '__fixtures__/packs']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(2);
    expect(result.rootsSkipped).toEqual([]);
  });

  it('skips non-existent roots and continues with the rest', () => {
    const packA = buildPack({
      root: 'packs',
      archive: Buffer.from('only-real-root'),
      manifestObj: makeValidManifest({
        integrity: { algorithm: 'sha256', hash: '__COMPUTE__' },
      }),
    });
    const result = run(packA.entries, ['packs', 'missing-root']);
    expect(result.violations).toEqual([]);
    expect(result.packsInspected).toBe(1);
    expect(result.rootsSkipped).toEqual(['missing-root']);
  });
});

// ---------- bonus coverage: version regex mismatch ----------

describe('check-pack-integrity: version-regex-mismatch', () => {
  it('reports version-regex-mismatch for malformed version strings', () => {
    const { entries } = buildPack({
      manifestObj: makeValidManifest({ version: 'not-a-version' }),
    });
    const result = run(entries, ['packs']);
    const versionErrors = result.violations.filter((v) => v.invariant === 'version-regex-mismatch');
    expect(versionErrors.length).toBe(1);
  });
});
