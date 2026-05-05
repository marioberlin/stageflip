// packages/runtimes/frame-runtime-bridge/src/clips/magic-wall-panel.test.tsx
// T-355a — magicWallPanelClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MagicWallPanel,
  type MagicWallPanelProps,
  magicWallPanelClip,
  magicWallPanelPropsSchema,
} from './magic-wall-panel.js';

afterEach(cleanup);

const FPS = 30;

function renderAt(frame: number, props: MagicWallPanelProps, durationInFrames = 600) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: FPS, durationInFrames }}>
      <MagicWallPanel {...props} />
    </FrameProvider>,
  );
}

const MIN_REGION = {
  id: 'CA',
  label: 'CA',
  bounds: { x: 0, y: 0, width: 100, height: 100 },
};

describe('magicWallPanelPropsSchema (T-355a)', () => {
  it('accepts a minimal valid input (single region)', () => {
    const result = magicWallPanelPropsSchema.safeParse({
      regions: [{ id: 'CA', label: 'CA', bounds: { x: 80, y: 120, width: 420, height: 340 } }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty regions array (min(1))', () => {
    expect(magicWallPanelPropsSchema.safeParse({ regions: [] }).success).toBe(false);
  });

  it('rejects more than 56 regions (max(56))', () => {
    const fiftySeven = Array.from({ length: 57 }, (_, i) => ({
      id: `R${i}`,
      label: `R${i}`,
      bounds: { x: i, y: i, width: 10, height: 10 },
    }));
    expect(magicWallPanelPropsSchema.safeParse({ regions: fiftySeven }).success).toBe(false);
  });

  it('rejects a region missing required fields', () => {
    // missing bounds
    expect(
      magicWallPanelPropsSchema.safeParse({ regions: [{ id: 'CA', label: 'CA' }] }).success,
    ).toBe(false);
    // missing id
    expect(
      magicWallPanelPropsSchema.safeParse({
        regions: [{ label: 'CA', bounds: { x: 0, y: 0, width: 10, height: 10 } }],
      }).success,
    ).toBe(false);
    // missing label
    expect(
      magicWallPanelPropsSchema.safeParse({
        regions: [{ id: 'CA', bounds: { x: 0, y: 0, width: 10, height: 10 } }],
      }).success,
    ).toBe(false);
  });

  it('accepts all three valueFormat values', () => {
    for (const fmt of ['percent', 'count', 'raw'] as const) {
      expect(
        magicWallPanelPropsSchema.safeParse({ regions: [MIN_REGION], valueFormat: fmt }).success,
      ).toBe(true);
    }
  });

  it('accepts all three entrance values', () => {
    for (const e of ['none', 'fade', 'stagger-rise'] as const) {
      expect(
        magicWallPanelPropsSchema.safeParse({ regions: [MIN_REGION], entrance: e }).success,
      ).toBe(true);
    }
  });

  it('rejects a malformed hex color', () => {
    expect(
      magicWallPanelPropsSchema.safeParse({ regions: [MIN_REGION], background: 'not-a-hex' })
        .success,
    ).toBe(false);
  });
});

describe('MagicWallPanel component (T-355a)', () => {
  it('renders title + subtitle + region tiles at their bounds with entrance="none"', () => {
    renderAt(0, {
      title: '2024 Election',
      subtitle: 'Updated 11:42 PM ET',
      entrance: 'none',
      regions: [
        { id: 'CA', label: 'CA', bounds: { x: 10, y: 200, width: 100, height: 80 } },
        { id: 'TX', label: 'TX', bounds: { x: 120, y: 200, width: 100, height: 80 } },
        { id: 'NY', label: 'NY', bounds: { x: 230, y: 200, width: 100, height: 80 } },
      ],
    });
    expect(screen.getByTestId('magic-wall-panel-title').textContent).toBe('2024 Election');
    expect(screen.getByTestId('magic-wall-panel-subtitle').textContent).toBe('Updated 11:42 PM ET');
    const ca = screen.getByTestId('magic-wall-panel-region-CA');
    expect(ca).toBeDefined();
    expect(ca.style.left).toBe('10px');
    expect(ca.style.top).toBe('200px');
    expect(ca.style.width).toBe('100px');
    expect(ca.style.height).toBe('80px');
    expect(screen.getByTestId('magic-wall-panel-region-TX')).toBeDefined();
    expect(screen.getByTestId('magic-wall-panel-region-NY')).toBeDefined();
  });

  it("renders value as percent (e.g. '62.1%') when valueFormat='percent'", () => {
    renderAt(120, {
      entrance: 'none',
      valueFormat: 'percent',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          value: 62.1,
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    const valueCell = screen.getByTestId('magic-wall-panel-region-value-CA');
    expect(valueCell.textContent).toMatch(/62\.1%/);
  });

  it("renders value with thousands grouping when valueFormat='count'", () => {
    renderAt(120, {
      entrance: 'none',
      valueFormat: 'count',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          value: 54000,
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    expect(screen.getByTestId('magic-wall-panel-region-value-CA').textContent).toBe('54,000');
  });

  it('valueLabel overrides format dispatch', () => {
    renderAt(120, {
      entrance: 'none',
      valueFormat: 'percent',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          value: 62.1,
          valueLabel: 'CALLED',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    const cell = screen.getByTestId('magic-wall-panel-region-value-CA');
    expect(cell.textContent).toBe('CALLED');
    expect(cell.textContent).not.toMatch(/62\.1%/);
  });

  it('renders no value cell when both value and valueLabel are absent', () => {
    renderAt(120, {
      entrance: 'none',
      regions: [{ id: 'CA', label: 'CA', bounds: { x: 0, y: 0, width: 100, height: 100 } }],
    });
    expect(screen.queryByTestId('magic-wall-panel-region-value-CA')).toBeNull();
  });

  it('per-region color tints the tile fill', () => {
    renderAt(120, {
      entrance: 'none',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          color: '#0044CC',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    const tile = screen.getByTestId('magic-wall-panel-region-CA');
    expect(tile.style.backgroundColor.toLowerCase()).toBe('#0044cc');
  });

  it('region without color falls back to the foreground prop', () => {
    renderAt(120, {
      entrance: 'none',
      foreground: '#00ff00',
      regions: [{ id: 'CA', label: 'CA', bounds: { x: 0, y: 0, width: 100, height: 100 } }],
    });
    const tile = screen.getByTestId('magic-wall-panel-region-CA');
    expect(tile.style.backgroundColor.toLowerCase()).toBe('#00ff00');
  });

  it("entrance='stagger-rise': region 0 opacity is 0 at frame 0; full opacity at large frame", () => {
    const regions = Array.from({ length: 8 }, (_, i) => ({
      id: `R${i}`,
      label: `R${i}`,
      bounds: { x: i * 10, y: 0, width: 10, height: 10 },
    }));
    renderAt(0, { regions, entrance: 'stagger-rise' });
    const r0 = screen.getByTestId('magic-wall-panel-region-R0');
    expect(r0.style.opacity).toBe('0');
    cleanup();
    renderAt(120, { regions, entrance: 'stagger-rise' });
    for (let i = 0; i < 8; i += 1) {
      const region = screen.getByTestId(`magic-wall-panel-region-R${i}`);
      expect(Number.parseFloat(region.style.opacity)).toBe(1);
    }
  });

  it("entrance='none' renders all regions at full opacity at frame 0", () => {
    const regions = Array.from({ length: 5 }, (_, i) => ({
      id: `R${i}`,
      label: `R${i}`,
      bounds: { x: i * 10, y: 0, width: 10, height: 10 },
    }));
    renderAt(0, { regions, entrance: 'none' });
    for (let i = 0; i < 5; i += 1) {
      const region = screen.getByTestId(`magic-wall-panel-region-R${i}`);
      expect(Number.parseFloat(region.style.opacity)).toBe(1);
    }
  });

  it('numeric-formatted cells carry font-variant-numeric: tabular-nums', () => {
    renderAt(120, {
      entrance: 'none',
      valueFormat: 'percent',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          value: 62.1,
          bounds: { x: 0, y: 0, width: 100, height: 100 },
        },
      ],
    });
    const cell = screen.getByTestId('magic-wall-panel-region-value-CA');
    expect(cell.style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('is frame-deterministic — identical HTML across two renders at the same frame', () => {
    const props: MagicWallPanelProps = {
      title: '2024 Presidential Election',
      subtitle: 'State Results',
      entrance: 'stagger-rise',
      valueFormat: 'percent',
      regions: [
        {
          id: 'CA',
          label: 'CA',
          value: 62.1,
          color: '#0044CC',
          bounds: { x: 80, y: 200, width: 200, height: 100 },
        },
        {
          id: 'TX',
          label: 'TX',
          value: 54.7,
          color: '#CC0000',
          bounds: { x: 300, y: 200, width: 200, height: 100 },
        },
        {
          id: 'NY',
          label: 'NY',
          value: 58.2,
          color: '#0044CC',
          bounds: { x: 520, y: 200, width: 200, height: 100 },
        },
      ],
      background: '#0a0a0a',
      foreground: '#ffffff',
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('magicWallPanelClip definition (T-355a)', () => {
  it("registers under kind 'magic-wall-panel' with the expected theme slots", () => {
    expect(magicWallPanelClip.kind).toBe('magic-wall-panel');
    expect(magicWallPanelClip.propsSchema).toBe(magicWallPanelPropsSchema);
    expect(magicWallPanelClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      foreground: { kind: 'palette', role: 'foreground' },
    });
  });
});
