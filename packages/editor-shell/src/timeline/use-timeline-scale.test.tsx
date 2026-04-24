// packages/editor-shell/src/timeline/use-timeline-scale.test.tsx
// Behavioural pins for useTimelineScale (T-181b).

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTimelineScale } from './use-timeline-scale';

describe('useTimelineScale', () => {
  it('defaults to zoom=1 and 100 px/s', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30 }));
    expect(result.current.zoom).toBe(1);
    expect(result.current.scale).toEqual({ fps: 30, pxPerSecond: 100 });
  });

  it('honours basePxPerSecond', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30, basePxPerSecond: 200 }));
    expect(result.current.scale.pxPerSecond).toBe(200);
  });

  it('setZoom clamps to [minZoom, maxZoom]', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30, minZoom: 0.5, maxZoom: 4 }));
    act(() => result.current.setZoom(100));
    expect(result.current.zoom).toBe(4);
    act(() => result.current.setZoom(0.01));
    expect(result.current.zoom).toBe(0.5);
  });

  it('setZoom ignores non-finite input (NaN, Infinity)', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30 }));
    act(() => result.current.setZoom(Number.NaN));
    expect(result.current.zoom).toBe(1);
    act(() => result.current.setZoom(Number.POSITIVE_INFINITY));
    expect(result.current.zoom).toBe(1);
  });

  it('zoomBy multiplies and clamps', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30, maxZoom: 4 }));
    act(() => result.current.zoomBy(2));
    expect(result.current.zoom).toBe(2);
    act(() => result.current.zoomBy(10));
    expect(result.current.zoom).toBe(4);
  });

  it('zoomBy ignores zero / negative factors', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30 }));
    act(() => result.current.zoomBy(0));
    expect(result.current.zoom).toBe(1);
    act(() => result.current.zoomBy(-2));
    expect(result.current.zoom).toBe(1);
  });

  it('reset returns to zoom=1', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30 }));
    act(() => result.current.setZoom(4));
    act(() => result.current.reset());
    expect(result.current.zoom).toBe(1);
  });

  it('scale.pxPerSecond scales with zoom', () => {
    const { result } = renderHook(() => useTimelineScale({ fps: 30, basePxPerSecond: 100 }));
    act(() => result.current.setZoom(2));
    expect(result.current.scale.pxPerSecond).toBe(200);
    act(() => result.current.setZoom(0.5));
    expect(result.current.scale.pxPerSecond).toBe(50);
  });
});
