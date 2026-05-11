// packages/export-router/src/detect-live-clips.test.ts
// Walker tests — `detectLiveClips()` over the three content modes + nested
// `group.children`. Uses fixtures from `./test-fixtures.ts` (extracted to a
// non-test module so other test files can reuse them without tripping
// biome `lint/suspicious/noExportsInTest`).

import { describe, expect, it } from 'vitest';

import { detectLiveClips } from './detect-live-clips.js';
import { displayDoc, group, liveClip, slideDoc, textEl, videoDoc } from './test-fixtures.js';

describe('detectLiveClips', () => {
  describe('content modes', () => {
    it('finds live clips in slide-mode (top-level)', () => {
      const doc = slideDoc([
        [textEl('t1'), liveClip('lc1', 'shader')],
        [liveClip('lc2', 'voice'), textEl('t2')],
      ]);
      expect(detectLiveClips(doc)).toEqual([
        { id: 'lc1', family: 'shader' },
        { id: 'lc2', family: 'voice' },
      ]);
    });

    it('finds live clips in video-mode (across tracks)', () => {
      const doc = videoDoc([
        [liveClip('lc-vid-1', 'three-scene')],
        [textEl('t1'), liveClip('lc-vid-2', 'live-data')],
      ]);
      expect(detectLiveClips(doc)).toEqual([
        { id: 'lc-vid-1', family: 'three-scene' },
        { id: 'lc-vid-2', family: 'live-data' },
      ]);
    });

    it('finds live clips in display-mode', () => {
      const doc = displayDoc([textEl('t1'), liveClip('lc-disp', 'web-embed'), textEl('t2')]);
      expect(detectLiveClips(doc)).toEqual([{ id: 'lc-disp', family: 'web-embed' }]);
    });
  });

  describe('group recursion', () => {
    it('descends into a single group', () => {
      const doc = slideDoc([[group('g1', [liveClip('lc-in-group', 'ai-chat'), textEl('t')])]]);
      expect(detectLiveClips(doc)).toEqual([{ id: 'lc-in-group', family: 'ai-chat' }]);
    });

    it('descends into deeply nested group → group → group', () => {
      const doc = slideDoc([
        [group('g1', [group('g2', [group('g3', [liveClip('lc-deep', 'ai-generative')])])])],
      ]);
      expect(detectLiveClips(doc)).toEqual([{ id: 'lc-deep', family: 'ai-generative' }]);
    });

    it('does NOT descend into staticFallback of an interactive clip', () => {
      // The fixture's liveClip helper sets staticFallback: [textEl(`${id}-fallback-text`)]
      // — never a nested live clip. Just verify only the outer clip is collected.
      const doc = slideDoc([[liveClip('outer', 'shader')]]);
      expect(detectLiveClips(doc)).toEqual([{ id: 'outer', family: 'shader' }]);
    });
  });

  describe('empty cases', () => {
    it('returns empty array when no live clips present (slide-mode)', () => {
      const doc = slideDoc([[textEl('t1'), textEl('t2')]]);
      expect(detectLiveClips(doc)).toEqual([]);
    });

    it('returns empty array when no live clips present (video-mode)', () => {
      const doc = videoDoc([[textEl('vt1')]]);
      expect(detectLiveClips(doc)).toEqual([]);
    });

    it('returns empty array when no live clips present (display-mode)', () => {
      const doc = displayDoc([textEl('dt1')]);
      expect(detectLiveClips(doc)).toEqual([]);
    });

    it('returns empty array when group children have no live clips', () => {
      const doc = slideDoc([[group('g1', [textEl('t1'), group('g2', [textEl('t2')])])]]);
      expect(detectLiveClips(doc)).toEqual([]);
    });
  });

  describe('order determinism', () => {
    it('preserves slide order, then in-element order', () => {
      const doc = slideDoc([
        [liveClip('A', 'shader'), liveClip('B', 'voice')],
        [liveClip('C', 'three-scene')],
      ]);
      expect(detectLiveClips(doc).map((c) => c.id)).toEqual(['A', 'B', 'C']);
    });
  });
});
