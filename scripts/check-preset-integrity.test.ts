// scripts/check-preset-integrity.test.ts
// Tests for the seven-invariant `check-preset-integrity` CI gate (T-308).
// Each invariant gets at least one positive + one negative test (synthetic
// presets); the on-disk corpus is exercised end-to-end via `runIntegrityChecks`
// against the real `skills/stageflip/presets/` root.
//
// AC numbers refer to docs/tasks/T-308.md.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  INTERACTIVE_CLIP_KINDS,
  VALID_CLIP_KINDS,
  checkBespokeFontHasFallback,
  checkClipKindExists,
  checkCompassAnchor,
  checkFrontmatter,
  checkInteractiveStaticFallback,
  checkParityFixtureSignOff,
  checkParityGoldenNonBlank,
  checkAiChatProps,
  checkLiveDataProps,
  checkShaderProps,
  checkThreeSceneProps,
  checkTypeDesignSignOff,
  checkAiGenerativeProps,
  checkVoiceProps,
  checkWebEmbedProps,
  decodeNonBlankMetrics,
  formatReport,
  listGoldenPngs,
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

// ---------- Invariant 15 (T-348b): parityFixture-non-blank ----------

/**
 * Encode a synthetic 1280x720 PNG into a tmp file. Each pixel in the buffer
 * is filled by `paint(x, y) → [r, g, b, a]`. Returns the absolute path to
 * the written file.
 */
function writeSyntheticPng(opts: {
  dir: string;
  filename: string;
  width?: number;
  height?: number;
  paint: (x: number, y: number) => [number, number, number, number];
}): string {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const png = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = opts.paint(x, y);
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  const bytes = PNG.sync.write(png);
  const path = join(opts.dir, opts.filename);
  writeFileSync(path, bytes);
  return path;
}

