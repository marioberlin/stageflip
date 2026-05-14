// scripts/generate-cluster-skill.test.ts
// Tests for T-315 per-cluster SKILL.md generator.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import matter from 'gray-matter';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clusterSkillFrontmatterSchema } from '../packages/schema/src/presets/frontmatter.js';
import {
  CLUSTER_LETTER_BY_NAME,
  buildClusterFrontmatter,
  buildClusterMarkdown,
  listPresetIds,
  parseArgs,
  parsePresetBullet,
  regeneratePresetsSection,
  rewritePresetsSection,
  runGenerate,
} from './generate-cluster-skill.js';

let tmpRoot: string;
const FIXED_NOW = new Date(Date.UTC(2026, 4, 14)); // 2026-05-14

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'gen-cluster-'));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function clusterDirWithPresets(cluster: string, ids: readonly string[]): string {
  const dir = join(tmpRoot, cluster);
  mkdirSync(dir, { recursive: true });
  for (const id of ids) {
    writeFileSync(join(dir, `${id}.md`), `---\nid: ${id}\n---\n# ${id}\n`, 'utf8');
  }
  return dir;
}

// ---------- parseArgs ----------

describe('parseArgs', () => {
  it('parses required + optional flags', () => {
    const { args, errors } = parseArgs([
      '--cluster=news',
      '--letter=A',
      '--title=News & breaking',
      '--owner-task=T-315',
      '--out=foo.md',
      '--force',
      '--refresh-presets-list',
    ]);
    expect(errors).toEqual([]);
    expect(args.cluster).toBe('news');
    expect(args.letter).toBe('A');
    expect(args.title).toBe('News & breaking');
    expect(args.ownerTask).toBe('T-315');
    expect(args.out).toBe('foo.md');
    expect(args.force).toBe(true);
    expect(args.refreshPresetsList).toBe(true);
  });

  it('flags unknown args', () => {
    const { errors } = parseArgs(['--bogus=x']);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid cluster value', () => {
    const { errors } = parseArgs(['--cluster=not-a-cluster']);
    expect(errors[0]).toMatch(/--cluster must be one of/);
  });

  it('rejects invalid letter value', () => {
    const { errors } = parseArgs(['--letter=Z']);
    expect(errors[0]).toMatch(/--letter must be one of/);
  });
});

// ---------- listPresetIds ----------

describe('listPresetIds', () => {
  it('returns alphabetical preset basenames excluding SKILL.md', () => {
    const dir = clusterDirWithPresets('news', ['zebra', 'alpha', 'beta']);
    writeFileSync(join(dir, 'SKILL.md'), 'should be excluded', 'utf8');
    writeFileSync(join(dir, 'README.txt'), 'not markdown', 'utf8');
    expect(listPresetIds(dir)).toEqual(['alpha', 'beta', 'zebra']);
  });

  it('returns empty array when cluster dir does not exist', () => {
    expect(listPresetIds(join(tmpRoot, 'no-such-dir'))).toEqual([]);
  });
});

// ---------- buildClusterFrontmatter + buildClusterMarkdown ----------

describe('buildClusterFrontmatter', () => {
  it('produces schema-valid frontmatter', () => {
    const fm = buildClusterFrontmatter({
      cluster: 'news',
      letter: 'A',
      title: 'News & breaking',
      ownerTask: 'T-315',
      lastUpdated: '2026-05-14',
    });
    const parsed = clusterSkillFrontmatterSchema.parse(fm);
    expect(parsed.title).toBe('Cluster A — News & breaking');
    expect(parsed.id).toBe('skills/stageflip/presets/news');
    expect(parsed.tier).toBe('cluster');
    expect(parsed.status).toBe('stub');
    expect(parsed.owner_task).toBe('T-315');
  });
});

