// packages/runtimes/frame-runtime-bridge/src/clips/comparison-table.test.tsx
// T-131b.3 — comparisonTableClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ComparisonTable,
  type ComparisonTableProps,
  comparisonTableClip,
  comparisonTablePropsSchema,
} from './comparison-table.js';

afterEach(cleanup);

function renderAt(frame: number, props: ComparisonTableProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <ComparisonTable {...props} />
    </FrameProvider>,
  );
}

describe('ComparisonTable component (T-131b.3)', () => {
  it('renders both headings', () => {
    renderAt(60, { leftHeading: 'Left', rightHeading: 'Right' });
    expect(screen.getByTestId('comparison-heading-left').textContent).toBe('Left');
    expect(screen.getByTestId('comparison-heading-right').textContent).toBe('Right');
  });

  it('renders the title when supplied', () => {
    renderAt(60, { title: 'Versus' });
    expect(screen.getByTestId('comparison-table-title').textContent).toBe('Versus');
  });

  it('omits the title element when title is absent', () => {
    renderAt(60, {});
    expect(screen.queryByTestId('comparison-table-title')).toBeNull();
  });

  it('renders one row per entry on each side', () => {
    renderAt(60, { leftRows: ['a', 'b'], rightRows: ['x', 'y', 'z'] });
    expect(screen.getByTestId('comparison-row-left-0')).toBeDefined();
    expect(screen.getByTestId('comparison-row-left-1')).toBeDefined();
    expect(screen.getByTestId('comparison-row-right-0')).toBeDefined();
    expect(screen.getByTestId('comparison-row-right-1')).toBeDefined();
    expect(screen.getByTestId('comparison-row-right-2')).toBeDefined();
  });

  it('rows slide in from their respective sides (negative X on left, positive on right)', () => {
    // At frame just after rowStart, rows should still be at their entry offset.
    // rowStartFrame = ceil(fps*0.25) = 8 at fps=30. Use frame=8.
    const { container } = renderAt(8, { leftRows: ['l'], rightRows: ['r'] });
    const left = container.querySelector<HTMLElement>(
      '[data-testid="comparison-row-left-0"]',
    ) as HTMLElement;
    const right = container.querySelector<HTMLElement>(
      '[data-testid="comparison-row-right-0"]',
    ) as HTMLElement;
    expect(left.style.transform).toContain('translateX(-');
    expect(right.style.transform).toMatch(/translateX\((?!-)/);
  });
});

describe('comparisonTableClip definition (T-131b.3)', () => {
  it("registers under kind 'comparison-table' with four themeSlots", () => {
    expect(comparisonTableClip.kind).toBe('comparison-table');
    expect(comparisonTableClip.propsSchema).toBe(comparisonTablePropsSchema);
    expect(comparisonTableClip.themeSlots).toEqual({
      leftColor: { kind: 'palette', role: 'primary' },
      rightColor: { kind: 'palette', role: 'accent' },
      textColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema is permissive — every field optional', () => {
    expect(comparisonTablePropsSchema.safeParse({}).success).toBe(true);
  });
});
