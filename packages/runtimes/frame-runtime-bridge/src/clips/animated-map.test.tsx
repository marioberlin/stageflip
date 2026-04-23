// packages/runtimes/frame-runtime-bridge/src/clips/animated-map.test.tsx
// T-131d.4 — animatedMapClip (SVG fallback port) behaviour + propsSchema +
// themeSlots. Real-tile mode is intentionally absent (see clip file header).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AnimatedMap,
  type AnimatedMapProps,
  animatedMapClip,
  animatedMapPropsSchema,
} from './animated-map.js';

afterEach(cleanup);

function renderAt(frame: number, props: AnimatedMapProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <AnimatedMap {...props} />
    </FrameProvider>,
  );
}

describe('AnimatedMap component (T-131d.4)', () => {
  it('renders the clip root with the route line and the start-dot', () => {
    renderAt(30);
    expect(screen.getByTestId('animated-map-clip')).toBeDefined();
    expect(screen.getByTestId('animated-map-route')).toBeDefined();
  });

  it('animates the route line: x2 equals the start at frame=0 and sweeps forward past mid-duration', () => {
    const { unmount } = renderAt(0);
    const route0 = screen.getByTestId('animated-map-route');
    expect(Number(route0.getAttribute('x2'))).toBe(300); // ROUTE_START.x
    unmount();
    renderAt(45, {}, 60);
    const routeLate = screen.getByTestId('animated-map-route');
    expect(Number(routeLate.getAttribute('x2'))).toBeGreaterThan(300);
  });

  it('omits the red end-dot until routeProgress > 0.9 and shows it late in the clip', () => {
    const { unmount } = renderAt(0);
    expect(screen.queryByTestId('animated-map-end-dot')).toBeNull();
    unmount();
    renderAt(59, {}, 60);
    expect(screen.getByTestId('animated-map-end-dot')).toBeDefined();
  });

  it('renders the title when supplied and omits it when empty', () => {
    const { unmount } = renderAt(30, { title: 'Paris → NYC' });
    expect(screen.getByTestId('animated-map-title').textContent).toBe('Paris → NYC');
    unmount();
    renderAt(30, { title: '' });
    expect(screen.queryByTestId('animated-map-title')).toBeNull();
  });

  it('interpolates center lat/lng linearly with eased progress; coords text updates across frames', () => {
    const { unmount } = renderAt(0, {
      startCenter: [0, 0],
      endCenter: [10, 20],
      title: '',
    });
    const coords0 = screen.getByTestId('animated-map-coords').textContent ?? '';
    expect(coords0).toContain('0.0000, 0.0000');
    unmount();
    renderAt(59, { startCenter: [0, 0], endCenter: [10, 20], title: '' });
    const coordsEnd = screen.getByTestId('animated-map-coords').textContent ?? '';
    // progress clamps at 1.0 at frame >= durationInFrames * 0.7 → coords land on end.
    expect(coordsEnd).toContain('10.0000, 20.0000');
  });

  it('applies explicit palette overrides (themeSlot targets) on top of the style defaults', () => {
    renderAt(30, {
      style: 'dark',
      backgroundColor: '#123456',
      accentColor: '#abcdef',
      textColor: '#ffffff',
      title: 'T',
    });
    const root = screen.getByTestId('animated-map-clip');
    expect(root.style.backgroundColor).toBe('#123456');
    const title = screen.getByTestId('animated-map-title');
    expect(title.style.color).toBe('#ffffff');
    const route = screen.getByTestId('animated-map-route');
    expect(route.getAttribute('stroke')).toBe('#abcdef');
  });
});

describe('animatedMapClip definition (T-131d.4)', () => {
  it("registers under kind 'animated-map' with three themeSlots", () => {
    expect(animatedMapClip.kind).toBe('animated-map');
    expect(animatedMapClip.propsSchema).toBe(animatedMapPropsSchema);
    expect(animatedMapClip.themeSlots).toEqual({
      backgroundColor: { kind: 'palette', role: 'background' },
      accentColor: { kind: 'palette', role: 'primary' },
      textColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects unknown style values and accepts the three documented ones', () => {
    expect(animatedMapPropsSchema.safeParse({ style: 'dark' }).success).toBe(true);
    expect(animatedMapPropsSchema.safeParse({ style: 'light' }).success).toBe(true);
    expect(animatedMapPropsSchema.safeParse({ style: 'satellite' }).success).toBe(true);
    expect(animatedMapPropsSchema.safeParse({ style: 'terrain' }).success).toBe(false);
  });

  it('propsSchema rejects non-tuple center coordinates', () => {
    expect(animatedMapPropsSchema.safeParse({ startCenter: [1] }).success).toBe(false);
    expect(animatedMapPropsSchema.safeParse({ startCenter: [1, 2, 3] }).success).toBe(false);
    expect(animatedMapPropsSchema.safeParse({ startCenter: [1, 2] }).success).toBe(true);
  });

  it('propsSchema rejects zero / negative zoom', () => {
    expect(animatedMapPropsSchema.safeParse({ startZoom: 0 }).success).toBe(false);
    expect(animatedMapPropsSchema.safeParse({ startZoom: -1 }).success).toBe(false);
    expect(animatedMapPropsSchema.safeParse({ startZoom: 4 }).success).toBe(true);
  });

  it('propsSchema rejects a mapboxToken prop — real-tile mode is intentionally not wired', () => {
    expect(animatedMapPropsSchema.safeParse({ mapboxToken: 'pk.test' } as unknown).success).toBe(
      false,
    );
  });
});
