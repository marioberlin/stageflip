// packages/testing/src/fixture-manifest.test.ts
// Validates every T-067 parity fixture manifest against the schema and a
// kind allowlist. The allowlist is hand-maintained — when a new runtime
// demo clip lands, add its kind below AND drop a fixture JSON into
// packages/testing/fixtures/. T-100 will score PSNR+SSIM against these
// fixtures in Phase 5; catching manifest drift at Phase 3 test time means
// the harness has a clean seed.

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GOLDEN_PATTERN,
  fixtureManifestSchema,
  parseFixtureManifest,
  resolveGoldenPath,
} from './fixture-manifest.js';

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url));

/** Known clip kinds shipped by the in-tree runtimes as of T-067. */
const KNOWN_KINDS: ReadonlyMap<string, string> = new Map([
  ['solid-background', 'css'],
  ['motion-text-gsap', 'gsap'],
  ['lottie-logo', 'lottie'],
  ['flash-through-white', 'shader'],
  ['swirl-vortex', 'shader'],
  ['glitch', 'shader'],
  ['three-product-reveal', 'three'],
]);

function listFixtureFiles(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function loadRaw(fileName: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(raw) as unknown;
}

describe('fixture-manifest — schema', () => {
  it('every fixture parses under the manifest schema', () => {
    const files = listFixtureFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = loadRaw(file);
      expect(() => parseFixtureManifest(raw), `fixture ${file}`).not.toThrow();
    }
  });

  it('rejects a manifest whose reference frame is outside the clip window', () => {
    const bad = {
      name: 'bad',
      runtime: 'css',
      kind: 'solid-background',
      description: 'out-of-range reference frame',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 10, props: {} },
      referenceFrames: [0, 5, 15],
    };
    expect(() => parseFixtureManifest(bad)).toThrow(/outside the clip window/);
  });

  it('rejects a manifest whose clip overruns the composition', () => {
    const bad = {
      name: 'bad',
      runtime: 'css',
      kind: 'solid-background',
      description: 'clip overruns composition',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 10, durationInFrames: 30, props: {} },
      referenceFrames: [10],
    };
    expect(() => parseFixtureManifest(bad)).toThrow(/durationInFrames/);
  });

  it('rejects unknown fields (strict mode)', () => {
    const bad = {
      name: 'bad',
      runtime: 'css',
      kind: 'solid-background',
      description: 'extra field',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0],
      someOtherField: 'no',
    };
    expect(() => fixtureManifestSchema.parse(bad)).toThrow();
  });
});

