// packages/runtimes/frame-runtime-bridge/src/clips/hr-dashboard.test.tsx
// T-131f.2 — hrDashboardClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  HrDashboard,
  type HrDashboardProps,
  hrDashboardClip,
  hrDashboardPropsSchema,
} from './hr-dashboard.js';

afterEach(cleanup);

const SAMPLE_DEPTS: HrDashboardProps['departments'] = [
  {
    id: 'eng',
    name: 'Engineering',
    color: '#81aeff',
    headcount: 120,
    openPositions: 6,
    attritionRate: 8.5,
  },
  {
    id: 'sales',
    name: 'Sales',
    color: '#34d399',
    headcount: 60,
    openPositions: 12,
    attritionRate: 18,
  },
  {
    id: 'ops',
    name: 'Operations',
    color: '#fb7185',
    headcount: 30,
    openPositions: 2,
    attritionRate: 10,
  },
];

function renderAt(frame: number, props: HrDashboardProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <HrDashboard {...props} />
    </FrameProvider>,
  );
}

describe('HrDashboard component (T-131f.2)', () => {
  it('renders the dashboard container', () => {
    renderAt(15, { departments: SAMPLE_DEPTS });
    expect(screen.getByTestId('hr-dashboard')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { departments: SAMPLE_DEPTS });
    const el = screen.getByTestId('hr-dashboard');
    expect(Number(el.style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { departments: SAMPLE_DEPTS });
    expect(Number(screen.getByTestId('hr-dashboard').style.opacity)).toBe(1);
  });

  it('renders a custom title when supplied', () => {
    renderAt(30, { departments: SAMPLE_DEPTS, title: 'Q4 People' });
    expect(screen.getByTestId('hr-dashboard-title').textContent).toBe('Q4 People');
  });

  it('falls back to "Headcount Overview" when title is absent', () => {
    renderAt(30, { departments: SAMPLE_DEPTS });
    expect(screen.getByTestId('hr-dashboard-title').textContent).toBe('Headcount Overview');
  });

  it('renders one row per department', () => {
    renderAt(30, { departments: SAMPLE_DEPTS });
    for (const d of SAMPLE_DEPTS) {
      expect(screen.getByTestId(`hr-dashboard-department-${d.id}`)).toBeDefined();
    }
  });

  it('aggregates headcount across departments in the KPI strip', () => {
    renderAt(30, { departments: SAMPLE_DEPTS });
    const kpi = screen.getByTestId('hr-dashboard-kpi-headcount');
    // 120 + 60 + 30 = 210
    expect(kpi.textContent).toContain('210');
  });

  it('omits the metrics panel when metrics array is empty', () => {
    renderAt(30, { departments: SAMPLE_DEPTS });
    expect(screen.queryByTestId('hr-dashboard-metrics')).toBeNull();
  });

  it('renders the metrics panel when metrics are supplied', () => {
    renderAt(30, {
      departments: SAMPLE_DEPTS,
      metrics: [
        {
          id: 'engagement',
          name: 'Engagement',
          category: 'culture',
          value: 78,
          unit: '%',
          trend: 'up',
        },
      ],
    });
    expect(screen.getByTestId('hr-dashboard-metrics')).toBeDefined();
  });

  it('renders a period footer when supplied', () => {
    renderAt(30, { departments: SAMPLE_DEPTS, period: 'Q4 2025' });
    expect(screen.getByTestId('hr-dashboard-period').textContent).toContain('Q4 2025');
  });

  it('handles empty departments without dividing by zero', () => {
    // totalHeadcount = 0 → each dept's pct = 0; no throw.
    expect(() => renderAt(30, { departments: [] })).not.toThrow();
  });
});

describe('hrDashboardClip definition (T-131f.2)', () => {
  it("registers under kind 'hr-dashboard' with propsSchema", () => {
    expect(hrDashboardClip.kind).toBe('hr-dashboard');
    expect(hrDashboardClip.propsSchema).toBe(hrDashboardPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(hrDashboardClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('declares font requirements (600/700/800)', () => {
    const fonts = hrDashboardClip.fontRequirements?.({ departments: [] }) ?? [];
    expect(fonts).toContainEqual({ family: 'Plus Jakarta Sans', weight: 600 });
    expect(fonts).toContainEqual({ family: 'Plus Jakarta Sans', weight: 700 });
    expect(fonts).toContainEqual({ family: 'Plus Jakarta Sans', weight: 800 });
  });

  it('propsSchema requires departments', () => {
    expect(hrDashboardPropsSchema.safeParse({}).success).toBe(false);
    expect(hrDashboardPropsSchema.safeParse({ departments: [] }).success).toBe(true);
  });

  it('propsSchema enforces strict departments shape', () => {
    expect(
      hrDashboardPropsSchema.safeParse({
        departments: [
          {
            id: 'x',
            name: 'X',
            color: '#fff',
            headcount: 'bad',
            openPositions: 0,
            attritionRate: 0,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap flows background + text + surface', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      hrDashboardClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<HrDashboardProps>
      >[0],
      theme,
      { departments: [] } as HrDashboardProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
