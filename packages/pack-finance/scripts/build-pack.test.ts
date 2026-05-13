// packages/pack-finance/scripts/build-pack.test.ts
// T-521 — Drives `buildPack` against a temp-dir source layout using a
// freshly-generated Ed25519 keypair. Verifies (a) outputs land on disk,
// (b) the integrity hash on the manifest matches SHA-256 over the
// archive bytes WITHOUT the manifest, (c) the emitted manifest parses
// under `parsePackManifest`, (d) the archive verifies against the
// corresponding public key, (e) dot-files in the source are skipped,
// (f) missing presets/ dir throws, and (g) the CLI default outDir
// tracks `MANIFEST_SKELETON.version` (regression coverage for the T-510
// hard-coded-version bug carried into the finance skeleton).

import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ED25519_SIGNATURE_LENGTH,
  parsePackManifest,
  verifyPackArchive,
} from '@stageflip/pack-format';
import { synthesizeArchive } from '@stageflip/pack-signing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MANIFEST_SKELETON } from '../src/manifest.js';
import { BuildPackError, buildPack } from './build-pack.js';

interface Fixture {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly tmpRoot: string;
}

function createFixture(opts?: { skipPresetsDir?: boolean; withDotFile?: boolean }): Fixture {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'finance-build-'));
  const sourceDir = join(tmpRoot, 'src-packs');
  const outDir = join(tmpRoot, 'out');
  mkdirSync(sourceDir, { recursive: true });
  if (!opts?.skipPresetsDir) {
    const presetsDir = join(sourceDir, 'presets');
    mkdirSync(presetsDir, { recursive: true });
    writeFileSync(
      join(presetsDir, 'earnings-call-template-placeholder.md'),
      '---\nid: earnings-call-template-placeholder\n---\n# placeholder\n',
    );
    writeFileSync(
      join(presetsDir, 'investor-deck-template-placeholder.md'),
      '---\nid: investor-deck-template-placeholder\n---\n# placeholder\n',
    );
    writeFileSync(
      join(presetsDir, 'bloomberg-pro-adapter.md'),
      '---\nid: bloomberg-pro-adapter\n---\n# placeholder\n',
    );
    writeFileSync(
      join(presetsDir, 'finance-semantic-tools-placeholder.md'),
      '---\nid: finance-semantic-tools-placeholder\n---\n# placeholder\n',
    );
    writeFileSync(join(sourceDir, 'LICENSE.md'), '# LICENSE placeholder\n');
    writeFileSync(join(sourceDir, 'NOTICE.md'), '# NOTICE placeholder\n');
  }
  if (opts?.withDotFile) {
    writeFileSync(join(sourceDir, '.DS_Store'), 'should-be-skipped');
  }

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();

  return { sourceDir, outDir, privateKeyPem, publicKeyPem, tmpRoot };
}

function cleanup(f: Fixture): void {
  rmSync(f.tmpRoot, { recursive: true, force: true });
}

