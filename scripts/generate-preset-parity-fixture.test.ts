// scripts/generate-preset-parity-fixture.test.ts
// Tests for the parity-fixture auto-generation pipeline (T-313).
// AC numbers refer to docs/tasks/T-313.md.
//
// The renderer is dependency-injected per the spec — production CLI passes the
// real `@stageflip/renderer-cdp`-backed renderer; tests pass a stub renderer
// (which never requires Chrome / ffmpeg). Mirrors the auth-middleware DI
// pattern used in T-262.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CANONICAL_FRAME,
  DEFAULT_COMPOSITION,
  DEFAULT_THRESHOLDS,
  type FixtureRenderer,
  RenderUnavailableError,
  __resetProductionRendererForTests,
  bindProductionRenderer,
  buildManifest,
  findPresetById,
  fixtureDirFor,
  formatUtcDate,
  parseArgs,
  productionRenderer,
  rewriteSignOff,
  runGenerate,
  usage,
  writeFileAtomic,
} from './generate-preset-parity-fixture.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REAL_PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// ---------- helpers ----------

function makeSyntheticPreset(opts: {
  cluster: string;
  id: string;
  parityFixture?: string;
  preferredFamily?: string;
  preferredLicense?: string;
  fallback?: { family: string; weight: number; license: string };
}): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${opts.id}`);
  lines.push(`cluster: ${opts.cluster}`);
  lines.push('clipKind: lowerThird');
  lines.push('source: docs/compass.md#synthetic');
  lines.push('status: stub');
  lines.push('preferredFont:');
  lines.push(`  family: ${opts.preferredFamily ?? 'Inter'}`);
  lines.push(`  license: ${opts.preferredLicense ?? 'ofl'}`);
  if (opts.fallback) {
    lines.push('fallbackFont:');
    lines.push(`  family: ${opts.fallback.family}`);
    lines.push(`  weight: ${opts.fallback.weight}`);
    lines.push(`  license: ${opts.fallback.license}`);
  }
  lines.push('permissions: []');
  lines.push('signOff:');
  lines.push(`  parityFixture: ${opts.parityFixture ?? 'pending-user-review'}`);
  lines.push('  typeDesign: pending-cluster-batch');
  lines.push('---');
  lines.push('');
  lines.push('# Synthetic body content');
  lines.push('');
  lines.push('## Visual tokens');
  lines.push('- Token A');
  lines.push('');
  return lines.join('\n');
}

function writeSyntheticTree(opts: {
  presets: Array<Parameters<typeof makeSyntheticPreset>[0]>;
}): string {
  const root = mkdtempSync(join(tmpdir(), 't313-presets-'));
  const clusters = new Set(opts.presets.map((p) => p.cluster));
  for (const cluster of clusters) {
    const dir = join(root, cluster);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---
title: Cluster ${cluster}
id: skills/stageflip/presets/${cluster}
tier: cluster
status: stub
last_updated: 2026-04-27
owner_task: T-313
related: []
---

# Cluster ${cluster}
`,
    );
  }
  for (const p of opts.presets) {
    writeFileSync(join(root, p.cluster, `${p.id}.md`), makeSyntheticPreset(p));
  }
  return root;
}

function makeFixturesRoot(): string {
  return mkdtempSync(join(tmpdir(), 't313-fixtures-'));
}

/** Stub renderer that returns a tiny PNG-shaped buffer. */
const STUB_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const stubRenderer: FixtureRenderer = {
  render: () => STUB_PNG,
};

const unavailableRenderer: FixtureRenderer = {
  render: () => {
    throw new RenderUnavailableError('chrome not found');
  },
};

const crashingRenderer: FixtureRenderer = {
  render: () => {
    throw new Error('boom');
  },
};

// ---------- formatUtcDate ----------

describe('formatUtcDate', () => {
  it('zero-pads month and day', () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(formatUtcDate(d)).toBe('2026-01-05');
  });

  it('handles late-year dates', () => {
    const d = new Date(Date.UTC(2026, 11, 31));
    expect(formatUtcDate(d)).toBe('2026-12-31');
  });
});

// ---------- buildManifest ----------

