// packages/runtimes/frame-runtime-bridge/src/clips/beat-synced-text.test.tsx
// T-183b — BeatSyncedText clip behaviour + currentBeatIndex + propsSchema.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BeatSyncedText,
  type BeatSyncedTextProps,
  beatSyncedTextClip,
  beatSyncedTextPropsSchema,
  currentBeatIndex,
} from './beat-synced-text.js';

afterEach(cleanup);

function renderAt(
  frame: number,
  props: BeatSyncedTextProps,
  durationInFrames = 120,
): ReturnType<typeof render> {
  return render(
    <FrameProvider frame={frame} config={{ width: 1920, height: 1080, fps: 30, durationInFrames }}>
      <BeatSyncedText {...props} />
    </FrameProvider>,
  );
}

const sample: BeatSyncedTextProps = {
  phrases: ['go', 'set', 'hit', 'win'],
  beatFrames: [0, 15, 30, 45, 60, 75],
};

describe('currentBeatIndex', () => {
  it('returns -1 when no beat has happened yet', () => {
    expect(currentBeatIndex(5, [10, 20, 30])).toBe(-1);
  });

  it('returns the most recent beat at or before the frame', () => {
    const beats = [0, 10, 20, 30];
    expect(currentBeatIndex(0, beats)).toBe(0);
    expect(currentBeatIndex(14, beats)).toBe(1);
    expect(currentBeatIndex(25, beats)).toBe(2);
    expect(currentBeatIndex(100, beats)).toBe(3);
  });

  it('returns -1 for an empty list', () => {
    expect(currentBeatIndex(10, [])).toBe(-1);
  });
});

describe('<BeatSyncedText>', () => {
  it('renders the first phrase at frame 0', () => {
    renderAt(0, sample);
    expect(screen.getByTestId('beat-synced-text-phrase').textContent).toBe('go');
    expect(screen.getByTestId('beat-synced-text-clip').getAttribute('data-beat-index')).toBe('0');
  });

  it('cycles phrases modulo length across beats', () => {
    renderAt(15, sample);
    expect(screen.getByTestId('beat-synced-text-phrase').textContent).toBe('set');
    cleanup();
    renderAt(60, sample);
    // index 4 → phrases[4 % 4] === phrases[0] === 'go'
    expect(screen.getByTestId('beat-synced-text-phrase').textContent).toBe('go');
  });

  it('pulses scale > 1 at beat frame, decays to scale 1 after pulseDecayFrames', () => {
    renderAt(0, sample);
    const peak = screen.getByTestId('beat-synced-text-phrase') as HTMLElement;
    expect(peak.style.transform).toBe('scale(1.08)');
    cleanup();
    renderAt(8, { ...sample, pulseDecayFrames: 8 });
    const decayed = screen.getByTestId('beat-synced-text-phrase') as HTMLElement;
    expect(decayed.style.transform).toBe('scale(1)');
  });

  it('inserts an implicit beat at 0 when the first beat is > 0', () => {
    const props: BeatSyncedTextProps = {
      phrases: ['start', 'next'],
      beatFrames: [30, 60],
    };
    renderAt(10, props);
    // Implicit beat at 0 → phrase[0] 'start', beat-index 0
    expect(screen.getByTestId('beat-synced-text-phrase').textContent).toBe('start');
  });
});

describe('beatSyncedTextClip definition', () => {
  it('registers under kind "beat-synced-text" with theme slots', () => {
    expect(beatSyncedTextClip.kind).toBe('beat-synced-text');
    expect(beatSyncedTextClip.propsSchema).toBe(beatSyncedTextPropsSchema);
    expect(beatSyncedTextClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'foreground' },
      pulseColor: { kind: 'palette', role: 'accent' },
      background: { kind: 'palette', role: 'background' },
    });
  });

  it('propsSchema requires phrases + beatFrames with at least one entry', () => {
    expect(beatSyncedTextPropsSchema.safeParse({}).success).toBe(false);
    expect(beatSyncedTextPropsSchema.safeParse({ phrases: [], beatFrames: [0] }).success).toBe(
      false,
    );
    expect(beatSyncedTextPropsSchema.safeParse({ phrases: ['x'], beatFrames: [] }).success).toBe(
      false,
    );
    expect(beatSyncedTextPropsSchema.safeParse({ phrases: ['x'], beatFrames: [0] }).success).toBe(
      true,
    );
  });

  it('propsSchema rejects negative beat frames', () => {
    expect(beatSyncedTextPropsSchema.safeParse({ phrases: ['x'], beatFrames: [-1] }).success).toBe(
      false,
    );
  });
});