describe('buildClusterMarkdown', () => {
  it('emits frontmatter + body skeleton; round-trips through schema', () => {
    const md = buildClusterMarkdown({
      cluster: 'news',
      letter: 'A',
      title: 'News & breaking',
      ownerTask: 'T-315',
      lastUpdated: '2026-05-14',
      presetIds: ['alpha', 'beta'],
    });
    expect(md.startsWith('---\n')).toBe(true);
    const parsed = matter(md);
    clusterSkillFrontmatterSchema.parse(parsed.data);
    expect(parsed.content).toContain('# Cluster A — News & breaking');
    expect(parsed.content).toContain('## When to invoke');
    expect(parsed.content).toContain('## Presets');
    expect(parsed.content).toContain('- [`alpha`](alpha.md) — TODO: one-line description');
    expect(parsed.content).toContain('- [`beta`](beta.md) — TODO: one-line description');
    expect(parsed.content).toContain('## References');
    expect(parsed.content).toContain('T-315 tooling');
  });

  it('shows placeholder when no presets exist', () => {
    const md = buildClusterMarkdown({
      cluster: 'news',
      letter: 'A',
      title: 'News',
      ownerTask: 'T-315',
      lastUpdated: '2026-05-14',
      presetIds: [],
    });
    expect(md).toContain('_(no presets yet');
  });
});

// ---------- parsePresetBullet ----------

describe('parsePresetBullet', () => {
  it('parses canonical bullet with em-dash and description', () => {
    const r = parsePresetBullet('- [`cnn-classic`](cnn-classic.md) — lowerThird, red banner');
    expect(r?.id).toBe('cnn-classic');
    expect(r?.description).toBe('lowerThird, red banner');
  });

  it('parses bullet with no description', () => {
    const r = parsePresetBullet('- [`cnn-classic`](cnn-classic.md)');
    expect(r?.id).toBe('cnn-classic');
    expect(r?.description).toBeUndefined();
  });

  it('rejects mismatched id and href', () => {
    expect(parsePresetBullet('- [`a`](b.md) — desc')).toBeUndefined();
  });

  it('rejects non-bullet lines', () => {
    expect(parsePresetBullet('not a bullet')).toBeUndefined();
  });
});

// ---------- regeneratePresetsSection ----------

describe('regeneratePresetsSection', () => {
  it('preserves existing descriptions on matched ids', () => {
    const existing = [
      '- [`alpha`](alpha.md) — kept description',
      '- [`gamma`](gamma.md) — gamma desc',
    ];
    const out = regeneratePresetsSection(existing, ['alpha', 'beta', 'gamma']);
    expect(out).toEqual([
      '- [`alpha`](alpha.md) — kept description',
      '- [`beta`](beta.md) — TODO: one-line description',
      '- [`gamma`](gamma.md) — gamma desc',
    ]);
  });

  it('drops bullets for ids no longer present', () => {
    const existing = ['- [`alpha`](alpha.md) — keep me', '- [`removed`](removed.md) — was here'];
    const out = regeneratePresetsSection(existing, ['alpha']);
    expect(out).toEqual(['- [`alpha`](alpha.md) — keep me']);
    expect(out.join('\n')).not.toContain('removed');
  });

  it('returns placeholder when no presets exist', () => {
    const out = regeneratePresetsSection([], []);
    expect(out[0]).toContain('no presets yet');
  });
});

// ---------- rewritePresetsSection ----------

