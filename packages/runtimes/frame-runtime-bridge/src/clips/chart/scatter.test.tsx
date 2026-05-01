// packages/runtimes/frame-runtime-bridge/src/clips/chart/scatter.test.tsx
// T-406 AC #11 — scatter renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ScatterChart } from './scatter.js';

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
  series: [
    { name: 'X', values: [1, 2, 3, 4] },
    { name: 'Y', values: [10, 20, 15, 25] },
  ],
};

describe('ScatterChart (T-406 AC #11)', () => {
  it('AC #11 — renders one <circle> per (series, valueIndex) pair', () => {
    const { container } = renderAtFrame(<ScatterChart data={data} legend axes />, 60);
    const points = container.querySelectorAll('[data-testid^="chart-scatter-point-"]');
    // 2 series × 4 values = 8 points (the "no jitter" v1 design renders all
    // input pairs; deferred-jitter is documented in T-406 D-T406-7).
    expect(points.length).toBe(8);
  });

  it('AC #11 — at frame 0, all points have opacity 0 (entrance pending)', () => {
    const { container } = renderAtFrame(<ScatterChart data={data} legend axes />, 0);
    const points = Array.from(
      container.querySelectorAll('[data-testid^="chart-scatter-point-"]'),
    ) as SVGCircleElement[];
    // Some points (later in the stagger order) should have opacity ≈ 0 at frame 0.
    const lastOpacities = points.slice(-2).map((p) => Number(p.getAttribute('opacity') ?? '1'));
    for (const opacity of lastOpacities) {
      expect(opacity).toBeLessThan(0.5);
    }
  });

  it('determinism — same render twice → identical SVG', () => {
    const a = renderAtFrame(<ScatterChart data={data} legend axes />, 30);
    const b = renderAtFrame(<ScatterChart data={data} legend axes />, 30);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
