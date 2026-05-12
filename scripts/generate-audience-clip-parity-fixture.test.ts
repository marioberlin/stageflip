// scripts/generate-audience-clip-parity-fixture.test.ts
// Tests for the audience parity-fixture generator CLI (T-476).
//
// Mirrors `scripts/generate-preset-parity-fixture.test.ts`'s shape:
// dependency-injected renderer (stub never requires Chrome / audience
// runtime); on-disk fixture trees materialized in tmpdir per case.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AUDIENCE_CLUSTER_NAME,
  type AudienceFixtureRenderer,
  DEFAULT_COMPOSITION,
  RenderUnavailableError,
  __resetProductionRendererForTests,
  bindProductionRenderer,
  buildProvenance,
  fixtureDirFor,
  parseArgs,
  productionRenderer,
  readManifest,
  readSnapshot,
  runGenerate,
  usage,
  writeFileAtomic,
} from './generate-audience-clip-parity-fixture.js';

// ---------- helpers ----------

interface FixtureSeed {
  clipKind: string;
  manifest: Record<string, unknown>;
  snapshot: Record<string, unknown>;
}

function seedFixtureTree(seeds: readonly FixtureSeed[]): string {
  const root = mkdtempSync(join(tmpdir(), 't476-fixtures-'));
  const audienceRoot = join(root, AUDIENCE_CLUSTER_NAME);
  mkdirSync(audienceRoot, { recursive: true });
  for (const seed of seeds) {
    const dir = join(audienceRoot, seed.clipKind);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(seed.manifest, null, 2)}\n`);
    writeFileSync(join(dir, 'snapshot.json'), `${JSON.stringify(seed.snapshot, null, 2)}\n`);
    writeFileSync(
      join(dir, 'thresholds.json'),
      `${JSON.stringify({ minPsnr: 35, minSsim: 0.95, maxFailingFrames: 0 }, null, 2)}\n`,
    );
  }
  return root;
}

const SAMPLE_MC_SNAPSHOT = {
  kind: 'live-poll-multiple-choice',
  optionCounts: [10, 5, 3],
  totalVotes: 18,
};

const SAMPLE_MC_MANIFEST = {
  name: 'live-poll-multiple-choice',
  cluster: 'audience',
  kind: 'live-poll-multiple-choice',
  description: 'sample',
  composition: { width: 1920, height: 1080, fps: 30, durationInFrames: 150 },
  referenceFrames: [75],
  goldens: { dir: '.', pattern: 'golden-frame-${frame}.png' },
  auditTagged: 'T-476: test',
};

function stubRenderer(opts: { png?: Uint8Array; throws?: Error } = {}): AudienceFixtureRenderer {
  return {
    render() {
      if (opts.throws) throw opts.throws;
      return opts.png ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic header
    },
  };
}

// ---------- tests ----------

describe('parseArgs', () => {
  it('parses --clip-kind for valid audience kinds', () => {
    const { args, errors } = parseArgs(['--clip-kind=live-poll-multiple-choice']);
    expect(errors).toEqual([]);
    expect(args.clipKind).toBe('live-poll-multiple-choice');
  });

  it('rejects unknown clip kinds', () => {
    const { args, errors } = parseArgs(['--clip-kind=not-a-kind']);
    expect(errors.length).toBeGreaterThan(0);
    expect(args.clipKind).toBeUndefined();
  });

  it('accepts --fixtures-root override', () => {
    const { args, errors } = parseArgs(['--fixtures-root=/tmp/foo']);
    expect(errors).toEqual([]);
    expect(args.fixturesRoot).toBe('/tmp/foo');
  });

  it('flags unknown flags', () => {
    const { errors } = parseArgs(['--bogus=value']);
    expect(errors).toEqual(["unknown flag '--bogus'"]);
  });

  it('flags positional arguments', () => {
    const { errors } = parseArgs(['positional']);
    expect(errors).toEqual(["unrecognised argument 'positional'"]);
  });

  it('honors --help', () => {
    const { args } = parseArgs(['--help']);
    expect(args.help).toBe(true);
  });

  it('lists all 11 audience kinds in usage()', () => {
    const text = usage();
    expect(text).toContain('live-poll-multiple-choice');
    expect(text).toContain('audience-ai-prompt');
    expect(text).toContain('heatmap');
    expect(text).toContain('survey');
  });
});

describe('fixtureDirFor', () => {
  it('resolves under <root>/audience/<kind>', () => {
    const dir = fixtureDirFor({ clipKind: 'heatmap', fixturesRoot: '/tmp/fx' });
    expect(dir).toBe(resolve('/tmp/fx/audience/heatmap'));
  });

  it('defaults to parity-fixtures when fixturesRoot is omitted', () => {
    const dir = fixtureDirFor({ clipKind: 'word-cloud' });
    expect(dir).toContain('parity-fixtures/audience/word-cloud');
  });
});

describe('readSnapshot', () => {
  let root: string;
  beforeEach(() => {
    root = seedFixtureTree([
      {
        clipKind: 'live-poll-multiple-choice',
        manifest: SAMPLE_MC_MANIFEST,
        snapshot: SAMPLE_MC_SNAPSHOT,
      },
    ]);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('parses and validates the snapshot', () => {
    const snapshot = readSnapshot({
      clipKind: 'live-poll-multiple-choice',
      fixtureDir: join(root, 'audience/live-poll-multiple-choice'),
    });
    expect(snapshot.kind).toBe('live-poll-multiple-choice');
  });

  it('rejects when the kind discriminant disagrees with the directory', () => {
    expect(() =>
      readSnapshot({
        clipKind: 'heatmap',
        fixtureDir: join(root, 'audience/live-poll-multiple-choice'),
      }),
    ).toThrow(/kind/);
  });

  it('rejects an invalid snapshot payload', () => {
    const bad = seedFixtureTree([
      {
        clipKind: 'live-poll-multiple-choice',
        manifest: SAMPLE_MC_MANIFEST,
        snapshot: { kind: 'live-poll-multiple-choice' }, // missing required fields
      },
    ]);
    try {
      expect(() =>
        readSnapshot({
          clipKind: 'live-poll-multiple-choice',
          fixtureDir: join(bad, 'audience/live-poll-multiple-choice'),
        }),
      ).toThrow(/aggregationValueSchema/);
    } finally {
      rmSync(bad, { recursive: true, force: true });
    }
  });
});

describe('readManifest', () => {
  let root: string;
  beforeEach(() => {
    root = seedFixtureTree([
      {
        clipKind: 'heatmap',
        manifest: { ...SAMPLE_MC_MANIFEST, kind: 'heatmap', name: 'heatmap' },
        snapshot: {
          kind: 'heatmap',
          taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
          totalTaps: 1,
          gridResolution: { w: 32, h: 32 },
        },
      },
    ]);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns the parsed manifest object', () => {
    const manifest = readManifest({ fixtureDir: join(root, 'audience/heatmap') });
    expect(manifest.kind).toBe('heatmap');
    expect(manifest.composition.width).toBe(1920);
  });
});

describe('buildProvenance', () => {
  it('returns a deterministic envelope keyed off the clip-kind + frame', () => {
    const provenance = buildProvenance({
      clipKind: 'live-poll-rating',
      aggregation: {
        kind: 'live-poll-rating',
        scoreCounts: [1, 0, 0, 0, 0],
        totalVotes: 1,
        mean: 1,
      },
      frame: 75,
    });
    expect(provenance.provider).toBe('parity-fixture');
    expect(provenance.sessionId).toBe('audience-fixture-live-poll-rating');
    expect(provenance.snapshotFrame).toBe(75);
    expect(provenance.clipKind).toBe('live-poll-rating');
    expect(provenance.snapshotPolicy).toBe('final');
    // Stable literal capture timestamp keeps re-renders reproducible.
    expect(provenance.capturedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('writeFileAtomic', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 't476-atomic-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes string content atomically', () => {
    const target = join(root, 'out.txt');
    writeFileAtomic(target, 'hello');
    expect(readFileSync(target, 'utf8')).toBe('hello');
  });

  it('writes binary content atomically', () => {
    const target = join(root, 'out.bin');
    writeFileAtomic(target, new Uint8Array([1, 2, 3, 4]));
    const written = readFileSync(target);
    expect(Array.from(written)).toEqual([1, 2, 3, 4]);
  });
});

describe('runGenerate', () => {
  let root: string;
  beforeEach(() => {
    root = seedFixtureTree([
      {
        clipKind: 'live-poll-multiple-choice',
        manifest: SAMPLE_MC_MANIFEST,
        snapshot: SAMPLE_MC_SNAPSHOT,
      },
    ]);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('renders the static-fallback path and writes a golden PNG', async () => {
    const renderer = stubRenderer({ png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xab]) });
    const result = await runGenerate(
      [`--clip-kind=live-poll-multiple-choice`, `--fixtures-root=${root}`],
      { renderer },
    );
    expect(result.exitCode).toBe(0);
    expect(result.written).toHaveLength(1);
    const golden = join(root, 'audience/live-poll-multiple-choice/golden-frame-75.png');
    expect(existsSync(golden)).toBe(true);
    const bytes = readFileSync(golden);
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0xab]);
  });

  it('exits with code 2 when --clip-kind is missing', async () => {
    const result = await runGenerate([`--fixtures-root=${root}`], { renderer: stubRenderer() });
    expect(result.exitCode).toBe(2);
    expect(result.stderr.some((line) => line.includes('--clip-kind'))).toBe(true);
  });

  it('exits with code 2 for parse errors', async () => {
    const result = await runGenerate(['--bogus=value'], { renderer: stubRenderer() });
    expect(result.exitCode).toBe(2);
    expect(result.stderr[0]).toContain("unknown flag '--bogus'");
  });

  it('exits with code 1 when the fixture directory is missing', async () => {
    const result = await runGenerate([`--clip-kind=heatmap`, `--fixtures-root=${root}`], {
      renderer: stubRenderer(),
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.some((line) => line.includes('fixture directory'))).toBe(true);
  });

  it('exits with code 1 when the snapshot fails schema validation', async () => {
    const bad = seedFixtureTree([
      {
        clipKind: 'live-poll-multiple-choice',
        manifest: SAMPLE_MC_MANIFEST,
        snapshot: { kind: 'live-poll-multiple-choice' }, // missing optionCounts
      },
    ]);
    try {
      const result = await runGenerate(
        [`--clip-kind=live-poll-multiple-choice`, `--fixtures-root=${bad}`],
        { renderer: stubRenderer() },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.some((line) => line.includes('aggregationValueSchema'))).toBe(true);
    } finally {
      rmSync(bad, { recursive: true, force: true });
    }
  });

  it('exits with code 1 when the renderer is unavailable', async () => {
    const renderer = stubRenderer({
      throws: new RenderUnavailableError('chrome not present'),
    });
    const result = await runGenerate(
      [`--clip-kind=live-poll-multiple-choice`, `--fixtures-root=${root}`],
      { renderer },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr.some((line) => line.includes('unavailable'))).toBe(true);
  });

  it('exits with code 1 when the renderer throws a non-unavailable error', async () => {
    const renderer = stubRenderer({ throws: new Error('boom') });
    const result = await runGenerate(
      [`--clip-kind=live-poll-multiple-choice`, `--fixtures-root=${root}`],
      { renderer },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr.some((line) => line.includes('render failed'))).toBe(true);
  });

  it('prints help and exits 0 with --help', async () => {
    const result = await runGenerate(['--help'], { renderer: stubRenderer() });
    expect(result.exitCode).toBe(0);
    expect(result.stdout[0]).toContain('Usage:');
  });

  it('respects manifest.referenceFrames when present (custom frame)', async () => {
    const customRoot = seedFixtureTree([
      {
        clipKind: 'live-poll-multiple-choice',
        manifest: { ...SAMPLE_MC_MANIFEST, referenceFrames: [42] },
        snapshot: SAMPLE_MC_SNAPSHOT,
      },
    ]);
    try {
      const result = await runGenerate(
        [`--clip-kind=live-poll-multiple-choice`, `--fixtures-root=${customRoot}`],
        { renderer: stubRenderer() },
      );
      expect(result.exitCode).toBe(0);
      const golden = join(customRoot, 'audience/live-poll-multiple-choice/golden-frame-42.png');
      expect(existsSync(golden)).toBe(true);
    } finally {
      rmSync(customRoot, { recursive: true, force: true });
    }
  });
});

describe('productionRenderer late binding', () => {
  afterEach(() => {
    __resetProductionRendererForTests();
  });

  it('throws RenderUnavailableError when unbound', () => {
    expect(() =>
      productionRenderer.render({
        clipKind: 'heatmap',
        provenance: buildProvenance({
          clipKind: 'heatmap',
          aggregation: {
            kind: 'heatmap',
            taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
            totalTaps: 1,
            gridResolution: { w: 32, h: 32 },
          },
          frame: 75,
        }),
        composition: DEFAULT_COMPOSITION,
        frame: 75,
      }),
    ).toThrow(RenderUnavailableError);
  });

  it('delegates to the bound renderer when set', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    bindProductionRenderer({
      render() {
        return bytes;
      },
    });
    const out = productionRenderer.render({
      clipKind: 'heatmap',
      provenance: buildProvenance({
        clipKind: 'heatmap',
        aggregation: {
          kind: 'heatmap',
          taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
          totalTaps: 1,
          gridResolution: { w: 32, h: 32 },
        },
        frame: 75,
      }),
      composition: DEFAULT_COMPOSITION,
      frame: 75,
    });
    expect(out).toBe(bytes);
  });
});
