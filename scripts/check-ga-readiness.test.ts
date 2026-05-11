// scripts/check-ga-readiness.test.ts
// Tests for the GA-readiness audit (T-410, Phase δ Lock-in).
// AC numbers refer to docs/tasks/T-410.md.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  type AuditReport,
  type CategoryResult,
  type CriterionResult,
  countByStatus,
  discoverRepoRoot,
  failCriteria,
  parseArgs,
  renderMarkdownReport,
  renderSummary,
  runAudit,
  runCategory8,
  runCli,
  totalCriteria,
  totalsByStatus,
  usage,
} from './check-ga-readiness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ---------- pure-function helpers ----------

function fakeCriterion(id: string, status: CriterionResult['status']): CriterionResult {
  return { id, description: `desc ${id}`, status, note: `note ${id}` };
}

function fakeCategory(num: number, criteria: CriterionResult[]): CategoryResult {
  return { number: num, title: `Cat${num}`, criteria };
}

function fakeReport(): AuditReport {
  return {
    generatedAt: '2026-05-11T00:00:00.000Z',
    categories: [
      fakeCategory(1, [
        fakeCriterion('1.1', 'PASS'),
        fakeCriterion('1.2', 'FAIL'),
        fakeCriterion('1.3', 'WARN'),
      ]),
      fakeCategory(2, [fakeCriterion('2.1', 'PASS'), fakeCriterion('2.2', 'NA')]),
    ],
  };
}

// ---------- aggregation ----------

describe('countByStatus', () => {
  it('counts each status across criteria', () => {
    const counts = countByStatus([
      fakeCriterion('a', 'PASS'),
      fakeCriterion('b', 'PASS'),
      fakeCriterion('c', 'FAIL'),
      fakeCriterion('d', 'WARN'),
      fakeCriterion('e', 'NA'),
    ]);
    expect(counts).toEqual({ PASS: 2, FAIL: 1, WARN: 1, NA: 1 });
  });

  it('returns all-zero counts on empty input', () => {
    expect(countByStatus([])).toEqual({ PASS: 0, FAIL: 0, WARN: 0, NA: 0 });
  });
});

describe('totalsByStatus + totalCriteria', () => {
  it('sums status counts across every category', () => {
    const r = fakeReport();
    expect(totalsByStatus(r)).toEqual({ PASS: 2, FAIL: 1, WARN: 1, NA: 1 });
    expect(totalCriteria(r)).toBe(5);
  });
});

describe('failCriteria', () => {
  it('extracts every FAIL across categories in order', () => {
    const r = fakeReport();
    const fails = failCriteria(r);
    expect(fails.length).toBe(1);
    expect(fails[0]?.id).toBe('1.2');
  });

  it('returns empty array when there are no fails', () => {
    const r: AuditReport = {
      generatedAt: 'x',
      categories: [fakeCategory(1, [fakeCriterion('1.1', 'PASS'), fakeCriterion('1.2', 'WARN')])],
    };
    expect(failCriteria(r)).toEqual([]);
  });
});

// ---------- formatters ----------

describe('renderMarkdownReport', () => {
  it('includes the report header, summary, and per-category sections', () => {
    const md = renderMarkdownReport(fakeReport());
    expect(md).toContain('# StageFlip — GA Readiness Report');
    expect(md).toContain('**Generated at**: `2026-05-11T00:00:00.000Z`');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Punch list (FAIL items)');
    expect(md).toContain('## Category 1 — Cat1');
    expect(md).toContain('## Category 2 — Cat2');
  });

  it('renders the FAIL row in the punch list', () => {
    const md = renderMarkdownReport(fakeReport());
    expect(md).toMatch(/\| 1\.2 \| desc 1\.2 \| note 1\.2 \|/);
  });

  it('shows "no FAIL criteria" when the report is clean', () => {
    const r: AuditReport = {
      generatedAt: 'x',
      categories: [fakeCategory(1, [fakeCriterion('1.1', 'PASS')])],
    };
    const md = renderMarkdownReport(r);
    expect(md).toContain('_No FAIL criteria — GA readiness checklist clear._');
  });

  it('escapes pipes in note text so markdown tables stay parseable', () => {
    const r: AuditReport = {
      generatedAt: 'x',
      categories: [
        fakeCategory(1, [
          {
            id: '1.1',
            description: 'd',
            status: 'FAIL',
            note: 'has | pipe and\nnewline',
          },
        ]),
      ],
    };
    const md = renderMarkdownReport(r);
    // Pipe escaped + newline collapsed.
    expect(md).toContain('has \\| pipe and newline');
  });
});

