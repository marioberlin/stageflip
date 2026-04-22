// packages/runtimes/frame-runtime-bridge/src/clips/pull-quote.test.tsx
// T-131b.3 — pullQuoteClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PullQuote,
  type PullQuoteProps,
  pullQuoteClip,
  pullQuotePropsSchema,
} from './pull-quote.js';

afterEach(cleanup);

function renderAt(frame: number, props: PullQuoteProps = {}, durationInFrames = 120) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <PullQuote {...props} />
    </FrameProvider>,
  );
}

describe('PullQuote component (T-131b.3)', () => {
  it('shows zero quote characters before the type-in begins (frame < quoteStart)', () => {
    // quoteStart = ceil(fps*0.3) = 9 at fps=30 → at frame=0 zero chars.
    renderAt(0, { quote: 'Hello world' });
    const body = screen.getByTestId('pull-quote-body').textContent ?? '';
    // body includes the caret `|` — strip it before asserting
    expect(body.replace('|', '').trim()).toBe('');
  });

  it('shows the full quote once typing completes', () => {
    // quoteEnd = max(quoteStart+1, duration - ceil(fps*0.8)) = 120-24=96 at 30fps 120f
    renderAt(96, { quote: 'Hello world' }, 120);
    const body = screen.getByTestId('pull-quote-body').textContent ?? '';
    expect(body.replace('|', '').trim()).toBe('Hello world');
  });

  it('caret stops blinking once typing is done (showCaret = false)', () => {
    renderAt(96, { quote: 'x' }, 120);
    const caret = screen.getByTestId('pull-quote-caret') as HTMLElement;
    expect(caret.style.opacity).toBe('0');
  });

  it('attribution fades in after the quote type completes', () => {
    // At frame=96 (quoteEnd) attrOpacity should be 0; at 96 + fps*0.5 = 111 it's 1.
    const { unmount } = renderAt(96, {}, 120);
    const attrStart = screen.getByTestId('pull-quote-attribution') as HTMLElement;
    expect(Number(attrStart.style.opacity)).toBe(0);
    unmount();
    renderAt(119, {}, 120);
    const attrEnd = screen.getByTestId('pull-quote-attribution') as HTMLElement;
    expect(Number(attrEnd.style.opacity)).toBe(1);
  });

  it('renders the decorative opening-quote mark', () => {
    renderAt(30, {});
    expect(screen.getByTestId('pull-quote-mark')).toBeDefined();
  });
});

describe('pullQuoteClip definition (T-131b.3)', () => {
  it("registers under kind 'pull-quote' with three themeSlots", () => {
    expect(pullQuoteClip.kind).toBe('pull-quote');
    expect(pullQuoteClip.propsSchema).toBe(pullQuotePropsSchema);
    expect(pullQuoteClip.themeSlots).toEqual({
      accentColor: { kind: 'palette', role: 'primary' },
      textColor: { kind: 'palette', role: 'foreground' },
      background: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema is permissive — every field optional', () => {
    expect(pullQuotePropsSchema.safeParse({}).success).toBe(true);
  });

  it('propsSchema rejects empty-string quote (would render zero chars forever)', () => {
    expect(pullQuotePropsSchema.safeParse({ quote: '' }).success).toBe(false);
  });
});
