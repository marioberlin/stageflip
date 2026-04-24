// packages/editor-shell/src/timeline/tracks.test.ts
// Coverage for the multi-track layout math (T-181): row stacking order,
// per-kind heights, element block placement + composition clipping.

import { describe, expect, it } from 'vitest';

import type { TimelineScale } from './math';
import {
  type ElementBlockInput,
  TRACK_KIND_HEIGHT_PX,
  TRACK_KIND_ORDER,
  type TrackLaneInput,
  placeElementBlock,
  placeTrackElements,
  totalTrackStackHeight,
  trackRowLayout,
} from './tracks';

describe('TRACK_KIND_ORDER', () => {
  it('is the canonical top-to-bottom video track order', () => {
    expect([...TRACK_KIND_ORDER]).toEqual(['visual', 'overlay', 'caption', 'audio']);
  });
});

describe('trackRowLayout', () => {
  it('returns an empty layout when no tracks are supplied', () => {
    expect(trackRowLayout([])).toEqual([]);
  });

  it('orders rows by canonical kind order regardless of input order', () => {
    const tracks: TrackLaneInput[] = [
      { id: 'a1', kind: 'audio' },
      { id: 'c1', kind: 'caption' },
      { id: 'v1', kind: 'visual' },
      { id: 'o1', kind: 'overlay' },
    ];
    const rows = trackRowLayout(tracks);
    expect(rows.map((r) => r.id)).toEqual(['v1', 'o1', 'c1', 'a1']);
    expect(rows.map((r) => r.kind)).toEqual(['visual', 'overlay', 'caption', 'audio']);
  });

  it('stacks multiple tracks of the same kind in input order', () => {
    const tracks: TrackLaneInput[] = [
      { id: 'v2', kind: 'visual' },
      { id: 'v1', kind: 'visual' },
      { id: 'a1', kind: 'audio' },
    ];
    const rows = trackRowLayout(tracks);
    expect(rows.map((r) => r.id)).toEqual(['v2', 'v1', 'a1']);
    expect(rows.map((r) => r.groupIndex)).toEqual([0, 1, 0]);
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('accumulates topPx using per-kind heights', () => {
    const tracks: TrackLaneInput[] = [
      { id: 'v1', kind: 'visual' },
      { id: 'o1', kind: 'overlay' },
      { id: 'c1', kind: 'caption' },
    ];
    const rows = trackRowLayout(tracks);
    expect(rows[0]?.topPx).toBe(0);
    expect(rows[0]?.heightPx).toBe(TRACK_KIND_HEIGHT_PX.visual);
    expect(rows[1]?.topPx).toBe(TRACK_KIND_HEIGHT_PX.visual);
    expect(rows[1]?.heightPx).toBe(TRACK_KIND_HEIGHT_PX.overlay);
    expect(rows[2]?.topPx).toBe(TRACK_KIND_HEIGHT_PX.visual + TRACK_KIND_HEIGHT_PX.overlay);
    expect(rows[2]?.heightPx).toBe(TRACK_KIND_HEIGHT_PX.caption);
  });
});

describe('totalTrackStackHeight', () => {
  it('is 0 for an empty layout', () => {
    expect(totalTrackStackHeight([])).toBe(0);
  });

  it('sums per-kind heights for a full layout', () => {
    const rows = trackRowLayout([
      { id: 'v1', kind: 'visual' },
      { id: 'o1', kind: 'overlay' },
      { id: 'c1', kind: 'caption' },
      { id: 'a1', kind: 'audio' },
    ]);
    const expected =
      TRACK_KIND_HEIGHT_PX.visual +
      TRACK_KIND_HEIGHT_PX.overlay +
      TRACK_KIND_HEIGHT_PX.caption +
      TRACK_KIND_HEIGHT_PX.audio;
    expect(totalTrackStackHeight(rows)).toBe(expected);
  });
});

const scale: TimelineScale = { fps: 30, pxPerSecond: 100 };
const duration = 30 * 10; // 10s at 30fps

describe('placeElementBlock', () => {
  it('places a fully-in-range block', () => {
    const placed = placeElementBlock(
      { elementId: 'e1', startFrame: 30, endFrame: 60 },
      duration,
      scale,
    );
    expect(placed).toMatchObject({
      elementId: 'e1',
      startFrame: 30,
      endFrame: 60,
      leftPx: 100,
      widthPx: 100,
    });
  });

  it('clamps a block that starts before 0', () => {
    const placed = placeElementBlock(
      { elementId: 'e1', startFrame: -30, endFrame: 15 },
      duration,
      scale,
    );
    expect(placed?.startFrame).toBe(0);
    expect(placed?.endFrame).toBe(15);
    expect(placed?.leftPx).toBe(0);
  });

  it('clamps a block that ends past the composition', () => {
    const placed = placeElementBlock(
      { elementId: 'e1', startFrame: 270, endFrame: 600 },
      duration,
      scale,
    );
    expect(placed?.endFrame).toBe(duration);
  });

  it('returns null for a block fully outside the composition', () => {
    expect(
      placeElementBlock({ elementId: 'e1', startFrame: 1000, endFrame: 2000 }, duration, scale),
    ).toBeNull();
  });

  it('returns null for a zero-length block', () => {
    expect(
      placeElementBlock({ elementId: 'e1', startFrame: 30, endFrame: 30 }, duration, scale),
    ).toBeNull();
  });

  it('enforces a minimum 1px width for sub-pixel slivers', () => {
    const tinyScale: TimelineScale = { fps: 30, pxPerSecond: 1 };
    const placed = placeElementBlock(
      { elementId: 'e1', startFrame: 0, endFrame: 1 },
      duration,
      tinyScale,
    );
    expect(placed?.widthPx).toBeGreaterThanOrEqual(1);
  });
});

describe('placeTrackElements', () => {
  it('drops out-of-range blocks while keeping in-range ones', () => {
    const blocks: ElementBlockInput[] = [
      { elementId: 'e1', startFrame: 0, endFrame: 30 },
      { elementId: 'e2', startFrame: 1000, endFrame: 2000 }, // out
      { elementId: 'e3', startFrame: 60, endFrame: 120 },
    ];
    const placed = placeTrackElements(blocks, duration, scale);
    expect(placed.map((p) => p.elementId)).toEqual(['e1', 'e3']);
  });

  it('preserves input order for in-range blocks', () => {
    const blocks: ElementBlockInput[] = [
      { elementId: 'a', startFrame: 0, endFrame: 30 },
      { elementId: 'b', startFrame: 60, endFrame: 90 },
      { elementId: 'c', startFrame: 30, endFrame: 60 },
    ];
    expect(placeTrackElements(blocks, duration, scale).map((p) => p.elementId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
