// packages/import-hyperframes-html/src/tracks/classify.test.ts
// AC #9 — pin every branch of the track-kind heuristic.

import { describe, expect, it } from 'vitest';
import { classifyTrackKind } from './classify.js';

describe('classifyTrackKind', () => {
  it('main + index 0 => visual', () => {
    expect(
      classifyTrackKind({
        compositionId: 'main-orchestration',
        trackIndex: 0,
        audioOnly: false,
      }),
    ).toBe('visual');
  });

  it('captions => caption', () => {
    expect(classifyTrackKind({ compositionId: 'captions', trackIndex: 2, audioOnly: false })).toBe(
      'caption',
    );
    expect(classifyTrackKind({ compositionId: 'subtitles', trackIndex: 3, audioOnly: false })).toBe(
      'caption',
    );
  });

  it('audio-only composition => audio', () => {
    expect(classifyTrackKind({ compositionId: 'sfx-pack', trackIndex: 1, audioOnly: true })).toBe(
      'audio',
    );
  });

  it('graphics => overlay', () => {
    expect(classifyTrackKind({ compositionId: 'graphics', trackIndex: 1, audioOnly: false })).toBe(
      'overlay',
    );
  });

  it('main but not at index 0 => overlay', () => {
    expect(
      classifyTrackKind({ compositionId: 'main-orchestration', trackIndex: 2, audioOnly: false }),
    ).toBe('overlay');
  });
});
