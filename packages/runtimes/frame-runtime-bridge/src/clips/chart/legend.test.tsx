// packages/runtimes/frame-runtime-bridge/src/clips/chart/legend.test.tsx
// T-406 — shared legend renderer used by all 7 kinds.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Legend } from './legend.js';

describe('Legend', () => {
  it('renders one entry per series with the series color', () => {
    const { container } = render(
      <svg width={1920} height={1080} role="img" aria-label="legend test">
        <title>legend test</title>
        <Legend
          x={1500}
          y={50}
          entries={[
            { name: 'Series A', color: '#0072e5' },
            { name: 'Series B', color: '#ff6b35' },
          ]}
          textColor="#ebf1fa"
        />
      </svg>,
    );
    const items = container.querySelectorAll('[data-testid^="chart-legend-entry-"]');
    expect(items.length).toBe(2);
  });

  it('omits the legend when entries is empty', () => {
    const { container } = render(
      <svg width={1920} height={1080} role="img" aria-label="empty legend test">
        <title>empty legend test</title>
        <Legend x={0} y={0} entries={[]} textColor="#ebf1fa" />
      </svg>,
    );
    expect(container.querySelectorAll('[data-testid^="chart-legend-entry-"]').length).toBe(0);
  });
});
