// packages/runtimes/frame-runtime-bridge/src/clips/pie-chart-build.test.tsx
// T-131b.2 — pieChartBuildClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PieChartBuild,
  type PieChartBuildProps,
  pieChartBuildClip,
  pieChartBuildPropsSchema,
} from './pie-chart-build.js';

afterEach(cleanup);

function renderAt(frame: number, props: PieChartBuildProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <PieChartBuild {...props} />
    </FrameProvider>,
  );
}

describe('PieChartBuild component (T-131b.2)', () => {
  it('renders one circle per value', () => {
    const { container } = renderAt(60, { values: [25, 25, 25, 25] });
    expect(container.querySelectorAll('circle').length).toBe(4);
  });

  it('renders a title when supplied', () => {
    renderAt(60, { values: [10, 20], title: 'Q1' });
    expect(screen.getByTestId('pie-chart-title').textContent).toBe('Q1');
  });

  it('omits the title element when title is absent', () => {
    renderAt(60, { values: [10, 20] });
    expect(screen.queryByTestId('pie-chart-title')).toBeNull();
  });

  it('renders the legend only when labels are provided', () => {
    renderAt(60, { values: [10, 20], labels: ['A', 'B'] });
    const legend = screen.getByTestId('pie-chart-legend');
    expect(legend.textContent).toContain('A');
    expect(legend.textContent).toContain('B');
  });

  it('handles all-zero values without dividing by zero', () => {
    expect(() => renderAt(60, { values: [0, 0, 0] })).not.toThrow();
  });

  it('uses a stroke wider than the radius for filled mode and 80px for donut mode', () => {
    const filled = renderAt(60, { values: [10, 20, 30] });
    const filledFirst = filled.container.querySelector('circle') as SVGCircleElement;
    expect(filledFirst.getAttribute('stroke-width')).toBe('300');
    cleanup();
    const donut = renderAt(60, { values: [10, 20, 30], donut: true });
    const donutFirst = donut.container.querySelector('circle') as SVGCircleElement;
    expect(donutFirst.getAttribute('stroke-width')).toBe('80');
  });
});

describe('pieChartBuildClip definition (T-131b.2)', () => {
  it("registers under kind 'pie-chart-build' with three themeSlots", () => {
    expect(pieChartBuildClip.kind).toBe('pie-chart-build');
    expect(pieChartBuildClip.propsSchema).toBe(pieChartBuildPropsSchema);
    expect(pieChartBuildClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
      legendColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects empty values array', () => {
    expect(pieChartBuildPropsSchema.safeParse({ values: [] }).success).toBe(false);
  });

  it('propsSchema rejects negative values', () => {
    expect(pieChartBuildPropsSchema.safeParse({ values: [-1] }).success).toBe(false);
  });
});
