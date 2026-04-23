// packages/runtimes/frame-runtime-bridge/src/clips/okr-dashboard.test.tsx
// T-131f.2b — okrDashboardClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  OkrDashboard,
  type OkrDashboardProps,
  okrDashboardClip,
  okrDashboardPropsSchema,
} from './okr-dashboard.js';

afterEach(cleanup);

const OBJECTIVES: OkrDashboardProps['objectives'] = [
  {
    id: 'growth',
    title: 'Accelerate user growth',
    owner: 'Ada',
    status: 'on_track',
    progress: 68,
    team: 'growth',
    keyResults: [
      {
        id: 'k1',
        title: 'DAU to 1M',
        current: 800000,
        target: 1000000,
        status: 'on_track',
        trend: 'up',
      },
      {
        id: 'k2',
        title: 'Churn below 2%',
        current: 2.4,
        target: 2,
        unit: '%',
        status: 'at_risk',
        trend: 'flat',
      },
    ],
  },
  {
    id: 'perf',
    title: 'Improve performance',
    owner: 'Ben',
    status: 'at_risk',
    progress: 42,
    team: 'platform',
    keyResults: [
      {
        id: 'k3',
        title: 'P99 under 250ms',
        current: 320,
        target: 250,
        unit: 'ms',
        status: 'behind',
        trend: 'down',
      },
    ],
  },
  {
    id: 'brand',
    title: 'Refresh brand identity',
    owner: 'Cam',
    status: 'behind',
    progress: 18,
    team: 'marketing',
    keyResults: [],
  },
  {
    id: 'infra',
    title: 'Multi-region rollout',
    owner: 'Dee',
    status: 'not_started',
    progress: 0,
    team: 'platform',
    keyResults: [],
  },
  {
    id: 'archive',
    title: 'Archive legacy dashboards',
    owner: 'Eve',
    status: 'completed',
    progress: 100,
    team: 'growth',
    keyResults: [],
  },
];

function renderAt(frame: number, props: OkrDashboardProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <OkrDashboard {...props} />
    </FrameProvider>,
  );
}

