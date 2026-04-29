// scripts/check-cluster-eligibility.test.ts
// Tests for the cluster-batch eligibility gate (T-313 §D-T313-2).
// AC numbers refer to docs/tasks/T-313.md.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALL_CLUSTER_IDENTIFIERS,
  ALL_CLUSTER_LETTERS,
  checkClusterEligibility,
  classifyPreset,
  formatReport,
  parseArgs,
  resolveCluster,
  runCheck,
  usage,
} from './check-cluster-eligibility.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REAL_PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// ---------- helpers ----------

function makeSyntheticPreset(opts: {
  cluster: string;
  id: string;
  parityFixture?: string;
  typeDesign?: string;
  preferredLicense?: string;
}): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${opts.id}`);
  lines.push(`cluster: ${opts.cluster}`);
  lines.push('clipKind: lowerThird');
  lines.push('source: docs/compass.md#synthetic');
  lines.push('status: stub');
  lines.push('preferredFont:');
  lines.push('  family: Inter');
  lines.push(`  license: ${opts.preferredLicense ?? 'ofl'}`);
  lines.push('permissions: []');
  lines.push('signOff:');
  lines.push(`  parityFixture: ${opts.parityFixture ?? 'pending-user-review'}`);
  lines.push(`  typeDesign: ${opts.typeDesign ?? 'pending-cluster-batch'}`);
  lines.push('---');
  lines.push('');
  lines.push('# Synthetic');
  return lines.join('\n');
}

function writeSyntheticTree(opts: {
  presets: Array<{
    cluster: string;
    id: string;
    parityFixture?: string;
    typeDesign?: string;
    preferredLicense?: string;
  }>;
  emptyClusters?: string[];
}): string {
  const root = mkdtempSync(join(tmpdir(), 'eligibility-'));
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

// ---------- resolveCluster ----------

describe('resolveCluster', () => {
  it.each(ALL_CLUSTER_LETTERS)('letter %s resolves to known cluster', (letter) => {
    const r = resolveCluster(letter);
    expect(r.kind).toBe('known');
  });

  it('resolves "news" → A', () => {
    const r = resolveCluster('news');
    expect(r.kind).toBe('known');
    if (r.kind === 'known') expect(r.letter).toBe('A');
  });

  it('mixed-case "News" → news', () => {
    const r = resolveCluster('News');
    expect(r.kind).toBe('known');
    if (r.kind === 'known') expect(r.name).toBe('news');
  });

  it('lowercase letter "a" → news', () => {
    const r = resolveCluster('a');
    expect(r.kind).toBe('known');
    if (r.kind === 'known') expect(r.name).toBe('news');
  });

  it('unknown identifier → kind: unknown (AC #12)', () => {
    expect(resolveCluster('Z').kind).toBe('unknown');
    expect(resolveCluster('').kind).toBe('unknown');
    expect(resolveCluster('marketing').kind).toBe('unknown');
  });

  it('exposes ALL_CLUSTER_IDENTIFIERS', () => {
    expect(ALL_CLUSTER_IDENTIFIERS).toContain('A');
    expect(ALL_CLUSTER_IDENTIFIERS).toContain('news');
    expect(ALL_CLUSTER_IDENTIFIERS).toContain('ar');
  });
});

// ---------- classifyPreset ----------

describe('classifyPreset', () => {
  function makePreset(parityFixture: string) {
    return {
      filePath: 'x.md',
      frontmatter: {
        id: 'p',
        cluster: 'news' as const,
        clipKind: 'lowerThird',
        source: 'x',
        status: 'stub' as const,
        preferredFont: { family: 'Inter', license: 'ofl' },
        permissions: [],
        signOff: { parityFixture, typeDesign: 'pending-cluster-batch' },
      },
      body: {
        visualTokens: '',
        typography: '',
        animation: '',
        rules: '',
        acceptance: '',
        references: '',
        unknown: {},
      },
    };
  }

  it('signed:YYYY-MM-DD → kind: signed', () => {
    const r = classifyPreset(makePreset('signed:2026-04-27') as never);
    expect(r.kind).toBe('signed');
    if (r.kind === 'signed') expect(r.signedDate).toBe('2026-04-27');
  });

  it('pending-user-review → kind: pending', () => {
    const r = classifyPreset(makePreset('pending-user-review') as never);
    expect(r.kind).toBe('pending');
  });

  it('na → kind: na', () => {
    const r = classifyPreset(makePreset('na') as never);
    expect(r.kind).toBe('na');
  });

  it('garbage value → kind: malformed', () => {
    const r = classifyPreset(makePreset('garbage' as never) as never);
    expect(r.kind).toBe('malformed');
  });
});

// ---------- checkClusterEligibility ----------

describe('checkClusterEligibility — AC #9, #10, #11', () => {
  it('all signed → eligible (AC #10)', () => {
    const root = writeSyntheticTree({
      presets: [
        { cluster: 'news', id: 'a-one', parityFixture: 'signed:2026-04-27' },
        { cluster: 'news', id: 'b-two', parityFixture: 'signed:2026-04-28' },
      ],
    });
    try {
      const report = checkClusterEligibility({
        letter: 'A',
        name: 'news',
        presetsRoot: root,
      });
      expect(report.eligible).toBe(true);
      expect(report.total).toBe(2);
      expect(report.signedCount).toBe(2);
      expect(report.pendingCount).toBe(0);
      // Sorted alphabetically by id.
      expect(report.presets.map((p) => p.presetId)).toEqual(['a-one', 'b-two']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('mixed signed + pending → not eligible (AC #11)', () => {
    const root = writeSyntheticTree({
      presets: [
        { cluster: 'news', id: 'a-one', parityFixture: 'signed:2026-04-27' },
        { cluster: 'news', id: 'b-two', parityFixture: 'pending-user-review' },
        { cluster: 'news', id: 'c-three', parityFixture: 'pending-user-review' },
      ],
    });
    try {
      const report = checkClusterEligibility({
        letter: 'A',
        name: 'news',
        presetsRoot: root,
      });
      expect(report.eligible).toBe(false);
      expect(report.pendingCount).toBe(2);
      expect(report.signedCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('na presets count as eligible (text-free e.g. QR-code CTAs)', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'ctas',
          id: 'qr-only',
          parityFixture: 'na',
          preferredLicense: 'na',
        },
      ],
    });
    try {
      const report = checkClusterEligibility({
        letter: 'G',
        name: 'ctas',
        presetsRoot: root,
      });
      expect(report.eligible).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('empty cluster → eligible (degenerate)', () => {
    const root = writeSyntheticTree({ presets: [], emptyClusters: ['weather'] });
    try {
      const report = checkClusterEligibility({
        letter: 'C',
        name: 'weather',
        presetsRoot: root,
      });
      expect(report.eligible).toBe(true);
      expect(report.total).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs against the real on-disk corpus (AC #9)', () => {
    // Most real presets are still pending-user-review at HEAD; we only assert
    // that the report renders + counts add up.
    const report = checkClusterEligibility({
      letter: 'A',
      name: 'news',
      presetsRoot: REAL_PRESETS_ROOT,
    });
    expect(report.total).toBeGreaterThan(0);
    expect(report.signedCount + report.pendingCount).toBe(report.total);
  });
});

// ---------- formatReport ----------

describe('formatReport', () => {
  it('renders eligible cluster with PASS rows', () => {
    const text = formatReport({
      letter: 'A',
      name: 'news',
      presets: [{ kind: 'signed', presetId: 'cnn-classic', signedDate: '2026-04-27' }],
      signedCount: 1,
      pendingCount: 0,
      total: 1,
      eligible: true,
    });
    expect(text).toContain('Cluster A — news (1 preset)');
    expect(text).toContain('PASS cnn-classic (signed:2026-04-27)');
    expect(text).toContain('Cluster A: ELIGIBLE');
  });

  it('renders not-eligible cluster with FAIL rows', () => {
    const text = formatReport({
      letter: 'A',
      name: 'news',
      presets: [
        { kind: 'signed', presetId: 'cnn-classic', signedDate: '2026-04-27' },
        { kind: 'pending', presetId: 'fox-news-alert' },
      ],
      signedCount: 1,
      pendingCount: 1,
      total: 2,
      eligible: false,
    });
    expect(text).toContain('FAIL fox-news-alert (pending-user-review)');
    expect(text).toContain('Cluster A: NOT ELIGIBLE — 1 preset(s) pending');
  });

  it('renders na rows correctly', () => {
    const text = formatReport({
      letter: 'G',
      name: 'ctas',
      presets: [{ kind: 'na', presetId: 'coinbase-dvd-qr' }],
      signedCount: 1,
      pendingCount: 0,
      total: 1,
      eligible: true,
    });
    expect(text).toContain('PASS coinbase-dvd-qr (na — text-free preset)');
  });

  it('renders malformed rows correctly', () => {
    const text = formatReport({
      letter: 'A',
      name: 'news',
      presets: [{ kind: 'malformed', presetId: 'broken', raw: 'oops' }],
      signedCount: 0,
      pendingCount: 1,
      total: 1,
      eligible: false,
    });
    expect(text).toContain("FAIL broken (malformed signOff.parityFixture: 'oops')");
  });

  it('renders empty cluster row', () => {
    const text = formatReport({
      letter: 'C',
      name: 'weather',
      presets: [],
      signedCount: 0,
      pendingCount: 0,
      total: 0,
      eligible: true,
    });
    expect(text).toContain('Cluster C: ELIGIBLE — empty cluster');
  });
});

// ---------- parseArgs ----------

describe('parseArgs', () => {
  it('parses --cluster and --presets-root', () => {
    const { args, errors } = parseArgs(['--cluster=A', '--presets-root=foo']);
    expect(errors).toEqual([]);
    expect(args.cluster).toBe('A');
    expect(args.presetsRoot).toBe('foo');
  });

  it('handles --help', () => {
    const { args } = parseArgs(['--help']);
    expect(args.help).toBe(true);
  });

  it('handles -h', () => {
    const { args } = parseArgs(['-h']);
    expect(args.help).toBe(true);
  });

  it('rejects unknown flags', () => {
    const { errors } = parseArgs(['--mystery=1']);
    expect(errors[0]).toContain("unknown flag '--mystery'");
  });

  it('rejects positional args', () => {
    const { errors } = parseArgs(['oops']);
    expect(errors[0]).toContain("unrecognised argument 'oops'");
  });
});

// ---------- runCheck ----------

describe('runCheck', () => {
  it('--help → exit 0 with usage', () => {
    const r = runCheck(['--help']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.join('\n')).toContain('Usage');
  });

  it('parse error → exit 2', () => {
    const r = runCheck(['oops']);
    expect(r.exitCode).toBe(2);
  });

  it('missing --cluster → exit 2', () => {
    const r = runCheck([]);
    expect(r.exitCode).toBe(2);
    expect(r.stderr.join('\n')).toContain('--cluster=<letter|name> is required');
  });

  it('unknown cluster → exit 1 (AC #12)', () => {
    const r = runCheck(['--cluster=Z']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr.join('\n')).toContain("unknown cluster 'Z'");
  });

  it('eligible cluster → exit 0', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'a-one', parityFixture: 'signed:2026-04-27' }],
    });
    try {
      const r = runCheck(['--cluster=A', `--presets-root=${root}`]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout.join('\n')).toContain('ELIGIBLE');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('pending cluster → exit 1', () => {
    const root = writeSyntheticTree({
      presets: [{ cluster: 'news', id: 'a-one', parityFixture: 'pending-user-review' }],
    });
    try {
      const r = runCheck(['--cluster=A', `--presets-root=${root}`]);
      expect(r.exitCode).toBe(1);
      expect(r.stdout.join('\n')).toContain('NOT ELIGIBLE');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('loader failure → exit 1 with diagnostic', () => {
    // Point at a nonexistent presets root.
    const r = runCheck(['--cluster=A', '--presets-root=/no/such/path/__nope__']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr.join('\n')).toContain('failed to load presets');
  });
});

describe('usage', () => {
  it('mentions every relevant flag', () => {
    const u = usage();
    expect(u).toContain('--cluster');
    expect(u).toContain('--presets-root');
  });
});

// ---------- subprocess CLI smoke ----------

describe('subprocess CLI', () => {
  it('exits 0 for --help', () => {
    const result = spawnSync(
      'tsx',
      [resolve(__dirname, 'check-cluster-eligibility.ts'), '--help'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage');
  });
});
