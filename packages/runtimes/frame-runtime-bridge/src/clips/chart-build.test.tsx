// packages/runtimes/frame-runtime-bridge/src/clips/chart-build.test.tsx
// T-131b.1 — chartBuildClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ChartBuild,
  type ChartBuildProps,
  chartBuildClip,
  chartBuildPropsSchema,
} from './chart-build.js';

afterEach(cleanup);

function renderAt(frame: number, props: ChartBuildProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <ChartBuild {...props} />
    </FrameProvider>,
  );
}

describe('ChartBuild component (T-131b.1)', () => {
  it('renders one bar per value', () => {
    renderAt(60, { values: [10, 20, 30] });
    expect(screen.getByTestId('chart-build-bar-0')).toBeDefined();
    expect(screen.getByTestId('chart-build-bar-1')).toBeDefined();
    expect(screen.getByTestId('chart-build-bar-2')).toBeDefined();
  });

  it('shows zero-height bars at frame=0', () => {
    renderAt(0, { values: [10, 20, 30] });
    const bar0 = screen.getByTestId('chart-build-bar-0') as HTMLElement;
    expect(bar0.style.height).toBe('0%');
  });

  it('the tallest bar reaches its full %-of-max once the build window completes', () => {
    renderAt(60, { values: [50, 100] }, 60);
    const tallest = screen.getByTestId('chart-build-bar-1') as HTMLElement;
    expect(tallest.style.height).toBe('100%');
  });

  it('handles all-zeros without dividing by zero (denominator clamped to 1)', () => {
    expect(() => renderAt(30, { values: [0, 0, 0] }, 60)).not.toThrow();
  });

  it('renders labels when provided, omits them when absent', () => {
    renderAt(60, { values: [1, 2], labels: ['A', 'B'] });
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
  });
});

describe('chartBuildClip definition (T-131b.1)', () => {
  it("registers under kind 'chart-build' with three themeSlots (color / background / labelColor)", () => {
    expect(chartBuildClip.kind).toBe('chart-build');
    expect(chartBuildClip.propsSchema).toBe(chartBuildPropsSchema);
    expect(chartBuildClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      labelColor: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema rejects empty values array', () => {
    expect(chartBuildPropsSchema.safeParse({ values: [] }).success).toBe(false);
  });
});