describe('check-preset-integrity invariant 15: parityFixture-non-blank (T-348b)', () => {
  let tmp: string;

  function setup(): string {
    tmp = mkdtempSync(join(tmpdir(), 'check-preset-integrity-non-blank-'));
    return tmp;
  }

  function teardown(): void {
    rmSync(tmp, { recursive: true, force: true });
  }

  it('FAILS on a pure-white PNG (Cluster D regression mode — true-detective / severance)', () => {
    setup();
    try {
      const goldenPath = writeSyntheticPng({
        dir: tmp,
        filename: 'pure-white.png',
        paint: () => [255, 255, 255, 255],
      });
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toMatch(/appears blank/);
        expect(r.message).toMatch(/significant color bucket/);
      }
    } finally {
      teardown();
    }
  });

  it('FAILS on a pure-pale-yellow PNG (Cluster D regression mode — succession / got-trajan sepia)', () => {
    setup();
    try {
      const goldenPath = writeSyntheticPng({
        dir: tmp,
        filename: 'pure-sepia.png',
        // Approximate sepia-of-white: 255*0.393 + 255*0.769 + 255*0.189 ≈ 345
        // → clamped per-channel; sepia matrix W3C output is roughly RGB(255,
        // 230, 180) for the modal post-filter pixel.
        paint: () => [255, 230, 180, 255],
      });
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath });
      expect(r.ok).toBe(false);
    } finally {
      teardown();
    }
  });

  it('FAILS on a near-blank with sub-significance fringe noise (anti-aliasing alone)', () => {
    setup();
    try {
      // 99.97 % white + 0.03 % stray noise in scattered pixels — far below
      // the 0.05 % significance floor; gate must still fire.
      const goldenPath = writeSyntheticPng({
        dir: tmp,
        filename: 'near-blank-fringe.png',
        paint: (x, y) => {
          // Stray noise in 0.03 % of pixels (every ~3300th pixel by simple LCG).
          const idx = y * 1280 + x;
          if (idx % 3333 === 0) return [128, 128, 128, 255];
          return [255, 255, 255, 255];
        },
      });
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath });
      expect(r.ok).toBe(false);
    } finally {
      teardown();
    }
  });

  it('PASSES on a small-element-on-flat-canvas (legitimate small-element preset register)', () => {
    setup();
    try {
      // 100x100 px white square (0.86 % of canvas) on solid black canvas
      // — analogous to coinbase-dvd-qr's small QR rectangle on black. Two
      // significant buckets clear stage 1 of the gate.
      const goldenPath = writeSyntheticPng({
        dir: tmp,
        filename: 'small-element.png',
        paint: (x, y) => {
          const inSquare = x >= 590 && x < 690 && y >= 310 && y < 410;
          return inSquare ? [255, 255, 255, 255] : [0, 0, 0, 255];
        },
      });
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath });
      expect(r.ok).toBe(true);
    } finally {
      teardown();
    }
  });

  it('PASSES on a flat canvas with > 0.05 % spread non-modal pixels (single significant bucket OK if dominance < 99.95 %)', () => {
    setup();
    try {
      // White canvas with ~0.06 % red pixels spread across many quantized
      // buckets via varying intensity — none individually significant, but
      // dominance drops below 99.95 % so the gate's stage 2 saves us.
      const goldenPath = writeSyntheticPng({
        dir: tmp,
        filename: 'spread-fringe.png',
        paint: (x, y) => {
          const idx = y * 1280 + x;
          if (idx % 1500 === 0) {
            const channel = (idx >> 8) & 0xff; // varying red intensity → many buckets
            return [128 + (channel >> 1), 0, 0, 255];
          }
          return [255, 255, 255, 255];
        },
      });
      const metrics = decodeNonBlankMetrics(readFileSync(goldenPath));
      // Sanity: most pixels white, <1% non-modal.
      expect(metrics.maxBucketFraction).toBeGreaterThan(0.99);
      expect(metrics.maxBucketFraction).toBeLessThan(0.9995);
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath });
      expect(r.ok).toBe(true);
    } finally {
      teardown();
    }
  });

  it('FAILS with a decoder error message when the file is not a valid PNG', () => {
    setup();
    try {
      const bogus = join(tmp, 'not-a-png.png');
      writeFileSync(bogus, Buffer.from('not a real png'));
      const r = checkParityGoldenNonBlank({ presetId: 'p', goldenPath: bogus });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toMatch(/failed to decode parity golden/);
      }
    } finally {
      teardown();
    }
  });

  it('FAILS with a missing-file message when the golden does not exist', () => {
    setup();
    try {
      const r = checkParityGoldenNonBlank({
        presetId: 'p',
        goldenPath: join(tmp, 'never-existed.png'),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toMatch(/does not exist/);
      }
    } finally {
      teardown();
    }
  });

  it('listGoldenPngs returns sorted matches and filters non-golden PNGs', () => {
    setup();
    try {
      // Set up parity-fixtures/<cluster>/<preset>/ structure.
      const presetDir = join(tmp, 'news', 'preset-x');
      mkdirSync(presetDir, { recursive: true });
      writeFileSync(join(presetDir, 'golden-frame-60.png'), Buffer.from([]));
      writeFileSync(join(presetDir, 'golden-frame-120-variantA.png'), Buffer.from([]));
      writeFileSync(join(presetDir, 'unrelated.png'), Buffer.from([]));
      writeFileSync(join(presetDir, 'golden-frame-30.png'), Buffer.from([]));
      const found = listGoldenPngs({
        parityFixturesRoot: tmp,
        cluster: 'news',
        presetId: 'preset-x',
      });
      expect(found).toHaveLength(3);
      expect(found.every((p) => p.endsWith('.png'))).toBe(true);
      expect(found.every((p) => /golden-frame-/.test(p))).toBe(true);
      // Sorted ascending — frame-120 sorts before frame-30 lexicographically.
      const names = found.map((p) => p.split('/').pop());
      expect(names).toEqual([
        'golden-frame-120-variantA.png',
        'golden-frame-30.png',
        'golden-frame-60.png',
      ]);
    } finally {
      teardown();
    }
  });

  it('listGoldenPngs returns [] when the preset directory does not exist', () => {
    setup();
    try {
      const found = listGoldenPngs({
        parityFixturesRoot: tmp,
        cluster: 'news',
        presetId: 'never-created',
      });
      expect(found).toEqual([]);
    } finally {
      teardown();
    }
  });

  it('decodeNonBlankMetrics: pure-color image → 1 distinct bucket, 1 significant bucket, 100 % dominance', () => {
    setup();
    try {
      const path = writeSyntheticPng({
        dir: tmp,
        filename: 'pure.png',
        paint: () => [200, 100, 50, 255],
      });
      const m = decodeNonBlankMetrics(readFileSync(path));
      expect(m.distinctBuckets).toBe(1);
      expect(m.significantBuckets).toBe(1);
      expect(m.maxBucketFraction).toBe(1);
    } finally {
      teardown();
    }
  });

  it('decodeNonBlankMetrics: 50/50 two-color image → 2 distinct buckets, 2 significant, 50 % dominance', () => {
    setup();
    try {
      const path = writeSyntheticPng({
        dir: tmp,
        filename: 'two-color.png',
        paint: (x) => (x < 640 ? [0, 0, 0, 255] : [255, 255, 255, 255]),
      });
      const m = decodeNonBlankMetrics(readFileSync(path));
      expect(m.distinctBuckets).toBe(2);
      expect(m.significantBuckets).toBe(2);
      expect(m.maxBucketFraction).toBe(0.5);
    } finally {
      teardown();
    }
  });
});

