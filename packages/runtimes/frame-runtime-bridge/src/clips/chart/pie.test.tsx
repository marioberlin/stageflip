// packages/runtimes/frame-runtime-bridge/src/clips/chart/pie.test.tsx
// T-406 AC #9 + #13 — pie renderer.

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { ENTRANCE_FRACTION } from './constants.js';
import { PieChart } from './pie.js';

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
  series: [{ name: 'Share', values: [25, 25, 25, 25] }],
};

describe('PieChart (T-406 AC #9, #13)', () => {
  it('AC #9 — renders N slices for N values (first series)', () => {
    const { container } = renderAtFrame(<PieChart data={data} legend />, 60);
    const slices = container.querySelectorAll('[data-testid^="chart-pie-slice-"]');
    expect(slices.length).toBe(4);
  });

  it('AC #9 — at frame 0, slices have zero terminal angle (animation pre-start)', () => {
    const { container } = renderAtFrame(<PieChart data={data} legend />, 0);
    // At frame 0, every slice path is empty (`arcPath()` returns '' when
    // `endAngle - startAngle <= 0`). Total slice angle sum at the
    // settled frame → 360°; at frame 0 → 0°.
    const slices = Array.from(
      container.querySelectorAll('[data-testid^="chart-pie-slice-"]'),
    ) as SVGPathElement[];
    expect(slices.length).toBe(4);
    for (const slice of slices) {
      expect(slice.getAttribute('d')).toBe('');
    }
  });

  it('AC #13 — animation has settled past floor(0.6 * durationInFrames)', () => {
    const settled = Math.floor(60 * ENTRANCE_FRACTION) + 1;
    const a = renderAtFrame(<PieChart data={data} legend />, settled);
    const b = renderAtFrame(<PieChart data={data} legend />, 59);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);
  });
});
