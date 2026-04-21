// packages/runtimes/lottie/src/index.test.tsx
// Unit tests for the lottie runtime. A fake LottiePlayer lets tests assert
// lifecycle and seek behaviour without spinning up the real lottie-web
// renderer.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub lottie-web at the module boundary — happy-dom's canvas support is
// incomplete, and loading the real lottie build at import time throws.
// Every test injects its own LottiePlayer via `lottieFactory`, so the
// default import is never actually exercised.
vi.mock('lottie-web', () => ({ default: {} }));

import {
  type ClipRenderContext,
  __clearRuntimeRegistry,
  findClip,
  registerRuntime,
} from '@stageflip/runtimes-contract';

import {
  type LottieAnimationItem,
  type LottiePlayer,
  createLottieRuntime,
  defineLottieClip,
} from './index.js';

afterEach(() => {
  cleanup();
  __clearRuntimeRegistry();
});

interface FakeAnim extends LottieAnimationItem {
  _calls: { goToAndStop: Array<[number, boolean]>; destroy: number };
}

function makeFakePlayer(): LottiePlayer & { _anim: FakeAnim } {
  const anim: Partial<LottieAnimationItem> & {
    _calls: FakeAnim['_calls'];
  } = {
    _calls: { goToAndStop: [], destroy: 0 },
    goToAndStop: vi.fn((v: number, isFrame?: boolean) => {
      (anim._calls.goToAndStop as Array<[number, boolean]>).push([v, isFrame ?? false]);
    }),
    destroy: vi.fn(() => {
      anim._calls.destroy += 1;
    }),
  };
  const player: LottiePlayer & { _anim: FakeAnim } = {
    loadAnimation: vi.fn(() => anim as unknown as LottieAnimationItem),
    _anim: anim as FakeAnim,
  };
  return player;
}

function makeCtx(overrides: Partial<ClipRenderContext<unknown>> = {}): ClipRenderContext<unknown> {
  return {
    frame: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    clipFrom: 0,
    clipDurationInFrames: 60,
    props: {},
    ...overrides,
  };
}

describe('createLottieRuntime — runtime shape', () => {
  it("produces a ClipRuntime with id 'lottie' and tier 'live'", () => {
    const rt = createLottieRuntime();
    expect(rt.id).toBe('lottie');
    expect(rt.tier).toBe('live');
    expect(rt.clips.size).toBe(0);
  });

  it('accepts clips at construction time', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'probe',
      animationData: { v: '5.7.0', fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [] },
      lottieFactory: () => fakePlayer,
    });
    const rt = createLottieRuntime([clip]);
    expect(rt.clips.get('probe')).toBe(clip);
  });

  it('throws on duplicate kind', () => {
    const fakePlayer = makeFakePlayer();
    const a = defineLottieClip({
      kind: 'dup',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });
    const b = defineLottieClip({
      kind: 'dup',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });
    expect(() => createLottieRuntime([a, b])).toThrow(/duplicate/);
  });
});

describe('defineLottieClip — window gating', () => {
  it('returns null before the clip window', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'gated',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });
    const el = clip.render(makeCtx({ frame: 4, clipFrom: 5 }));
    expect(el).toBeNull();
  });

  it('returns null at the exclusive end of the clip window', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'gated',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });
    const el = clip.render(makeCtx({ frame: 10, clipFrom: 5, clipDurationInFrames: 5 }));
    expect(el).toBeNull();
  });

  it('renders at inclusive start and last frame', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'gated',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });
    expect(clip.render(makeCtx({ frame: 5, clipFrom: 5 }))).not.toBeNull();
    expect(clip.render(makeCtx({ frame: 9, clipFrom: 5, clipDurationInFrames: 5 }))).not.toBeNull();
  });
});

