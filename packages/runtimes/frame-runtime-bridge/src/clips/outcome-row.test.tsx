// packages/runtimes/frame-runtime-bridge/src/clips/outcome-row.test.tsx
// T-358a — outcomeRowClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  OutcomeRow,
  type OutcomeRowProps,
  outcomeRowClip,
  outcomeRowPropsSchema,
} from './outcome-row.js';

afterEach(cleanup);

function renderAt(frame: number, props: OutcomeRowProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <OutcomeRow {...props} />
    </FrameProvider>,
  );
}

describe('outcomeRowPropsSchema (T-358a)', () => {
  it('accepts a single chip with only a color', () => {
    expect(outcomeRowPropsSchema.safeParse({ chips: [{ color: '#000000' }] }).success).toBe(true);
  });

  it('rejects an empty chips array', () => {
    expect(outcomeRowPropsSchema.safeParse({ chips: [] }).success).toBe(false);
  });

  it('rejects more than 12 chips', () => {
    const thirteen = Array.from({ length: 13 }, () => ({ color: '#aabbcc' }));
    expect(outcomeRowPropsSchema.safeParse({ chips: thirteen }).success).toBe(false);
  });

  it('rejects a chip missing color', () => {
    expect(outcomeRowPropsSchema.safeParse({ chips: [{ label: 'x' }] }).success).toBe(false);
  });

  it('rejects an unknown shape', () => {
    expect(
      outcomeRowPropsSchema.safeParse({ chips: [{ color: '#000000' }], shape: 'star' }).success,
    ).toBe(false);
  });
});

describe('OutcomeRow component (T-358a)', () => {
  it('renders N chips with the supplied per-chip colors at frame 60', () => {
    renderAt(60, {
      chips: [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }],
    });
    const chip0 = screen.getByTestId('outcome-row-chip-0');
    const chip1 = screen.getByTestId('outcome-row-chip-1');
    const chip2 = screen.getByTestId('outcome-row-chip-2');
    expect(chip0).toBeDefined();
    expect(chip1).toBeDefined();
    expect(chip2).toBeDefined();
    // Default shape is `circle` — chips render an inline SVG <circle>.
    const circle0 = chip0.querySelector('circle');
    const circle1 = chip1.querySelector('circle');
    const circle2 = chip2.querySelector('circle');
    expect(circle0?.getAttribute('fill')).toBe('#ff0000');
    expect(circle1?.getAttribute('fill')).toBe('#00ff00');
    expect(circle2?.getAttribute('fill')).toBe('#0000ff');
  });

  it('renders chip 0 fully transparent at frame 0 (entrance window pre-start)', () => {
    renderAt(0, { chips: [{ color: '#ff0000' }] });
    const chip0 = screen.getByTestId('outcome-row-chip-0');
    // opacity = interpolate(0, [0, 12], [0, 1]) = 0
    expect(chip0.style.opacity).toBe('0');
  });

  it('staggers chip entrance — at frame 10 chip 0 partial, chip 5 still 0', () => {
    renderAt(10, {
      chips: [
        { color: '#111111' },
        { color: '#222222' },
        { color: '#333333' },
        { color: '#444444' },
        { color: '#555555' },
        { color: '#666666' },
      ],
    });
    const chip0 = screen.getByTestId('outcome-row-chip-0');
    const chip5 = screen.getByTestId('outcome-row-chip-5');
    // chip 0: delay=0, frame=10, [0,12] → 10/12 ≈ 0.833
    const op0 = Number.parseFloat(chip0.style.opacity);
    expect(op0).toBeGreaterThan(0);
    expect(op0).toBeLessThan(1);
    // chip 5: delay=20, frame=10 < 20 → 0
    expect(chip5.style.opacity).toBe('0');
  });

  it('renders square shape variant when shape="square"', () => {
    renderAt(60, { chips: [{ color: '#abcdef' }], shape: 'square' });
    const chip0 = screen.getByTestId('outcome-row-chip-0');
    const rect = chip0.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute('fill')).toBe('#abcdef');
    // No corner radius for plain square.
    expect(rect?.getAttribute('rx') ?? '0').toBe('0');
  });

  it('renders rounded shape variant with non-zero corner radius', () => {
    renderAt(60, { chips: [{ color: '#abcdef' }], shape: 'rounded' });
    const chip0 = screen.getByTestId('outcome-row-chip-0');
    const rect = chip0.querySelector('rect');
    expect(rect).not.toBeNull();
    const rx = Number.parseFloat(rect?.getAttribute('rx') ?? '0');
    expect(rx).toBeGreaterThan(0);
  });

  it('is frame-deterministic — same props + same frame → identical HTML', () => {
    const props: OutcomeRowProps = {
      chips: [{ color: '#ff0000' }, { color: '#00ff00' }, { color: '#0000ff' }],
    };
    const a = renderAt(60, props).container.innerHTML;
    cleanup();
    const b = renderAt(60, props).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('outcomeRowClip definition (T-358a)', () => {
  it("registers under kind 'outcome-row' with three theme slots", () => {
    expect(outcomeRowClip.kind).toBe('outcome-row');
    expect(outcomeRowClip.propsSchema).toBe(outcomeRowPropsSchema);
    expect(outcomeRowClip.themeSlots).toEqual({
      defaultFill: { kind: 'palette', role: 'surface' },
      outlineColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'background' },
    });
  });
});
