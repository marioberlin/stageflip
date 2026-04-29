// scripts/check-preset-integrity.test.ts
// Tests for the seven-invariant `check-preset-integrity` CI gate (T-308).
// Each invariant gets at least one positive + one negative test (synthetic
// presets); the on-disk corpus is exercised end-to-end via `runIntegrityChecks`
// against the real `skills/stageflip/presets/` root.
//
// AC numbers refer to docs/tasks/T-308.md.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  INTERACTIVE_CLIP_KINDS,
  VALID_CLIP_KINDS,
  checkBespokeFontHasFallback,
  checkClipKindExists,
  checkCompassAnchor,
  checkFrontmatter,
  checkInteractiveStaticFallback,
  checkParityFixtureSignOff,
  checkShaderProps,
  checkThreeSceneProps,
  checkTypeDesignSignOff,
  formatReport,
  loadCompassAnchors,
  runIntegrityChecks,
} from './check-preset-integrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const PRESETS_ROOT = resolve(REPO_ROOT, 'skills/stageflip/presets');

// --------- helpers ----------

interface SyntheticOpts {
  cluster?: string;
  id?: string;
  clipKind?: string;
  source?: string;
  preferredFontLicense?: string;
  preferredFontFamily?: string;
  fallbackFont?: { family: string; weight: number; license: string } | null;
  parityFixture?: string;
  typeDesign?: string;
  staticFallback?: string;
  permissions?: string[];
  status?: string;
}

function makeFrontmatter(opts: SyntheticOpts = {}): string {
  const cluster = opts.cluster ?? 'news';
  const id = opts.id ?? 'synthetic-preset';
  const clipKind = opts.clipKind ?? 'lowerThird';
  const source = opts.source ?? 'docs/compass.md#synthetic';
  const preferredFamily = opts.preferredFontFamily ?? 'Inter';
  const preferredLicense = opts.preferredFontLicense ?? 'ofl';
  const parityFixture = opts.parityFixture ?? 'pending-user-review';
  const typeDesign = opts.typeDesign ?? 'pending-cluster-batch';
  const status = opts.status ?? 'stub';

  const lines: string[] = ['---'];
  lines.push(`id: ${id}`);
  lines.push(`cluster: ${cluster}`);
  lines.push(`clipKind: ${clipKind}`);
  lines.push(`source: ${source}`);
  lines.push(`status: ${status}`);
  lines.push('preferredFont:');
  lines.push(`  family: ${preferredFamily}`);
  lines.push(`  license: ${preferredLicense}`);
  if (opts.fallbackFont) {
    lines.push('fallbackFont:');
    lines.push(`  family: ${opts.fallbackFont.family}`);
    lines.push(`  weight: ${opts.fallbackFont.weight}`);
    lines.push(`  license: ${opts.fallbackFont.license}`);
  }
  lines.push(`permissions: ${JSON.stringify(opts.permissions ?? [])}`);
  if (opts.staticFallback !== undefined) {
    lines.push(`staticFallback: ${opts.staticFallback}`);
  }
  lines.push('signOff:');
  lines.push(`  parityFixture: ${parityFixture}`);
  lines.push(`  typeDesign: ${typeDesign}`);
  lines.push('---');
  lines.push('');
  lines.push('# Synthetic preset');
  return lines.join('\n');
}

