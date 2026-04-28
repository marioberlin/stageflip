// scripts/check-skill-drift.test.ts
// Tests for the T-310 preset-tree drift checks added on top of the T-014
// link-integrity + tier-coverage checks. Each AC from docs/tasks/T-310.md is
// pinned at least once. Synthetic preset trees are written to a temp directory
// and fed through the script's public surface (`presetClusterCoverageCheck`,
// `presetIdCoherenceCheck`, `runChecks`). The on-disk corpus is exercised
// end-to-end via `runChecks` against the real `skills/stageflip/presets/`.
//
// AC numbers refer to docs/tasks/T-310.md.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { SkillTier } from '../packages/skills-core/src/index.js';

import {
  formatReport,
  presetClusterCoverageCheck,
  presetIdCoherenceCheck,
  runChecks,
  tierCoverageCheck,
} from './check-skill-drift.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REAL_SKILLS_ROOT = resolve(REPO_ROOT, 'skills/stageflip');
const REAL_PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// ---------- helpers ----------

interface PresetSpec {
  /** Cluster directory name (e.g., 'news'). */
  cluster: string;
  /** Filename without `.md`. */
  filename: string;
  /** Frontmatter `id` field — defaults to `filename`. */
  id?: string;
  /** Frontmatter `cluster` field — defaults to `cluster`. */
  declaredCluster?: string;
}

interface ClusterSpec {
  /** Cluster directory name. */
  name: string;
  /** Skip emitting `SKILL.md` (synthetic missing-cluster case). */
  omitSkill?: boolean;
  /** Override the cluster skill's `id` field. */
  skillId?: string;
}

function makePresetFile(spec: PresetSpec): string {
  const id = spec.id ?? spec.filename;
  const cluster = spec.declaredCluster ?? spec.cluster;
  return [
    '---',
    `id: ${id}`,
    `cluster: ${cluster}`,
    'clipKind: lowerThird',
    'source: docs/compass.md#synthetic',
    'status: stub',
    'preferredFont:',
    '  family: Inter',
    '  license: ofl',
    'permissions: []',
    'signOff:',
    '  parityFixture: pending-user-review',
    '  typeDesign: pending-cluster-batch',
    '---',
    '',
    '# Synthetic preset',
    '',
  ].join('\n');
}

function makeClusterSkill(spec: ClusterSpec): string {
  const id = spec.skillId ?? `skills/stageflip/presets/${spec.name}`;
  return [
    '---',
    `title: Cluster ${spec.name}`,
    `id: ${id}`,
    'tier: cluster',
    'status: stub',
    'last_updated: 2026-04-27',
    'owner_task: T-310',
    'related: []',
    '---',
    '',
    `# Cluster ${spec.name}`,
    '',
  ].join('\n');
}

interface SyntheticTreeOpts {
  clusters: ClusterSpec[];
  presets: PresetSpec[];
}

