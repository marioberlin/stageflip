// scripts/check-asset-licenses.test.ts
// Unit tests for the T-422 check-asset-licenses CI gate. The validation
// core is pure (no filesystem, no dynamic-import) so tests drive synthetic
// `AdapterRegistry` instances populated via `parseAdapterDescriptor` and
// assert the verdict shape. AC numbers refer to docs/tasks/T-422.md.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdapterRegistry, parseAdapterDescriptor } from '../packages/adapters-core/src/index.js';
import type {
  AdapterDescriptor,
  AdapterLicenseKind,
  AdapterModalityKind,
} from '../packages/adapters-core/src/index.js';

import {
  PER_MODALITY_LICENSE_WHITELIST,
  PROPRIETARY_OK,
  classifyAdapterLicense,
  discoverAdapterPackages,
  extractDescriptorsFromPackage,
  formatReport,
  isAdapterPackageName,
  main,
  validateRegistry,
} from './check-asset-licenses.js';

// ---------- helpers ----------

function makeDescriptor(
  modalityKind: AdapterModalityKind,
  licenseKind: AdapterLicenseKind,
  id = 'synthetic',
): AdapterDescriptor {
  return parseAdapterDescriptor({
    id,
    modality: { kind: modalityKind },
    capability: {},
    license: { kind: licenseKind },
    sandbox: { kind: 'in-process' },
  });
}

function registryWith(...adapters: AdapterDescriptor[]): AdapterRegistry {
  const reg = new AdapterRegistry();
  for (const a of adapters) reg.register(a);
  return reg;
}

// ---------- validateRegistry ----------

describe('validateRegistry — empty state (AC 1, 6)', () => {
  it('empty registry returns PASS verdict with zero failures', () => {
    const report = validateRegistry(new AdapterRegistry());
    expect(report.exitCode).toBe(0);
    expect(report.adaptersInspected).toBe(0);
    expect(report.forbidden).toEqual([]);
    expect(report.needsAdr).toEqual([]);
    expect(report.unknownModality).toEqual([]);
  });
});

