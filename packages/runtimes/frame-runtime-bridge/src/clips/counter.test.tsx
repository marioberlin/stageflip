// packages/runtimes/frame-runtime-bridge/src/clips/counter.test.tsx
// T-131b.1 — counterClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Counter, type CounterProps, counterClip, counterPropsSchema } from './counter.js';

afterEach(cleanup);

function renderAt(frame: number, props: CounterProps, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <Counter {...props} />
    </FrameProvider>,
  );
}

describe('Counter component (T-131b.1)', () => {
  it('shows 0 at frame=0 and target at frame=duration-10', () => {
    renderAt(0, { target: 1000 });
    expect(screen.getByTestId('counter-clip').textContent).toContain('0');
    cleanup();
    renderAt(50, { target: 1000 }, 60);
    // `toLocaleString()` is locale-dependent: en-US emits `1,000`, fr-FR
    // emits `1 000`, de-DE emits `1.000`. Strip non-digits to assert the
    // numeric content alone — locale formatting is intentional in the port
    // (matches the reference clip), but the test should not pin a CI locale.
    expect(screen.getByTestId('counter-clip').textContent?.replace(/\D/g, '')).toBe('1000');
  });

  it('respects prefix + suffix props verbatim around the locale-formatted value', () => {
    renderAt(50, { target: 42, prefix: '$', suffix: 'k' }, 60);
    const text = screen.getByTestId('counter-clip').textContent ?? '';
    expect(text.startsWith('$')).toBe(true);
    expect(text.endsWith('k')).toBe(true);
    expect(text.replace(/\D/g, '')).toBe('42');
  });

  it('uses tabular-nums on the value span (preserved from reference)', () => {
    renderAt(50, { target: 50 }, 60);
    const span = screen.getByTestId('counter-clip').querySelector('span') as HTMLElement;
    expect(span.style.fontVariantNumeric).toBe('tabular-nums');
  });

  it('renders the supplied background colour on the outer container', () => {
    renderAt(0, { target: 10, background: 'rgb(10, 20, 30)' });
    expect(screen.getByTestId('counter-clip').style.backgroundColor).toBe('rgb(10, 20, 30)');
  });
});

describe('counterClip definition (T-131b.1)', () => {
  it("registers under kind 'counter' with a propsSchema", () => {
    expect(counterClip.kind).toBe('counter');
    expect(counterClip.propsSchema).toBe(counterPropsSchema);
  });

  it('declares themeSlots binding color → primary, background → background', () => {
    expect(counterClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('declares Plus Jakarta Sans 800 as a font requirement', () => {
    expect(counterClip.fontRequirements?.({ target: 1 })).toEqual([
      { family: 'Plus Jakarta Sans', weight: 800 },
    ]);
  });

  it('propsSchema rejects non-numeric target', () => {
    expect(counterPropsSchema.safeParse({ target: 'oops' }).success).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows color + background', () => {
    const theme: Theme = {
      palette: { primary: '#0a84ff', background: '#0c1116' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      counterClip as unknown as Parameters<typeof resolveClipDefaultsForTheme<CounterProps>>[0],
      theme,
      { target: 100 } as CounterProps,
    );
    expect(out.color).toBe('#0a84ff');
    expect(out.background).toBe('#0c1116');
  });
});