// ---------- Invariant 15: Cluster I (audience) per-clipKind path resolution ----------
//
// Audience presets share goldens by clipKind, not preset id. T-486/T-476
// laid out `parity-fixtures/audience/<clipKind>/` because multiple presets
// (e.g. `bbc-question-time` + `conference-qa-upvote`, both `live-qa`) share
// the same static-fallback golden. The integrity check resolves the lookup
// directory by `fm.clipKind` when `fm.cluster === 'audience'`.

describe('check-preset-integrity invariant 15: Cluster I per-clipKind path resolution', () => {
  let presetsRoot: string;
  let parityRoot: string;

  function setup(): void {
    presetsRoot = mkdtempSync(join(tmpdir(), 'cluster-i-presets-'));
    parityRoot = mkdtempSync(join(tmpdir(), 'cluster-i-parity-'));
  }

  function teardown(): void {
    rmSync(presetsRoot, { recursive: true, force: true });
    rmSync(parityRoot, { recursive: true, force: true });
  }

  it('PASSES when two audience presets share a single per-clipKind golden', () => {
    setup();
    try {
      // Two presets in cluster `audience`, both clipKind `live-qa`, both
      // signed. The integrity check must resolve BOTH to the per-clipKind
      // golden under parity-fixtures/audience/live-qa/.
      const audienceClusterDir = join(presetsRoot, 'audience');
      mkdirSync(audienceClusterDir, { recursive: true });
      writeFileSync(
        join(audienceClusterDir, 'SKILL.md'),
        '---\ntitle: Cluster audience\nid: skills/stageflip/presets/audience\ntier: cluster\nstatus: stub\nlast_updated: 2026-05-14\nowner_task: T-486\nrelated: []\n---\n\n# Cluster audience\n',
      );
      const presetA = makeFrontmatter({
        cluster: 'audience',
        id: 'bbc-question-time',
        clipKind: 'live-qa',
        permissions: ['audience-network'],
        parityFixture: "'signed:2026-05-14'",
        typeDesign: 'pending-cluster-batch',
        status: 'substantive',
      });
      const presetB = makeFrontmatter({
        cluster: 'audience',
        id: 'conference-qa-upvote',
        clipKind: 'live-qa',
        permissions: ['audience-network'],
        parityFixture: "'signed:2026-05-14'",
        typeDesign: 'pending-cluster-batch',
        status: 'substantive',
      });
      writeFileSync(join(audienceClusterDir, 'bbc-question-time.md'), presetA);
      writeFileSync(join(audienceClusterDir, 'conference-qa-upvote.md'), presetB);
      // Single golden under per-clipKind dir, two-color so non-blank gate passes.
      const kindDir = join(parityRoot, 'audience', 'live-qa');
      mkdirSync(kindDir, { recursive: true });
      writeSyntheticPng({
        dir: kindDir,
        filename: 'golden-frame-75.png',
        paint: (x) => (x < 640 ? [16, 64, 160, 255] : [240, 248, 255, 255]),
      });
      const report = runIntegrityChecks({
        presetsRoot,
        parityFixturesRoot: parityRoot,
      });
      expect(report.byInvariant['parityFixture-non-blank'].errors).toEqual([]);
    } finally {
      teardown();
    }
  });

  it('FAILS with a per-clipKind path message when the audience kind dir has no goldens', () => {
    setup();
    try {
      const audienceClusterDir = join(presetsRoot, 'audience');
      mkdirSync(audienceClusterDir, { recursive: true });
      writeFileSync(
        join(audienceClusterDir, 'SKILL.md'),
        '---\ntitle: Cluster audience\nid: skills/stageflip/presets/audience\ntier: cluster\nstatus: stub\nlast_updated: 2026-05-14\nowner_task: T-486\nrelated: []\n---\n\n# Cluster audience\n',
      );
      writeFileSync(
        join(audienceClusterDir, 'kahoot-competitive.md'),
        makeFrontmatter({
          cluster: 'audience',
          id: 'kahoot-competitive',
          clipKind: 'live-quiz',
          permissions: ['audience-network'],
          parityFixture: "'signed:2026-05-14'",
          typeDesign: 'pending-cluster-batch',
          status: 'substantive',
        }),
      );
      // No goldens under parity-fixtures/audience/live-quiz/.
      const report = runIntegrityChecks({
        presetsRoot,
        parityFixturesRoot: parityRoot,
      });
      const errors = report.byInvariant['parityFixture-non-blank'].errors;
      expect(errors.length).toBe(1);
      expect(errors[0]?.message).toMatch(
        /no golden PNGs found under parity-fixtures\/audience\/live-quiz\//,
      );
    } finally {
      teardown();
    }
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

// ---------- Invariant 10: voice-props (T-387 AC #4) ----------

describe('check-preset-integrity invariant 10: voice-props (T-387 AC #4)', () => {
  it('passes when family is omitted', () => {
    const r = checkVoiceProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-voice (out of scope here)', () => {
    const r = checkVoiceProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=voice without liveMount', () => {
    const r = checkVoiceProps({ presetId: 'p', raw: { family: 'voice' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=voice without liveMount.props', () => {
    const r = checkVoiceProps({
      presetId: 'p',
      raw: { family: 'voice', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props has maxDurationMs=0', () => {
    const r = checkVoiceProps({
      presetId: 'p',
      raw: {
        family: 'voice',
        liveMount: { props: { maxDurationMs: 0 } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/voiceClipPropsSchema/);
  });

  it('fails when liveMount.props has empty language', () => {
    const r = checkVoiceProps({
      presetId: 'p',
      raw: {
        family: 'voice',
        liveMount: { props: { language: '' } },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a minimal valid voice-props payload (defaults applied)', () => {
    const r = checkVoiceProps({
      presetId: 'p',
      raw: {
        family: 'voice',
        liveMount: { props: {} },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('passes for a complete voice-props payload', () => {
    const r = checkVoiceProps({
      presetId: 'p',
      raw: {
        family: 'voice',
        liveMount: {
          props: {
            mimeType: 'audio/webm',
            maxDurationMs: 30_000,
            partialTranscripts: true,
            language: 'en-US',
            posterFrame: 0,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- Invariant 11: ai-chat-props (T-389 AC #5) ----------

describe('check-preset-integrity invariant 11: ai-chat-props (T-389 AC #5)', () => {
  it('passes when family is omitted', () => {
    const r = checkAiChatProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-ai-chat (out of scope here)', () => {
    const r = checkAiChatProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=ai-chat without liveMount', () => {
    const r = checkAiChatProps({ presetId: 'p', raw: { family: 'ai-chat' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=ai-chat without liveMount.props', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: { family: 'ai-chat', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props has empty systemPrompt', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: {
        family: 'ai-chat',
        liveMount: {
          props: { systemPrompt: '', provider: 'openai', model: 'gpt-4o-mini' },
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/aiChatClipPropsSchema/);
  });

  it('fails when liveMount.props has out-of-range temperature', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: {
        family: 'ai-chat',
        liveMount: {
          props: {
            systemPrompt: 'sp',
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 2.5,
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('fails when liveMount.props has maxTokens=0', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: {
        family: 'ai-chat',
        liveMount: {
          props: {
            systemPrompt: 'sp',
            provider: 'openai',
            model: 'gpt-4o-mini',
            maxTokens: 0,
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a minimal valid ai-chat-props payload (defaults applied)', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: {
        family: 'ai-chat',
        liveMount: {
          props: { systemPrompt: 'sp', provider: 'openai', model: 'gpt-4o-mini' },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('passes for a complete ai-chat-props payload', () => {
    const r = checkAiChatProps({
      presetId: 'p',
      raw: {
        family: 'ai-chat',
        liveMount: {
          props: {
            systemPrompt: 'You are a helpful assistant.',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-latest',
            maxTokens: 256,
            temperature: 0.4,
            multiTurn: true,
            posterFrame: 0,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- Invariant 12: live-data-props (T-391 AC #5) ----------

describe('check-preset-integrity invariant 12: live-data-props (T-391 AC #5)', () => {
  // T-404 R-1 — schema's LiveData endpoint host allowlist defaults to
  // deny-all. Seed `example.com` (the test fixture host) before each
  // test in this suite so happy-path payloads continue to validate.
  // Import from source path (not '@stageflip/schema') so we share the
  // exact module instance that `checkLiveDataProps` uses internally —
  // the dist re-export would otherwise yield a separate module-level
  // allowlist state.
  beforeEach(async () => {
    const { extendAllowedHosts, __resetAllowedHostsForTests } = await import(
      '../packages/schema/src/clips/interactive/live-data-props.js'
    );
    __resetAllowedHostsForTests();
    extendAllowedHosts([/^example\.com$/]);
  });

  it('passes when family is omitted', () => {
    const r = checkLiveDataProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-live-data (out of scope here)', () => {
    const r = checkLiveDataProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=live-data without liveMount', () => {
    const r = checkLiveDataProps({ presetId: 'p', raw: { family: 'live-data' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=live-data without liveMount.props', () => {
    const r = checkLiveDataProps({
      presetId: 'p',
      raw: { family: 'live-data', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props has a non-URL endpoint', () => {
    const r = checkLiveDataProps({
      presetId: 'p',
      raw: {
        family: 'live-data',
        liveMount: { props: { endpoint: 'not-a-url' } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveDataClipPropsSchema/);
  });

  it('fails when liveMount.props uses an unsupported method', () => {
    const r = checkLiveDataProps({
      presetId: 'p',
      raw: {
        family: 'live-data',
        liveMount: {
          props: { endpoint: 'https://example.com/api', method: 'PUT' },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a minimal valid live-data-props payload (defaults applied)', () => {
    const r = checkLiveDataProps({
      presetId: 'p',
      raw: {
        family: 'live-data',
        liveMount: { props: { endpoint: 'https://example.com/api' } },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('passes for a complete live-data-props payload', () => {
    const r = checkLiveDataProps({
      presetId: 'p',
      raw: {
        family: 'live-data',
        liveMount: {
          props: {
            endpoint: 'https://example.com/api',
            method: 'POST',
            headers: { 'X-Trace': 'abc' },
            body: { q: 1 },
            parseMode: 'json',
            refreshTrigger: 'manual',
            posterFrame: 7,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- Invariant 13: web-embed-props (T-393 AC #5) ----------

describe('check-preset-integrity invariant 13: web-embed-props (T-393 AC #5)', () => {
  it('passes when family is omitted', () => {
    const r = checkWebEmbedProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-web-embed (out of scope here)', () => {
    const r = checkWebEmbedProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=web-embed without liveMount', () => {
    const r = checkWebEmbedProps({ presetId: 'p', raw: { family: 'web-embed' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=web-embed without liveMount.props', () => {
    const r = checkWebEmbedProps({
      presetId: 'p',
      raw: { family: 'web-embed', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props has a non-URL url', () => {
    const r = checkWebEmbedProps({
      presetId: 'p',
      raw: {
        family: 'web-embed',
        liveMount: { props: { url: 'not-a-url' } },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/webEmbedClipPropsSchema/);
  });

  it('fails when liveMount.props has a non-array sandbox', () => {
    const r = checkWebEmbedProps({
      presetId: 'p',
      raw: {
        family: 'web-embed',
        liveMount: {
          props: { url: 'https://example.com', sandbox: 'allow-scripts' },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a minimal valid web-embed-props payload (defaults applied)', () => {
    const r = checkWebEmbedProps({
      presetId: 'p',
      raw: {
        family: 'web-embed',
        liveMount: { props: { url: 'https://example.com/embed' } },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('passes for a complete web-embed-props payload', () => {
    const r = checkWebEmbedProps({
      presetId: 'p',
      raw: {
        family: 'web-embed',
        liveMount: {
          props: {
            url: 'https://example.com/embed',
            sandbox: ['allow-scripts'],
            allowedOrigins: ['https://example.com'],
            width: 800,
            height: 600,
            posterFrame: 7,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

// ---------- Invariant 14: ai-generative-props (T-395 AC #6) ----------

describe('check-preset-integrity invariant 14: ai-generative-props (T-395 AC #6)', () => {
  it('passes when family is omitted', () => {
    const r = checkAiGenerativeProps({ presetId: 'p', raw: { clipKind: 'lowerThird' } });
    expect(r.ok).toBe(true);
  });

  it('passes when family is non-ai-generative (out of scope here)', () => {
    const r = checkAiGenerativeProps({ presetId: 'p', raw: { family: 'shader' } });
    expect(r.ok).toBe(true);
  });

  it('fails when family=ai-generative without liveMount', () => {
    const r = checkAiGenerativeProps({ presetId: 'p', raw: { family: 'ai-generative' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount/);
  });

  it('fails when family=ai-generative without liveMount.props', () => {
    const r = checkAiGenerativeProps({
      presetId: 'p',
      raw: { family: 'ai-generative', liveMount: {} },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/liveMount.props/);
  });

  it('fails when liveMount.props has empty prompt', () => {
    const r = checkAiGenerativeProps({
      presetId: 'p',
      raw: {
        family: 'ai-generative',
        liveMount: {
          props: { prompt: '', provider: 'openai', model: 'dall-e-3' },
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/aiGenerativeClipPropsSchema/);
  });

  it('fails when liveMount.props has non-positive width', () => {
    const r = checkAiGenerativeProps({
      presetId: 'p',
      raw: {
        family: 'ai-generative',
        liveMount: {
          props: { prompt: 'p', provider: 'openai', model: 'dall-e-3', width: 0 },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('passes for a minimal valid ai-generative-props payload (defaults applied)', () => {
    const r = checkAiGenerativeProps({
      presetId: 'p',
      raw: {
        family: 'ai-generative',
        liveMount: {
          props: { prompt: 'p', provider: 'openai', model: 'dall-e-3' },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('passes for a complete ai-generative-props payload', () => {
    const r = checkAiGenerativeProps({
      presetId: 'p',
      raw: {
        family: 'ai-generative',
        liveMount: {
          props: {
            prompt: 'a watercolor painting',
            provider: 'stability',
            model: 'stable-diffusion-xl',
            negativePrompt: 'no text',
            seed: 42,
            width: 1024,
            height: 1024,
            posterFrame: 7,
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
    // T-348b: parity-fixtures path is workspace-relative; the test runner's
    // cwd may be `scripts/` rather than the repo root, so pass an absolute
    // path explicitly to keep invariant 15 reading the actual signed goldens.
    const report = runIntegrityChecks({
      presetsRoot: PRESETS_ROOT,
      parityFixturesRoot: resolve(REPO_ROOT, 'parity-fixtures'),
    });
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
