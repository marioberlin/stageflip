// packages/runtimes/frame-runtime-bridge/src/clips/marketing-dashboard.test.tsx
// T-131f.2 — marketingDashboardClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MarketingDashboard,
  type MarketingDashboardProps,
  marketingDashboardClip,
  marketingDashboardPropsSchema,
} from './marketing-dashboard.js';

afterEach(cleanup);

const CHANNELS: MarketingDashboardProps['channels'] = [
  { id: 'email', name: 'Email', color: '#81aeff', spend: 5000, revenue: 18000, conversions: 240 },
  {
    id: 'paid',
    name: 'Paid Search',
    color: '#fb7185',
    spend: 12000,
    revenue: 36000,
    conversions: 460,
  },
  { id: 'social', name: 'Social', color: '#34d399', spend: 8000, revenue: 14000, conversions: 200 },
];

const FUNNEL: MarketingDashboardProps['funnelStages'] = [
  { id: 'aware', name: 'Awareness', color: '#81aeff', value: 100000 },
  { id: 'interest', name: 'Interest', color: '#5af8fb', value: 35000, conversionRate: 35 },
  { id: 'convert', name: 'Conversion', color: '#34d399', value: 5200, conversionRate: 15 },
];

function renderAt(frame: number, props: MarketingDashboardProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <MarketingDashboard {...props} />
    </FrameProvider>,
  );
}

describe('MarketingDashboard component (T-131f.2)', () => {
  it('renders the dashboard container', () => {
    renderAt(15, { channels: CHANNELS });
    expect(screen.getByTestId('marketing-dashboard')).toBeDefined();
  });

  it('fades in over frames 0..15', () => {
    renderAt(0, { channels: CHANNELS });
    expect(Number(screen.getByTestId('marketing-dashboard').style.opacity)).toBe(0);
    cleanup();
    renderAt(15, { channels: CHANNELS });
    expect(Number(screen.getByTestId('marketing-dashboard').style.opacity)).toBe(1);
  });

  it('defaults the title to "Campaign Performance" in channels mode', () => {
    renderAt(30, { channels: CHANNELS });
    expect(screen.getByTestId('marketing-dashboard-title').textContent).toBe(
      'Campaign Performance',
    );
  });

  it('defaults the title to "Marketing Funnel" in funnel mode', () => {
    renderAt(30, { channels: CHANNELS, mode: 'funnel', funnelStages: FUNNEL });
    expect(screen.getByTestId('marketing-dashboard-title').textContent).toBe('Marketing Funnel');
  });

  it('renders a date-range line when dateRange is supplied', () => {
    renderAt(30, {
      channels: CHANNELS,
      dateRange: { start: '2026-01-01', end: '2026-03-31' },
    });
    expect(screen.getByTestId('marketing-dashboard-date-range').textContent).toContain(
      '2026-01-01',
    );
  });

  it('renders channel bars + table in channels mode', () => {
    renderAt(30, { channels: CHANNELS });
    for (const ch of CHANNELS) {
      expect(screen.getByTestId(`marketing-dashboard-channel-bar-${ch.id}`)).toBeDefined();
    }
    expect(screen.getByTestId('marketing-dashboard-channel-table')).toBeDefined();
    expect(screen.queryByTestId('marketing-dashboard-funnel')).toBeNull();
  });

  it('survives a zero-valued first funnel stage (no NaN width)', () => {
    // If the top-of-funnel value is 0 the width ratio would otherwise divide
    // by zero. The clip falls back to maxVal=1 so every stage renders at a
    // fraction of the container; no NaN leaks into the DOM.
    renderAt(30, {
      channels: CHANNELS,
      mode: 'funnel',
      funnelStages: [
        { id: 'aware', name: 'Awareness', color: '#81aeff', value: 0 },
        { id: 'interest', name: 'Interest', color: '#5af8fb', value: 0 },
      ],
    });
    for (const id of ['aware', 'interest']) {
      const stage = screen.getByTestId(`marketing-dashboard-funnel-stage-${id}`);
      // The stage has two direct children: a 140px-wide label div and a
      // flex:1 bar container. Descend to the bar element inside the bar
      // container (its only child).
      const children = stage.children as HTMLCollection;
      const barContainer = children[1] as HTMLElement | undefined;
      const bar = barContainer?.firstElementChild as HTMLElement | null;
      expect(bar?.style.width).toMatch(/%$/);
      expect(bar?.style.width).not.toContain('NaN');
    }
  });

  it('renders funnel bars when mode=funnel', () => {
    renderAt(30, { channels: CHANNELS, mode: 'funnel', funnelStages: FUNNEL });
    for (const s of FUNNEL) {
      expect(screen.getByTestId(`marketing-dashboard-funnel-stage-${s.id}`)).toBeDefined();
    }
    expect(screen.queryByTestId('marketing-dashboard-channels')).toBeNull();
  });

  it('computes ROAS correctly from aggregated spend + revenue', () => {
    renderAt(30, { channels: CHANNELS });
    // total spend = 25000, total revenue = 68000, ROAS = 2.7
    const roas = screen.getByTestId('marketing-dashboard-kpi-roas');
    expect(roas.textContent).toContain('2.7x');
  });

  it('handles empty channels without dividing by zero', () => {
    expect(() => renderAt(30, { channels: [] })).not.toThrow();
  });

  it('uses a custom currencyPrefix when supplied', () => {
    renderAt(30, { channels: CHANNELS, currencyPrefix: '\u20AC' });
    const spend = screen.getByTestId('marketing-dashboard-kpi-total-spend');
    expect(spend.textContent).toContain('\u20AC');
  });
});

describe('marketingDashboardClip definition (T-131f.2)', () => {
  it("registers under kind 'marketing-dashboard' with propsSchema", () => {
    expect(marketingDashboardClip.kind).toBe('marketing-dashboard');
    expect(marketingDashboardClip.propsSchema).toBe(marketingDashboardPropsSchema);
  });

  it('declares themeSlots for background + text + surface', () => {
    expect(marketingDashboardClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      surface: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema requires channels', () => {
    expect(marketingDashboardPropsSchema.safeParse({}).success).toBe(false);
    expect(marketingDashboardPropsSchema.safeParse({ channels: [] }).success).toBe(true);
  });

  it('propsSchema rejects unknown mode values', () => {
    expect(marketingDashboardPropsSchema.safeParse({ channels: [], mode: 'bogus' }).success).toBe(
      false,
    );
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap flows background + text + surface', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', surface: '#151c23' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      marketingDashboardClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<MarketingDashboardProps>
      >[0],
      theme,
      { channels: [] } as MarketingDashboardProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.surface).toBe('#151c23');
  });
});