describe('fixture-manifest — fixture catalogue', () => {
  it('every shipped fixture targets a known runtime + kind', () => {
    for (const file of listFixtureFiles()) {
      const raw = loadRaw(file);
      const manifest = parseFixtureManifest(raw);
      const expectedRuntime = KNOWN_KINDS.get(manifest.kind);
      expect(expectedRuntime, `kind ${manifest.kind} not in allowlist`).toBeDefined();
      expect(manifest.runtime, `fixture ${file}`).toBe(expectedRuntime);
    }
  });

  it('covers every known kind exactly once', () => {
    const seen = new Set<string>();
    for (const file of listFixtureFiles()) {
      const manifest = parseFixtureManifest(loadRaw(file));
      expect(seen.has(manifest.kind), `duplicate fixture for ${manifest.kind}`).toBe(false);
      seen.add(manifest.kind);
    }
    for (const kind of KNOWN_KINDS.keys()) {
      expect(seen.has(kind), `no fixture for known kind ${kind}`).toBe(true);
    }
  });

  it('every fixture name equals its file basename', () => {
    for (const file of listFixtureFiles()) {
      const manifest = parseFixtureManifest(loadRaw(file));
      const fileBase = basename(file, '.json');
      expect(manifest.name, `fixture ${file}`).toBe(fileBase);
    }
  });

  it('every fixture lists at least three reference frames (t=0, mid, end convention)', () => {
    for (const file of listFixtureFiles()) {
      const manifest = parseFixtureManifest(loadRaw(file));
      expect(manifest.referenceFrames.length, `fixture ${file}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('fixture-manifest — parity thresholds (T-102)', () => {
  const baseFixture = {
    name: 'base',
    runtime: 'css',
    kind: 'solid-background',
    description: 'base',
    composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
    clip: { from: 0, durationInFrames: 30, props: {} },
    referenceFrames: [0, 15, 29],
  };

  it('accepts a manifest with thresholds + goldens', () => {
    const parsed = parseFixtureManifest({
      ...baseFixture,
      thresholds: { minPsnr: 34, minSsim: 0.97, maxFailingFrames: 0 },
      goldens: { dir: 'goldens/base' },
    });
    expect(parsed.thresholds?.minPsnr).toBe(34);
    expect(parsed.goldens?.dir).toBe('goldens/base');
  });

  it('accepts a region on thresholds', () => {
    const parsed = parseFixtureManifest({
      ...baseFixture,
      thresholds: {
        minPsnr: 30,
        minSsim: 0.95,
        region: { x: 10, y: 20, width: 50, height: 40 },
      },
    });
    expect(parsed.thresholds?.region).toEqual({ x: 10, y: 20, width: 50, height: 40 });
  });

  it('accepts a manifest with neither thresholds nor goldens (backwards compat)', () => {
    const parsed = parseFixtureManifest(baseFixture);
    expect(parsed.thresholds).toBeUndefined();
    expect(parsed.goldens).toBeUndefined();
  });

  it('rejects minSsim > 1', () => {
    expect(() =>
      parseFixtureManifest({ ...baseFixture, thresholds: { minSsim: 1.5 } }),
    ).toThrow();
  });

  it('rejects negative minPsnr', () => {
    expect(() =>
      parseFixtureManifest({ ...baseFixture, thresholds: { minPsnr: -1 } }),
    ).toThrow();
  });

  it('rejects a region with zero width', () => {
    expect(() =>
      parseFixtureManifest({
        ...baseFixture,
        thresholds: { region: { x: 0, y: 0, width: 0, height: 10 } },
      }),
    ).toThrow();
  });

  it('rejects unknown fields on thresholds (strict)', () => {
    // Pass via `unknown` so the Zod strict check is what fails,
    // not the TS structural check.
    const bad: unknown = {
      ...baseFixture,
      thresholds: { minPsnr: 30, extra: 'no' },
    };
    expect(() => parseFixtureManifest(bad)).toThrow();
  });

  it('rejects an empty goldens.dir', () => {
    expect(() =>
      parseFixtureManifest({ ...baseFixture, goldens: { dir: '' } }),
    ).toThrow();
  });

  it('accepts a custom goldens.pattern', () => {
    const parsed = parseFixtureManifest({
      ...baseFixture,
      goldens: { dir: 'gold', pattern: 'f${frame}.jpg' },
    });
    expect(parsed.goldens?.pattern).toBe('f${frame}.jpg');
  });
});

describe('resolveGoldenPath', () => {
  const baseManifest = parseFixtureManifest({
    name: 'base',
    runtime: 'css',
    kind: 'solid-background',
    description: 'base',
    composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
    clip: { from: 0, durationInFrames: 30, props: {} },
    referenceFrames: [0, 15, 29],
    goldens: { dir: 'goldens/base' },
  });

  it('joins fixtureDir + goldens.dir + default pattern with the frame substituted', () => {
    const path = resolveGoldenPath(baseManifest, '/workspace/fixtures', 15);
    expect(path).toBe('/workspace/fixtures/goldens/base/frame-15.png');
  });

  it('honours a trailing slash on fixtureDir', () => {
    const path = resolveGoldenPath(baseManifest, '/workspace/fixtures/', 15);
    expect(path).toBe('/workspace/fixtures/goldens/base/frame-15.png');
  });

  it('honours a leading slash on goldens.dir (strip it)', () => {
    const manifest = parseFixtureManifest({
      name: 'lead',
      runtime: 'css',
      kind: 'solid-background',
      description: 'leading slash',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0],
      goldens: { dir: '/goldens/abs' },
    });
    const path = resolveGoldenPath(manifest, '/workspace', 0);
    expect(path).toBe('/workspace/goldens/abs/frame-0.png');
  });

  it('honours a custom pattern', () => {
    const manifest = parseFixtureManifest({
      name: 'pat',
      runtime: 'css',
      kind: 'solid-background',
      description: 'custom pattern',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0, 15],
      goldens: { dir: 'gold', pattern: 'f_${frame}.jpg' },
    });
    const path = resolveGoldenPath(manifest, '/x', 15);
    expect(path).toBe('/x/gold/f_15.jpg');
  });

  it('returns null when the manifest has no goldens', () => {
    const bare = parseFixtureManifest({
      name: 'no-gold',
      runtime: 'css',
      kind: 'solid-background',
      description: 'no goldens',
      composition: { width: 100, height: 100, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0],
    });
    expect(resolveGoldenPath(bare, '/x', 0)).toBeNull();
  });

  it('exposes the default pattern via DEFAULT_GOLDEN_PATTERN', () => {
    expect(DEFAULT_GOLDEN_PATTERN).toContain('${frame}');
    expect(DEFAULT_GOLDEN_PATTERN).toMatch(/\.png$/);
  });
});
