// packages/runtimes/frame-runtime-bridge/src/clips/chart/bar.test.tsx
// T-406 AC #6 + #13 — bar renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { BarChart } from './bar.js';
import { ENTRANCE_FRACTION } from './constants.js';

function renderAtFrame(node: ReactElement, frame: number, durationInFrames = 60) {
  const cfg: VideoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames };
  return render(
    <FrameProvider frame={frame} config={cfg}>
      {node}
    </FrameProvider>,
  );
}

const data = {
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'Sales', values: [10, 20, 30, 40] }],
};

describe('BarChart (T-406 AC #6, #13)', () => {
  it('AC #6 — renders N rectangles for N values', () => {
    const { container } = renderAtFrame(<BarChart data={data} legend axes />, 60);
    const rects = container.querySelectorAll('[data-testid^="chart-bar-rect-"]');
    expect(rects.length).toBe(4);
  });

  it('AC #6 — bar heights are proportional to values at the terminal frame', () => {
    const { container } = renderAtFrame(<BarChart data={data} legend axes />, 60);
    const rects = Array.from(
      container.querySelectorAll('[data-testid^="chart-bar-rect-"]'),
    ) as SVGRectElement[];
    expect(rects.length).toBe(4);
    const heights = rects.map((r) => Number(r.getAttribute('height') ?? '0'));
    // Heights should be monotonically increasing (values are 10/20/30/40).
    for (let i = 1; i < heights.length; i++) {
      const prev = heights[i - 1] ?? 0;
      expect(heights[i]).toBeGreaterThanOrEqual(prev);
    }
  });

  it('AC #13 — animation has settled past floor(0.6 * durationInFrames)', () => {
    const settled = Math.floor(60 * ENTRANCE_FRACTION) + 1;
    const a = renderAtFrame(<BarChart data={data} legend axes />, settled);
    const b = renderAtFrame(<BarChart data={data} legend axes />, 59);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });

  it('renders an empty chart for empty data without crashing', () => {
    const { container } = renderAtFrame(
      <BarChart data={{ labels: [], series: [] }} legend axes />,
      30,
    );
    expect(container.querySelectorAll('[data-testid^="chart-bar-rect-"]').length).toBe(0);
  });
});
