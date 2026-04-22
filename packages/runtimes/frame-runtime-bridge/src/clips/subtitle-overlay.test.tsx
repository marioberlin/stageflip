// packages/runtimes/frame-runtime-bridge/src/clips/subtitle-overlay.test.tsx
// T-131b.2 — subtitleOverlayClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SubtitleOverlay,
  type SubtitleOverlayProps,
  subtitleOverlayClip,
  subtitleOverlayPropsSchema,
} from './subtitle-overlay.js';

afterEach(cleanup);

function renderAt(frame: number, props: SubtitleOverlayProps, durationInFrames = 90) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <SubtitleOverlay {...props} />
    </FrameProvider>,
  );
}

describe('SubtitleOverlay component (T-131b.2)', () => {
  it('auto-times words evenly when no `words` prop is given', () => {
    renderAt(15, { text: 'one two three' });
    const root = screen.getByTestId('subtitle-overlay-clip');
    expect(root.textContent?.trim()).toContain('one');
    expect(root.textContent?.trim()).toContain('two');
  });

  it('marks the word matching currentTimeMs as the active word', () => {
    // 90-frame composition at 30fps = 3000ms total. 3 words → 1000ms each.
    // Frame 45 → 1500ms → second word active (1000-2000ms range).
    renderAt(45, { text: 'one two three' }, 90);
    const active = screen.getByTestId('subtitle-active-word');
    expect(active.textContent?.trim()).toBe('two');
  });

  it('respects an explicit words[] timing array', () => {
    // 30fps, frame 30 → 1000ms. word at 500-1500 should be active.
    renderAt(30, {
      words: [
        { text: 'alpha', startMs: 0, endMs: 500 },
        { text: 'bravo', startMs: 500, endMs: 1500 },
        { text: 'charlie', startMs: 1500, endMs: 2500 },
      ],
    });
    expect(screen.getByTestId('subtitle-active-word').textContent?.trim()).toBe('bravo');
  });

  it('renders nothing observable when text is empty (no words to display)', () => {
    renderAt(0, { text: '' });
    const root = screen.getByTestId('subtitle-overlay-clip');
    expect(root.textContent?.trim() ?? '').toBe('');
  });

  it('holds the last line at end-of-clip (does NOT snap to line 0 once all words have ended)', () => {
    // Two-line scenario: 10 words = lines [0..7] + [8..9]. At frame=89 of a
    // 90-frame composition (almost end), every word has ended. The clip must
    // continue showing the *last* line — not reset to line 0.
    const text = 'one two three four five six seven eight nine ten';
    renderAt(89, { text }, 90);
    const root = screen.getByTestId('subtitle-overlay-clip');
    const text2 = root.textContent ?? '';
    expect(text2).toContain('nine');
    expect(text2).toContain('ten');
    expect(text2).not.toContain('one');
  });
});

describe('subtitleOverlayClip definition (T-131b.2)', () => {
  it("registers under kind 'subtitle-overlay' with three themeSlots", () => {
    expect(subtitleOverlayClip.kind).toBe('subtitle-overlay');
    expect(subtitleOverlayClip.propsSchema).toBe(subtitleOverlayPropsSchema);
    expect(subtitleOverlayClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
      activeColor: { kind: 'palette', role: 'background' },
      background: { kind: 'palette', role: 'surface' },
    });
  });

  it('propsSchema rejects words array with non-positive endMs', () => {
    const bad = { words: [{ text: 'x', startMs: 0, endMs: 0 }] };
    expect(subtitleOverlayPropsSchema.safeParse(bad).success).toBe(false);
  });

  it('propsSchema accepts the position enum and rejects unknown values', () => {
    expect(subtitleOverlayPropsSchema.safeParse({ position: 'top' }).success).toBe(true);
    expect(subtitleOverlayPropsSchema.safeParse({ position: 'middle' }).success).toBe(false);
  });
});