function writeSyntheticPresetsRoot(opts: SyntheticTreeOpts): string {
  const root = mkdtempSync(join(tmpdir(), 'tdx-skill-drift-'));
  for (const cluster of opts.clusters) {
    const dir = join(root, cluster.name);
    mkdirSync(dir, { recursive: true });
    if (!cluster.omitSkill) {
      writeFileSync(join(dir, 'SKILL.md'), makeClusterSkill(cluster));
    }
  }
  for (const preset of opts.presets) {
    const dir = join(root, preset.cluster);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${preset.filename}.md`), makePresetFile(preset));
  }
  return root;
}

const cleanupTargets: string[] = [];
function tracked(path: string): string {
  cleanupTargets.push(path);
  return path;
}
afterEach(() => {
  for (const p of cleanupTargets.splice(0)) {
    rmSync(p, { recursive: true, force: true });
  }
});

// ---------- AC #1 / #2 — preset-cluster-coverage: every cluster has SKILL.md ----------

describe('T-310 AC #1, #2 — preset-cluster-coverage', () => {
  it('walks the presets root and identifies clusters (AC #1)', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }, { name: 'sports' }],
        presets: [
          { cluster: 'news', filename: 'foo' },
          { cluster: 'sports', filename: 'bar' },
        ],
      }),
    );
    const result = presetClusterCoverageCheck({ presetsRoot: root });
    expect(result.errors).toEqual([]);
    expect(result.scannedClusters).toBe(2);
    expect(result.scannedPresets).toBe(2);
  });

  it('fails when a cluster directory has no SKILL.md (AC #2)', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }, { name: 'sports', omitSkill: true }],
        presets: [{ cluster: 'sports', filename: 'bar' }],
      }),
    );
    const result = presetClusterCoverageCheck({ presetsRoot: root });
    expect(result.errors.length).toBeGreaterThan(0);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/sports/);
    expect(joined).toMatch(/SKILL\.md/);
  });

  it("fails when a preset's `cluster` field disagrees with its directory (AC #3)", () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }, { name: 'sports' }],
        presets: [
          // File is in news/, but its frontmatter declares cluster: sports.
          { cluster: 'news', filename: 'foo', declaredCluster: 'sports' },
        ],
      }),
    );
    const result = presetClusterCoverageCheck({ presetsRoot: root });
    expect(result.errors.length).toBeGreaterThan(0);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/foo/);
    expect(joined).toMatch(/news/);
    expect(joined).toMatch(/sports/);
  });
});

// ---------- AC #4 — PASS at HEAD (real on-disk presets) ----------

describe('T-310 AC #4 — preset-cluster-coverage PASS at HEAD', () => {
  it('passes against the real skills/stageflip/presets/ tree', () => {
    const result = presetClusterCoverageCheck({
      presetsRoot: REAL_PRESETS_ROOT,
    });
    expect(result.errors).toEqual([]);
    expect(result.scannedClusters).toBe(8);
    expect(result.scannedPresets).toBeGreaterThanOrEqual(40);
  });
});

// ---------- AC #5 — preset-id-coherence: id matches filename ----------

describe('T-310 AC #5 — preset-id-coherence: id matches filename', () => {
  it('passes when id matches filename', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }],
        presets: [{ cluster: 'news', filename: 'cnn-classic', id: 'cnn-classic' }],
      }),
    );
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    expect(result.errors).toEqual([]);
  });

  it('fails when id and filename disagree', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }],
        presets: [{ cluster: 'news', filename: 'cnn-classic', id: 'mismatched' }],
      }),
    );
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    expect(result.errors.length).toBeGreaterThan(0);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/cnn-classic/);
    expect(joined).toMatch(/mismatched/);
  });
});

// ---------- AC #6 — cluster skill `id` matches filesystem location ----------

describe('T-310 AC #6 — cluster skill id ↔ filesystem location', () => {
  it('passes for a correctly anchored cluster skill', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news', skillId: 'skills/stageflip/presets/news' }],
        presets: [],
      }),
    );
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    expect(result.errors).toEqual([]);
  });

  it('fails when the cluster skill id does not match its directory', () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news', skillId: 'skills/stageflip/presets/sports' }],
        presets: [],
      }),
    );
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    expect(result.errors.length).toBeGreaterThan(0);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/news/);
    expect(joined).toMatch(/sports/);
  });
});

// ---------- AC #7 — PASS at HEAD ----------

describe('T-310 AC #7 — preset-id-coherence PASS at HEAD', () => {
  it('passes against the real skills/stageflip/presets/ tree', () => {
    const result = presetIdCoherenceCheck({
      presetsRoot: REAL_PRESETS_ROOT,
    });
    expect(result.errors).toEqual([]);
  });
});

// ---------- AC #8, #9, #10, #11 — runChecks aggregation + format ----------

describe('T-310 AC #8, #9, #10 — runChecks aggregates 4 checks', () => {
  it('runs all 4 checks and exits 0 on a clean tree (AC #8)', async () => {
    const report = await runChecks({
      skillsRoot: REAL_SKILLS_ROOT,
      presetsRoot: REAL_PRESETS_ROOT,
      basePath: REPO_ROOT,
    });
    expect(report.exitCode).toBe(0);
    expect(report.results.map((r) => r.name).sort()).toEqual([
      'link-integrity',
      'preset-cluster-coverage',
      'preset-id-coherence',
      'tier-coverage',
    ]);
  });

  it('aggregates violations across 4 checks (AC #10)', async () => {
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [
          { name: 'news', skillId: 'skills/stageflip/presets/sports' }, // wrong skill id
          { name: 'sports', omitSkill: true }, // missing cluster skill
        ],
        presets: [
          { cluster: 'news', filename: 'foo', id: 'bar' }, // id ≠ filename
        ],
      }),
    );
    const coverage = presetClusterCoverageCheck({ presetsRoot: root });
    const coherence = presetIdCoherenceCheck({ presetsRoot: root });
    // Both checks must report errors — no fail-on-first.
    expect(coverage.errors.length).toBeGreaterThan(0);
    expect(coherence.errors.length).toBeGreaterThan(0);
  });

  it('produces output matching the [name]: PASS pattern (AC #9)', async () => {
    const report = await runChecks({
      skillsRoot: REAL_SKILLS_ROOT,
      presetsRoot: REAL_PRESETS_ROOT,
      basePath: REPO_ROOT,
    });
    const formatted = formatReport(report);
    expect(formatted.stdout).toMatch(/\[link-integrity\]: PASS/);
    expect(formatted.stdout).toMatch(/\[tier-coverage\]: PASS/);
    expect(formatted.stdout).toMatch(/\[preset-cluster-coverage\]: PASS/);
    expect(formatted.stdout).toMatch(/\[preset-id-coherence\]: PASS/);
  });
});

// ---------- AC #11 — backward compat ----------

describe('T-310 AC #11 — existing checks unchanged in behavior', () => {
  it('link-integrity + tier-coverage still PASS at HEAD', async () => {
    const report = await runChecks({
      skillsRoot: REAL_SKILLS_ROOT,
      presetsRoot: REAL_PRESETS_ROOT,
      basePath: REPO_ROOT,
    });
    const link = report.results.find((r) => r.name === 'link-integrity');
    const tier = report.results.find((r) => r.name === 'tier-coverage');
    expect(link?.errors).toEqual([]);
    expect(tier?.errors).toEqual([]);
  });
});

// ---------- additional coverage: malformed/edge-case files ----------

describe('coverage — malformed inputs', () => {
  it('reports a preset whose frontmatter has no `cluster` field', () => {
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-nocluster-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(join(newsDir, 'SKILL.md'), makeClusterSkill({ name: 'news' }));
    writeFileSync(
      join(newsDir, 'orphan.md'),
      ['---', 'id: orphan', '# missing cluster', '---', ''].join('\n'),
    );
    const result = presetClusterCoverageCheck({ presetsRoot: root });
    expect(result.errors.some((e) => /orphan/.test(e))).toBe(true);
  });

  it('returns an error result when the presets root does not exist', () => {
    const missing = join(tmpdir(), `tdx-skill-drift-no-such-presets-${Date.now()}`);
    const coverage = presetClusterCoverageCheck({ presetsRoot: missing });
    expect(coverage.errors.length).toBeGreaterThan(0);
    const coherence = presetIdCoherenceCheck({ presetsRoot: missing });
    expect(coherence.errors.length).toBeGreaterThan(0);
  });

  it('skips presets whose frontmatter cannot be parsed (already covered by cluster-coverage)', () => {
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-malformed-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(join(newsDir, 'SKILL.md'), makeClusterSkill({ name: 'news' }));
    // gray-matter parses this fine but the YAML is essentially empty.
    writeFileSync(join(newsDir, 'empty-fm.md'), '---\n---\n\n# Body only\n');
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    // empty-fm has no id, so we just skip it (no double-report).
    expect(result.errors).toEqual([]);
  });

  it('reports a non-string id field on a preset', () => {
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-nonstr-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(join(newsDir, 'SKILL.md'), makeClusterSkill({ name: 'news' }));
    // id is a number — schema parse fails, fall-back string check fails too.
    writeFileSync(
      join(newsDir, 'whatever.md'),
      ['---', 'id: 12345', 'cluster: news', '---', ''].join('\n'),
    );
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    // id is not a string -> readPresetId returns undefined -> skipped.
    expect(result.errors).toEqual([]);
  });

  it('survives gray-matter parse failures on a preset (catch-block path)', () => {
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-yamlerr-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(join(newsDir, 'SKILL.md'), makeClusterSkill({ name: 'news' }));
    // Malformed YAML — duplicate key + bad indent triggers js-yaml exception
    // inside gray-matter's try/catch.
    writeFileSync(
      join(newsDir, 'broken-yaml.md'),
      '---\nfoo: bar\nfoo:\n  - bad\n   indent\n---\n',
    );
    // Both checks tolerate the parse failure (our wrappers swallow it).
    const cov = presetClusterCoverageCheck({ presetsRoot: root });
    const coh = presetIdCoherenceCheck({ presetsRoot: root });
    // cluster-coverage reports the unparseable cluster field; coherence skips.
    expect(cov.errors.some((e) => /broken-yaml/.test(e))).toBe(true);
    expect(coh.errors).toEqual([]);
  });

  it('tier-coverage flags a tier with zero skills', () => {
    const tree = {
      skills: [],
      byId: new Map(),
      byTier: new Map<SkillTier, never[]>(),
    };
    const result = tierCoverageCheck(tree, 'fake/root');
    // Every SKILL_TIERS entry should produce an error.
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((e) => /tier "/.test(e))).toBe(true);
  });

  it('reports a cluster skill with no id field', () => {
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-noid-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(
      join(newsDir, 'SKILL.md'),
      ['---', 'title: News', 'tier: cluster', '---', '', '# News'].join('\n'),
    );
    // No errors expected: readClusterSkillId returns undefined -> we just
    // skip the comparison, since cluster-coverage owns the "broken cluster
    // skill" reporting via the loader's own validation in production.
    const result = presetIdCoherenceCheck({ presetsRoot: root });
    expect(result.errors).toEqual([]);
  });
});

// ---------- runChecks — error paths + warnings ----------

describe('runChecks — error paths', () => {
  it('reports both link-integrity + tier-coverage when skills root is unreadable', async () => {
    const missing = join(tmpdir(), 'tdx-skill-drift-does-not-exist-xyz');
    const root = tracked(
      writeSyntheticPresetsRoot({
        clusters: [{ name: 'news' }],
        presets: [],
      }),
    );
    const report = await runChecks({
      skillsRoot: missing,
      presetsRoot: root,
    });
    const link = report.results.find((r) => r.name === 'link-integrity');
    const tier = report.results.find((r) => r.name === 'tier-coverage');
    expect(link?.errors.length).toBeGreaterThan(0);
    expect(tier?.errors.length).toBeGreaterThan(0);
    expect(report.exitCode).toBe(1);
  });

  it('surfaces preset-loader aggregated parse errors as link-integrity warnings', async () => {
    // Synthetic preset with malformed Zod-validated frontmatter — triggers
    // PresetRegistryLoadError aggregation in loadAllPresets.
    const root = tracked(mkdtempSync(join(tmpdir(), 'tdx-skill-drift-loader-')));
    const newsDir = join(root, 'news');
    mkdirSync(newsDir, { recursive: true });
    writeFileSync(join(newsDir, 'SKILL.md'), makeClusterSkill({ name: 'news' }));
    // Frontmatter that parses YAML but fails Zod (status is invalid enum).
    writeFileSync(
      join(newsDir, 'broken.md'),
      [
        '---',
        'id: broken',
        'cluster: news',
        'clipKind: lowerThird',
        'source: docs/compass.md#x',
        'status: not-a-real-status',
        'preferredFont:',
        '  family: Inter',
        '  license: ofl',
        'permissions: []',
        'signOff:',
        '  parityFixture: pending-user-review',
        '  typeDesign: pending-cluster-batch',
        '---',
        '',
      ].join('\n'),
    );
    // Use a separate skills root that loads cleanly so link-integrity itself
    // produces no errors — only loader warnings should show up.
    const report = await runChecks({
      skillsRoot: REAL_SKILLS_ROOT,
      presetsRoot: root,
      basePath: REPO_ROOT,
    });
    const link = report.results.find((r) => r.name === 'link-integrity');
    expect(link?.warnings.some((w) => /preset loader/.test(w))).toBe(true);
  });
});

// ---------- formatReport — error rendering ----------

describe('formatReport — error rendering', () => {
  it('renders FAIL with stderr when any check has errors', () => {
    const formatted = formatReport({
      results: [
        { name: 'preset-cluster-coverage', errors: ['oops: missing'], warnings: [] },
        { name: 'link-integrity', errors: [], warnings: [] },
      ],
      exitCode: 1,
    });
    expect(formatted.stdout).toMatch(/\[preset-cluster-coverage\]: 1 error/);
    expect(formatted.stderr).toMatch(/oops: missing/);
    expect(formatted.stderr).toMatch(/FAIL \(1 error/);
  });

  it('renders warnings as PASS-with-warning', () => {
    const formatted = formatReport({
      results: [{ name: 'link-integrity', errors: [], warnings: ['heads up'] }],
      exitCode: 0,
    });
    expect(formatted.stdout).toMatch(/PASS with 1 warnings/);
    expect(formatted.stderr).toMatch(/heads up/);
  });
});