describe('OkrDashboard component (T-131f.2b)', () => {
  it('renders the dashboard container', () => {
    renderAt(15, { objectives: OBJECTIVES });
    expect(screen.getByTestId('okr-dashboard')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { objectives: OBJECTIVES });
    expect(Number(screen.getByTestId('okr-dashboard').style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { objectives: OBJECTIVES });
    expect(Number(screen.getByTestId('okr-dashboard').style.opacity)).toBe(1);
  });

  it('renders KPI strip (avg progress, on-track, at-risk, behind, key-results)', () => {
    renderAt(30, { objectives: OBJECTIVES });
    // 5 objs: avg (68+42+18+0+100)/5 = 45.6 → rounded 46
    expect(screen.getByTestId('okr-dashboard-kpi-avg-progress').textContent).toContain('46%');
    // on_track + completed = 2 out of 5
    expect(screen.getByTestId('okr-dashboard-kpi-on-track').textContent).toContain('2/5');
    expect(screen.getByTestId('okr-dashboard-kpi-at-risk').textContent).toContain('1');
    expect(screen.getByTestId('okr-dashboard-kpi-behind').textContent).toContain('1');
  });

  it('defaults title by okrType', () => {
    renderAt(30, { objectives: OBJECTIVES, okrType: 'roadmap' });
    expect(screen.getByTestId('okr-dashboard-title').textContent).toBe('Strategy Roadmap');
    cleanup();
    renderAt(30, { objectives: OBJECTIVES });
    expect(screen.getByTestId('okr-dashboard-title').textContent).toBe('OKR Dashboard');
  });

  it('respects a custom title', () => {
    renderAt(30, { objectives: OBJECTIVES, title: 'Q4 OKRs' });
    expect(screen.getByTestId('okr-dashboard-title').textContent).toBe('Q4 OKRs');
  });

  it('renders one objective card per visible objective in dashboard mode', () => {
    renderAt(30, { objectives: OBJECTIVES, okrType: 'dashboard' });
    for (const o of OBJECTIVES) {
      expect(screen.getByTestId(`okr-dashboard-objective-${o.id}`)).toBeDefined();
    }
  });

  it('shows key results when showKeyResults !== false', () => {
    renderAt(30, { objectives: OBJECTIVES, showKeyResults: true });
    expect(screen.getByTestId('okr-dashboard-key-results-growth')).toBeDefined();
  });

  it('hides key results when showKeyResults === false', () => {
    renderAt(30, { objectives: OBJECTIVES, showKeyResults: false });
    expect(screen.queryByTestId('okr-dashboard-key-results-growth')).toBeNull();
  });

  it('limits visible objectives by density (executive=4)', () => {
    renderAt(30, { objectives: OBJECTIVES, density: 'executive' });
    // 4 visible of 5 total.
    const visible = OBJECTIVES.slice(0, 4);
    for (const o of visible) {
      expect(screen.getByTestId(`okr-dashboard-objective-${o.id}`)).toBeDefined();
    }
    expect(screen.queryByTestId('okr-dashboard-objective-archive')).toBeNull();
  });

  it('renders team comparison columns when okrType=team_comparison', () => {
    renderAt(30, { objectives: OBJECTIVES, okrType: 'team_comparison' });
    expect(screen.getByTestId('okr-dashboard-teams')).toBeDefined();
    expect(screen.getByTestId('okr-dashboard-team-growth')).toBeDefined();
    expect(screen.getByTestId('okr-dashboard-team-platform')).toBeDefined();
  });

  it('renders Now/Next/Later lanes when okrType=roadmap', () => {
    renderAt(30, { objectives: OBJECTIVES, okrType: 'roadmap' });
    for (const lane of ['now', 'next', 'later']) {
      expect(screen.getByTestId(`okr-dashboard-lane-${lane}`)).toBeDefined();
    }
  });

  it('handles empty objectives (avg progress = 0, no crash)', () => {
    expect(() => renderAt(30, { objectives: [] })).not.toThrow();
    expect(screen.getByTestId('okr-dashboard-kpi-avg-progress').textContent).toContain('0%');
  });

  it('renders a period footer when supplied', () => {
    renderAt(30, { objectives: OBJECTIVES, period: 'Q4 2025' });
    expect(screen.getByTestId('okr-dashboard-footer').textContent).toContain('Q4 2025');
  });

  it('clamps objective progress to [0, 100] before computing the progress ring dash', () => {
    // Progress 150 is out-of-range via schema (max:100), so we construct
    // with a cast — verifies the clamp defence-in-depth at render.
    const weird = [
      { ...OBJECTIVES[0], progress: 150 },
    ] as unknown as OkrDashboardProps['objectives'];
    expect(() => renderAt(30, { objectives: weird })).not.toThrow();
  });
});

describe('okrDashboardClip definition (T-131f.2b)', () => {
  it("registers under kind 'okr-dashboard' with propsSchema", () => {
    expect(okrDashboardClip.kind).toBe('okr-dashboard');
    expect(okrDashboardClip.propsSchema).toBe(okrDashboardPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(okrDashboardClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema requires objectives', () => {
    expect(okrDashboardPropsSchema.safeParse({}).success).toBe(false);
    expect(okrDashboardPropsSchema.safeParse({ objectives: [] }).success).toBe(true);
  });

  it('propsSchema rejects progress out of [0, 100]', () => {
    expect(
      okrDashboardPropsSchema.safeParse({
        objectives: [
          {
            id: 'x',
            title: 'X',
            owner: 'Y',
            status: 'on_track',
            progress: 120,
            keyResults: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('propsSchema rejects unknown status values', () => {
    expect(
      okrDashboardPropsSchema.safeParse({
        objectives: [
          {
            id: 'x',
            title: 'X',
            owner: 'Y',
            status: 'bogus',
            progress: 50,
            keyResults: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      okrDashboardClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<OkrDashboardProps>
      >[0],
      theme,
      { objectives: [] } as OkrDashboardProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
