// packages/runtimes/frame-runtime-bridge/src/clips/chart/index.test.tsx
// T-406 ACs #1-#5, #21-#22, #27 — chartPropsSchema + dispatcher +
// DataSourceRef rejection + ALL_BRIDGE_CLIPS registration + KNOWN_KINDS
// allowlist.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ChartClip, chartClip, chartPropsSchema } from './index.js';

const validBase = {
  chartKind: 'bar' as const,
  data: { labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'Sales', values: [10, 20, 30] }] },
};

function renderAtFrame(node: ReactElement, frame: number, config: Partial<VideoConfig> = {}) {
  const cfg: VideoConfig = {
    width: config.width ?? 1920,
    height: config.height ?? 1080,
    fps: config.fps ?? 30,
    durationInFrames: config.durationInFrames ?? 60,
  };
  return render(
    <FrameProvider frame={frame} config={cfg}>
      {node}
    </FrameProvider>,
  );
}

describe('chartPropsSchema (T-406 AC #1-#4)', () => {
  it('AC #1 — accepts valid payloads for each of the 7 chart kinds', () => {
    for (const kind of ['bar', 'line', 'area', 'pie', 'donut', 'scatter', 'combo'] as const) {
      const parsed = chartPropsSchema.parse({ ...validBase, chartKind: kind });
      expect(parsed.chartKind).toBe(kind);
      expect(parsed.legend).toBe(true);
      expect(parsed.axes).toBe(true);
    }
  });

  it('AC #2 — DataSourceRef rejected with T-167 reference in error message', () => {
    const result = chartPropsSchema.safeParse({ ...validBase, data: 'ds:foo' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = JSON.stringify(result.error.issues);
      expect(message).toMatch(/T-167|inline|ChartData/i);
    }
  });

  it('AC #2 — non-ds-pattern strings also rejected', () => {
    expect(() => chartPropsSchema.parse({ ...validBase, data: 'random-string' })).toThrow();
  });

  it('AC #2 — `parse()` (not just safeParse) surfaces T-167 message', () => {
    // Earlier revisions monkey-patched safeParse only; this guards the
    // preprocess-based fix that runs through both parse paths.
    expect(() => chartPropsSchema.parse({ ...validBase, data: 'ds:abc' })).toThrow(/T-167/);
  });

  it('AC #3 — empty labels + series arrays accepted (no error)', () => {
    expect(() =>
      chartPropsSchema.parse({ ...validBase, data: { labels: [], series: [] } }),
    ).not.toThrow();
  });

  it('AC #4 — extra top-level fields rejected (strict)', () => {
    expect(() => chartPropsSchema.parse({ ...validBase, extra: true })).toThrow();
  });

  it('AC #4 — invalid chartKind rejected', () => {
    expect(() => chartPropsSchema.parse({ ...validBase, chartKind: 'mystery' })).toThrow();
  });
});

describe('ChartClip dispatcher (T-406 AC #5)', () => {
  it.each([
    ['bar', /chart-bar/],
    ['line', /chart-line/],
    ['area', /chart-area/],
    ['pie', /chart-pie/],
    ['donut', /chart-donut/],
    ['scatter', /chart-scatter/],
    ['combo', /chart-combo/],
  ] as const)('AC #5 — chartKind %s dispatches to its renderer', (kind, testIdRe) => {
    const { container } = renderAtFrame(<ChartClip {...validBase} chartKind={kind} />, 30);
    const found = container.querySelector(`[data-testid^="chart-${kind}"]`);
    expect(found, `expected element matching ${testIdRe}`).not.toBeNull();
  });
});

describe('chartClip ClipDefinition (T-406 AC #21, #22)', () => {
  it('AC #21 — chartClip.kind is "chart"', () => {
    expect(chartClip.kind).toBe('chart');
  });

  it('chartClip carries a propsSchema', () => {
    expect((chartClip as { propsSchema?: unknown }).propsSchema).toBeDefined();
  });

  it('AC #22 — `chart` is in the bridge clipKind allowlist (LIVE_RUNTIME_MANIFEST)', async () => {
    // The bridge's clipKind allowlist lives in
    // `packages/skills-sync/src/live-runtime-manifest.ts`
    // (LIVE_RUNTIME_MANIFEST) — that's the canonical "what kinds does
    // the frame-runtime bridge accept" table consumed by host-bundle
    // parity tests + skill catalog generation. The fixture-manifest
    // KNOWN_KINDS map in packages/testing is a different allowlist
    // (fixtures-only) that chart will join when the chart parity
    // fixture lands. We grep the source so this test does not require
    // adding `@stageflip/skills-sync` as a dep of the bridge package.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const here = fileURLToPath(import.meta.url);
    const repoRoot = here.replace(
      /\/packages\/runtimes\/frame-runtime-bridge\/src\/clips\/chart\/index\.test\.tsx$/,
      '',
    );
    const manifestSrc = readFileSync(
      `${repoRoot}/packages/skills-sync/src/live-runtime-manifest.ts`,
      'utf8',
    );
    expect(manifestSrc).toMatch(/'chart'/);
  });

  it('chartClip carries themeSlots covering all renderer color slots', () => {
    const themeSlots = (chartClip as { themeSlots?: Record<string, unknown> }).themeSlots;
    expect(themeSlots).toBeDefined();
    if (themeSlots === undefined) throw new Error('themeSlots missing');
    // 8 series + axis + gridline + text per AC #17.
    for (const k of [
      'series0',
      'series1',
      'series2',
      'series3',
      'series4',
      'series5',
      'series6',
      'series7',
      'axis',
      'gridline',
      'text',
    ]) {
      expect(themeSlots[k]).toBeDefined();
    }
  });
});

describe('determinism (T-406 AC #19, #20)', () => {
  it('AC #19 — same args + same frame → byte-for-byte identical SVG output', () => {
    const a = renderAtFrame(<ChartClip {...validBase} chartKind="bar" />, 30);
    const b = renderAtFrame(<ChartClip {...validBase} chartKind="bar" />, 30);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});

describe('hard-rule grep (T-406 AC #20)', () => {
  it('AC #20 — chart/ source files contain no Math.random / Date.now / performance.now / fetch references', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir).filter((f) => {
      if (f.endsWith('.test.tsx') || f.endsWith('.test.ts')) return false;
      if (f.endsWith('.snap')) return false;
      const full = join(dir, f);
      return statSync(full).isFile();
    });
    for (const f of files) {
      const content = readFileSync(join(dir, f), 'utf8');
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(stripped, `forbidden primitive in ${f}`).not.toMatch(/\bMath\.random\b/);
      expect(stripped, `forbidden primitive in ${f}`).not.toMatch(/\bDate\.now\b/);
      expect(stripped, `forbidden primitive in ${f}`).not.toMatch(/\bperformance\.now\b/);
      expect(stripped, `forbidden primitive in ${f}`).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('AC #16 — no inline hex literals in renderer files', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dir = dirname(fileURLToPath(import.meta.url));
    const renderers = readdirSync(dir).filter((f) =>
      [
        'bar.tsx',
        'line.tsx',
        'area.tsx',
        'pie.tsx',
        'donut.tsx',
        'scatter.tsx',
        'combo.tsx',
        'axes.tsx',
        'legend.tsx',
      ].includes(f),
    );
    for (const f of renderers) {
      const full = join(dir, f);
      if (!statSync(full).isFile()) continue;
      const content = readFileSync(full, 'utf8');
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(stripped, `inline hex literal in ${f}`).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}['"`]/);
    }
  });
});
