// scripts/invoke-type-design-consultant.test.ts
// Tests for the orchestrator-side type-design-consultant invocation tooling
// (T-311). AC numbers refer to docs/tasks/T-311.md.
//
// The tests run against:
//   - the on-disk preset corpus (`skills/stageflip/presets/`) for
//     manifest-stability fixtures, and
//   - synthetic preset trees written under tmpdir for re-trigger and
//     empty-cluster cases (so they don't require committing fixture files).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALL_CLUSTER_IDENTIFIERS,
  EXEMPT_CLUSTER_LETTERS,
  REVIEWABLE_CLUSTER_LETTERS,
  assemblePrompt,
  buildSkeleton,
  getClusterPresetManifest,
  loadCompassBody,
  parseArgs,
  renderManifestYaml,
  resolveCluster,
  runInvocation,
} from './invoke-type-design-consultant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REAL_PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// ---------- helpers ----------

function makeSyntheticPreset(opts: {
  cluster: string;
  id: string;
  preferredFamily?: string;
  preferredLicense?: string;
  fallback?: { family: string; weight: number; license: string };
  source?: string;
}): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${opts.id}`);
  lines.push(`cluster: ${opts.cluster}`);
  lines.push('clipKind: lowerThird');
  lines.push(`source: ${opts.source ?? 'docs/compass_artifact.md#synthetic'}`);
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
  lines.push('  parityFixture: pending-user-review');
  lines.push('  typeDesign: pending-cluster-batch');
  lines.push('---');
  lines.push('');
  lines.push('# Synthetic');
  return lines.join('\n');
}

function writeSyntheticTree(opts: {
  presets: Array<{
    cluster: string;
    id: string;
    preferredFamily?: string;
    preferredLicense?: string;
    fallback?: { family: string; weight: number; license: string };
    source?: string;
  }>;
  emptyClusters?: string[];
}): string {
  const root = mkdtempSync(join(tmpdir(), 'tdc-presets-'));
  const clusters = new Set([...opts.presets.map((p) => p.cluster), ...(opts.emptyClusters ?? [])]);
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
owner_task: T-311
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

function makeReviewsRoot(): string {
  return mkdtempSync(join(tmpdir(), 'tdc-reviews-'));
}

// ---------- resolveCluster ----------

describe('resolveCluster — AC #5, #6', () => {
  it('resolves uppercase letter A → news (reviewable)', () => {
    const r = resolveCluster('A');
    expect(r.kind).toBe('reviewable');
    if (r.kind === 'reviewable') {
      expect(r.letter).toBe('A');
      expect(r.name).toBe('news');
    }
  });

  it('resolves lowercase letter a → news (reviewable)', () => {
    const r = resolveCluster('a');
    expect(r.kind).toBe('reviewable');
  });

  it('resolves "news" → A (reviewable)', () => {
    const r = resolveCluster('news');
    expect(r.kind).toBe('reviewable');
    if (r.kind === 'reviewable') {
      expect(r.letter).toBe('A');
    }
  });

  it('resolves "News" (mixed case) → A (reviewable)', () => {
    const r = resolveCluster('News');
    expect(r.kind).toBe('reviewable');
  });

  it.each(REVIEWABLE_CLUSTER_LETTERS)('letter %s is reviewable', (letter) => {
    const r = resolveCluster(letter);
    expect(r.kind).toBe('reviewable');
  });

  it.each(EXEMPT_CLUSTER_LETTERS)('letter %s is exempt', (letter) => {
    const r = resolveCluster(letter);
    expect(r.kind).toBe('exempt');
  });

  it.each(['weather', 'data', 'ar'])('cluster name %s is exempt', (name) => {
    const r = resolveCluster(name);
    expect(r.kind).toBe('exempt');
  });

  it('returns kind: unknown for "Z"', () => {
    expect(resolveCluster('Z').kind).toBe('unknown');
  });

  it('returns kind: unknown for empty string', () => {
    expect(resolveCluster('').kind).toBe('unknown');
  });

  it('returns kind: unknown for an unrelated string', () => {
    expect(resolveCluster('marketing').kind).toBe('unknown');
  });

  it('exposes ALL_CLUSTER_IDENTIFIERS for error messages', () => {
    expect(ALL_CLUSTER_IDENTIFIERS).toContain('A');
    expect(ALL_CLUSTER_IDENTIFIERS).toContain('news');
  });
});

// ---------- getClusterPresetManifest ----------

describe('getClusterPresetManifest — AC #7, #8, #9', () => {
  it('returns sorted-by-id manifest for the real "news" cluster', () => {
    const manifest = getClusterPresetManifest('news', {
      presetsRoot: REAL_PRESETS_ROOT,
    });
    expect(manifest.length).toBeGreaterThan(0);
    // Stable order: alphabetical by id.
    const ids = manifest.map((e) => e.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('every manifest entry has id, preferredFont, source, status', () => {
    const manifest = getClusterPresetManifest('news', {
      presetsRoot: REAL_PRESETS_ROOT,
    });
    for (const entry of manifest) {
      expect(entry.id).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
      expect(entry.preferredFont.family.length).toBeGreaterThan(0);
      expect(entry.preferredFont.license.length).toBeGreaterThan(0);
      expect(entry.source.length).toBeGreaterThan(0);
      expect(['stub', 'substantive']).toContain(entry.status);
    }
  });

  it('byte-stable across repeated invocations (AC #8)', () => {
    const a = renderManifestYaml(
      getClusterPresetManifest('news', { presetsRoot: REAL_PRESETS_ROOT }),
    );
    const b = renderManifestYaml(
      getClusterPresetManifest('news', { presetsRoot: REAL_PRESETS_ROOT }),
    );
    expect(a).toBe(b);
  });

  it('letter "A" resolves identically to "news" (AC #5)', () => {
    const byLetter = getClusterPresetManifest('A', {
      presetsRoot: REAL_PRESETS_ROOT,
    });
    const byName = getClusterPresetManifest('news', {
      presetsRoot: REAL_PRESETS_ROOT,
    });
    expect(byLetter).toEqual(byName);
  });

  it('empty cluster returns [] without erroring (AC #9)', () => {
    const root = writeSyntheticTree({
      presets: [],
      emptyClusters: ['news'],
    });
    try {
      const manifest = getClusterPresetManifest('news', { presetsRoot: root });
      expect(manifest).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exempt cluster (C) throws with a clear message', () => {
    expect(() => getClusterPresetManifest('C', { presetsRoot: REAL_PRESETS_ROOT })).toThrow(
      /ADR-004/,
    );
  });

  it('unknown cluster throws with enumeration', () => {
    expect(() => getClusterPresetManifest('Z', { presetsRoot: REAL_PRESETS_ROOT })).toThrow(
      /Known:/,
    );
  });

  it('renderManifestYaml emits ~ for missing fallbackFont', () => {
    const yaml = renderManifestYaml([
      {
        id: 'foo',
        preferredFont: { family: 'Inter', license: 'ofl' },
        fallbackFont: undefined,
        source: 'docs/compass_artifact.md#foo',
        status: 'stub',
      },
    ]);
    expect(yaml).toContain('fallbackFont: ~');
  });

  it('renderManifestYaml escapes single quotes in family names', () => {
    const yaml = renderManifestYaml([
      {
        id: 'foo',
        preferredFont: { family: "O'Reilly", license: 'ofl' },
        fallbackFont: undefined,
        source: 'docs/compass_artifact.md#foo',
        status: 'stub',
      },
    ]);
    expect(yaml).toContain("O''Reilly");
  });
});

// ---------- buildSkeleton ----------

describe('buildSkeleton — AC #10, #11, #12', () => {
  it('frontmatter contains signedOff: false and clusterPresets list (AC #12)', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [
        {
          id: 'cnn-classic',
          preferredFont: { family: 'CNN Sans', license: 'proprietary-byo' },
          fallbackFont: { family: 'Inter Tight', weight: 700, license: 'ofl' },
          source: 'docs/compass_artifact.md#cnn',
          status: 'stub',
        },
      ],
      reviewedAt: '2026-04-27',
      reason: undefined,
    });
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('signedOff: false');
    expect(md).toContain('clusterPresets: [cnn-classic]');
    expect(md).toContain('reviewedAt: 2026-04-27');
  });

  it('per-preset section includes all 5 SKILL.md output sections (AC #10)', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [
        {
          id: 'cnn-classic',
          preferredFont: { family: 'CNN Sans', license: 'proprietary-byo' },
          fallbackFont: { family: 'Inter Tight', weight: 700, license: 'ofl' },
          source: 'docs/compass_artifact.md#cnn',
          status: 'stub',
        },
      ],
      reviewedAt: '2026-04-27',
      reason: undefined,
    });
    expect(md).toContain('Three ranked candidates');
    expect(md).toContain('Kerning / x-height / weight deltas');
    expect(md).toContain('Rationale');
    expect(md).toContain('Reference-frame recommendation');
    expect(md).toContain('Final recommendation');
  });

  it('cluster-level Cross-preset coherence + Escalations (AC #11)', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [],
      reviewedAt: '2026-04-27',
      reason: undefined,
    });
    expect(md).toContain('## Cross-preset coherence');
    expect(md).toContain('## Escalations');
  });

  it('embeds the re-review reason when supplied', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [],
      reviewedAt: '2026-04-27',
      reason: 'font-license-update',
    });
    expect(md).toContain('## Re-review reason');
    expect(md).toContain('font-license-update');
  });

  it('handles missing fallbackFont gracefully', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [
        {
          id: 'foo',
          preferredFont: { family: 'Inter', license: 'ofl' },
          fallbackFont: undefined,
          source: 'docs/compass_artifact.md#foo',
          status: 'stub',
        },
      ],
      reviewedAt: '2026-04-27',
      reason: undefined,
    });
    expect(md).toContain('Current fallback**: none');
  });

  it('renders empty cluster as a "no presets" placeholder', () => {
    const md = buildSkeleton({
      letter: 'A',
      name: 'news',
      manifest: [],
      reviewedAt: '2026-04-27',
      reason: undefined,
    });
    expect(md).toContain('clusterPresets: []');
    expect(md).toContain('_No presets in this cluster._');
  });
});

// ---------- assemblePrompt ----------

describe('assemblePrompt', () => {
  it('embeds the manifest YAML and notes compass located when present', () => {
    const p = assemblePrompt({
      letter: 'A',
      name: 'news',
      manifest: [
        {
          id: 'cnn-classic',
          preferredFont: { family: 'CNN Sans', license: 'proprietary-byo' },
          fallbackFont: { family: 'Inter Tight', weight: 700, license: 'ofl' },
          source: 'docs/compass_artifact.md#cnn',
          status: 'stub',
        },
      ],
      compassPath: 'docs/compass_artifact.md',
      compassBody: '# Compass\n',
    });
    expect(p.compassPresent).toBe(true);
    expect(p.text).toContain('cnn-classic');
    expect(p.text).toContain('(located)');
  });

  it('flags compass NOT FOUND when missing', () => {
    const p = assemblePrompt({
      letter: 'A',
      name: 'news',
      manifest: [],
      compassPath: 'docs/compass_artifact.md',
      compassBody: undefined,
    });
    expect(p.compassPresent).toBe(false);
    expect(p.text).toContain('NOT FOUND');
  });
});

// ---------- loadCompassBody ----------

describe('loadCompassBody', () => {
  it('returns content when file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tdc-compass-'));
    const path = join(dir, 'compass.md');
    writeFileSync(path, '# Compass\n');
    try {
      expect(loadCompassBody(path)).toBe('# Compass\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined when file is missing', () => {
    expect(loadCompassBody('/nonexistent/path/to/compass.md')).toBeUndefined();
  });
});

// ---------- parseArgs ----------

describe('parseArgs', () => {
  it('parses a typical invocation', () => {
    const { args, errors } = parseArgs([
      '--cluster=A',
      '--reason=foo',
      '--write-prompt',
      '--reviewed-at=2026-04-27',
    ]);
    expect(errors).toEqual([]);
    expect(args.cluster).toBe('A');
    expect(args.reason).toBe('foo');
    expect(args.writePrompt).toBe(true);
    expect(args.reviewedAt).toBe('2026-04-27');
    expect(args.writeReviewSkeleton).toBe(true);
  });

  it('--no-write-review-skeleton disables skeleton', () => {
    const { args } = parseArgs(['--cluster=A', '--no-write-review-skeleton']);
    expect(args.writeReviewSkeleton).toBe(false);
  });

  it('flags --help', () => {
    expect(parseArgs(['--help']).args.help).toBe(true);
    expect(parseArgs(['-h']).args.help).toBe(true);
  });

  it('reports unknown flags as errors', () => {
    const { errors } = parseArgs(['--cluster=A', '--mystery=1']);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/--mystery/);
  });

  it('reports positional non-flag arguments as errors', () => {
    const { errors } = parseArgs(['cluster=A']);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------- runInvocation ----------

describe('runInvocation — AC #1, #2, #3, #4, #6', () => {
  it('AC #1: --cluster=A writes the skeleton review file', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(
        ['--cluster=A', `--presets-root=${REAL_PRESETS_ROOT}`, `--reviews-root=${reviewsRoot}`],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(0);
      const reviewPath = resolve(reviewsRoot, 'type-design-consultant-cluster-A.md');
      expect(existsSync(reviewPath)).toBe(true);
      const body = readFileSync(reviewPath, 'utf8');
      expect(body).toContain('Cluster A');
      expect(body).toContain('signedOff: false');
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('AC #2: --cluster=C exits non-zero with an ADR-004 §D4 error', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(['--cluster=C', `--reviews-root=${reviewsRoot}`], {
        today: () => '2026-04-27',
      });
      expect(result.exitCode).toBe(1);
      const stderr = result.stderr.join('\n');
      expect(stderr).toMatch(/does not require batch/);
      expect(stderr).toMatch(/ADR-004/);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it.each(['C', 'E', 'H'])('AC #2: cluster letter %s rejects (no batch review)', (letter) => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation([`--cluster=${letter}`, `--reviews-root=${reviewsRoot}`], {
        today: () => '2026-04-27',
      });
      expect(result.exitCode).toBe(1);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('AC #3: re-trigger guard — second run without --reason fails', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const first = runInvocation(
        ['--cluster=A', `--presets-root=${REAL_PRESETS_ROOT}`, `--reviews-root=${reviewsRoot}`],
        { today: () => '2026-04-27' },
      );
      expect(first.exitCode).toBe(0);

      const second = runInvocation(
        ['--cluster=A', `--presets-root=${REAL_PRESETS_ROOT}`, `--reviews-root=${reviewsRoot}`],
        { today: () => '2026-04-27' },
      );
      expect(second.exitCode).toBe(1);
      expect(second.stderr.join('\n')).toMatch(/already exists/);
      expect(second.stderr.join('\n')).toMatch(/--reason/);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('AC #3: re-trigger with --reason succeeds and embeds the reason', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      runInvocation(
        ['--cluster=A', `--presets-root=${REAL_PRESETS_ROOT}`, `--reviews-root=${reviewsRoot}`],
        { today: () => '2026-04-27' },
      );
      const second = runInvocation(
        [
          '--cluster=A',
          '--reason=font-license-update',
          `--presets-root=${REAL_PRESETS_ROOT}`,
          `--reviews-root=${reviewsRoot}`,
        ],
        { today: () => '2026-04-28' },
      );
      expect(second.exitCode).toBe(0);
      const reviewPath = resolve(reviewsRoot, 'type-design-consultant-cluster-A.md');
      const body = readFileSync(reviewPath, 'utf8');
      expect(body).toContain('font-license-update');
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('AC #4: --write-prompt writes reviews/.prompts/cluster-A-<date>.md', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(
        [
          '--cluster=A',
          '--write-prompt',
          `--presets-root=${REAL_PRESETS_ROOT}`,
          `--reviews-root=${reviewsRoot}`,
        ],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(0);
      const promptPath = resolve(reviewsRoot, '.prompts', 'cluster-A-2026-04-27.md');
      expect(existsSync(promptPath)).toBe(true);
      const body = readFileSync(promptPath, 'utf8');
      expect(body).toContain('Cluster A');
      expect(body).toContain('Preset manifest');
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('AC #6: --cluster=Z exits non-zero with the cluster enumeration', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(['--cluster=Z', `--reviews-root=${reviewsRoot}`], {
        today: () => '2026-04-27',
      });
      expect(result.exitCode).toBe(1);
      const stderr = result.stderr.join('\n');
      expect(stderr).toMatch(/unknown cluster/);
      expect(stderr).toMatch(/news/);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('--help prints usage and exits 0', () => {
    const result = runInvocation(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.join('\n')).toMatch(/Usage/);
  });

  it('missing --cluster exits with code 2', () => {
    const result = runInvocation([]);
    expect(result.exitCode).toBe(2);
  });

  it('unknown flag exits with code 2', () => {
    const result = runInvocation(['--cluster=A', '--mystery=1']);
    expect(result.exitCode).toBe(2);
  });

  it('warns when compass file is missing but proceeds', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(
        [
          '--cluster=A',
          `--presets-root=${REAL_PRESETS_ROOT}`,
          `--reviews-root=${reviewsRoot}`,
          '--compass-path=/nonexistent/compass.md',
        ],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.join('\n')).toMatch(/WARN: compass file/);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('--no-write-review-skeleton skips skeleton (still allows --write-prompt)', () => {
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(
        [
          '--cluster=A',
          '--no-write-review-skeleton',
          '--write-prompt',
          `--presets-root=${REAL_PRESETS_ROOT}`,
          `--reviews-root=${reviewsRoot}`,
        ],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(0);
      const reviewPath = resolve(reviewsRoot, 'type-design-consultant-cluster-A.md');
      expect(existsSync(reviewPath)).toBe(false);
      const promptPath = resolve(reviewsRoot, '.prompts', 'cluster-A-2026-04-27.md');
      expect(existsSync(promptPath)).toBe(true);
    } finally {
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('handles a synthetic empty cluster end-to-end (no errors)', () => {
    const presetsRoot = writeSyntheticTree({
      presets: [],
      emptyClusters: ['news'],
    });
    const reviewsRoot = makeReviewsRoot();
    try {
      const result = runInvocation(
        ['--cluster=A', `--presets-root=${presetsRoot}`, `--reviews-root=${reviewsRoot}`],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(0);
      const reviewPath = resolve(reviewsRoot, 'type-design-consultant-cluster-A.md');
      expect(existsSync(reviewPath)).toBe(true);
      const body = readFileSync(reviewPath, 'utf8');
      expect(body).toContain('clusterPresets: []');
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });

  it('surfaces loader failures as exit 1', () => {
    const presetsRoot = mkdtempSync(join(tmpdir(), 'tdc-empty-'));
    const reviewsRoot = makeReviewsRoot();
    try {
      // No cluster directories exist — loadAllPresets returns an empty registry.
      // To get a failure, pass a non-existent path.
      const result = runInvocation(
        [
          '--cluster=A',
          `--presets-root=${presetsRoot}/nonexistent`,
          `--reviews-root=${reviewsRoot}`,
        ],
        { today: () => '2026-04-27' },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.join('\n')).toMatch(/failed to load presets/);
    } finally {
      rmSync(presetsRoot, { recursive: true, force: true });
      rmSync(reviewsRoot, { recursive: true, force: true });
    }
  });
});

// ---------- subprocess CLI smoke ----------

describe('CLI subprocess smoke', () => {
  it('exits 0 when invoked with --help', () => {
    const scriptPath = resolve(__dirname, 'invoke-type-design-consultant.ts');
    const result = spawnSync('npx', ['tsx', scriptPath, '--help'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Usage/);
  });

  it('exits 1 when invoked with --cluster=C', () => {
    const scriptPath = resolve(__dirname, 'invoke-type-design-consultant.ts');
    const result = spawnSync('npx', ['tsx', scriptPath, '--cluster=C'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ADR-004/);
  });
});
