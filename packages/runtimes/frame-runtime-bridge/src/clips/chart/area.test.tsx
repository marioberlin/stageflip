// packages/runtimes/frame-runtime-bridge/src/clips/chart/area.test.tsx
// T-406 AC #8 + #13 — area renderer.

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import type { ReactElement } from 'react';

import { AreaChart } from './area.js';
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
  labels: ['A', 'B', 'C', 'D'],
  series: [{ name: 'Series', values: [10, 20, 15, 25] }],
};

describe('AreaChart (T-406 AC #8, #13)', () => {
  it('AC #8 — renders both a <path> (line) AND a <polygon> (filled area) per series', () => {
    const { container } = renderAtFrame(<AreaChart data={data} legend axes />, 60);
    const lines = container.querySelectorAll('[data-testid^="chart-area-line-"]');
    const fills = container.querySelectorAll('[data-testid^="chart-area-fill-"]');
    expect(lines.length).toBe(1);
    expect(fills.length).toBe(1);
  });

  it('AC #13 — animation has settled past floor(0.6 * durationInFrames)', () => {
    const settled = Math.floor(60 * ENTRANCE_FRACTION) + 1;
    const a = renderAtFrame(<AreaChart data={data} legend axes />, settled);
    const b = renderAtFrame(<AreaChart data={data} legend axes />, 59);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