describe('renderSummary', () => {
  it('includes category lines + a final PASS/FAIL totals line', () => {
    const out = renderSummary(fakeReport());
    expect(out).toContain('check-ga-readiness: 2 categories, 5 criteria');
    expect(out).toContain('[Cat 1: Cat1]: 1 PASS / 1 FAIL / 1 WARN / 0 N/A');
    expect(out).toContain('[Cat 2: Cat2]: 1 PASS / 0 FAIL / 0 WARN / 1 N/A');
    expect(out).toContain('check-ga-readiness: FAIL (1 criteria — see report for the punch list)');
  });

  it('emits a PASS line when there are zero FAILs', () => {
    const r: AuditReport = {
      generatedAt: 'x',
      categories: [fakeCategory(1, [fakeCriterion('1.1', 'PASS')])],
    };
    const out = renderSummary(r);
    expect(out).toContain('check-ga-readiness: PASS (1 pass / 0 warn / 0 n/a)');
  });
});

// ---------- arg parsing ----------

describe('parseArgs', () => {
  it('returns defaults on empty argv', () => {
    const { args, errors } = parseArgs([]);
    expect(errors).toEqual([]);
    expect(args.help).toBe(false);
    expect(args.noWrite).toBe(false);
    expect(args.repoRoot).toBeUndefined();
    expect(args.presetsRoot).toBe('skills/stageflip/presets');
    expect(args.reportOut).toBe('docs/ga-readiness-report.md');
  });

  it('parses --help / -h', () => {
    expect(parseArgs(['--help']).args.help).toBe(true);
    expect(parseArgs(['-h']).args.help).toBe(true);
  });

  it('parses --no-write', () => {
    expect(parseArgs(['--no-write']).args.noWrite).toBe(true);
  });

  it('parses --repo-root, --presets-root, --report-out', () => {
    const { args, errors } = parseArgs([
      '--repo-root=/x',
      '--presets-root=foo/bar',
      '--report-out=baz.md',
    ]);
    expect(errors).toEqual([]);
    expect(args.repoRoot).toBe('/x');
    expect(args.presetsRoot).toBe('foo/bar');
    expect(args.reportOut).toBe('baz.md');
  });

  it('reports unknown flags + unrecognised positional args', () => {
    const { errors } = parseArgs(['--bogus=1', 'positional']);
    expect(errors).toContain("unknown flag '--bogus'");
    expect(errors).toContain("unrecognised argument 'positional'");
  });
});

describe('usage', () => {
  it('mentions the script name and key flags', () => {
    const u = usage();
    expect(u).toContain('check-ga-readiness');
    expect(u).toContain('--repo-root');
    expect(u).toContain('--presets-root');
    expect(u).toContain('--report-out');
    expect(u).toContain('--no-write');
  });
});

// ---------- runCli orchestration ----------

