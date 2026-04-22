// packages/runtimes/frame-runtime-bridge/src/clips/scene-3d.test.tsx
// T-131d — scene3dClip behaviour + propsSchema + themeSlots.

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Scene3D, type Scene3DProps, scene3dClip, scene3dPropsSchema } from './scene-3d.js';

afterEach(cleanup);

function renderAt(frame: number, props: Scene3DProps = {}, durationInFrames = 60) {
  return render(
    <FrameProvider frame={frame} config={{ width: 640, height: 360, fps: 30, durationInFrames }}>
      <Scene3D {...props} />
    </FrameProvider>,
  );
}

describe('Scene3D component (T-131d)', () => {
  it('defaults to the cube shape', () => {
    renderAt(60, {});
    expect(screen.getByTestId('scene-3d-cube')).toBeDefined();
    expect(screen.queryByTestId('scene-3d-pyramid')).toBeNull();
  });

  it('renders pyramid when shape="pyramid"', () => {
    renderAt(60, { shape: 'pyramid' });
    expect(screen.getByTestId('scene-3d-pyramid')).toBeDefined();
  });

  it('renders sphere when shape="sphere"', () => {
    renderAt(60, { shape: 'sphere' });
    expect(screen.getByTestId('scene-3d-sphere')).toBeDefined();
  });

  it('renders torus when shape="torus" with 12 ring segments', () => {
    const { container } = renderAt(60, { shape: 'torus' });
    const torus = screen.getByTestId('scene-3d-torus');
    expect(torus).toBeDefined();
    // 12 ring divs + the wrapper itself.
    expect(torus.querySelectorAll('div').length).toBe(12);
    // Ensure container is also assigned.
    expect(container.querySelector('[data-testid="scene-3d-clip"]')).not.toBeNull();
  });

  it('opacity ramps from 0 at frame=0 to 1 by frame=20', () => {
    const { unmount } = renderAt(0, {});
    const root0 = screen.getByTestId('scene-3d-clip') as HTMLElement;
    expect(Number(root0.style.opacity)).toBe(0);
    unmount();
    renderAt(20, {});
    const root20 = screen.getByTestId('scene-3d-clip') as HTMLElement;
    expect(Number(root20.style.opacity)).toBe(1);
  });

  it('Y rotation grows linearly with time at the configured rotationSpeed', () => {
    // rotationSpeed=45deg/sec, fps=30 → 1.5deg/frame on Y.
    // At frame=60 (2 sec) → 90 degrees on Y.
    renderAt(60, { shape: 'cube', rotationSpeed: 45 });
    const cube = screen.getByTestId('scene-3d-cube') as HTMLElement;
    expect(cube.style.transform).toContain('rotateY(90deg)');
  });

  it('renders the optional title when supplied', () => {
    renderAt(60, { title: '3D!' });
    expect(screen.getByTestId('scene-3d-title').textContent).toBe('3D!');
  });
});

describe('scene3dClip definition (T-131d)', () => {
  it("registers under kind 'scene-3d' with three themeSlots", () => {
    expect(scene3dClip.kind).toBe('scene-3d');
    expect(scene3dClip.propsSchema).toBe(scene3dPropsSchema);
    expect(scene3dClip.themeSlots).toEqual({
      color: { kind: 'palette', role: 'primary' },
      background: { kind: 'palette', role: 'background' },
      titleColor: { kind: 'palette', role: 'foreground' },
    });
  });

  it('propsSchema rejects unknown shape values', () => {
    expect(scene3dPropsSchema.safeParse({ shape: 'octahedron' }).success).toBe(false);
    expect(scene3dPropsSchema.safeParse({ shape: 'cube' }).success).toBe(true);
  });
});
