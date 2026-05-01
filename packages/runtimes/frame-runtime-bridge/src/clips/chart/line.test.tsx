// packages/runtimes/frame-runtime-bridge/src/clips/chart/line.test.tsx
// T-406 AC #7 + #13 — line renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ENTRANCE_FRACTION } from './constants.js';
import { LineChart } from './line.js';

function renderAtFrame(node: ReactElement, frame: number, durationInFrames = 60) {
  const cfg: VideoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames };
  return render(
    <FrameProvider frame={frame} config={cfg}>
      {node}
    </FrameProvider>,
  );
}

const data = {
  labels: ['Q1', 'Q2', 'Q3'],
  series: [
    { name: 'A', values: [10, 20, 30] },
    { name: 'B', values: [5, 15, 25] },
  ],
};

describe('LineChart (T-406 AC #7, #13)', () => {
  it('AC #7 — renders one <path> per series with stroke-dasharray + stroke-dashoffset', () => {
    const { container } = renderAtFrame(<LineChart data={data} legend axes />, 30);
    const paths = container.querySelectorAll('[data-testid^="chart-line-path-"]');
    expect(paths.length).toBe(2);
    for (const path of Array.from(paths)) {
      expect(path.getAttribute('stroke-dasharray')).not.toBeNull();
      expect(path.getAttribute('stroke-dashoffset')).not.toBeNull();
    }
  });

  it('AC #7 — at frame 0, dashoffset equals dasharray (line not yet drawn)', () => {
    const { container } = renderAtFrame(<LineChart data={data} legend axes />, 0);
    const path = container.querySelector('[data-testid="chart-line-path-0"]');
    expect(path).not.toBeNull();
    const dasharray = Number(path?.getAttribute('stroke-dasharray') ?? '0');
    const dashoffset = Number(path?.getAttribute('stroke-dashoffset') ?? '0');
    expect(dashoffset).toBeCloseTo(dasharray, 3);
  });

  it('AC #13 — animation has settled past floor(0.6 * durationInFrames)', () => {
    const settled = Math.floor(60 * ENTRANCE_FRACTION) + 1;
    const a = renderAtFrame(<LineChart data={data} legend axes />, settled);
    const b = renderAtFrame(<LineChart data={data} legend axes />, 59);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
