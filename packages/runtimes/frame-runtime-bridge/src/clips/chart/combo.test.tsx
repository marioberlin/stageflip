// packages/runtimes/frame-runtime-bridge/src/clips/chart/combo.test.tsx
// T-406 AC #12 — combo renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ComboChart } from './combo.js';
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
  series: [
    { name: 'Sales (bar)', values: [10, 20, 30, 40] },
    { name: 'Forecast (line)', values: [12, 22, 32, 42] },
    { name: 'Target (line)', values: [15, 25, 35, 45] },
  ],
};

describe('ComboChart (T-406 AC #12)', () => {
  it('AC #12 — first series renders as bars', () => {
    const { container } = renderAtFrame(<ComboChart data={data} legend axes />, 60);
    const bars = container.querySelectorAll('[data-testid^="chart-combo-bar-"]');
    expect(bars.length).toBe(4);
  });

  it('AC #12 — subsequent series render as lines', () => {
    const { container } = renderAtFrame(<ComboChart data={data} legend axes />, 60);
    const lines = container.querySelectorAll('[data-testid^="chart-combo-line-"]');
    // 2 line series (series 1 and series 2; series 0 is bars).
    expect(lines.length).toBe(2);
  });

  it('handles single-series input (only bars, no lines)', () => {
    const single = {
      labels: ['A', 'B'],
      series: [{ name: 'X', values: [10, 20] }],
    };
    const { container } = renderAtFrame(<ComboChart data={single} legend axes />, 60);
    expect(container.querySelectorAll('[data-testid^="chart-combo-bar-"]').length).toBe(2);
    expect(container.querySelectorAll('[data-testid^="chart-combo-line-"]').length).toBe(0);
  });

  it('AC #13 — animation has settled past floor(0.6 * durationInFrames)', () => {
    const settled = Math.floor(60 * ENTRANCE_FRACTION) + 1;
    const a = renderAtFrame(<ComboChart data={data} legend axes />, settled);
    const b = renderAtFrame(<ComboChart data={data} legend axes />, 59);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
