// packages/runtimes/frame-runtime-bridge/src/clips/voiceover-narration.test.tsx
// T-131e.2 — voiceoverNarrationClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { resolveClipDefaultsForTheme } from '@stageflip/runtimes-contract';
import type { Theme } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  VoiceoverNarration,
  type VoiceoverNarrationProps,
  voiceoverNarrationClip,
  voiceoverNarrationPropsSchema,
} from './voiceover-narration.js';

afterEach(cleanup);

function renderAt(frame: number, props: VoiceoverNarrationProps, durationInFrames = 180) {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <VoiceoverNarration {...props} />
    </FrameProvider>,
  );
}

describe('VoiceoverNarration component (T-131e.2)', () => {
  it('auto-segments plain text on sentence boundaries and shows the active segment', () => {
    // Two sentences → first is active until 50% of duration, second after.
    renderAt(0, { text: 'Hello world. This is fine.' });
    // At frame=0 the active segment is the first sentence.
    expect(screen.getByTestId('voiceover-narration-text').textContent).toMatch(/Hello world/);
  });

  it('advances to the second segment halfway through the composition', () => {
    renderAt(100, { text: 'Hello world. This is fine.' }, 180);
    // 100/30fps ≈ 3333ms, totalMs = 6000ms. Two sentences → boundary at 3000ms.
    expect(screen.getByTestId('voiceover-narration-text').textContent).toMatch(/This is fine/);
  });

  it('uses explicit segments when provided', () => {
    renderAt(
      30,
      {
        segments: [
          { text: 'First.', startMs: 0, endMs: 1000 },
          { text: 'Second.', startMs: 1000, endMs: 2000 },
        ],
      },
      60,
    );
    // frame=30 at fps=30 → 1000ms; the first segment ends at 1000 (exclusive),
    // so the active segment is Second.
    expect(screen.getByTestId('voiceover-narration-text').textContent).toBe('Second.');
  });

  it('renders the speaker name and avatar initial', () => {
    renderAt(0, { text: 'Hi.', speaker: 'Ada' });
    expect(screen.getByTestId('voiceover-narration-speaker').textContent).toBe('Ada');
    expect(screen.getByTestId('voiceover-narration-avatar').textContent).toBe('A');
  });

  it('renders an optional title', () => {
    renderAt(0, { text: 'Hi.', title: 'Chapter 1' });
    expect(screen.getByTestId('voiceover-narration-title').textContent).toBe('Chapter 1');
  });

  it('hides the waveform when showWaveform is false', () => {
    renderAt(0, { text: 'Hi.', showWaveform: false });
    expect(screen.queryByTestId('voiceover-narration-waveform')).toBeNull();
  });

  it('renders a waveform strip by default (40 bars)', () => {
    const { container } = renderAt(0, { text: 'Hi.' });
    const bars = container.querySelectorAll('[data-testid="voiceover-narration-waveform"] > div');
    expect(bars.length).toBe(40);
  });

  it('snaps progress to 100% when the playhead is past the last segment end', () => {
    // Explicit short segments ending at 500ms; composition duration much
    // larger so frame=180 is well past the last segment's endMs.
    renderAt(
      180,
      {
        segments: [
          { text: 'First.', startMs: 0, endMs: 250 },
          { text: 'Second.', startMs: 250, endMs: 500 },
        ],
      },
      300,
    );
    const progress = screen.getByTestId('voiceover-narration-progress-fill') as HTMLElement;
    expect(Number.parseFloat(progress.style.width)).toBe(100);
  });

  it('progress bar width grows as composition advances', () => {
    renderAt(0, { text: 'First. Second.' }, 60);
    const progress0 = screen.getByTestId('voiceover-narration-progress-fill') as HTMLElement;
    const w0 = Number.parseFloat(progress0.style.width);
    cleanup();
    renderAt(50, { text: 'First. Second.' }, 60);
    const progress1 = screen.getByTestId('voiceover-narration-progress-fill') as HTMLElement;
    const w1 = Number.parseFloat(progress1.style.width);
    expect(w1).toBeGreaterThan(w0);
  });

  it('mounts an <audio> element when audioUrl is provided', () => {
    const { container } = renderAt(0, { text: 'Hi.', audioUrl: '/narration.mp3' });
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe('/narration.mp3');
  });

  it('omits the <audio> element when audioUrl is absent', () => {
    const { container } = renderAt(0, { text: 'Hi.' });
    expect(container.querySelector('audio')).toBeNull();
  });
});

describe('voiceoverNarrationClip definition (T-131e.2)', () => {
  it("registers under kind 'voiceover-narration' with a propsSchema", () => {
    expect(voiceoverNarrationClip.kind).toBe('voiceover-narration');
    expect(voiceoverNarrationClip.propsSchema).toBe(voiceoverNarrationPropsSchema);
  });

  it('declares themeSlots binding background + text/accent slots', () => {
    expect(voiceoverNarrationClip.themeSlots).toEqual({
      background: { kind: 'palette', role: 'background' },
      textColor: { kind: 'palette', role: 'foreground' },
      color: { kind: 'palette', role: 'primary' },
    });
  });

  it('font requirements declare Plus Jakarta Sans 600 + 700', () => {
    const fonts = voiceoverNarrationClip.fontRequirements?.({}) ?? [];
    expect(fonts).toContainEqual({ family: 'Plus Jakarta Sans', weight: 600 });
    expect(fonts).toContainEqual({ family: 'Plus Jakarta Sans', weight: 700 });
  });

  it('propsSchema accepts an empty-props payload (all fields optional)', () => {
    expect(voiceoverNarrationPropsSchema.safeParse({}).success).toBe(true);
  });

  it('propsSchema rejects unknown props (strict mode)', () => {
    expect(voiceoverNarrationPropsSchema.safeParse({ bogus: true }).success).toBe(false);
  });

  it('propsSchema validates segment shape (startMs <= endMs is NOT enforced, just types)', () => {
    expect(
      voiceoverNarrationPropsSchema.safeParse({
        segments: [{ text: 'hi', startMs: 0, endMs: 100 }],
      }).success,
    ).toBe(true);
    expect(
      voiceoverNarrationPropsSchema.safeParse({
        segments: [{ text: 'hi', startMs: '0', endMs: 100 }],
      }).success,
    ).toBe(false);
  });

  it('integrates with resolveClipDefaultsForTheme — palette swap re-flows background + text + accent', () => {
    const theme: Theme = {
      palette: { background: '#080f15', foreground: '#ebf1fa', primary: '#0072e5' },
      tokens: {},
    };
    const out = resolveClipDefaultsForTheme(
      voiceoverNarrationClip as unknown as Parameters<
        typeof resolveClipDefaultsForTheme<VoiceoverNarrationProps>
      >[0],
      theme,
      {} as VoiceoverNarrationProps,
    );
    expect(out.background).toBe('#080f15');
    expect(out.textColor).toBe('#ebf1fa');
    expect(out.color).toBe('#0072e5');
  });
});