describe('rewritePresetsSection', () => {
  const SAMPLE = [
    '---',
    'title: Cluster A — News',
    'id: skills/stageflip/presets/news',
    'tier: cluster',
    'status: stub',
    'last_updated: 2026-05-14',
    'owner_task: T-315',
    'related: []',
    '---',
    '',
    '# Cluster A — News',
    '',
    '## When to invoke',
    '',
    'Invoke for news.',
    '',
    '## Presets',
    '',
    '- [`alpha`](alpha.md) — alpha desc',
    '- [`gamma`](gamma.md) — gamma desc',
    '',
    '## References',
    '',
    'See ADR-004.',
    '',
  ].join('\n');

  it('regenerates only the Presets section; preserves other sections byte-for-byte', () => {
    const out = rewritePresetsSection(SAMPLE, ['alpha', 'beta', 'gamma']);
    expect(out).toContain('- [`alpha`](alpha.md) — alpha desc');
    expect(out).toContain('- [`beta`](beta.md) — TODO: one-line description');
    expect(out).toContain('- [`gamma`](gamma.md) — gamma desc');
    // Other sections preserved
    expect(out).toContain('# Cluster A — News');
    expect(out).toContain('Invoke for news.');
    expect(out).toContain('## References');
    expect(out).toContain('See ADR-004.');
    // Frontmatter unchanged
    expect(out.startsWith('---\n')).toBe(true);
  });

  it('preserves trailing prose inside Presets section', () => {
    const withProse = SAMPLE.replace(
      '- [`gamma`](gamma.md) — gamma desc\n',
      '- [`gamma`](gamma.md) — gamma desc\n\nThe six presets cover every illustrative scenario.\n',
    );
    const out = rewritePresetsSection(withProse, ['alpha', 'gamma']);
    expect(out).toContain('The six presets cover every illustrative scenario.');
  });

  it('throws when Presets heading is missing', () => {
    const noHeading = SAMPLE.replace('## Presets', '## Different Section');
    expect(() => rewritePresetsSection(noHeading, ['alpha'])).toThrow(/missing the '## Presets'/);
  });
});

// ---------- runGenerate: create mode ----------