describe('buildManifest', () => {
  it('builds a manifest from a preset (with fallback)', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'cnn-classic',
          preferredFamily: 'CNN Sans',
          preferredLicense: 'proprietary-byo',
          fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
        },
      ],
    });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      expect(preset).toBeDefined();
      if (!preset) return;
      const manifest = buildManifest({ preset, frame: 60 });
      expect(manifest.name).toBe('cnn-classic');
      expect(manifest.cluster).toBe('news');
      expect(manifest.kind).toBe('lowerThird');
      expect(manifest.referenceFrames).toEqual([60]);
      expect(manifest.composition).toEqual(DEFAULT_COMPOSITION);
      expect(manifest.fonts.preferred).toEqual({
        family: 'CNN Sans',
        license: 'proprietary-byo',
      });
      expect(manifest.fonts.fallback).toEqual({
        family: 'Inter Tight',
        weight: 700,
        license: 'ofl',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('omits fallback when preset has none', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'plain' }],
    });
    try {
      const preset = findPresetById({ presetId: 'plain', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({ preset, frame: 30 });
      expect(manifest.fonts.fallback).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses a custom composition when provided', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'plain' }],
    });
    try {
      const preset = findPresetById({ presetId: 'plain', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({
        preset,
        frame: 0,
        composition: { width: 1920, height: 1080, fps: 60, durationInFrames: 300 },
      });
      expect(manifest.composition.width).toBe(1920);
      expect(manifest.composition.fps).toBe(60);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- fixtureDirFor ----------

describe('fixtureDirFor', () => {
  it('produces <root>/<cluster>/<preset>', () => {
    const dir = fixtureDirFor({
      cluster: 'news',
      presetId: 'cnn-classic',
      fixturesRoot: '/tmp/x',
    });
    expect(dir).toBe(resolve('/tmp/x', 'news', 'cnn-classic'));
  });
});

// ---------- findPresetById ----------

describe('findPresetById', () => {
  it('returns the preset when present', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      expect(preset?.frontmatter.id).toBe('cnn-classic');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined for unknown id (AC #2)', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    try {
      const preset = findPresetById({ presetId: 'mystery', presetsRoot: root });
      expect(preset).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- rewriteSignOff (AC #5/6/7) ----------

describe('rewriteSignOff — frontmatter mutation safety (AC #5/6/7)', () => {
  const baseRaw = makeSyntheticPreset({
    cluster: 'news',
    id: 'cnn-classic',
    preferredFamily: 'CNN Sans',
    preferredLicense: 'proprietary-byo',
    fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
  });

  it('rewrites pending-user-review → signed:<date> (AC #5)', () => {
    const updated = rewriteSignOff({
      raw: baseRaw,
      filePath: 'cnn-classic.md',
      date: '2026-04-27',
      force: false,
    });
    const parsed = matter(updated);
    expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
      'signed:2026-04-27',
    );
  });

  it('preserves the body (AC #7)', () => {
    const updated = rewriteSignOff({
      raw: baseRaw,
      filePath: 'cnn-classic.md',
      date: '2026-04-27',
      force: false,
    });
    expect(updated).toContain('# Synthetic body content');
    expect(updated).toContain('## Visual tokens');
    expect(updated).toContain('- Token A');
  });

  it('preserves unrelated frontmatter fields (AC #7)', () => {
    const updated = rewriteSignOff({
      raw: baseRaw,
      filePath: 'cnn-classic.md',
      date: '2026-04-27',
      force: false,
    });
    const parsed = matter(updated);
    const data = parsed.data as Record<string, unknown>;
    expect(data.id).toBe('cnn-classic');
    expect(data.cluster).toBe('news');
    expect(data.clipKind).toBe('lowerThird');
    expect(data.preferredFont).toEqual({ family: 'CNN Sans', license: 'proprietary-byo' });
    expect(data.fallbackFont).toEqual({
      family: 'Inter Tight',
      weight: 700,
      license: 'ofl',
    });
    // typeDesign untouched.
    expect((data.signOff as { typeDesign: string }).typeDesign).toBe('pending-cluster-batch');
  });

  it('rejects re-sign when already signed (AC #6)', () => {
    const signed = rewriteSignOff({
      raw: baseRaw,
      filePath: 'p.md',
      date: '2026-04-27',
      force: false,
    });
    expect(() =>
      rewriteSignOff({ raw: signed, filePath: 'p.md', date: '2026-05-01', force: false }),
    ).toThrow(/already 'signed:2026-04-27'/);
  });

  it('allows re-sign with --force', () => {
    const signed = rewriteSignOff({
      raw: baseRaw,
      filePath: 'p.md',
      date: '2026-04-27',
      force: false,
    });
    const resigned = rewriteSignOff({
      raw: signed,
      filePath: 'p.md',
      date: '2026-05-01',
      force: true,
    });
    const parsed = matter(resigned);
    expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
      'signed:2026-05-01',
    );
  });

  it('errors when signOff is missing', () => {
    const broken = '---\nid: x\ncluster: news\n---\n\nbody';
    expect(() =>
      rewriteSignOff({ raw: broken, filePath: 'p.md', date: '2026-04-27', force: false }),
    ).toThrow(/missing signOff block/);
  });

  it('errors when signOff.parityFixture is missing', () => {
    const broken = '---\nid: x\nsignOff:\n  typeDesign: na\n---\n\nbody';
    expect(() =>
      rewriteSignOff({ raw: broken, filePath: 'p.md', date: '2026-04-27', force: false }),
    ).toThrow(/parityFixture missing/);
  });
});

// ---------- writeFileAtomic (AC #8) ----------

describe('writeFileAtomic — atomic-ish write (AC #8)', () => {
  it('writes a file successfully', () => {
    const dir = mkdtempSync(join(tmpdir(), 't313-atomic-'));
    try {
      const target = join(dir, 'out.txt');
      writeFileAtomic(target, 'hello');
      expect(readFileSync(target, 'utf8')).toBe('hello');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes binary buffers', () => {
    const dir = mkdtempSync(join(tmpdir(), 't313-atomic-'));
    try {
      const target = join(dir, 'out.bin');
      writeFileAtomic(target, STUB_PNG);
      expect(readFileSync(target)).toEqual(Buffer.from(STUB_PNG));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves no temp file on success', () => {
    const dir = mkdtempSync(join(tmpdir(), 't313-atomic-'));
    try {
      writeFileAtomic(join(dir, 'a.txt'), 'x');
      // Verify only the one file exists (no orphan temp file remained).
      const list = readdirSync(dir);
      expect(list).toEqual(['a.txt']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cleans up temp file when the rename target is unwritable', () => {
    // Write into a path whose parent doesn't exist — the open() will fail,
    // but no temp file should be left behind in any reachable directory.
    expect(() => writeFileAtomic('/no/such/dir/__t313__/nope.txt', 'x')).toThrow();
  });
});

// ---------- parseArgs ----------

describe('parseArgs', () => {
  it('parses --preset, --frame, --mark-signed, --force', () => {
    const { args, errors } = parseArgs([
      '--preset=cnn-classic',
      '--frame=42',
      '--mark-signed',
      '--force',
    ]);
    expect(errors).toEqual([]);
    expect(args.preset).toBe('cnn-classic');
    expect(args.frame).toBe(42);
    expect(args.markSigned).toBe(true);
    expect(args.force).toBe(true);
  });

  it('rejects non-integer --frame', () => {
    const { errors } = parseArgs(['--preset=p', '--frame=abc']);
    expect(errors[0]).toContain('--frame must be a nonnegative integer');
  });

  it('rejects negative --frame', () => {
    const { errors } = parseArgs(['--preset=p', '--frame=-1']);
    expect(errors[0]).toContain('--frame must be a nonnegative integer');
  });

  it('handles --help and -h', () => {
    expect(parseArgs(['--help']).args.help).toBe(true);
    expect(parseArgs(['-h']).args.help).toBe(true);
  });

  it('rejects unknown flags', () => {
    const { errors } = parseArgs(['--unknown=1']);
    expect(errors[0]).toContain("unknown flag '--unknown'");
  });

  it('rejects positional args', () => {
    const { errors } = parseArgs(['oops']);
    expect(errors[0]).toContain("unrecognised argument 'oops'");
  });

  it('parses --presets-root and --fixtures-root', () => {
    const { args } = parseArgs(['--presets-root=/foo', '--fixtures-root=/bar']);
    expect(args.presetsRoot).toBe('/foo');
    expect(args.fixturesRoot).toBe('/bar');
  });

  it('default frame is the canonical mid-hold', () => {
    const { args } = parseArgs(['--preset=p']);
    expect(args.frame).toBe(DEFAULT_CANONICAL_FRAME);
  });
});

// ---------- runGenerate ----------

describe('runGenerate — happy path (AC #1)', () => {
  it('writes manifest.json + golden-frame-<n>.png + thresholds.json', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'cnn-classic',
          preferredFamily: 'CNN Sans',
          preferredLicense: 'proprietary-byo',
          fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
        },
      ],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer },
      );
      expect(r.exitCode).toBe(0);
      const dir = join(fixturesRoot, 'news', 'cnn-classic');
      expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
      expect(existsSync(join(dir, `golden-frame-${DEFAULT_CANONICAL_FRAME}.png`))).toBe(true);
      expect(existsSync(join(dir, 'thresholds.json'))).toBe(true);

      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      expect(manifest.name).toBe('cnn-classic');
      const thresholds = JSON.parse(readFileSync(join(dir, 'thresholds.json'), 'utf8'));
      expect(thresholds).toEqual(DEFAULT_THRESHOLDS);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('--frame=<n> overrides the default canonical frame (AC #3)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          '--frame=120',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer },
      );
      expect(r.exitCode).toBe(0);
      const dir = join(fixturesRoot, 'news', 'cnn-classic');
      expect(existsSync(join(dir, 'golden-frame-120.png'))).toBe(true);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('async renderer is awaited', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    const asyncRenderer: FixtureRenderer = {
      render: async () => Promise.resolve(STUB_PNG),
    };
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: asyncRenderer },
      );
      expect(r.exitCode).toBe(0);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });
});

describe('runGenerate — error paths', () => {
  it('--help → exit 0', async () => {
    const r = await runGenerate(['--help'], { renderer: stubRenderer });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.join('\n')).toContain('Usage');
  });

  it('parse error → exit 2', async () => {
    const r = await runGenerate(['oops'], { renderer: stubRenderer });
    expect(r.exitCode).toBe(2);
  });

  it('missing --preset → exit 2', async () => {
    const r = await runGenerate([], { renderer: stubRenderer });
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('--preset=<id> is required');
  });

  it('unknown preset → exit 1 with clear error (AC #2)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    try {
      const r = await runGenerate(['--preset=mystery', `--presets-root=${presetsRoot}`], {
        renderer: stubRenderer,
      });
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join('\n')).toContain("unknown preset 'mystery'");
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
    }
  });

  it('renderer-unavailable error → exit 1 with clear message (AC #4)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: unavailableRenderer },
      );
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join('\n')).toContain('rendering pipeline unavailable');
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('renderer crash → exit 1 with diagnostic', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: crashingRenderer },
      );
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join('\n')).toContain('render failed');
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('loader failure → exit 1', async () => {
    const r = await runGenerate(['--preset=cnn-classic', '--presets-root=/no/such/__t313__/path'], {
      renderer: stubRenderer,
    });
    expect(r.exitCode).toBe(1);
    expect(r.stderr.join('\n')).toContain('failed to load presets');
  });
});

