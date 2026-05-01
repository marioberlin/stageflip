// packages/runtimes/frame-runtime-bridge/src/clips/chart/axes.test.tsx
// T-406 — shared axis renderer used by bar / line / area / scatter / combo.

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { Axes } from './axes.js';

describe('Axes', () => {
  it('renders both x and y axis lines + tick labels', () => {
    const { container } = render(
      <svg width={1920} height={1080}>
        <Axes
          width={1920}
          height={1080}
          padding={{ top: 80, right: 60, bottom: 60, left: 70 }}
          minVal={0}
          maxVal={100}
          labels={['A', 'B', 'C', 'D']}
          axisColor="#999999"
          gridColor="#f0f0f0"
          textColor="#666666"
        />
      </svg>,
    );
    expect(container.querySelector('[data-testid="chart-axes-x"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chart-axes-y"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-testid^="chart-axes-x-label-"]').length,
    ).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-testid^="chart-axes-y-label-"]').length,
    ).toBeGreaterThan(0);
  });

  it('omits the axis when omit prop is true', () => {
    const { container } = render(
      <svg width={1920} height={1080}>
        <Axes
          width={1920}
          height={1080}
          padding={{ top: 80, right: 60, bottom: 60, left: 70 }}
          minVal={0}
          maxVal={100}
          labels={['A', 'B']}
          axisColor="#999999"
          gridColor="#f0f0f0"
          textColor="#666666"
          omit
        />
      </svg>,
    );
    expect(container.querySelector('[data-testid="chart-axes-x"]')).toBeNull();
    expect(container.querySelector('[data-testid="chart-axes-y"]')).toBeNull();
  });
});
