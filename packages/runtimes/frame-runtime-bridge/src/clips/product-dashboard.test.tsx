// packages/runtimes/frame-runtime-bridge/src/clips/product-dashboard.test.tsx
// T-131f.2b — productDashboardClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ProductDashboard,
  type ProductDashboardProps,
  productDashboardClip,
  productDashboardPropsSchema,
} from './product-dashboard.js';

afterEach(cleanup);

const FEATURES: ProductDashboardProps['features'] = [
  { id: 'f1', title: 'Auth rewrite', status: 'shipped', priority: 'p0', team: 'platform' },
  { id: 'f2', title: 'Billing portal', status: 'in_progress', priority: 'p1', team: 'billing' },
  { id: 'f3', title: 'Mobile app', status: 'planned', priority: 'p2' },
  {
    id: 'f4',
    title: 'Legacy export',
    status: 'blocked',
    priority: 'p2',
    description: 'Waiting on legal.',
  },
];

const METRICS: ProductDashboardProps['metrics'] = [
  { id: 'uptime', name: 'Uptime', value: 99.9, unit: '%', trend: 'up' },
  {
    id: 'latency',
    name: 'P99',
    value: 320,
    unit: 'ms',
    trend: 'down',
    threshold: { warning: 300, critical: 500 },
  },
  {
    id: 'deploys',
    name: 'Deploys',
    value: 42,
    trend: 'flat',
    sparkline: [10, 20, 40, 30, 42],
    previousValue: 36,
  },
];

function renderAt(frame: number, props: ProductDashboardProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <ProductDashboard {...props} />
    </FrameProvider>,
  );
}

describe('ProductDashboard component (T-131f.2b)', () => {
  it('renders the dashboard container', () => {
    renderAt(15, { features: FEATURES });
    expect(screen.getByTestId('product-dashboard')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { features: FEATURES });
    expect(Number(screen.getByTestId('product-dashboard').style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { features: FEATURES });
    expect(Number(screen.getByTestId('product-dashboard').style.opacity)).toBe(1);
  });

  it('aggregates feature status counts in the KPI strip', () => {
    renderAt(30, { features: FEATURES });
    expect(screen.getByTestId('product-dashboard-kpi-shipped').textContent).toContain('1');
    expect(screen.getByTestId('product-dashboard-kpi-in-progress').textContent).toContain('1');
    expect(screen.getByTestId('product-dashboard-kpi-blocked').textContent).toContain('1');
  });

  it('defaults title based on reportType when title is absent', () => {
    renderAt(30, { features: FEATURES, reportType: 'roadmap' });
    expect(screen.getByTestId('product-dashboard-title').textContent).toBe('Product Roadmap');
    cleanup();
    renderAt(30, { features: FEATURES, reportType: 'sprint_review', sprintNumber: 42 });
    expect(screen.getByTestId('product-dashboard-title').textContent).toBe('Sprint 42 Review');
    cleanup();
    renderAt(30, { features: FEATURES, reportType: 'release_notes', version: '1.4.0' });
    expect(screen.getByTestId('product-dashboard-title').textContent).toBe('Release 1.4.0');
  });

  it('renders a feature grid in sprint_review mode', () => {
    renderAt(30, { features: FEATURES, reportType: 'sprint_review' });
    expect(screen.getByTestId('product-dashboard-features')).toBeDefined();
    for (const f of FEATURES) {
      expect(screen.getByTestId(`product-dashboard-feature-${f.id}`)).toBeDefined();
    }
    expect(screen.queryByTestId('product-dashboard-roadmap')).toBeNull();
    expect(screen.queryByTestId('product-dashboard-metrics')).toBeNull();
  });

  it('renders Now/Next/Later lanes in roadmap mode', () => {
    renderAt(30, { features: FEATURES, reportType: 'roadmap' });
    for (const label of ['now', 'next', 'later']) {
      expect(screen.getByTestId(`product-dashboard-lane-${label}`)).toBeDefined();
    }
  });

  it('renders the metrics panel (with optional sparklines) in metrics_dashboard mode', () => {
    renderAt(30, { features: FEATURES, metrics: METRICS, reportType: 'metrics_dashboard' });
    expect(screen.getByTestId('product-dashboard-metrics')).toBeDefined();
  });

  it('renders a period footer when supplied', () => {
    renderAt(30, { features: FEATURES, period: 'Sprint 42' });
    expect(screen.getByTestId('product-dashboard-footer').textContent).toContain('Sprint 42');
  });

  it('handles empty features without dividing by zero', () => {
    expect(() => renderAt(30, { features: [] })).not.toThrow();
  });
});

describe('productDashboardClip definition (T-131f.2b)', () => {
  it("registers under kind 'product-dashboard' with propsSchema", () => {
    expect(productDashboardClip.kind).toBe('product-dashboard');
    expect(productDashboardClip.propsSchema).toBe(productDashboardPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(productDashboardClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema requires features', () => {
    expect(productDashboardPropsSchema.safeParse({}).success).toBe(false);
    expect(productDashboardPropsSchema.safeParse({ features: [] }).success).toBe(true);
  });

  it('propsSchema rejects unknown status values', () => {
    expect(
      productDashboardPropsSchema.safeParse({
        features: [{ id: 'x', title: 'X', status: 'bogus', priority: 'p0' }],
      }).success,
    ).toBe(false);
  });

  it('propsSchema rejects unknown reportType values', () => {
    expect(
      productDashboardPropsSchema.safeParse({ features: [], reportType: 'unknown' }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      productDashboardClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<ProductDashboardProps>
      >[0],
      theme,
      { features: [] } as ProductDashboardProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