describe('runGenerate — --mark-signed flow (AC #5/6)', () => {
  it('updates frontmatter to signed:<today>', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          '--mark-signed',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer, today: () => '2026-04-27' },
      );
      expect(r.exitCode).toBe(0);
      const updated = readFileSync(join(presetsRoot, 'news', 'cnn-classic.md'), 'utf8');
      const parsed = matter(updated);
      expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
        'signed:2026-04-27',
      );
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('refuses to re-sign without --force (AC #6)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'cnn-classic',
          parityFixture: 'signed:2026-04-01',
        },
      ],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          '--mark-signed',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer, today: () => '2026-04-27' },
      );
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join('\n')).toContain("already 'signed:2026-04-01'");
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('allows re-sign with --force', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'cnn-classic',
          parityFixture: 'signed:2026-04-01',
        },
      ],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          '--mark-signed',
          '--force',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer, today: () => '2026-04-27' },
      );
      expect(r.exitCode).toBe(0);
      const updated = readFileSync(join(presetsRoot, 'news', 'cnn-classic.md'), 'utf8');
      const parsed = matter(updated);
      expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
        'signed:2026-04-27',
      );
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('preserves body and unrelated frontmatter when marking signed (AC #7)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'cnn-classic',
          preferredFamily: 'CNN Sans',
          preferredLicense: 'proprietary-byo',
          fallback: { family: 'Inter Tight', weight: 700, license: 'ofl' },
        },
      ],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const before = readFileSync(join(presetsRoot, 'news', 'cnn-classic.md'), 'utf8');
      const beforeBody = before.split('---').slice(2).join('---');

      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          '--mark-signed',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer, today: () => '2026-04-27' },
      );
      expect(r.exitCode).toBe(0);

      const after = readFileSync(join(presetsRoot, 'news', 'cnn-classic.md'), 'utf8');
      const afterBody = after.split('---').slice(2).join('---');
      expect(afterBody.trim()).toBe(beforeBody.trim());

      const parsed = matter(after);
      const data = parsed.data as Record<string, unknown>;
      expect(data.id).toBe('cnn-classic');
      expect(data.fallbackFont).toEqual({
        family: 'Inter Tight',
        weight: 700,
        license: 'ofl',
      });
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });
});