describe('runCli', () => {
  it('returns help on --help with exit 0', () => {
    const result = runCli(['--help'], {
      nowIso: () => 'x',
      write: () => {
        throw new Error('should not write');
      },
      cwd: REPO_ROOT,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.join('\n')).toContain('check-ga-readiness');
  });

  it('returns exit 2 on bad args', () => {
    const result = runCli(['--bogus=1'], {
      nowIso: () => 'x',
      write: () => {},
      cwd: REPO_ROOT,
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr.join('\n')).toContain("unknown flag '--bogus'");
  });

  it('writes the report and returns exit 1 when there are FAIL criteria (real corpus)', () => {
    let writtenPath: string | undefined;
    let writtenBody: string | undefined;
    const result = runCli(['--no-write'], {
      nowIso: () => '2026-05-11T00:00:00.000Z',
      write: (p, body) => {
        writtenPath = p;
        writtenBody = body;
      },
      cwd: REPO_ROOT,
    });
    // Today's main has multiple FAIL criteria (T-411 / T-412 / user-manual) —
    // the gate must surface them.
    expect(result.exitCode).toBe(1);
    expect(result.stderr.join('\n')).toContain('FAIL criterion');
    // --no-write was passed — write should not have been called.
    expect(writtenPath).toBeUndefined();
    expect(writtenBody).toBeUndefined();
  });

  it('writes the report when --no-write is omitted', () => {
    let writtenPath: string | undefined;
    const result = runCli([], {
      nowIso: () => '2026-05-11T00:00:00.000Z',
      write: (p) => {
        writtenPath = p;
      },
      cwd: REPO_ROOT,
    });
    // exit code may be 0 or 1 depending on corpus state — we only assert
    // that the report was written.
    expect([0, 1]).toContain(result.exitCode);
    expect(writtenPath).toBeDefined();
    expect(writtenPath).toMatch(/docs\/ga-readiness-report\.md$/);
  });
});

// ---------- discoverRepoRoot ----------

describe('discoverRepoRoot', () => {
  it('walks up from a subdir of the real repo to find the root', () => {
    const subdir = join(REPO_ROOT, 'docs', 'tasks');
    expect(discoverRepoRoot(subdir)).toBe(REPO_ROOT);
  });

  it('returns startDir when no stageflip package.json is found', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-ga-readiness-discovery-'));
    try {
      expect(discoverRepoRoot(tmp)).toBe(tmp);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------- runAudit smoke (real corpus) ----------

describe('runAudit (real corpus)', () => {
  it('produces 8 categories with criteria each', () => {
    const report = runAudit({
      repoRoot: REPO_ROOT,
      presetsRoot: 'skills/stageflip/presets',
      generatedAt: '2026-05-11T00:00:00.000Z',
    });
    expect(report.categories.length).toBe(8);
    for (const cat of report.categories) {
      expect(cat.criteria.length).toBeGreaterThan(0);
    }
  });

  it('marks 1.3 cluster-compose bundles PASS on current main', () => {
    const report = runAudit({
      repoRoot: REPO_ROOT,
      presetsRoot: 'skills/stageflip/presets',
      generatedAt: 'x',
    });
    const cat1 = report.categories.find((c) => c.number === 1);
    const c13 = cat1?.criteria.find((c) => c.id === '1.3');
    expect(c13?.status).toBe('PASS');
  });

  it('marks 4.2 frontier clip primitives PASS on current main', () => {
    const report = runAudit({
      repoRoot: REPO_ROOT,
      presetsRoot: 'skills/stageflip/presets',
      generatedAt: 'x',
    });
    const cat4 = report.categories.find((c) => c.number === 4);
    const c42 = cat4?.criteria.find((c) => c.id === '4.2');
    expect(c42?.status).toBe('PASS');
  });

  it('marks 3.4 ADRs PASS on current main', () => {
    const report = runAudit({
      repoRoot: REPO_ROOT,
      presetsRoot: 'skills/stageflip/presets',
      generatedAt: 'x',
    });
    const cat3 = report.categories.find((c) => c.number === 3);
    const c34 = cat3?.criteria.find((c) => c.id === '3.4');
    expect(c34?.status).toBe('PASS');
  });
});

// ---------- synthetic-tree smoke (isolated category checks) ----------

describe('runAudit on synthetic minimal tree', () => {
  it('flags FAIL when CLAUDE.md is missing entirely', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-ga-readiness-syn-'));
    try {
      // Create a near-empty repo with a presets root but no CLAUDE.md.
      mkdirSync(join(tmp, 'skills/stageflip/presets/news'), { recursive: true });
      writeFileSync(
        join(tmp, 'skills/stageflip/presets/news/SKILL.md'),
        '---\ncluster: news\n---\n# Cluster A — News\n',
      );
      const report = runAudit({
        repoRoot: tmp,
        presetsRoot: 'skills/stageflip/presets',
        generatedAt: 'x',
      });
      const cat3 = report.categories.find((c) => c.number === 3);
      const c31 = cat3?.criteria.find((c) => c.id === '3.1');
      expect(c31?.status).toBe('FAIL');
      const c32 = cat3?.criteria.find((c) => c.id === '3.2');
      expect(c32?.status).toBe('FAIL');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------- Category 8 (T-447 Phase 14 GA readiness) ----------

describe('runCategory8 (real corpus)', () => {
  it('returns 11 criteria in stable 8.1..8.11 ordering', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    expect(cat.number).toBe(8);
    expect(cat.title).toBe('Phase 14 GA readiness');
    expect(cat.criteria.length).toBe(11);
    expect(cat.criteria.map((c) => c.id)).toEqual([
      '8.1',
      '8.2',
      '8.3',
      '8.4',
      '8.5',
      '8.6',
      '8.7',
      '8.8',
      '8.9',
      '8.10',
      '8.11',
    ]);
  });

  it('marks 8.2 PASS — 9 reference adapter packages on main', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c82 = cat.criteria.find((c) => c.id === '8.2');
    expect(c82?.status).toBe('PASS');
    expect(c82?.note).toMatch(/9\/9/);
  });

  it('marks 8.3 PASS — 9 security.json sidecars present', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c83 = cat.criteria.find((c) => c.id === '8.3');
    expect(c83?.status).toBe('PASS');
  });

  it('marks 8.4 PASS — ADAPTER_IDS lists all 9 adapter ids', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c84 = cat.criteria.find((c) => c.id === '8.4');
    expect(c84?.status).toBe('PASS');
  });

  it('marks 8.5 PASS — check-asset-licenses fully wired', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c85 = cat.criteria.find((c) => c.id === '8.5');
    expect(c85?.status).toBe('PASS');
  });

  it('marks 8.6 PASS — check-adapter-regression fully wired', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c86 = cat.criteria.find((c) => c.id === '8.6');
    expect(c86?.status).toBe('PASS');
  });

  it('marks 8.7 PASS — @stageflip/adapter-sandbox present', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c87 = cat.criteria.find((c) => c.id === '8.7');
    expect(c87?.status).toBe('PASS');
  });

  it('marks 8.8 PASS — @stageflip/usage-telemetry + query_usage_telemetry tool present', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c88 = cat.criteria.find((c) => c.id === '8.8');
    expect(c88?.status).toBe('PASS');
  });

  it('marks 8.9 PASS — check-data-flow-security fully wired', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c89 = cat.criteria.find((c) => c.id === '8.9');
    expect(c89?.status).toBe('PASS');
  });

  it('marks 8.11 auto-WARN per closeout-timing memory', () => {
    const cat = runCategory8({ repoRoot: REPO_ROOT, presetsRoot: 'skills/stageflip/presets' });
    const c811 = cat.criteria.find((c) => c.id === '8.11');
    // Per feedback_phase_closeout_timing.md — phase-N closeout lands at
    // phase-N+1 start; T-449 docs not yet expected on main.
    expect(['WARN', 'PASS']).toContain(c811?.status);
  });
});

describe('runCategory8 on synthetic empty tree', () => {
  it('flags 8.1 / 8.2 / 8.3 / 8.4 FAIL on an empty repo', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-ga-readiness-cat8-'));
    try {
      const cat = runCategory8({ repoRoot: tmp, presetsRoot: 'skills/stageflip/presets' });
      const byId = new Map(cat.criteria.map((c) => [c.id, c]));
      expect(byId.get('8.1')?.status).toBe('FAIL');
      expect(byId.get('8.2')?.status).toBe('FAIL');
      expect(byId.get('8.3')?.status).toBe('FAIL');
      expect(byId.get('8.4')?.status).toBe('FAIL');
      expect(byId.get('8.5')?.status).toBe('FAIL');
      expect(byId.get('8.6')?.status).toBe('FAIL');
      expect(byId.get('8.7')?.status).toBe('FAIL');
      expect(byId.get('8.8')?.status).toBe('FAIL');
      expect(byId.get('8.9')?.status).toBe('FAIL');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('flags 8.1 PASS on synthetic tree with both ADRs ratified', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-ga-readiness-cat8-adrs-'));
    try {
      mkdirSync(join(tmp, 'docs/decisions'), { recursive: true });
      writeFileSync(
        join(tmp, 'docs/decisions/ADR-007-provider-seam-pattern.md'),
        '# ADR-007\n\n**Status**: **Accepted**\n',
      );
      writeFileSync(
        join(tmp, 'docs/decisions/ADR-008-asset-generation.md'),
        '# ADR-008\n\n**Status**: **Accepted**\n',
      );
      const cat = runCategory8({ repoRoot: tmp, presetsRoot: 'skills/stageflip/presets' });
      const c81 = cat.criteria.find((c) => c.id === '8.1');
      expect(c81?.status).toBe('PASS');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('flags 8.1 FAIL when ADR-007 is Proposed and ADR-008 is Accepted', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-ga-readiness-cat8-mix-'));
    try {
      mkdirSync(join(tmp, 'docs/decisions'), { recursive: true });
      writeFileSync(
        join(tmp, 'docs/decisions/ADR-007-provider-seam-pattern.md'),
        '# ADR-007\n\n**Status**: **Proposed**\n',
      );
      writeFileSync(
        join(tmp, 'docs/decisions/ADR-008-asset-generation.md'),
        '# ADR-008\n\n**Status**: **Accepted**\n',
      );
      const cat = runCategory8({ repoRoot: tmp, presetsRoot: 'skills/stageflip/presets' });
      const c81 = cat.criteria.find((c) => c.id === '8.1');
      expect(c81?.status).toBe('FAIL');
      expect(c81?.note).toMatch(/ADR-007/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
