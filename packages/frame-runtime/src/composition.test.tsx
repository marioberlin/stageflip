// packages/frame-runtime/src/composition.test.tsx
// Unit tests for <Composition>, registerComposition, renderFrame.

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  Composition,
  __clearCompositionRegistry,
  getComposition,
  listCompositions,
  registerComposition,
  renderFrame,
  unregisterComposition,
} from './composition.js';
import { useCurrentFrame, useVideoConfig } from './frame-context.js';

beforeEach(() => {
  __clearCompositionRegistry();
});

afterEach(() => {
  cleanup();
  __clearCompositionRegistry();
});

interface Props {
  label: string;
}

function Scene({ label }: Props): React.ReactNode {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  return (
    <span data-testid="scene">{`${label}@${frame}:${cfg.width}x${cfg.height}@${cfg.fps}`}</span>
  );
}

describe('registerComposition / getComposition / listCompositions', () => {
  it('round-trips a registered composition', () => {
    registerComposition({
      id: 'intro',
      component: Scene,
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      defaultProps: { label: 'hello' },
    });
    const def = getComposition('intro');
    expect(def).toBeDefined();
    expect(def?.id).toBe('intro');
    expect(def?.width).toBe(1920);
    expect(def?.defaultProps).toEqual({ label: 'hello' });
  });

  it('lists all registered compositions', () => {
    registerComposition({
      id: 'a',
      component: Scene,
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    registerComposition({
      id: 'b',
      component: Scene,
      width: 200,
      height: 200,
      fps: 30,
      durationInFrames: 60,
    });
    const ids = listCompositions().map((c) => c.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });

  it('unregisterComposition removes the definition', () => {
    registerComposition({
      id: 'gone',
      component: Scene,
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    unregisterComposition('gone');
    expect(getComposition('gone')).toBeUndefined();
  });

  it('duplicate id on register throws', () => {
    registerComposition({
      id: 'dup',
      component: Scene,
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    expect(() =>
      registerComposition({
        id: 'dup',
        component: Scene,
        width: 100,
        height: 100,
        fps: 30,
        durationInFrames: 60,
      }),
    ).toThrow(/already registered/);
  });
});

describe('<Composition> JSX registers during render', () => {
  it('registers the composition when mounted', () => {
    expect(getComposition('jsx-id')).toBeUndefined();
    render(
      <Composition
        id="jsx-id"
        component={Scene}
        width={640}
        height={480}
        fps={24}
        durationInFrames={120}
        defaultProps={{ label: 'jsx' }}
      />,
    );
    const def = getComposition('jsx-id');
    expect(def?.id).toBe('jsx-id');
    expect(def?.width).toBe(640);
    expect(def?.durationInFrames).toBe(120);
  });

  it('renders null (does not render the component inline)', () => {
    const { container } = render(
      <Composition
        id="no-inline"
        component={Scene}
        width={100}
        height={100}
        fps={30}
        durationInFrames={60}
      />,
    );
    expect(container.querySelector('[data-testid="scene"]')).toBeNull();
  });
});

describe('renderFrame — mounts the composition with provided props at a frame', () => {
  it('renders the registered component inside a FrameProvider', () => {
    registerComposition({
      id: 'scene-1',
      component: Scene,
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      defaultProps: { label: 'default' },
    });
    const { getByTestId } = render(renderFrame('scene-1', 42));
    expect(getByTestId('scene').textContent).toBe('default@42:1920x1080@30');
  });

  it('merges props over defaultProps', () => {
    registerComposition({
      id: 'scene-2',
      component: Scene,
      width: 640,
      height: 480,
      fps: 24,
      durationInFrames: 120,
      defaultProps: { label: 'default' },
    });
    const { getByTestId } = render(renderFrame('scene-2', 0, { label: 'override' }));
    expect(getByTestId('scene').textContent).toBe('override@0:640x480@24');
  });

  it('accepts props without defaultProps', () => {
    registerComposition<Props>({
      id: 'scene-3',
      component: Scene,
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
    });
    const { getByTestId } = render(renderFrame('scene-3', 5, { label: 'only-props' }));
    expect(getByTestId('scene').textContent).toBe('only-props@5:100x100@30');
  });
});

describe('renderFrame — validation', () => {
  beforeEach(() => {
    registerComposition({
      id: 'valid',
      component: Scene,
      width: 100,
      height: 100,
      fps: 30,
      durationInFrames: 60,
      defaultProps: { label: 'x' },
    });
  });

  it('throws on unknown id', () => {
    expect(() => renderFrame('nope', 0)).toThrow(/not registered/);
  });

  it('throws on negative frame', () => {
    expect(() => renderFrame('valid', -1)).toThrow(/frame.*non-negative/);
  });

  it('throws on non-integer frame', () => {
    expect(() => renderFrame('valid', 1.5)).toThrow(/frame.*integer/);
  });

  it('throws when frame >= durationInFrames', () => {
    expect(() => renderFrame('valid', 60)).toThrow(/out of range/);
  });

  it('accepts frame === durationInFrames - 1 (inclusive end)', () => {
    const { getByTestId } = render(renderFrame('valid', 59));
    expect(getByTestId('scene').textContent).toBe('x@59:100x100@30');
  });
});

describe('registerComposition — validation', () => {
  it('throws on empty id', () => {
    expect(() =>
      registerComposition({
        id: '',
        component: Scene,
        width: 100,
        height: 100,
        fps: 30,
        durationInFrames: 60,
      }),
    ).toThrow(/id.*non-empty/);
  });

  it('throws on non-positive width', () => {
    expect(() =>
      registerComposition({
        id: 'x',
        component: Scene,
        width: 0,
        height: 100,
        fps: 30,
        durationInFrames: 60,
      }),
    ).toThrow(/width.*positive/);
  });

  it('throws on non-integer fps', () => {
    expect(() =>
      registerComposition({
        id: 'x',
        component: Scene,
        width: 100,
        height: 100,
        fps: 29.97,
        durationInFrames: 60,
      }),
    ).toThrow(/fps.*integer/);
  });

  it('throws on non-positive durationInFrames', () => {
    expect(() =>
      registerComposition({
        id: 'x',
        component: Scene,
        width: 100,
        height: 100,
        fps: 30,
        durationInFrames: 0,
      }),
    ).toThrow(/durationInFrames.*positive/);
  });
});