// ---------- productionRenderer / usage ----------

describe('productionRenderer', () => {
  it('throws RenderUnavailableError until wired into the parity-prime pipeline', () => {
    __resetProductionRendererForTests();
    const root = writeSyntheticTree({ presets: [{ cluster: 'news', id: 'cnn-classic' }] });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      expect(() =>
        productionRenderer.render({
          preset,
          composition: DEFAULT_COMPOSITION,
          frame: 0,
        }),
      ).toThrow(RenderUnavailableError);
    } finally {
      __resetProductionRendererForTests();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('usage', () => {
  it('mentions the relevant flags', () => {
    const u = usage();
    expect(u).toContain('--preset');
    expect(u).toContain('--frame');
    expect(u).toContain('--mark-signed');
  });
});

// ---------- subprocess CLI smoke ----------

describe('subprocess CLI', () => {
  it('exits 0 for --help', () => {
    const result = spawnSync(
      'tsx',
      [resolve(__dirname, 'generate-preset-parity-fixture.ts'), '--help'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage');
  });

  it('without renderer wiring, real-preset request → exit 1 unavailable', () => {
    const result = spawnSync(
      'tsx',
      [
        resolve(__dirname, 'generate-preset-parity-fixture.ts'),
        '--preset=cnn-classic',
        `--presets-root=${REAL_PRESETS_ROOT}`,
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('rendering pipeline unavailable');
  });
});

// ---------- T-359a — multi-variant parseArgs ----------

describe('parseArgs — --variant (T-359a AC #1, #2)', () => {
  it('accepts a single --variant', () => {
    const { args, errors } = parseArgs(['--preset=p', '--variant=sessionBest']);
    expect(errors).toEqual([]);
    expect(args.variants).toEqual(['sessionBest']);
  });

  it('accepts repeated --variant flags (AC #1)', () => {
    const { args, errors } = parseArgs([
      '--preset=p',
      '--variant=sessionBest',
      '--variant=personalBest',
      '--variant=neutral',
    ]);
    expect(errors).toEqual([]);
    expect(args.variants).toEqual(['sessionBest', 'personalBest', 'neutral']);
  });

  it('accepts comma-separated --variant value (AC #1)', () => {
    const { args, errors } = parseArgs([
      '--preset=p',
      '--variant=sessionBest,personalBest,neutral',
    ]);
    expect(errors).toEqual([]);
    expect(args.variants).toEqual(['sessionBest', 'personalBest', 'neutral']);
  });

  it('mixes repeated + comma-separated and dedups in declared order', () => {
    const { args, errors } = parseArgs([
      '--preset=p',
      '--variant=a,b',
      '--variant=b',
      '--variant=c',
    ]);
    expect(errors).toEqual([]);
    expect(args.variants).toEqual(['a', 'b', 'c']);
  });

  it('rejects invalid variant names (AC #2)', () => {
    const { errors } = parseArgs(['--preset=p', '--variant=Bad-Name']);
    expect(errors[0]).toMatch(/--variant.*Bad-Name/);
  });

  it('rejects variant starting with uppercase (AC #2)', () => {
    const { errors } = parseArgs(['--preset=p', '--variant=SessionBest']);
    expect(errors[0]).toMatch(/--variant/);
  });

  it('rejects empty variant in comma list (AC #2)', () => {
    const { errors } = parseArgs(['--preset=p', '--variant=a,,b']);
    expect(errors[0]).toMatch(/--variant/);
  });

  it('default variants is empty array (single-variant legacy)', () => {
    const { args } = parseArgs(['--preset=p']);
    expect(args.variants).toEqual([]);
  });
});

// ---------- T-359a — buildManifest multi-variant ----------

describe('buildManifest — multi-variant shape (T-359a AC #4, #11)', () => {
  it('omits variants field when no variants supplied (single-variant legacy AC #11)', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({ preset, frame: 60 });
      expect(manifest.variants).toBeUndefined();
      expect(manifest.referenceFrames).toEqual([60]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('populates object-keyed variants when variants supplied (AC #4)', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    try {
      const preset = findPresetById({ presetId: 'f1-sector', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({
        preset,
        frame: 60,
        variants: ['sessionBest', 'personalBest', 'neutral'],
      });
      expect(manifest.variants).toBeDefined();
      expect(manifest.variants).toEqual({
        sessionBest: { frames: [60] },
        personalBest: { frames: [60] },
        neutral: { frames: [60] },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps referenceFrames present alongside variants for legacy readers', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    try {
      const preset = findPresetById({ presetId: 'f1-sector', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({
        preset,
        frame: 60,
        variants: ['a', 'b'],
      });
      expect(manifest.referenceFrames).toEqual([60]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses variant-aware goldens pattern when variants supplied', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    try {
      const preset = findPresetById({ presetId: 'f1-sector', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      const manifest = buildManifest({
        preset,
        frame: 60,
        variants: ['a', 'b'],
      });
      expect(manifest.goldens.pattern).toContain('${variant}');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- T-359a — runGenerate multi-variant ----------

describe('runGenerate — multi-variant render loop (T-359a AC #3, #5)', () => {
  it('writes one golden per variant with -<variant> suffix (AC #3)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    const fixturesRoot = makeFixturesRoot();
    const calls: string[] = [];
    const variantRenderer: FixtureRenderer = {
      render: (args) => {
        calls.push(args.variant ?? '<none>');
        return STUB_PNG;
      },
    };
    try {
      const r = await runGenerate(
        [
          '--preset=f1-sector',
          '--variant=sessionBest',
          '--variant=personalBest',
          '--variant=neutral',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: variantRenderer },
      );
      expect(r.exitCode).toBe(0);
      const dir = join(fixturesRoot, 'data', 'f1-sector');
      expect(existsSync(join(dir, 'golden-frame-60-sessionBest.png'))).toBe(true);
      expect(existsSync(join(dir, 'golden-frame-60-personalBest.png'))).toBe(true);
      expect(existsSync(join(dir, 'golden-frame-60-neutral.png'))).toBe(true);
      expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      expect(manifest.variants).toEqual({
        sessionBest: { frames: [60] },
        personalBest: { frames: [60] },
        neutral: { frames: [60] },
      });
      expect(calls).toEqual(['sessionBest', 'personalBest', 'neutral']);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('partial-render failure aborts before frontmatter mutation (AC #5)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    const fixturesRoot = makeFixturesRoot();
    const partialRenderer: FixtureRenderer = {
      render: (args) => {
        if (args.variant === 'personalBest') throw new Error('boom for personalBest');
        return STUB_PNG;
      },
    };
    try {
      const r = await runGenerate(
        [
          '--preset=f1-sector',
          '--variant=sessionBest',
          '--variant=personalBest',
          '--variant=neutral',
          '--mark-signed',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: partialRenderer, today: () => '2026-05-03' },
      );
      expect(r.exitCode).toBe(1);
      expect(r.stderr.join('\n')).toContain('personalBest');
      const updated = readFileSync(join(presetsRoot, 'data', 'f1-sector.md'), 'utf8');
      const parsed = matter(updated);
      expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
        'pending-user-review',
      );
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('--mark-signed succeeds when all variants render (AC #5)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=f1-sector',
          '--variant=sessionBest',
          '--variant=personalBest',
          '--variant=neutral',
          '--mark-signed',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer, today: () => '2026-05-03' },
      );
      expect(r.exitCode).toBe(0);
      const updated = readFileSync(join(presetsRoot, 'data', 'f1-sector.md'), 'utf8');
      const parsed = matter(updated);
      expect((parsed.data as { signOff: { parityFixture: string } }).signOff.parityFixture).toBe(
        'signed:2026-05-03',
      );
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('multi-variant idempotency: re-run overwrites cleanly (AC #6)', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const argsList = [
        '--preset=f1-sector',
        '--variant=a',
        '--variant=b',
        `--presets-root=${presetsRoot}`,
        `--fixtures-root=${fixturesRoot}`,
      ];
      const r1 = await runGenerate(argsList, { renderer: stubRenderer });
      expect(r1.exitCode).toBe(0);
      const dir = join(fixturesRoot, 'data', 'f1-sector');
      const m1 = readFileSync(join(dir, 'manifest.json'), 'utf8');
      const r2 = await runGenerate(argsList, { renderer: stubRenderer });
      expect(r2.exitCode).toBe(0);
      const m2 = readFileSync(join(dir, 'manifest.json'), 'utf8');
      expect(m2).toBe(m1);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });

  it('single-variant invocation byte-identical to T-313 baseline (AC #11)', async () => {
    // Render twice with the same args, no --variant. The two manifests must
    // match byte-for-byte (no `variants` key, identical layout).
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'cnn-classic' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      const r = await runGenerate(
        [
          '--preset=cnn-classic',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: stubRenderer },
      );
      expect(r.exitCode).toBe(0);
      const manifest = JSON.parse(
        readFileSync(join(fixturesRoot, 'news', 'cnn-classic', 'manifest.json'), 'utf8'),
      );
      expect(manifest.variants).toBeUndefined();
      expect(manifest.referenceFrames).toEqual([DEFAULT_CANONICAL_FRAME]);
      // The single golden file uses the no-suffix shape.
      expect(
        existsSync(
          join(fixturesRoot, 'news', 'cnn-classic', `golden-frame-${DEFAULT_CANONICAL_FRAME}.png`),
        ),
      ).toBe(true);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });
});

// ---------- T-359a — bindProductionRenderer ----------

describe('bindProductionRenderer (T-359a AC #7, #8, #9)', () => {
  it('production renderer throws RenderUnavailableError before binding (AC #9 baseline)', () => {
    __resetProductionRendererForTests();
    const root = writeSyntheticTree({ presets: [{ cluster: 'news', id: 'cnn-classic' }] });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      expect(() =>
        productionRenderer.render({
          preset,
          composition: DEFAULT_COMPOSITION,
          frame: 0,
        }),
      ).toThrow(RenderUnavailableError);
    } finally {
      rmSync(root, { recursive: true, force: true });
      __resetProductionRendererForTests();
    }
  });

  it('bindProductionRenderer swaps the impl; production renderer then defers to it (AC #8)', async () => {
    const root = writeSyntheticTree({ presets: [{ cluster: 'news', id: 'cnn-classic' }] });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      bindProductionRenderer({
        render: () => new Uint8Array([1, 2, 3, 4]),
      });
      const result = await Promise.resolve(
        productionRenderer.render({ preset, composition: DEFAULT_COMPOSITION, frame: 0 }),
      );
      expect(Array.from(result)).toEqual([1, 2, 3, 4]);
    } finally {
      __resetProductionRendererForTests();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('after reset, production renderer reverts to RenderUnavailableError (AC #9)', () => {
    const root = writeSyntheticTree({ presets: [{ cluster: 'news', id: 'cnn-classic' }] });
    try {
      const preset = findPresetById({ presetId: 'cnn-classic', presetsRoot: root });
      if (!preset) throw new Error('test setup');
      bindProductionRenderer({ render: () => new Uint8Array([9]) });
      __resetProductionRendererForTests();
      expect(() =>
        productionRenderer.render({ preset, composition: DEFAULT_COMPOSITION, frame: 0 }),
      ).toThrow(RenderUnavailableError);
    } finally {
      __resetProductionRendererForTests();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('end-to-end: bound renderer drives a multi-variant runGenerate', async () => {
    const presetsRoot = writeSyntheticTree({
      presets: [{ cluster: 'data', id: 'f1-sector' }],
    });
    const fixturesRoot = makeFixturesRoot();
    try {
      bindProductionRenderer({
        render: (args) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, args.variant?.length ?? 0]),
      });
      const r = await runGenerate(
        [
          '--preset=f1-sector',
          '--variant=sessionBest',
          '--variant=neutral',
          `--presets-root=${presetsRoot}`,
          `--fixtures-root=${fixturesRoot}`,
        ],
        { renderer: productionRenderer },
      );
      expect(r.exitCode).toBe(0);
      const dir = join(fixturesRoot, 'data', 'f1-sector');
      expect(existsSync(join(dir, 'golden-frame-60-sessionBest.png'))).toBe(true);
      expect(existsSync(join(dir, 'golden-frame-60-neutral.png'))).toBe(true);
    } finally {
      __resetProductionRendererForTests();
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(fixturesRoot, { recursive: true, force: true });
    }
  });
});