describe('runGenerate — create mode happy path', () => {
  it('writes a valid stub SKILL.md for an empty cluster directory', async () => {
    const out = join(tmpRoot, 'audience', 'SKILL.md');
    const res = await runGenerate(
      ['--cluster=audience', '--title=Live audience', '--owner-task=T-315', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(0);
    expect(existsSync(out)).toBe(true);
    const file = readFileSync(out, 'utf8');
    expect(file.startsWith('---\n')).toBe(true);
    const parsed = matter(file);
    const fm = clusterSkillFrontmatterSchema.parse(parsed.data);
    expect(fm.title).toBe('Cluster I — Live audience'); // letter auto-derived
    expect(fm.id).toBe('skills/stageflip/presets/audience');
    expect(fm.last_updated).toBe('2026-05-14');
    expect(fm.owner_task).toBe('T-315');
    expect(parsed.content).toContain('# Cluster I — Live audience');
    expect(parsed.content).toContain('## When to invoke');
    expect(parsed.content).toContain('## Presets');
  });

  it('populates Presets section from existing cluster preset files', async () => {
    const clusterDir = clusterDirWithPresets('news', ['cnn-classic', 'bbc-reith-dark']);
    const out = join(clusterDir, 'SKILL.md');
    const res = await runGenerate(
      ['--cluster=news', '--title=News & breaking', '--owner-task=T-315', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(0);
    const file = readFileSync(out, 'utf8');
    // alphabetical
    const bbcIdx = file.indexOf('bbc-reith-dark');
    const cnnIdx = file.indexOf('cnn-classic');
    expect(bbcIdx).toBeGreaterThan(-1);
    expect(cnnIdx).toBeGreaterThan(bbcIdx);
  });

  it('rejects unknown letter (e.g. Z)', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(
      ['--cluster=news', '--letter=Z', '--title=News', '--owner-task=T-315', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(2);
  });

  it('explicit valid --letter overrides auto-derivation', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(
      ['--cluster=news', '--letter=I', '--title=News', '--owner-task=T-315', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(0);
    const fm = clusterSkillFrontmatterSchema.parse(matter(readFileSync(out, 'utf8')).data);
    expect(fm.title).toBe('Cluster I — News');
  });
});

describe('runGenerate — create mode error paths', () => {
  it('exits 1 when --cluster is missing', async () => {
    const res = await runGenerate(['--title=x', '--owner-task=T-1']);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/missing required flag\(s\): --cluster/);
  });

  it('exits 1 when --title is missing (create mode)', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(['--cluster=news', '--owner-task=T-315', `--out=${out}`]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/--title/);
  });

  it('exits 1 when --owner-task is missing (create mode)', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(['--cluster=news', '--title=News', `--out=${out}`]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/--owner-task/);
  });

  it('exits 2 when --cluster value is invalid', async () => {
    const res = await runGenerate(['--cluster=not-real', '--title=x', '--owner-task=T-1']);
    expect(res.exitCode).toBe(2);
  });

  it('exits 1 when target exists without --force', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    mkdirSync(join(tmpRoot, 'news'), { recursive: true });
    writeFileSync(out, 'preexisting content', 'utf8');
    const res = await runGenerate([
      '--cluster=news',
      '--title=News',
      '--owner-task=T-315',
      `--out=${out}`,
    ]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/file exists/);
    expect(readFileSync(out, 'utf8')).toBe('preexisting content');
  });

  it('--force overwrites existing target', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    mkdirSync(join(tmpRoot, 'news'), { recursive: true });
    writeFileSync(out, 'preexisting content', 'utf8');
    const res = await runGenerate(
      ['--cluster=news', '--title=News', '--owner-task=T-315', '--force', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(0);
    expect(readFileSync(out, 'utf8')).not.toBe('preexisting content');
  });

  it('exits 1 when frontmatter validation fails (invalid owner_task)', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(
      [
        '--cluster=news',
        '--title=News',
        '--owner-task=not-a-task-id', // fails /^T-\d+/
        `--out=${out}`,
      ],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/frontmatter validation failed/);
  });
});

// ---------- runGenerate: refresh-presets-list mode ----------

describe('runGenerate — refresh-presets-list mode', () => {
  const EXISTING_FILE = [
    '---',
    'title: Cluster A — News',
    'id: skills/stageflip/presets/news',
    'tier: cluster',
    'status: stub',
    'last_updated: 2026-05-14',
    'owner_task: T-315',
    'related: []',
    '---',
    '',
    '# Cluster A — News',
    '',
    '## When to invoke',
    '',
    'Invoke for news.',
    '',
    '## Presets',
    '',
    '- [`alpha`](alpha.md) — preserved description',
    '- [`removed`](removed.md) — should disappear',
    '',
    '## References',
    '',
    'See ADR-004.',
    '',
  ].join('\n');

  function setupCluster(
    cluster: string,
    fileContent: string,
    presetIds: readonly string[],
  ): { out: string } {
    const dir = join(tmpRoot, cluster);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'SKILL.md');
    writeFileSync(out, fileContent, 'utf8');
    for (const id of presetIds) {
      writeFileSync(join(dir, `${id}.md`), `---\nid: ${id}\n---\n`, 'utf8');
    }
    return { out };
  }

  it('preserves all other sections byte-for-byte; rewrites only Presets', async () => {
    const { out } = setupCluster('news', EXISTING_FILE, ['alpha', 'beta']);
    const before = readFileSync(out, 'utf8');
    const res = await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    expect(res.exitCode).toBe(0);
    const after = readFileSync(out, 'utf8');
    expect(after).not.toBe(before);
    // Other sections intact
    expect(after).toContain('# Cluster A — News');
    expect(after).toContain('Invoke for news.');
    expect(after).toContain('## References');
    expect(after).toContain('See ADR-004.');
    expect(after).toContain('owner_task: T-315');
  });

  it('preserves human-written descriptions for ids still present', async () => {
    const { out } = setupCluster('news', EXISTING_FILE, ['alpha', 'beta']);
    await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    const after = readFileSync(out, 'utf8');
    expect(after).toContain('- [`alpha`](alpha.md) — preserved description');
    expect(after).toContain('- [`beta`](beta.md) — TODO: one-line description');
  });

  it('removes ids that no longer have files; adds new ids alphabetically', async () => {
    const { out } = setupCluster('news', EXISTING_FILE, ['alpha', 'beta', 'zeta']);
    await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    const after = readFileSync(out, 'utf8');
    expect(after).not.toContain('removed');
    const alphaIdx = after.indexOf('`alpha`');
    const betaIdx = after.indexOf('`beta`');
    const zetaIdx = after.indexOf('`zeta`');
    expect(alphaIdx).toBeGreaterThan(-1);
    expect(betaIdx).toBeGreaterThan(alphaIdx);
    expect(zetaIdx).toBeGreaterThan(betaIdx);
  });

  it('exits 1 when target SKILL.md does not exist', async () => {
    const out = join(tmpRoot, 'news', 'SKILL.md');
    const res = await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/requires an existing SKILL\.md/);
  });

  it('exits 1 and preserves file when Presets heading is missing', async () => {
    const noHeading = EXISTING_FILE.replace('## Presets', '## Some Other Section');
    const { out } = setupCluster('news', noHeading, ['alpha']);
    const before = readFileSync(out, 'utf8');
    const res = await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    expect(res.exitCode).toBe(1);
    expect(res.stderr.join('\n')).toMatch(/missing the '## Presets'/);
    expect(readFileSync(out, 'utf8')).toBe(before);
  });

  it('no-op when refresh would produce identical content', async () => {
    const dir = join(tmpRoot, 'news');
    mkdirSync(dir, { recursive: true });
    const out = join(dir, 'SKILL.md');
    const content = [
      '---',
      'title: Cluster A — News',
      'id: skills/stageflip/presets/news',
      'tier: cluster',
      'status: stub',
      'last_updated: 2026-05-14',
      'owner_task: T-315',
      'related: []',
      '---',
      '',
      '## Presets',
      '',
      '- [`alpha`](alpha.md) — desc one',
      '- [`beta`](beta.md) — desc two',
      '',
      '## References',
      '',
      'x',
      '',
    ].join('\n');
    writeFileSync(out, content, 'utf8');
    writeFileSync(join(dir, 'alpha.md'), '---\nid: alpha\n---\n', 'utf8');
    writeFileSync(join(dir, 'beta.md'), '---\nid: beta\n---\n', 'utf8');
    const res = await runGenerate(['--cluster=news', '--refresh-presets-list', `--out=${out}`]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout.join('\n')).toMatch(/no changes/);
    expect(readFileSync(out, 'utf8')).toBe(content);
  });
});

