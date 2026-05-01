// packages/runtimes/frame-runtime-bridge/src/clips/chart/donut.test.tsx
// T-406 AC #10 — donut renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { DonutChart, INNER_RADIUS_FRACTION } from './donut.js';

function renderAtFrame(node: ReactElement, frame: number, durationInFrames = 60) {
  const cfg: VideoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames };
  return render(
    <FrameProvider frame={frame} config={cfg}>
      {node}
    </FrameProvider>,
  );
}

const data = {
  labels: ['A', 'B', 'C'],
  series: [{ name: 'Share', values: [40, 35, 25] }],
};

describe('DonutChart (T-406 AC #10)', () => {
  it('AC #10 — renders N slices like pie chart', () => {
    const { container } = renderAtFrame(<DonutChart data={data} legend />, 60);
    const slices = container.querySelectorAll('[data-testid^="chart-donut-slice-"]');
    expect(slices.length).toBe(3);
  });

  it('AC #10 — INNER_RADIUS_FRACTION is 0.55 (v1 default)', () => {
    expect(INNER_RADIUS_FRACTION).toBe(0.55);
  });
});
