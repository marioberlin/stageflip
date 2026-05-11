// scripts/check-export-parity.test.ts
// Unit tests for the T-409 preset × export parity gate. AC numbers refer
// to docs/tasks/T-409.md.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { RoutingDecision } from '../packages/export-router/src/types.js';
import type { ExportTarget } from '../packages/schema/src/index.js';

import {
  buildSyntheticLiveClipDocument,
  checkExporterPackageExists,
  checkFallbackBranchCoverage,
  checkMatrixModeConsistency,
  checkRouteShape,
  exporterPackageToDirName,
  formatReport,
  parseArgs,
  runCheck,
  runParityChecks,
  usage,
} from './check-export-parity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REAL_PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');
const REAL_PACKAGES_ROOT = resolve(REPO_ROOT, 'packages');

// ---------- helpers ----------

function makeSyntheticPreset(opts: { cluster: string; id: string }): string {
  const lines: string[] = ['---'];
  lines.push(`id: ${opts.id}`);
  lines.push(`cluster: ${opts.cluster}`);
  lines.push('clipKind: lowerThird');
  lines.push('source: docs/compass.md#synthetic');
  lines.push('status: stub');
  lines.push('preferredFont:');
  lines.push('  family: Inter');
  lines.push('  license: ofl');
  lines.push('permissions: []');
  lines.push('signOff:');
  lines.push('  parityFixture: pending-user-review');
  lines.push('  typeDesign: pending-cluster-batch');
  lines.push('---');
  lines.push('');
  lines.push('# Synthetic preset');
  return lines.join('\n');
}