describe('buildPack', () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = createFixture();
  });

  afterEach(() => {
    cleanup(fx);
  });

  it('produces archive.sfpack + signature.bin + manifest.json under outDir', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    expect(result.archivePath).toBe(join(fx.outDir, 'archive.sfpack'));
    expect(result.signaturePath).toBe(join(fx.outDir, 'signature.bin'));
    expect(result.manifestPath).toBe(join(fx.outDir, 'manifest.json'));
    // All three files exist + non-empty.
    expect(readFileSync(result.archivePath).length).toBeGreaterThan(0);
    expect(readFileSync(result.signaturePath).length).toBe(ED25519_SIGNATURE_LENGTH);
    expect(readFileSync(result.manifestPath).length).toBeGreaterThan(0);
  });

  it('the manifest.integrity.hash equals SHA-256 over the archive bytes without the manifest', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    // Re-synthesize the archive without the manifest using the same
    // source files (excluding the manifest the build wrote) so we can
    // verify the integrity hash matches what build-pack computed.
    const archiveBytes = synthesizeArchive([
      { path: 'LICENSE.md', content: readFileSync(join(fx.sourceDir, 'LICENSE.md')) },
      { path: 'NOTICE.md', content: readFileSync(join(fx.sourceDir, 'NOTICE.md')) },
      {
        path: 'presets/bloomberg-pro-adapter.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'bloomberg-pro-adapter.md')),
      },
      {
        path: 'presets/earnings-call-template-placeholder.md',
        content: readFileSync(
          join(fx.sourceDir, 'presets', 'earnings-call-template-placeholder.md'),
        ),
      },
      {
        path: 'presets/finance-semantic-tools-placeholder.md',
        content: readFileSync(
          join(fx.sourceDir, 'presets', 'finance-semantic-tools-placeholder.md'),
        ),
      },
      {
        path: 'presets/investor-deck-template-placeholder.md',
        content: readFileSync(
          join(fx.sourceDir, 'presets', 'investor-deck-template-placeholder.md'),
        ),
      },
    ]);
    const expectedHash = createHash('sha256').update(archiveBytes).digest('hex');
    expect(result.integrityHash).toBe(expectedHash);
    const writtenManifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(writtenManifest.integrity.hash).toBe(expectedHash);
  });

  it('the emitted manifest parses under parsePackManifest', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(() => parsePackManifest(manifest)).not.toThrow();
  });

  it('the resulting archive verifies against the matching public key', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const archiveBytes = new Uint8Array(readFileSync(result.archivePath));
    const signature = new Uint8Array(readFileSync(result.signaturePath));
    expect(verifyPackArchive(archiveBytes, signature, fx.publicKeyPem)).toBe(true);
  });

  it('throws BuildPackError if the source dir is missing presets/', () => {
    cleanup(fx);
    fx = createFixture({ skipPresetsDir: true });
    expect(() =>
      buildPack({
        sourceDir: fx.sourceDir,
        outDir: fx.outDir,
        privateKeyPem: fx.privateKeyPem,
      }),
    ).toThrow(BuildPackError);
  });

  it('skips dot-files in the source dir (e.g. .DS_Store)', () => {
    cleanup(fx);
    fx = createFixture({ withDotFile: true });
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    // Same fixture without .DS_Store should produce the same archive
    // bytes / integrity hash — proves the dot-file did not enter the
    // archive.
    const otherTmpRoot = mkdtempSync(join(tmpdir(), 'finance-build-noDot-'));
    try {
      const baseline = createFixture();
      try {
        const baselineResult = buildPack({
          sourceDir: baseline.sourceDir,
          outDir: join(otherTmpRoot, 'out'),
          privateKeyPem: fx.privateKeyPem,
        });
        expect(result.integrityHash).toBe(baselineResult.integrityHash);
      } finally {
        cleanup(baseline);
      }
    } finally {
      rmSync(otherTmpRoot, { recursive: true, force: true });
    }
  });

  it('the manifest declares the paid-per-tenant license with the finance-1y SKU', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'finance-1y',
      entitlementType: 'subscription',
    });
  });

  it('the manifest contributes exactly four cluster-finance presets (T-521 — earnings-call template / investor-deck template / Bloomberg-pro adapter / finance-semantic-tools slots reserved for T-522..T-525)', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.contributes.presets).toHaveLength(4);
    for (const p of manifest.contributes.presets) {
      expect(p.cluster).toBe('cluster-finance');
    }
  });

  it('the manifest contributes exactly one adapter — the reserved bloomberg-pro premium-tier data-source adapter (T-524)', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.contributes.adapters).toEqual([
      { id: 'bloomberg-pro', modality: 'data-source' },
    ]);
  });

  it('the manifest declares version 0.1.0 (skeleton release)', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.version).toBe(MANIFEST_SKELETON.version);
  });
});

