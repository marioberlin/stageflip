// packages/pack-frontier-fx/scripts/build-pack.test.ts
// T-531 / T-532 / T-533 — Drives `buildPack` against a temp-dir source
// layout using a freshly-generated Ed25519 keypair. Verifies (a)
// outputs land on disk, (b) the integrity hash on the manifest matches
// SHA-256 over the archive bytes WITHOUT the manifest, (c) the emitted
// manifest parses under `parsePackManifest`, (d) the archive verifies
// against the corresponding public key, (e) dot-files in the source
// are skipped, (f) missing presets/ dir throws, and (g) the CLI default
// outDir tracks `MANIFEST_SKELETON.version` (regression coverage for
// the T-510 hard-coded-version bug carried into the frontier-fx
// skeleton). T-533 flipped the `3d-asset-library-placeholder` slot to
// the substantive `3d-asset-library` preset and seeded
// `contributes.assets` with the eight pre-licensed commercial-OK 3D
// asset references (.glb / model/gltf-binary).

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
  const tmpRoot = mkdtempSync(join(tmpdir(), 'frontier-fx-build-'));
  const sourceDir = join(tmpRoot, 'src-packs');
  const outDir = join(tmpRoot, 'out');
  mkdirSync(sourceDir, { recursive: true });
  if (!opts?.skipPresetsDir) {
    const presetsDir = join(sourceDir, 'presets');
    mkdirSync(presetsDir, { recursive: true });
    writeFileSync(
      join(presetsDir, 'shader-aurora-borealis.md'),
      '---\nid: shader-aurora-borealis\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, 'shader-cosmic-nebula.md'),
      '---\nid: shader-cosmic-nebula\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, 'shader-liquid-metal.md'),
      '---\nid: shader-liquid-metal\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, 'shader-fire-portal.md'),
      '---\nid: shader-fire-portal\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, 'shader-data-stream.md'),
      '---\nid: shader-data-stream\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, '3d-asset-library.md'),
      '---\nid: 3d-asset-library\n---\n# substantive\n',
    );
    writeFileSync(
      join(presetsDir, 'reactionstream-physics-placeholder.md'),
      '---\nid: reactionstream-physics-placeholder\n---\n# placeholder\n',
    );
    writeFileSync(
      join(presetsDir, 'titlesequence-premium-placeholder.md'),
      '---\nid: titlesequence-premium-placeholder\n---\n# placeholder\n',
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
        path: 'presets/3d-asset-library.md',
        content: readFileSync(join(fx.sourceDir, 'presets', '3d-asset-library.md')),
      },
      {
        path: 'presets/reactionstream-physics-placeholder.md',
        content: readFileSync(
          join(fx.sourceDir, 'presets', 'reactionstream-physics-placeholder.md'),
        ),
      },
      {
        path: 'presets/shader-aurora-borealis.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'shader-aurora-borealis.md')),
      },
      {
        path: 'presets/shader-cosmic-nebula.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'shader-cosmic-nebula.md')),
      },
      {
        path: 'presets/shader-data-stream.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'shader-data-stream.md')),
      },
      {
        path: 'presets/shader-fire-portal.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'shader-fire-portal.md')),
      },
      {
        path: 'presets/shader-liquid-metal.md',
        content: readFileSync(join(fx.sourceDir, 'presets', 'shader-liquid-metal.md')),
      },
      {
        path: 'presets/titlesequence-premium-placeholder.md',
        content: readFileSync(
          join(fx.sourceDir, 'presets', 'titlesequence-premium-placeholder.md'),
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
    const otherTmpRoot = mkdtempSync(join(tmpdir(), 'frontier-fx-build-noDot-'));
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

  it('the manifest declares the paid-per-tenant license with the frontier-fx-1y SKU', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.license).toEqual({
      kind: 'paid-per-tenant',
      sku: 'frontier-fx-1y',
      entitlementType: 'subscription',
    });
  });

  it('the manifest contributes exactly eight cluster-i presets (T-533 — 5 substantive shaders + substantive 3D asset library + 2 remaining placeholders for T-534/T-535)', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.contributes.presets).toHaveLength(8);
    for (const p of manifest.contributes.presets) {
      expect(p.cluster).toBe('cluster-i');
    }
    expect(manifest.contributes.presets.map((p: { id: string }) => p.id)).toContain(
      '3d-asset-library',
    );
  });

  it('the manifest contributes exactly eight pre-licensed 3D asset entries (T-533 — commercial-OK .glb / model/gltf-binary under 3d/)', () => {
    const result = buildPack({
      sourceDir: fx.sourceDir,
      outDir: fx.outDir,
      privateKeyPem: fx.privateKeyPem,
    });
    const manifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.contributes.assets).toEqual([
      { path: '3d/podium-classic.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/stage-spotlight-set.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/data-cube-rotating.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/sphere-particles.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/celebration-confetti-burst.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/handshake-icon-3d.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/award-trophy.glb', mimeType: 'model/gltf-binary' },
      { path: '3d/ribbon-cut-scissors.glb', mimeType: 'model/gltf-binary' },
    ]);
  });

  it('the manifest declares version 0.1.0 (T-533 does NOT bump — T-535 carries the v0.2.0 GA bump that closes the pack)', () => {
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

describe('build-pack CLI default outDir (T-533 — version-templated, per T-510 fix)', () => {
  // The CLI's `isMainModule` branch is gated on `process.argv[1]` matching the
  // script path so the module under test runs as a library here, NOT as a CLI.
  // We assert the contract by checking the runtime literal: the default outDir
  // expression in the CLI is `resolve(packageRoot, ../../packs/stageflip/frontier-fx/${MANIFEST_SKELETON.version})`.
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
    expect(cliSource).toContain('`../../packs/stageflip/frontier-fx/${MANIFEST_SKELETON.version}`');
    // Negative: no hard-coded version literal remains in the default outDir.
    expect(cliSource).not.toContain("'../../packs/stageflip/frontier-fx/0.1.0'");
    expect(cliSource).not.toContain('"../../packs/stageflip/frontier-fx/0.1.0"');
  });

  it('package-relative default outDir resolves under packs/stageflip/frontier-fx/<manifest-version>/', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageRoot = resolve(here, '..');
    const expected = resolve(
      packageRoot,
      `../../packs/stageflip/frontier-fx/${MANIFEST_SKELETON.version}`,
    );
    expect(expected.endsWith(`/packs/stageflip/frontier-fx/${MANIFEST_SKELETON.version}`)).toBe(
      true,
    );
    expect(expected).toContain('/packs/stageflip/frontier-fx/0.1.0');
  });

  it('build-pack.ts CLI uses STAGEFLIP_FRONTIER_FX_{KEY,SRC,OUT} env-var prefix (NOT the news-pro / sports-networks / creator-style / finance / wedding-events prefix)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const cliSource = readFileSync(resolve(here, 'build-pack.ts'), 'utf-8');
    expect(cliSource).toContain('STAGEFLIP_FRONTIER_FX_KEY');
    expect(cliSource).toContain('STAGEFLIP_FRONTIER_FX_SRC');
    expect(cliSource).toContain('STAGEFLIP_FRONTIER_FX_OUT');
    expect(cliSource).not.toContain('STAGEFLIP_NEWS_PRO_');
    expect(cliSource).not.toContain('STAGEFLIP_SPORTS_NETWORKS_');
    expect(cliSource).not.toContain('STAGEFLIP_CREATOR_STYLE_');
    expect(cliSource).not.toContain('STAGEFLIP_FINANCE_');
    expect(cliSource).not.toContain('STAGEFLIP_WEDDING_EVENTS_');
  });
});

describe('buildPack — outDir is honored verbatim regardless of MANIFEST_SKELETON.version (separation-of-concerns seam)', () => {
  // The `buildPack` function itself takes `outDir` as a required parameter —
  // it does not inspect the manifest version when choosing where to write
  // outputs. The CLI-default-outDir interpolation is the only place that
  // looks at MANIFEST_SKELETON.version.
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'frontier-fx-explicit-outdir-'));
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
