// packages/runtimes/frame-runtime-bridge/src/clips/line-chart-draw.test.tsx
// T-131b.2 — lineChartDrawClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  LineChartDraw,
  type LineChartDrawProps,
  lineChartDrawClip,
  lineChartDrawPropsSchema,
} from './line-chart-draw.js';

afterEach(cleanup);

function renderAt(frame: number, props: LineChartDrawProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <LineChartDraw {...props} />
    </FrameProvider>,
  );
}

describe('LineChartDraw component (T-131b.2)', () => {
  it('renders a path element built from values', () => {
    renderAt(60, { values: [10, 20, 30, 25, 40] });
    expect(screen.getByTestId('line-chart-path')).toBeDefined();
  });

  it('animates the path via stroke-dashoffset (full-length offset at frame=0, zero at draw-end)', () => {
    const { unmount } = renderAt(0, { values: [10, 20, 30, 40] });
    const path0 = screen.getByTestId('line-chart-path') as unknown as SVGPathElement;
    const offset0 = Number(path0.getAttribute('stroke-dashoffset'));
    expect(offset0).toBeGreaterThan(0);
    unmount();
    renderAt(45, { values: [10, 20, 30, 40] }, 60);
    const pathEnd = screen.getByTestId('line-chart-path') as unknown as SVGPathElement;
    expect(Number(pathEnd.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 1);
  });

  it('renders one dot per value when showDots is on (default)', () => {
    renderAt(60, { values: [10, 20, 30] });
    expect(screen.getByTestId('line-chart-dot-0')).toBeDefined();
    expect(screen.getByTestId('line-chart-dot-1')).toBeDefined();
    expect(screen.getByTestId('line-chart-dot-2')).toBeDefined();
  });

  it('omits dots entirely when showDots is false', () => {
    renderAt(60, { values: [10, 20, 30], showDots: false });
    expect(screen.queryByTestId('line-chart-dot-0')).toBeNull();
  });

  it('renders a title when supplied', () => {
    renderAt(60, { values: [1, 2, 3], title: 'Revenue' });
    expect(screen.getByTestId('line-chart-title').textContent).toBe('Revenue');
  });
});

describe('lineChartDrawClip definition (T-131b.2)', () => {
  it("registers under kind 'line-chart-draw' with five themeSlots", () => {
    expect(lineChartDrawClip.kind).toBe('line-chart-draw');
    expect(lineChartDrawClip.propsSchema).toBe(lineChartDrawPropsSchema);
    expect(lineChartDrawClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
      axisLabelColor: { kind: 'palette', role: 'foreground' },
      dataLabelColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects single-point values arrays (need at least 2 points to draw a line)', () => {
    expect(lineChartDrawPropsSchema.safeParse({ values: [1] }).success).toBe(false);
    expect(lineChartDrawPropsSchema.safeParse({ values: [1, 2] }).success).toBe(true);
  });
});