describe('defineLottieClip — lottie lifecycle', () => {
  it('loads the animation with autoplay:false on mount and seeks on every frame', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'lifecycle',
      animationData: { v: '5.7.0' },
      lottieFactory: () => fakePlayer,
    });

    const el = clip.render(makeCtx({ frame: 0, fps: 30 }));
    const { rerender, unmount } = render(el as React.ReactElement);

    // loadAnimation called once with the right shape.
    expect(fakePlayer.loadAnimation).toHaveBeenCalledTimes(1);
    const params = (fakePlayer.loadAnimation as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(params.autoplay).toBe(false);
    expect(params.loop).toBe(false);
    expect(params.renderer).toBe('svg');
    expect(params.animationData).toEqual({ v: '5.7.0' });

    // First render triggered the seek-on-mount effect.
    expect(fakePlayer._anim._calls.goToAndStop.length).toBeGreaterThanOrEqual(1);

    // Rerender with a new frame → another seek.
    const el2 = clip.render(makeCtx({ frame: 15, fps: 30 }));
    rerender(el2 as React.ReactElement);
    const seeks = fakePlayer._anim._calls.goToAndStop;
    const lastSeek = seeks[seeks.length - 1];
    expect(lastSeek?.[1]).toBe(false); // ms-based, not frame-based
    expect(lastSeek?.[0]).toBeCloseTo(500, 6); // 15 / 30 = 0.5s = 500ms

    // Unmount → destroy.
    unmount();
    expect(fakePlayer._anim._calls.destroy).toBe(1);
  });

  it('converts frame + fps to milliseconds (fps-independent seek)', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'seek-ms',
      animationData: {},
      lottieFactory: () => fakePlayer,
    });

    // frame=30 at fps=60 → 500ms
    const el = clip.render(makeCtx({ frame: 30, fps: 60 }));
    render(el as React.ReactElement);

    const last = fakePlayer._anim._calls.goToAndStop.at(-1);
    expect(last?.[0]).toBeCloseTo(500, 6);
    expect(last?.[1]).toBe(false);
  });
});

describe('defineLottieClip — resolve player lazily', () => {
  it('does not call lottieFactory until first render', () => {
    const factory = vi.fn(makeFakePlayer);
    const clip = defineLottieClip({
      kind: 'lazy',
      animationData: {},
      lottieFactory: factory,
    });
    expect(factory).not.toHaveBeenCalled();

    clip.render(makeCtx({ frame: 0 }));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('caches the resolved player across renders', () => {
    const factory = vi.fn(makeFakePlayer);
    const clip = defineLottieClip({
      kind: 'lazy-cached',
      animationData: {},
      lottieFactory: factory,
    });
    clip.render(makeCtx({ frame: 0 }));
    clip.render(makeCtx({ frame: 1 }));
    clip.render(makeCtx({ frame: 2 }));
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('defineLottieClip — fontRequirements', () => {
  it('forwards user-declared fontRequirements', () => {
    const clip = defineLottieClip({
      kind: 'font-probe',
      animationData: {},
      fontRequirements: () => [{ family: 'Inter' }],
      lottieFactory: makeFakePlayer,
    });
    expect(clip.fontRequirements?.({})).toEqual([{ family: 'Inter' }]);
  });

  it('omits fontRequirements when not declared', () => {
    const clip = defineLottieClip({
      kind: 'no-fonts',
      animationData: {},
      lottieFactory: makeFakePlayer,
    });
    expect(clip.fontRequirements).toBeUndefined();
  });
});

describe('lottie runtime — contract-registry round-trip', () => {
  it('registers cleanly and findClip resolves its demo kind', () => {
    const fakePlayer = makeFakePlayer();
    const clip = defineLottieClip({
      kind: 'lottie-logo',
      animationData: { v: '5.7.0', fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [] },
      lottieFactory: () => fakePlayer,
    });
    const rt = createLottieRuntime([clip]);
    registerRuntime(rt);
    const found = findClip('lottie-logo');
    expect(found?.runtime).toBe(rt);
    expect(found?.clip).toBe(clip);
  });
});
