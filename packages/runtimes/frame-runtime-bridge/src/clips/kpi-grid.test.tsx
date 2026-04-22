// packages/runtimes/frame-runtime-bridge/src/clips/kpi-grid.test.tsx
// T-131b.3 — kpiGridClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { KpiGrid, type KpiGridProps, kpiGridClip, kpiGridPropsSchema } from './kpi-grid.js';

afterEach(cleanup);

function renderAt(frame: number, props: KpiGridProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <KpiGrid {...props} />
    </FrameProvider>,
  );
}

const SAMPLE_CARDS: KpiGridProps['cards'] = [
  { value: 100, label: 'Revenue', prefix: '$', suffix: 'k' },
  { value: 42, label: 'Users', suffix: 'k' },
  { value: 3.2, label: 'Uptime', suffix: '%', decimals: 1, trend: 1.5 },
];

describe('KpiGrid component (T-131b.3)', () => {
  it('renders one card per entry up to columns*rows', () => {
    renderAt(60, { cards: SAMPLE_CARDS });
    expect(screen.getByTestId('kpi-card-0')).toBeDefined();
    expect(screen.getByTestId('kpi-card-1')).toBeDefined();
    expect(screen.getByTestId('kpi-card-2')).toBeDefined();
  });

  it('truncates `cards[]` to columns*rows (extras are dropped)', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ value: i, label: `L${i}` }));
    renderAt(60, { cards: many, columns: 2, rows: 2 });
    for (const i of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`kpi-card-${i}`)).toBeDefined();
    }
    expect(screen.queryByTestId('kpi-card-4')).toBeNull();
  });

  it('renders the title when supplied', () => {
    renderAt(60, { cards: SAMPLE_CARDS, title: 'Q4 Metrics' });
    expect(screen.getByTestId('kpi-grid-title').textContent).toBe('Q4 Metrics');
  });

  it('renders trend markers only on cards that carry a trend number', () => {
    renderAt(60, { cards: SAMPLE_CARDS });
    expect(screen.queryByTestId('kpi-card-0-trend')).toBeNull();
    expect(screen.queryByTestId('kpi-card-1-trend')).toBeNull();
    expect(screen.getByTestId('kpi-card-2-trend')).toBeDefined();
  });

  it('shows an up-arrow + positive colour for positive trend', () => {
    renderAt(60, { cards: [{ value: 1, label: 'A', trend: 2.5 }], positiveColor: '#00ff00' });
    const trend = screen.getByTestId('kpi-card-0-trend');
    expect(trend.textContent).toContain('▲');
    expect(trend.textContent).toContain('+2.5%');
  });

  it('shows a down-arrow + negative colour for negative trend', () => {
    renderAt(60, { cards: [{ value: 1, label: 'A', trend: -3.1 }], negativeColor: '#ff0000' });
    const trend = screen.getByTestId('kpi-card-0-trend');
    expect(trend.textContent).toContain('▼');
    expect(trend.textContent).toContain('-3.1%');
  });

  it('trend of exactly 0 is NOT treated as a gain (down-arrow + negative colour)', () => {
    renderAt(60, { cards: [{ value: 1, label: 'A', trend: 0 }] });
    const trend = screen.getByTestId('kpi-card-0-trend');
    expect(trend.textContent).toContain('▼');
    expect(trend.textContent).not.toContain('▲');
  });
});

describe('kpiGridClip definition (T-131b.3)', () => {
  it("registers under kind 'kpi-grid' with four themeSlots", () => {
    expect(kpiGridClip.kind).toBe('kpi-grid');
    expect(kpiGridClip.propsSchema).toBe(kpiGridPropsSchema);
    expect(kpiGridClip.themeSlots).toEqual({
      accentColor: { kind: 'palette', role: 'primary' },
      bioColor: { kind: 'palette', role: 'accent' },
      textColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema rejects empty cards array', () => {
    expect(kpiGridPropsSchema.safeParse({ cards: [] }).success).toBe(false);
  });

  it('propsSchema restricts columns/rows to {2, 3}', () => {
    expect(
      kpiGridPropsSchema.safeParse({ cards: [{ value: 1, label: 'x' }], columns: 4 }).success,
    ).toBe(false);
    expect(
      kpiGridPropsSchema.safeParse({ cards: [{ value: 1, label: 'x' }], rows: 2 }).success,
    ).toBe(true);
  });
});