// ---------- generated file: link integrity ----------

describe('generated file link integrity', () => {
  it('every preset-bullet link resolves to an actual .md file in the cluster dir', async () => {
    const clusterDir = clusterDirWithPresets('news', ['cnn-classic', 'bbc-reith-dark']);
    const out = join(clusterDir, 'SKILL.md');
    const res = await runGenerate(
      ['--cluster=news', '--title=News', '--owner-task=T-315', `--out=${out}`],
      { now: FIXED_NOW },
    );
    expect(res.exitCode).toBe(0);
    const file = readFileSync(out, 'utf8');
    // Collect markdown link targets like `(foo.md)`.
    const linkRe = /\(([a-z0-9][a-z0-9-]*\.md)\)/g;
    const linked = new Set<string>();
    const matches = file.matchAll(linkRe);
    for (const m of matches) {
      if (m[1] !== undefined) linked.add(m[1]);
    }
    expect(linked.size).toBeGreaterThan(0);
    for (const target of linked) {
      expect(existsSync(join(clusterDir, target))).toBe(true);
    }
  });
});

// ---------- letter map sanity ----------

describe('CLUSTER_LETTER_BY_NAME', () => {
  it('covers all PRESET_CLUSTERS with unique letters A..I', () => {
    const values = Object.values(CLUSTER_LETTER_BY_NAME);
    expect(new Set(values).size).toBe(values.length);
    expect(values.sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  });
});