describe('build-pack CLI default outDir (T-521 — version-templated, per T-510 fix)', () => {
  // The CLI's `isMainModule` branch is gated on `process.argv[1]` matching the
  // script path so the module under test runs as a library here, NOT as a CLI.
  // We assert the contract by checking the runtime literal: the default outDir
  // expression in the CLI is `resolve(packageRoot, ../../packs/stageflip/finance/${MANIFEST_SKELETON.version})`.
  // Verifying that MANIFEST_SKELETON.version reaches the expected value AND
  // the CLI's source contains the templated path (NOT a hard-coded `0.1.0`)
  // is a sufficient regression for the bug T-510 fixed in news-pro and that
  // we carry forward into this skeleton.

  it('MANIFEST_SKELETON.version is 0.1.0 — the value the CLI default outDir interpolates', () => {
    expect(MANIFEST_SKELETON.version).toBe('0.1.0');
  });

  it('build-pack.ts CLI source uses ${MANIFEST_SKELETON.version} (NOT a hard-coded 0.1.0 literal) in the default outDir expression', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const cliSource = readFileSync(resolve(here, 'build-pack.ts'), 'utf-8');
    // Positive: the templated form is present.
    expect(cliSource).toContain('`../../packs/stageflip/finance/${MANIFEST_SKELETON.version}`');
    // Negative: no hard-coded version literal remains in the default outDir.
    expect(cliSource).not.toContain("'../../packs/stageflip/finance/0.1.0'");
    expect(cliSource).not.toContain('"../../packs/stageflip/finance/0.1.0"');
  });

  it('package-relative default outDir resolves under packs/stageflip/finance/<manifest-version>/', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageRoot = resolve(here, '..');
    const expected = resolve(
      packageRoot,
      `../../packs/stageflip/finance/${MANIFEST_SKELETON.version}`,
    );
    expect(expected.endsWith(`/packs/stageflip/finance/${MANIFEST_SKELETON.version}`)).toBe(true);
    expect(expected).toContain('/packs/stageflip/finance/0.1.0');
  });

  it('build-pack.ts CLI uses STAGEFLIP_FINANCE_{KEY,SRC,OUT} env-var prefix (NOT the news-pro / sports-networks / creator-style prefix)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const cliSource = readFileSync(resolve(here, 'build-pack.ts'), 'utf-8');
    expect(cliSource).toContain('STAGEFLIP_FINANCE_KEY');
    expect(cliSource).toContain('STAGEFLIP_FINANCE_SRC');
    expect(cliSource).toContain('STAGEFLIP_FINANCE_OUT');
    expect(cliSource).not.toContain('STAGEFLIP_NEWS_PRO_');
    expect(cliSource).not.toContain('STAGEFLIP_SPORTS_NETWORKS_');
    expect(cliSource).not.toContain('STAGEFLIP_CREATOR_STYLE_');
  });
});

describe('buildPack — outDir is honored verbatim regardless of MANIFEST_SKELETON.version (separation-of-concerns seam)', () => {
  // The `buildPack` function itself takes `outDir` as a required parameter —
  // it does not inspect the manifest version when choosing where to write
  // outputs. The CLI-default-outDir interpolation is the only place that
  // looks at MANIFEST_SKELETON.version.
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'finance-explicit-outdir-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes outputs to the supplied outDir even if the directory name does not match the manifest version', () => {
    const sourceDir = join(tmpRoot, 'src');
    const outDir = join(tmpRoot, 'arbitrary-out-dir-no-version-prefix');
    mkdirSync(join(sourceDir, 'presets'), { recursive: true });
    writeFileSync(join(sourceDir, 'presets', 'p.md'), '# placeholder\n');
    const { privateKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const result = buildPack({ sourceDir, outDir, privateKeyPem });
    expect(result.archivePath).toBe(join(outDir, 'archive.sfpack'));
    expect(readdirSync(outDir).sort()).toEqual(
      ['archive.sfpack', 'manifest.json', 'signature.bin'].sort(),
    );
  });
});