describe('validateRegistry — whitelisted licenses PASS (AC 5)', () => {
  it('apache-2.0 TTS adapter passes', () => {
    const reg = registryWith(makeDescriptor('tts', 'apache-2.0', 'kokoro'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
    expect(report.adaptersInspected).toBe(1);
  });

  it('mit music-gen adapter passes', () => {
    const reg = registryWith(makeDescriptor('music-gen', 'mit', 'acestep'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
  });

  it('cc-by music-gen adapter passes (per ADR-008 §D13 line 655)', () => {
    const reg = registryWith(makeDescriptor('music-gen', 'cc-by', 'attributed-music'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
  });

  it('cc-by sfx adapter passes (per ADR-008 §D13 line 656)', () => {
    const reg = registryWith(makeDescriptor('sfx', 'cc-by', 'attributed-sfx'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
  });

  it('proprietary-byo TTS adapter passes (BYO credentials posture)', () => {
    const reg = registryWith(makeDescriptor('tts', 'proprietary-byo', 'fish-speech'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
  });

  it('multiple adapters across modalities all pass', () => {
    const reg = registryWith(
      makeDescriptor('tts', 'apache-2.0', 'kokoro'),
      makeDescriptor('video-gen', 'proprietary-byo', 'seedance'),
      makeDescriptor('music-gen', 'cc-by', 'yue'),
      makeDescriptor('sfx', 'mit', 'stable-audio'),
      makeDescriptor('three-d', 'apache-2.0', 'tripo'),
    );
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(0);
    expect(report.adaptersInspected).toBe(5);
  });
});

describe('validateRegistry — non-whitelisted license FAILS (AC 2)', () => {
  it('cc-by TTS adapter is non-whitelisted (cc-by NOT in tts whitelist)', () => {
    const reg = registryWith(makeDescriptor('tts', 'cc-by', 'bad-tts'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
    expect(report.forbidden).toHaveLength(1);
    expect(report.forbidden[0]?.adapterId).toBe('bad-tts');
    expect(report.forbidden[0]?.modality).toBe('tts');
    expect(report.forbidden[0]?.license).toBe('cc-by');
    expect(report.forbidden[0]?.reason).toBe('not-in-whitelist');
  });

  it('cc-by video-gen adapter is non-whitelisted', () => {
    const reg = registryWith(makeDescriptor('video-gen', 'cc-by', 'bad-video'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
    expect(report.forbidden[0]?.modality).toBe('video-gen');
  });

  it('cc-by three-d adapter is non-whitelisted', () => {
    const reg = registryWith(makeDescriptor('three-d', 'cc-by', 'bad-3d'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
  });

  it('cc-by slide-deck-gen is non-whitelisted (source-grounded modalities exclude cc-by)', () => {
    const reg = registryWith(makeDescriptor('slide-deck-gen', 'cc-by', 'bad-slides'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
  });
});

describe('validateRegistry — gpl-incompatible always FAILS (AC 5)', () => {
  it('gpl-incompatible TTS adapter is FORBIDDEN regardless of modality', () => {
    const reg = registryWith(makeDescriptor('tts', 'gpl-incompatible', 'bad-gpl'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
    expect(report.forbidden).toHaveLength(1);
    expect(report.forbidden[0]?.reason).toBe('gpl-incompatible');
  });

  it('gpl-incompatible bundle adapter (Phase 16) also FORBIDDEN', () => {
    const reg = registryWith(makeDescriptor('bundle', 'gpl-incompatible', 'bad-bundle'));
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
    expect(report.forbidden[0]?.reason).toBe('gpl-incompatible');
  });
});

describe('validateRegistry — proprietary-vendored requires ADR (AC 2)', () => {
  it('proprietary-vendored without ADR is NEEDS-ADR (FAIL)', () => {
    const reg = registryWith(
      makeDescriptor('video-gen', 'proprietary-vendored', 'unreviewed-vendored'),
    );
    const report = validateRegistry(reg);
    expect(report.exitCode).toBe(1);
    expect(report.needsAdr).toHaveLength(1);
    expect(report.needsAdr[0]?.adapterId).toBe('unreviewed-vendored');
  });

  it('proprietary-vendored adapter on the PROPRIETARY_OK allowlist passes', () => {
    const allowlist = new Map<string, string>([['cleared-vendored', 'ADR-099 cleared 2026-05-11']]);
    const reg = registryWith(
      makeDescriptor('video-gen', 'proprietary-vendored', 'cleared-vendored'),
    );
    const report = validateRegistry(reg, allowlist);
    expect(report.exitCode).toBe(0);
    expect(report.needsAdr).toHaveLength(0);
  });

  it('on inaugural ship the PROPRIETARY_OK allowlist is empty', () => {
    expect(PROPRIETARY_OK.size).toBe(0);
  });
});

describe('PER_MODALITY_LICENSE_WHITELIST — ADR-008 §D13 spot-checks', () => {
  it('every modality in ADAPTER_MODALITY_KINDS has a whitelist entry', () => {
    const modalities: AdapterModalityKind[] = [
      'tts',
      'video-gen',
      'music-gen',
      'sfx',
      'three-d',
      'slide-deck-gen',
      'mind-map-gen',
      'table-gen',
      'quiz-gen',
      'flashcard-gen',
      'report-gen',
      'infographic-gen',
      'research-session',
      'audience-backend',
      'bundle',
    ];
    for (const m of modalities) {
      expect(PER_MODALITY_LICENSE_WHITELIST[m]).toBeDefined();
      expect(PER_MODALITY_LICENSE_WHITELIST[m].length).toBeGreaterThan(0);
    }
  });

  it('no modality whitelist contains gpl-incompatible (CLAUDE.md §3 invariant)', () => {
    for (const [, allowed] of Object.entries(PER_MODALITY_LICENSE_WHITELIST)) {
      expect(allowed).not.toContain('gpl-incompatible');
    }
  });

  it('tts whitelist excludes cc-by (per ADR-008 §D13 line 653)', () => {
    expect(PER_MODALITY_LICENSE_WHITELIST.tts).not.toContain('cc-by');
  });

  it('music-gen whitelist includes cc-by (per ADR-008 §D13 line 655)', () => {
    expect(PER_MODALITY_LICENSE_WHITELIST['music-gen']).toContain('cc-by');
  });

  it('sfx whitelist includes cc-by (per ADR-008 §D13 line 656)', () => {
    expect(PER_MODALITY_LICENSE_WHITELIST.sfx).toContain('cc-by');
  });

  it('three-d whitelist excludes cc-by (per ADR-008 §D13 line 657)', () => {
    expect(PER_MODALITY_LICENSE_WHITELIST['three-d']).not.toContain('cc-by');
  });
});

// ---------- classifyAdapterLicense pure helper ----------

describe('classifyAdapterLicense', () => {
  it('returns "allowed" for an in-whitelist license', () => {
    const verdict = classifyAdapterLicense('tts', 'apache-2.0');
    expect(verdict).toBe('allowed');
  });

  it('returns "gpl-incompatible" for any GPL declaration', () => {
    const verdict = classifyAdapterLicense('music-gen', 'gpl-incompatible');
    expect(verdict).toBe('gpl-incompatible');
  });

  it('returns "needs-adr" for proprietary-vendored', () => {
    const verdict = classifyAdapterLicense('video-gen', 'proprietary-vendored');
    expect(verdict).toBe('needs-adr');
  });

  it('returns "not-in-whitelist" for cc-by under tts', () => {
    const verdict = classifyAdapterLicense('tts', 'cc-by');
    expect(verdict).toBe('not-in-whitelist');
  });
});

// ---------- isAdapterPackageName ----------

describe('isAdapterPackageName — package-discovery convention', () => {
  it.each([
    '@stageflip/tts-kokoro',
    '@stageflip/tts-fish-speech',
    '@stageflip/video-seedance',
    '@stageflip/video-runway',
    '@stageflip/music-acestep',
    '@stageflip/music-yue',
    '@stageflip/sfx-stable-audio',
    '@stageflip/3d-tripo',
    '@stageflip/3d-meshy',
    '@stageflip/slide-deck-marp',
    '@stageflip/mind-map-mermaid',
    '@stageflip/table-gen-csv',
    '@stageflip/quiz-foo',
    '@stageflip/flashcard-anki',
    '@stageflip/report-gen-pdf',
    '@stageflip/infographic-mermaid',
    '@stageflip/research-session-notebooklm',
    '@stageflip/audience-mentimeter',
    '@stageflip/bundle-foo',
  ])('matches adapter convention: %s', (name) => {
    expect(isAdapterPackageName(name)).toBe(true);
  });

  it.each([
    '@stageflip/adapters-core',
    '@stageflip/asset-cache',
    '@stageflip/asset-gen-contract',
    '@stageflip/schema',
    '@stageflip/export-router',
    '@stageflip/frame-runtime',
    '@stageflip/captions',
    'react',
    'zod',
    '@stageflip/3-d-misnomer',
  ])('does NOT match adapter convention: %s', (name) => {
    expect(isAdapterPackageName(name)).toBe(false);
  });
});

// ---------- formatReport ----------

describe('formatReport', () => {
  it('formats inaugural-empty-state PASS message', () => {
    const report = validateRegistry(new AdapterRegistry());
    const out = formatReport(report);
    expect(out).toContain('0 adapters registered');
    expect(out).toContain('whitelist not yet exercised');
    expect(out).toContain('PASS');
  });

  it('formats PASS message for non-empty whitelisted registry', () => {
    const reg = registryWith(makeDescriptor('tts', 'apache-2.0', 'good'));
    const report = validateRegistry(reg);
    const out = formatReport(report);
    expect(out).toContain('1 adapter');
    expect(out).toContain('PASS');
  });

  it('formats FAIL message with FORBIDDEN bucket detail', () => {
    const reg = registryWith(makeDescriptor('tts', 'cc-by', 'bad'));
    const report = validateRegistry(reg);
    const out = formatReport(report);
    expect(out).toContain('FORBIDDEN');
    expect(out).toContain('bad');
    expect(out).toContain('cc-by');
    expect(out).toContain('FAIL');
  });

  it('formats FAIL message with NEEDS-ADR bucket detail', () => {
    const reg = registryWith(makeDescriptor('video-gen', 'proprietary-vendored', 'unreviewed'));
    const report = validateRegistry(reg);
    const out = formatReport(report);
    expect(out).toContain('NEEDS-ADR');
    expect(out).toContain('unreviewed');
    expect(out).toContain('FAIL');
  });

  it('reports gpl-incompatible explicitly in FORBIDDEN bucket', () => {
    const reg = registryWith(makeDescriptor('tts', 'gpl-incompatible', 'bad-gpl'));
    const report = validateRegistry(reg);
    const out = formatReport(report);
    expect(out).toContain('FORBIDDEN');
    expect(out).toContain('gpl-incompatible');
  });

  it('formats MISSING-DESCRIPTOR bucket detail', () => {
    const report = validateRegistry(new AdapterRegistry(), PROPRIETARY_OK, [
      '@stageflip/tts-orphan',
    ]);
    const out = formatReport(report);
    expect(out).toContain('MISSING-DESCRIPTOR');
    expect(out).toContain('tts-orphan');
    expect(out).toContain('FAIL');
  });

  it('formats PARSE-ERROR bucket detail', () => {
    const report = validateRegistry(
      new AdapterRegistry(),
      PROPRIETARY_OK,
      [],
      [{ source: '@stageflip/tts-broken', cause: 'Zod issue: license.kind not in enum' }],
    );
    const out = formatReport(report);
    expect(out).toContain('PARSE-ERROR');
    expect(out).toContain('tts-broken');
    expect(out).toContain('Zod issue');
    expect(out).toContain('FAIL');
  });

  it('formats UNKNOWN-MODALITY bucket detail (synthetic via cast)', () => {
    // Build an in-memory registry, then synthetically inject a descriptor
    // whose modality.kind escapes the type. We use parseAdapterDescriptor
    // first to get a valid base, then mutate via the unsafe cast (the
    // gate's defensive check exists for the upstream contract-mismatch
    // case where a future modality lands without updating ADAPTER_MODALITY_KINDS).
    const valid = makeDescriptor('tts', 'apache-2.0', 'shape-shifter');
    const synthetic = {
      ...valid,
      modality: { kind: 'unknown-future-modality' },
    } as unknown as AdapterDescriptor;
    // The gate only calls `.list()` so a structural duck type is sufficient.
    const fakeRegistry = {
      list: () => [synthetic],
    } as unknown as AdapterRegistry;
    const report = validateRegistry(fakeRegistry);
    const out = formatReport(report);
    expect(out).toContain('UNKNOWN-MODALITY');
    expect(out).toContain('shape-shifter');
    expect(out).toContain('unknown-future-modality');
    expect(out).toContain('FAIL');
  });
});

// ---------- discoverAdapterPackages ----------

describe('discoverAdapterPackages — filesystem walk', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'check-asset-licenses-disco-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns empty list when packages root is missing', () => {
    const result = discoverAdapterPackages(join(tmpRoot, 'does-not-exist'));
    expect(result).toEqual([]);
  });

  it('returns empty list when no adapter-named packages exist', () => {
    mkdirSync(join(tmpRoot, 'adapters-core'));
    writeFileSync(
      join(tmpRoot, 'adapters-core', 'package.json'),
      JSON.stringify({ name: '@stageflip/adapters-core' }),
    );
    mkdirSync(join(tmpRoot, 'schema'));
    writeFileSync(
      join(tmpRoot, 'schema', 'package.json'),
      JSON.stringify({ name: '@stageflip/schema' }),
    );
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toEqual([]);
  });

  it('discovers adapter-named packages and returns alphabetically', () => {
    mkdirSync(join(tmpRoot, 'tts-kokoro'));
    writeFileSync(
      join(tmpRoot, 'tts-kokoro', 'package.json'),
      JSON.stringify({ name: '@stageflip/tts-kokoro' }),
    );
    mkdirSync(join(tmpRoot, '3d-tripo'));
    writeFileSync(
      join(tmpRoot, '3d-tripo', 'package.json'),
      JSON.stringify({ name: '@stageflip/3d-tripo' }),
    );
    mkdirSync(join(tmpRoot, 'schema'));
    writeFileSync(
      join(tmpRoot, 'schema', 'package.json'),
      JSON.stringify({ name: '@stageflip/schema' }),
    );
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.name)).toEqual(['@stageflip/3d-tripo', '@stageflip/tts-kokoro']);
  });

  it('skips entries whose package.json is malformed', () => {
    mkdirSync(join(tmpRoot, 'tts-broken'));
    writeFileSync(join(tmpRoot, 'tts-broken', 'package.json'), 'not-json');
    mkdirSync(join(tmpRoot, 'tts-good'));
    writeFileSync(
      join(tmpRoot, 'tts-good', 'package.json'),
      JSON.stringify({ name: '@stageflip/tts-good' }),
    );
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('@stageflip/tts-good');
  });

  it('skips entries missing a package.json', () => {
    mkdirSync(join(tmpRoot, 'tts-no-manifest'));
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toEqual([]);
  });

  it('skips entries whose name is not a string', () => {
    mkdirSync(join(tmpRoot, 'tts-nameless'));
    writeFileSync(join(tmpRoot, 'tts-nameless', 'package.json'), JSON.stringify({}));
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toEqual([]);
  });

  it('skips non-directory entries inside packages root', () => {
    writeFileSync(join(tmpRoot, 'stray-file.txt'), 'noise');
    mkdirSync(join(tmpRoot, 'tts-real'));
    writeFileSync(
      join(tmpRoot, 'tts-real', 'package.json'),
      JSON.stringify({ name: '@stageflip/tts-real' }),
    );
    const result = discoverAdapterPackages(tmpRoot);
    expect(result).toHaveLength(1);
  });
});

// ---------- extractDescriptorsFromPackage ----------

describe('extractDescriptorsFromPackage — dynamic import', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'check-asset-licenses-extract-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns missingDescriptor when src/index.ts does not export anything', async () => {
    const dir = join(tmpRoot, 'tts-empty');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), 'export const noise = 1;');
    const result = await extractDescriptorsFromPackage({ name: '@stageflip/tts-empty', dir });
    expect(result.missingDescriptor).toBe(true);
    expect(result.descriptors).toEqual([]);
    expect(result.parseError).toBeUndefined();
  });

  it('returns parseError when dynamic-import fails (no index file)', async () => {
    const dir = join(tmpRoot, 'tts-no-index');
    mkdirSync(dir);
    const result = await extractDescriptorsFromPackage({ name: '@stageflip/tts-no-index', dir });
    expect(result.parseError).toBeDefined();
    expect(result.parseError?.cause).toContain('dynamic-import failed');
    expect(result.descriptors).toEqual([]);
  });

  it('extracts a single `descriptor` named export', async () => {
    const dir = join(tmpRoot, 'tts-single');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptor = ${JSON.stringify({
        id: 'tts-single',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'apache-2.0' },
        sandbox: { kind: 'in-process' },
      })};`,
    );
    const result = await extractDescriptorsFromPackage({ name: '@stageflip/tts-single', dir });
    expect(result.descriptors).toHaveLength(1);
    expect(result.descriptors[0]?.id).toBe('tts-single');
    expect(result.missingDescriptor).toBe(false);
    expect(result.parseError).toBeUndefined();
  });

  it('extracts a `descriptors` array named export', async () => {
    const dir = join(tmpRoot, 'tts-multi');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptors = ${JSON.stringify([
        {
          id: 'tts-a',
          modality: { kind: 'tts' },
          capability: {},
          license: { kind: 'apache-2.0' },
          sandbox: { kind: 'in-process' },
        },
        {
          id: 'tts-b',
          modality: { kind: 'tts' },
          capability: {},
          license: { kind: 'mit' },
          sandbox: { kind: 'in-process' },
        },
      ])};`,
    );
    const result = await extractDescriptorsFromPackage({ name: '@stageflip/tts-multi', dir });
    expect(result.descriptors).toHaveLength(2);
    expect(result.descriptors.map((d) => d.id)).toEqual(['tts-a', 'tts-b']);
  });

  it('returns parseError when descriptor fails Zod schema', async () => {
    const dir = join(tmpRoot, 'tts-malformed');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptor = ${JSON.stringify({
        id: 'NOT_KEBAB',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'apache-2.0' },
        sandbox: { kind: 'in-process' },
      })};`,
    );
    const result = await extractDescriptorsFromPackage({
      name: '@stageflip/tts-malformed',
      dir,
    });
    expect(result.parseError).toBeDefined();
    expect(result.parseError?.source).toContain('tts-malformed');
    expect(result.descriptors).toEqual([]);
  });
});

// ---------- main — end-to-end against synthetic packages root ----------

describe('main — end-to-end', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'check-asset-licenses-main-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('exits 0 against an empty packages root (inaugural state)', async () => {
    const code = await main(tmpRoot);
    expect(code).toBe(0);
  });

  it('exits 0 with a single whitelisted adapter discovered + extracted + validated', async () => {
    const dir = join(tmpRoot, 'tts-good');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@stageflip/tts-good' }));
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptor = ${JSON.stringify({
        id: 'tts-good',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'apache-2.0' },
        sandbox: { kind: 'in-process' },
      })};`,
    );
    const code = await main(tmpRoot);
    expect(code).toBe(0);
  });

  it('exits 1 when a discovered adapter declares cc-by under tts (non-whitelisted)', async () => {
    const dir = join(tmpRoot, 'tts-bad');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@stageflip/tts-bad' }));
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptor = ${JSON.stringify({
        id: 'tts-bad',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'cc-by' },
        sandbox: { kind: 'in-process' },
      })};`,
    );
    const code = await main(tmpRoot);
    expect(code).toBe(1);
  });

  it('exits 1 when a discovered package is missing its descriptor export', async () => {
    const dir = join(tmpRoot, 'tts-no-descriptor');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@stageflip/tts-no-descriptor' }),
    );
    writeFileSync(join(dir, 'src', 'index.ts'), 'export const other = 42;');
    const code = await main(tmpRoot);
    expect(code).toBe(1);
  });

  it('exits 1 when a discovered package fails Zod parse', async () => {
    const dir = join(tmpRoot, 'tts-bad-shape');
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@stageflip/tts-bad-shape' }));
    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `export const descriptor = ${JSON.stringify({
        id: 'BAD_ID_UPPERCASE',
        modality: { kind: 'tts' },
        capability: {},
        license: { kind: 'apache-2.0' },
        sandbox: { kind: 'in-process' },
      })};`,
    );
    const code = await main(tmpRoot);
    expect(code).toBe(1);
  });
});