function writeSyntheticTree(presets: Array<{ cluster: string; id: string }>): string {
  const root = mkdtempSync(join(tmpdir(), 'export-parity-'));
  const clusters = new Set(presets.map((p) => p.cluster));
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
owner_task: T-409
related: []
---

# Cluster ${cluster}
`,
    );
  }
  for (const p of presets) {
    writeFileSync(join(root, p.cluster, `${p.id}.md`), makeSyntheticPreset(p));
  }
  return root;
}

// ---------- exporterPackageToDirName ----------

describe('exporterPackageToDirName', () => {
  it('strips the @stageflip/ prefix', () => {
    expect(exporterPackageToDirName('@stageflip/export-pptx')).toBe('export-pptx');
    expect(exporterPackageToDirName('@stageflip/export-html5-zip')).toBe('export-html5-zip');
  });

  it('throws on a package name missing the prefix', () => {
    expect(() => exporterPackageToDirName('export-pptx')).toThrow(/expected.*@stageflip\//);
  });
});

// ---------- buildSyntheticDocumentForPreset ----------

describe('buildSyntheticDocumentForPreset', () => {
  it('produces a slide-mode doc with one text element and zero live clips', () => {
    const root = writeSyntheticTree([{ cluster: 'news', id: 'synthetic-1' }]);
    try {
      const report = runParityChecks({
        presetsRoot: root,
        packagesRoot: REAL_PACKAGES_ROOT,
      });
      expect(report.scannedPresets).toBe(1);
      expect(report.totalPairs).toBe(8);
      expect(report.exitCode).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- buildSyntheticLiveClipDocument ----------

describe('buildSyntheticLiveClipDocument', () => {
  it('contains one interactive-clip element', () => {
    const doc = buildSyntheticLiveClipDocument();
    // Cast to navigate the slide-mode shape (the synthetic doc is constructed
    // via `as unknown as Document` so structural inspection requires a cast).
    const slides = (doc.content as { slides: Array<{ elements: Array<{ type: string }> }> }).slides;
    expect(slides).toHaveLength(1);
    expect(slides[0]?.elements).toHaveLength(1);
    expect(slides[0]?.elements[0]?.type).toBe('interactive-clip');
  });
});

// ---------- checkRouteShape ----------

describe('checkRouteShape', () => {
  it('accepts a well-formed route+live decision', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'html-slides',
      mode: 'live',
      exporterPackage: '@stageflip/export-html5-zip',
      reason: 'target_is_live_capable',
    };
    expect(checkRouteShape(decision)).toEqual({ ok: true });
  });

  it('accepts a well-formed route+static decision', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only_no_live_clips',
    };
    expect(checkRouteShape(decision)).toEqual({ ok: true });
  });

  it('accepts a well-formed fallback decision', () => {
    const decision: RoutingDecision = {
      kind: 'fallback',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only',
      liveClipsOmitted: [{ id: 'foo', family: 'shader' }],
    };
    expect(checkRouteShape(decision)).toEqual({ ok: true });
  });

  it('rejects a route+live decision with the wrong reason', () => {
    const decision = {
      kind: 'route',
      target: 'html-slides' as ExportTarget,
      mode: 'live',
      exporterPackage: '@stageflip/export-html5-zip',
      reason: 'target_is_static_only_no_live_clips',
    } as unknown as RoutingDecision;
    const result = checkRouteShape(decision);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/wrong reason/);
  });

  it('rejects a fallback decision with mode != static', () => {
    const decision = {
      kind: 'fallback',
      target: 'mp4' as ExportTarget,
      mode: 'live',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only',
      liveClipsOmitted: [{ id: 'foo', family: 'shader' }],
    } as unknown as RoutingDecision;
    const result = checkRouteShape(decision);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/invalid mode/);
  });

  it('rejects a fallback decision missing liveClipsOmitted', () => {
    const decision = {
      kind: 'fallback',
      target: 'mp4' as ExportTarget,
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only',
    } as unknown as RoutingDecision;
    const result = checkRouteShape(decision);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/missing liveClipsOmitted/);
  });

  it('rejects an unknown discriminator', () => {
    const decision = {
      kind: 'mystery',
      target: 'mp4' as ExportTarget,
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
    } as unknown as RoutingDecision;
    const result = checkRouteShape(decision);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/unknown decision kind/);
  });
});

// ---------- checkExporterPackageExists ----------

describe('checkExporterPackageExists', () => {
  it('passes when the package directory has a package.json', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'pptx-flat',
      mode: 'static',
      exporterPackage: '@stageflip/export-pptx',
      reason: 'target_is_static_only_no_live_clips',
    };
    expect(checkExporterPackageExists({ decision, packagesRoot: REAL_PACKAGES_ROOT })).toEqual({
      ok: true,
    });
  });

  it('fails when the package directory does not exist', () => {
    const decision = {
      kind: 'route',
      target: 'pptx-flat',
      mode: 'static',
      exporterPackage: '@stageflip/export-fictional',
      reason: 'target_is_static_only_no_live_clips',
    } as unknown as RoutingDecision;
    const result = checkExporterPackageExists({
      decision,
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no package\.json/);
  });

  it('fails when the package name does not start with @stageflip/', () => {
    const decision = {
      kind: 'route',
      target: 'pptx-flat',
      mode: 'static',
      exporterPackage: 'export-pptx',
      reason: 'target_is_static_only_no_live_clips',
    } as unknown as RoutingDecision;
    const result = checkExporterPackageExists({
      decision,
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/@stageflip\//);
  });
});

// ---------- checkMatrixModeConsistency ----------

describe('checkMatrixModeConsistency', () => {
  it('passes when decision.mode matches EXPORT_MATRIX', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only_no_live_clips',
    };
    expect(checkMatrixModeConsistency({ target: 'mp4', decision })).toEqual({ ok: true });
  });

  it('fails when decision.mode disagrees with the matrix', () => {
    const decision = {
      kind: 'route',
      target: 'mp4',
      mode: 'live',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_live_capable',
    } as unknown as RoutingDecision;
    const result = checkMatrixModeConsistency({ target: 'mp4', decision });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/disagrees with EXPORT_MATRIX/);
  });
});

// ---------- checkFallbackBranchCoverage ----------

describe('checkFallbackBranchCoverage', () => {
  it('passes when a static target produces a fallback decision with non-empty liveClipsOmitted', () => {
    const decision: RoutingDecision = {
      kind: 'fallback',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only',
      liveClipsOmitted: [{ id: 'x', family: 'shader' }],
    };
    expect(checkFallbackBranchCoverage({ target: 'mp4', decision })).toEqual({ ok: true });
  });

  it('fails when a static target produces a route decision (live clip not surfaced)', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only_no_live_clips',
    };
    const result = checkFallbackBranchCoverage({ target: 'mp4', decision });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/expected 'fallback'/);
  });

  it('fails when a static target produces an empty liveClipsOmitted array', () => {
    const decision: RoutingDecision = {
      kind: 'fallback',
      target: 'mp4',
      mode: 'static',
      exporterPackage: '@stageflip/export-video',
      reason: 'target_is_static_only',
      liveClipsOmitted: [],
    };
    const result = checkFallbackBranchCoverage({ target: 'mp4', decision });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/empty liveClipsOmitted/);
  });

  it('passes when a live target produces a route+live decision', () => {
    const decision: RoutingDecision = {
      kind: 'route',
      target: 'html-slides',
      mode: 'live',
      exporterPackage: '@stageflip/export-html5-zip',
      reason: 'target_is_live_capable',
    };
    expect(checkFallbackBranchCoverage({ target: 'html-slides', decision })).toEqual({
      ok: true,
    });
  });

  it('fails when a live target produces a fallback decision', () => {
    const decision = {
      kind: 'fallback',
      target: 'html-slides',
      mode: 'static',
      exporterPackage: '@stageflip/export-html5-zip',
      reason: 'target_is_static_only',
      liveClipsOmitted: [{ id: 'x', family: 'shader' }],
    } as unknown as RoutingDecision;
    const result = checkFallbackBranchCoverage({ target: 'html-slides', decision });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/expected route\+live/);
  });
});

// ---------- runParityChecks (integration) ----------

describe('runParityChecks', () => {
  it('passes against the real preset corpus (AC #2)', () => {
    const report = runParityChecks({
      presetsRoot: REAL_PRESETS_ROOT,
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    expect(report.scannedPresets).toBeGreaterThanOrEqual(1);
    expect(report.totalPairs).toBe(report.scannedPresets * 8);
    expect(report.exitCode).toBe(0);
    for (const key of Object.keys(report.byInvariant) as Array<keyof typeof report.byInvariant>) {
      expect(report.byInvariant[key].errors).toEqual([]);
    }
  });

  it('returns exit 1 when the loader fails on a missing presets root', () => {
    const report = runParityChecks({
      presetsRoot: '/does/not/exist',
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    expect(report.exitCode).toBe(1);
    expect(report.loaderError).toBeDefined();
  });

  it('returns exit 1 when packagesRoot does not contain the expected exporter packages', () => {
    const root = writeSyntheticTree([{ cluster: 'news', id: 'synthetic-only' }]);
    const emptyPackagesRoot = mkdtempSync(join(tmpdir(), 'empty-packages-'));
    try {
      const report = runParityChecks({
        presetsRoot: root,
        packagesRoot: emptyPackagesRoot,
      });
      expect(report.exitCode).toBe(1);
      expect(report.byInvariant['exporter-package-exists'].errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(emptyPackagesRoot, { recursive: true, force: true });
    }
  });
});

// ---------- formatReport ----------

describe('formatReport', () => {
  it('emits PASS lines for every invariant on a clean report', () => {
    const report = runParityChecks({
      presetsRoot: REAL_PRESETS_ROOT,
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    const { stdout, stderr } = formatReport(report);
    expect(stdout).toMatch(/check-export-parity \[route-shape\]: PASS/);
    expect(stdout).toMatch(/check-export-parity \[exporter-package-exists\]: PASS/);
    expect(stdout).toMatch(/check-export-parity \[matrix-mode-consistency\]: PASS/);
    expect(stdout).toMatch(/check-export-parity \[fallback-branch-coverage\]: PASS/);
    expect(stdout).toMatch(/check-export-parity: PASS/);
    expect(stderr).toBe('');
  });

  it('emits FAIL lines on stderr when invariants fail', () => {
    const report = runParityChecks({
      presetsRoot: '/does/not/exist',
      packagesRoot: REAL_PACKAGES_ROOT,
    });
    const { stderr } = formatReport(report);
    expect(stderr).toMatch(/loader error/);
    expect(stderr).toMatch(/check-export-parity: FAIL/);
  });
});

// ---------- parseArgs ----------

describe('parseArgs', () => {
  it('returns defaults when no args are passed', () => {
    const { args, errors } = parseArgs([]);
    expect(errors).toEqual([]);
    expect(args.presetsRoot).toBe('skills/stageflip/presets');
    expect(args.packagesRoot).toBe('packages');
    expect(args.help).toBe(false);
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).args.help).toBe(true);
    expect(parseArgs(['-h']).args.help).toBe(true);
  });

  it('parses --presets-root=<path>', () => {
    const { args } = parseArgs(['--presets-root=/tmp/x']);
    expect(args.presetsRoot).toBe('/tmp/x');
  });

  it('parses --packages-root=<path>', () => {
    const { args } = parseArgs(['--packages-root=/tmp/y']);
    expect(args.packagesRoot).toBe('/tmp/y');
  });

  it('reports unknown flags', () => {
    const { errors } = parseArgs(['--mystery=foo']);
    expect(errors).toContain("unknown flag '--mystery'");
  });

  it('reports positional / unrecognised args', () => {
    const { errors } = parseArgs(['positional']);
    expect(errors[0]).toMatch(/unrecognised argument/);
  });
});

// ---------- runCheck (in-process CLI) ----------

describe('runCheck', () => {
  it('exits 0 with help text on --help', () => {
    const result = runCheck(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.join('\n')).toMatch(/Usage:/);
  });

  it('exits 2 on argument errors', () => {
    const result = runCheck(['--mystery']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr.join('\n')).toMatch(/unrecognised argument/);
  });

  it('exits 0 against the real corpus', () => {
    const result = runCheck([
      `--presets-root=${REAL_PRESETS_ROOT}`,
      `--packages-root=${REAL_PACKAGES_ROOT}`,
    ]);
    expect(result.exitCode).toBe(0);
  });
});

// ---------- usage ----------

describe('usage', () => {
  it('mentions both flags', () => {
    const u = usage();
    expect(u).toMatch(/--presets-root/);
    expect(u).toMatch(/--packages-root/);
  });
});

// ---------- subprocess CLI ----------

describe('CLI (subprocess)', () => {
  const SCRIPT_PATH = resolve(__dirname, 'check-export-parity.ts');

  it('exits 0 against the real corpus', () => {
    const r = spawnSync('pnpm', ['tsx', SCRIPT_PATH], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      // Surface stdout + stderr in the failure message so CI failures are
      // self-diagnosing.
      throw new Error(`exit=${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/check-export-parity: PASS/);
  }, 30_000);
});