function writeSyntheticTree(opts: {
  presets: Array<{ cluster: string; id: string; raw: string }>;
  clusterIds?: string[];
}): string {
  const root = mkdtempSync(join(tmpdir(), 'tdx-presets-'));
  const clusters = new Set([...opts.presets.map((p) => p.cluster), ...(opts.clusterIds ?? [])]);
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
owner_task: T-308
related: []
---

# Cluster ${cluster}
`,
    );
  }
  for (const p of opts.presets) {
    writeFileSync(join(root, p.cluster, `${p.id}.md`), p.raw);
  }
  return root;
}

// ---------- Invariant 1: frontmatter ----------

describe('check-preset-integrity invariant 1: frontmatter (AC #1)', () => {
  it('aggregates malformed frontmatter as a violation', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'malformed',
          raw: `---
id: malformed
cluster: news
# missing required fields (clipKind, source, status, preferredFont, signOff)
---
`,
        },
      ],
    });
    try {
      const report = runIntegrityChecks({ presetsRoot: root });
      const fmBucket = report.byInvariant.frontmatter;
      expect(fmBucket).toBeDefined();
      expect(fmBucket?.errors.length).toBeGreaterThan(0);
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes for a well-formed preset', () => {
    const result = checkFrontmatter({
      filePath: 'synthetic.md',
      raw: makeFrontmatter(),
    });
    expect(result.ok).toBe(true);
  });
});

// ---------- Invariant 2: clipKind ----------

describe('check-preset-integrity invariant 2: clipKind (AC #2)', () => {
  it('passes for a known clipKind', () => {
    const result = checkClipKindExists({ clipKind: 'lowerThird', presetId: 'p' });
    expect(result.ok).toBe(true);
  });

  it('fails for an unknown clipKind', () => {
    const result = checkClipKindExists({ clipKind: 'mystery', presetId: 'p' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/mystery/);
    }
  });

  it('every real clipKind atom is in VALID_CLIP_KINDS', () => {
    expect(VALID_CLIP_KINDS.has('lowerThird')).toBe(true);
    expect(VALID_CLIP_KINDS.has('breakingBanner')).toBe(true);
    expect(VALID_CLIP_KINDS.has('arOverlay')).toBe(true);
    expect(VALID_CLIP_KINDS.has('caption')).toBe(true);
  });
});

// ---------- Invariant 3: bespoke fallback ----------

describe('check-preset-integrity invariant 3: bespoke-font fallback (AC #3, #4)', () => {
  it('fails when proprietary-byo has no fallback (AC #3)', () => {
    const result = checkBespokeFontHasFallback({
      presetId: 'p',
      preferredFontFamily: 'Premier Sans',
      preferredFontLicense: 'commercial-byo',
      hasFallback: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/commercial-byo/);
      expect(result.message).toMatch(/Premier Sans/);
    }
  });

  it('passes when proprietary-byo has a fallback (AC #4)', () => {
    const result = checkBespokeFontHasFallback({
      presetId: 'p',
      preferredFontFamily: 'CNN Sans',
      preferredFontLicense: 'proprietary-byo',
      hasFallback: true,
    });
    expect(result.ok).toBe(true);
  });

  it('passes for a non-bespoke license regardless of fallback', () => {
    const result = checkBespokeFontHasFallback({
      presetId: 'p',
      preferredFontFamily: 'Inter',
      preferredFontLicense: 'ofl',
      hasFallback: false,
    });
    expect(result.ok).toBe(true);
  });
});

// ---------- Invariant 4: interactive staticFallback ----------

describe('check-preset-integrity invariant 4: interactive staticFallback (AC #5)', () => {
  it('fails for an interactive-family preset with no staticFallback', () => {
    // Ensure VALID_CLIP_KINDS includes interactive kinds so the synthetic check is meaningful.
    const interactiveKind = [...INTERACTIVE_CLIP_KINDS][0];
    if (interactiveKind === undefined) throw new Error('expected at least one interactive kind');
    const result = checkInteractiveStaticFallback({
      presetId: 'p',
      clipKind: interactiveKind,
      raw: { staticFallback: '' },
    });
    expect(result.ok).toBe(false);
  });

  it('fails for an interactive-family preset missing the staticFallback field', () => {
    const interactiveKind = [...INTERACTIVE_CLIP_KINDS][0];
    if (interactiveKind === undefined) throw new Error('expected at least one interactive kind');
    const result = checkInteractiveStaticFallback({
      presetId: 'p',
      clipKind: interactiveKind,
      raw: {},
    });
    expect(result.ok).toBe(false);
  });

  it('passes for an interactive-family preset with a staticFallback', () => {
    const interactiveKind = [...INTERACTIVE_CLIP_KINDS][0];
    if (interactiveKind === undefined) throw new Error('expected at least one interactive kind');
    const result = checkInteractiveStaticFallback({
      presetId: 'p',
      clipKind: interactiveKind,
      raw: { staticFallback: 'frozen-poster' },
    });
    expect(result.ok).toBe(true);
  });

  it('passes for a non-interactive preset regardless of staticFallback', () => {
    const result = checkInteractiveStaticFallback({
      presetId: 'p',
      clipKind: 'lowerThird',
      raw: {},
    });
    expect(result.ok).toBe(true);
  });
});

// ---------- Invariant 5: typeDesign sign-off (cluster scoping) ----------

describe('check-preset-integrity invariant 5: typeDesign sign-off (AC #6, #7)', () => {
  it('passes for a news-cluster preset with pending-cluster-batch (AC #6)', () => {
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'news',
      typeDesign: 'pending-cluster-batch',
      preferredFontLicense: 'proprietary-byo',
    });
    expect(result.ok).toBe(true);
  });

  it('passes for a weather-cluster preset without typeDesign (AC #7)', () => {
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'weather',
      typeDesign: 'na',
      preferredFontLicense: 'ofl',
    });
    expect(result.ok).toBe(true);
  });

  it('fails for a captions-cluster preset with typeDesign: na', () => {
    // captions is cluster F — invariant 5 applies.
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'captions',
      typeDesign: 'na',
      preferredFontLicense: 'ofl',
    });
    expect(result.ok).toBe(false);
  });

  it('passes for a sports-cluster preset with signed:YYYY-MM-DD', () => {
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'sports',
      typeDesign: 'signed:2026-04-28',
      preferredFontLicense: 'ofl',
    });
    expect(result.ok).toBe(true);
  });

  it('passes for a data-cluster preset with na (cluster E exempt)', () => {
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'data',
      typeDesign: 'na',
      preferredFontLicense: 'ofl',
    });
    expect(result.ok).toBe(true);
  });

  it('passes for an ar-cluster preset with na (cluster H exempt)', () => {
    const result = checkTypeDesignSignOff({
      presetId: 'p',
      cluster: 'ar',
      typeDesign: 'na',
      preferredFontLicense: 'ofl',
    });
    expect(result.ok).toBe(true);
  });

  it('passes for a ctas-cluster text-free preset (preferredFont.license=na)', () => {
    // Text-free presets (e.g. QR-only Coinbase CTA) are exempt from invariant 5
    // — type-design review has no purchase on a preset with no typography.
    const result = checkTypeDesignSignOff({
      presetId: 'coinbase-dvd-qr',
      cluster: 'ctas',
      typeDesign: 'na',
      preferredFontLicense: 'na',
    });
    expect(result.ok).toBe(true);
  });
});

// ---------- Invariant 6: parityFixture sign-off ----------

describe('check-preset-integrity invariant 6: parityFixture sign-off (AC #8)', () => {
  it('warns (not errors) when parityFixture is pending-user-review', () => {
    const result = checkParityFixtureSignOff({
      presetId: 'p',
      parityFixture: 'pending-user-review',
    });
    expect(result.ok).toBe(false);
    if (!result.ok && 'severity' in result) {
      expect(result.severity).toBe('warning');
    } else {
      throw new Error('expected warning severity');
    }
  });

  it('passes when parityFixture is signed', () => {
    const result = checkParityFixtureSignOff({
      presetId: 'p',
      parityFixture: 'signed:2026-04-28',
    });
    expect(result.ok).toBe(true);
  });

  it('passes when parityFixture is na', () => {
    const result = checkParityFixtureSignOff({
      presetId: 'p',
      parityFixture: 'na',
    });
    expect(result.ok).toBe(true);
  });
});

// ---------- Invariant 7: compass anchor ----------

describe('check-preset-integrity invariant 7: compass anchor (AC #9, #10)', () => {
  it('passes when source resolves to an existing anchor', () => {
    const compass = {
      filePath: '/tmp/compass.md',
      anchors: new Set(['cnn', 'cnn-classic']),
    };
    const result = checkCompassAnchor({
      presetId: 'p',
      source: 'docs/compass.md#cnn-classic',
      compass,
    });
    expect(result.ok).toBe(true);
  });

  it('fails when anchor is missing', () => {
    const compass = {
      filePath: '/tmp/compass.md',
      anchors: new Set(['cnn']),
    };
    const result = checkCompassAnchor({
      presetId: 'p',
      source: 'docs/compass.md#nonexistent-anchor',
      compass,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/nonexistent-anchor/);
    }
  });

  it('passes for an external https URL without verification', () => {
    const compass = {
      filePath: '/tmp/compass.md',
      anchors: new Set<string>(),
    };
    const result = checkCompassAnchor({
      presetId: 'p',
      source: 'https://example.com/some/page',
      compass,
    });
    expect(result.ok).toBe(true);
  });

  it('skips invariant 7 globally when compass is missing (AC #10)', () => {
    const result = checkCompassAnchor({
      presetId: 'p',
      source: 'docs/compass.md#cnn',
      compass: undefined,
    });
    // skipped === ok by contract; ensure no error.
    expect(result.ok).toBe(true);
  });

  it('loadCompassAnchors returns undefined for a missing file', () => {
    const loaded = loadCompassAnchors('/this/path/does/not/exist.md');
    expect(loaded).toBeUndefined();
  });

  it('loadCompassAnchors extracts heading slugs from a real markdown file', () => {
    const root = mkdtempSync(join(tmpdir(), 'tdx-compass-'));
    const filePath = join(root, 'compass.md');
    writeFileSync(
      filePath,
      `# Top Heading

Some prose.

## CNN

CNN content.

## CNN Breaking News Banner

Banner content.

### Sub Heading
`,
    );
    try {
      const loaded = loadCompassAnchors(filePath);
      expect(loaded).toBeDefined();
      expect(loaded?.anchors.has('cnn')).toBe(true);
      expect(loaded?.anchors.has('cnn-breaking-news-banner')).toBe(true);
      expect(loaded?.anchors.has('top-heading')).toBe(true);
      expect(loaded?.anchors.has('sub-heading')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- runIntegrityChecks aggregation ----------

describe('check-preset-integrity aggregation (AC #13)', () => {
  it('aggregates violations across multiple invariants in one report', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          // invariant 2 (mystery clipKind) + invariant 3 (no fallback for proprietary-byo)
          cluster: 'news',
          id: 'multi-violation',
          raw: makeFrontmatter({
            id: 'multi-violation',
            clipKind: 'mystery-kind',
            preferredFontFamily: 'CNN Sans',
            preferredFontLicense: 'proprietary-byo',
            fallbackFont: null,
          }),
        },
        {
          // invariant 5 (captions cluster, typeDesign na)
          cluster: 'captions',
          id: 'unsigned-caption',
          raw: makeFrontmatter({
            id: 'unsigned-caption',
            cluster: 'captions',
            clipKind: 'caption',
            typeDesign: 'na',
          }),
        },
      ],
      clusterIds: ['captions'],
    });
    try {
      const report = runIntegrityChecks({ presetsRoot: root });
      // Three error-severity invariants surfaced in one report.
      const errorInvariants = Object.entries(report.byInvariant).filter(
        ([, v]) => v.errors.length > 0,
      );
      expect(errorInvariants.length).toBeGreaterThanOrEqual(3);
      expect(report.exitCode).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- formatReport ----------

describe('check-preset-integrity formatReport (AC #12)', () => {
  it('renders PASS when no errors or warnings', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'weather',
          id: 'pass-preset',
          raw: makeFrontmatter({
            cluster: 'weather',
            id: 'pass-preset',
            clipKind: 'weatherMap',
            parityFixture: 'na',
            typeDesign: 'na',
          }),
        },
      ],
    });
    try {
      const report = runIntegrityChecks({ presetsRoot: root });
      const out = formatReport(report);
      expect(out.stdout).toMatch(/PASS/);
      expect(out.stderr).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders FAIL with violation list when there are errors', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'news',
          id: 'fail-preset',
          raw: makeFrontmatter({
            id: 'fail-preset',
            clipKind: 'mystery',
          }),
        },
      ],
    });
    try {
      const report = runIntegrityChecks({ presetsRoot: root });
      const out = formatReport(report);
      expect(out.stdout).toMatch(/clipKind\]: FAIL/);
      expect(out.stderr).toMatch(/FAIL/);
      expect(out.stderr).toMatch(/mystery/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('renders WARN section for pending parityFixture entries', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'weather',
          id: 'warn-preset',
          raw: makeFrontmatter({
            cluster: 'weather',
            id: 'warn-preset',
            clipKind: 'weatherMap',
            parityFixture: 'pending-user-review',
            typeDesign: 'na',
          }),
        },
      ],
    });
    try {
      const report = runIntegrityChecks({ presetsRoot: root });
      const out = formatReport(report);
      expect(out.stdout).toMatch(/parityFixture-signOff\]: WARN/);
      expect(out.stdout).toMatch(/pending-user-review/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits a SKIP line when compass is missing', () => {
    const root = writeSyntheticTree({
      presets: [
        {
          cluster: 'weather',
          id: 'skip-preset',
          raw: makeFrontmatter({
            cluster: 'weather',
            id: 'skip-preset',
            clipKind: 'weatherMap',
            typeDesign: 'na',
            parityFixture: 'na',
          }),
        },
      ],
    });
    try {
      const report = runIntegrityChecks({
        presetsRoot: root,
        compassPath: '/nonexistent/path/compass.md',
      });
      const out = formatReport(report);
      expect(out.stdout).toMatch(/compass-anchor\]: SKIP/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- Invariant 8: shader-props (T-383 AC #4, #5) ----------

describe('check-preset-integrity invariant 8: shader-props (T-383 AC #4, #5)', () => {
  it('AC #5 — passes when family is omitted', () => {
    const r = checkShaderProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('AC #5 — passes when family is non-shader (out of scope here)', () => {
    const r = checkShaderProps({ presetId: 'p', raw: { family: 'voice' } });
    expect(r.ok).toBe(true);
  });

  it('AC #4 — fails when family=shader without liveMount', () => {
    const r = checkShaderProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('AC #4 — fails when family=shader without liveMount.props', () => {
    const r = checkShaderProps({ presetId: 'p', raw: { family: 'shader', liveMount: {} } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('AC #4 — fails when liveMount.props omits required fields', () => {
    const r = checkShaderProps({
      presetId: 'p',
      raw: {
        family: 'shader',
        liveMount: { props: { fragmentShader: 'precision highp float; void main(){}' } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/shaderClipPropsSchema/);
  });

  it('AC #4 — fails when fragmentShader is empty', () => {
    const r = checkShaderProps({
      presetId: 'p',
      raw: {
        family: 'shader',
        liveMount: { props: { fragmentShader: '', width: 100, height: 100 } },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('AC #4 — fails when width is 0', () => {
    const r = checkShaderProps({
      presetId: 'p',
      raw: {
        family: 'shader',
        liveMount: {
          props: {
            fragmentShader: 'precision highp float; void main(){}',
            width: 0,
            height: 100,
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('AC #5 — passes for a valid shader-props payload', () => {
    const r = checkShaderProps({
      presetId: 'p',
      raw: {
        family: 'shader',
        liveMount: {
          props: {
            fragmentShader: 'precision highp float; void main(){}',
            width: 1280,
            height: 720,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- Invariant 9: three-scene-props (T-384 AC #5) ----------

describe('check-preset-integrity invariant 9: three-scene-props (T-384 AC #5)', () => {
  const VALID_REF = '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip';

  it('passes when family is omitted', () => {
    const r = checkThreeSceneProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-three-scene (out of scope here)', () => {
    const r = checkThreeSceneProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=three-scene without liveMount', () => {
    const r = checkThreeSceneProps({ presetId: 'p', raw: { family: 'three-scene' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=three-scene without liveMount.props', () => {
    const r = checkThreeSceneProps({
      presetId: 'p',
      raw: { family: 'three-scene', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props omits required fields', () => {
    const r = checkThreeSceneProps({
      presetId: 'p',
      raw: {
        family: 'three-scene',
        liveMount: { props: { setupRef: { module: VALID_REF } } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/threeSceneClipPropsSchema/);
  });

  it('fails when width is 0', () => {
    const r = checkThreeSceneProps({
      presetId: 'p',
      raw: {
        family: 'three-scene',
        liveMount: {
          props: {
            setupRef: { module: VALID_REF },
            width: 0,
            height: 100,
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('fails when prngSeed is negative', () => {
    const r = checkThreeSceneProps({
      presetId: 'p',
      raw: {
        family: 'three-scene',
        liveMount: {
          props: {
            setupRef: { module: VALID_REF },
            width: 100,
            height: 100,
            prngSeed: -1,
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a valid three-scene-props payload', () => {
    const r = checkThreeSceneProps({
      presetId: 'p',
      raw: {
        family: 'three-scene',
        liveMount: {
          props: {
            setupRef: { module: VALID_REF },
            width: 1280,
            height: 720,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- CLI invocation ----------

describe('check-preset-integrity CLI (AC #11, #12)', () => {
  it('runs via tsx and exits 0 with PASS at HEAD', () => {
    const result = spawnSync('pnpm', ['check-preset-integrity'], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      timeout: 30_000,
    });
    if (result.status !== 0) {
      throw new Error(
        `check-preset-integrity exited ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/check-preset-integrity: PASS/);
  });
});

// ---------- AC #14: PASS at HEAD ----------

describe('check-preset-integrity end-to-end at HEAD (AC #11, #14, #15)', () => {
  it('PASSES (or PASSES-WITH-WARNINGS) against the real on-disk presets', () => {
    const start = Date.now();
    const report = runIntegrityChecks({ presetsRoot: PRESETS_ROOT });
    const elapsedMs = Date.now() - start;
    if (report.exitCode !== 0) {
      // Surface the per-invariant error list to make CI failure debuggable.
      const detail = Object.entries(report.byInvariant)
        .filter(([, v]) => v.errors.length > 0)
        .map(
          ([k, v]) => `${k}:\n  ${v.errors.map((e) => `${e.presetId}: ${e.message}`).join('\n  ')}`,
        )
        .join('\n');
      throw new Error(`runIntegrityChecks unexpectedly failed at HEAD:\n${detail}`);
    }
    expect(report.exitCode).toBe(0);
    // AC #15: < 10 seconds for the 50-preset corpus.
    expect(elapsedMs).toBeLessThan(10_000);
  });
});
