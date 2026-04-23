// packages/runtimes/lottie/src/clips/lottie-player.test.tsx
// T-131d.3 — lottiePlayer clip definition + helper coverage.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub lottie-web the same way index.test.tsx does — happy-dom can't run
// the real renderer at import time.
vi.mock('lottie-web', () => ({ default: {} }));

import type { ClipRenderContext } from '@stageflip/runtimes-contract';

import type { LottieAnimationItem, LottiePlayer as LottiePlayerInstance } from '../types.js';

import {
  LottiePlayer,
  computePlaceholderRings,
  lottiePlayer,
  lottiePlayerPropsSchema,
  normaliseAnimationData,
} from './lottie-player.js';

function fakeLottie(): LottiePlayerInstance {
  const anim: Partial<LottieAnimationItem> = {
    goToAndStop: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    loadAnimation: vi.fn(() => anim as LottieAnimationItem),
  };
}

afterEach(cleanup);

describe('lottiePlayerPropsSchema', () => {
  it('accepts an empty-props payload (all fields optional)', () => {
    expect(lottiePlayerPropsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts inline object animationData', () => {
    expect(
      lottiePlayerPropsSchema.safeParse({ animationData: { v: '5.7.0', ip: 0, op: 30 } }).success,
    ).toBe(true);
  });

  it('accepts a JSON-string animationData', () => {
    expect(lottiePlayerPropsSchema.safeParse({ animationData: '{"v":"5.7.0"}' }).success).toBe(
      true,
    );
  });

  it('rejects a non-positive scale', () => {
    expect(lottiePlayerPropsSchema.safeParse({ scale: 0 }).success).toBe(false);
    expect(lottiePlayerPropsSchema.safeParse({ scale: -1 }).success).toBe(false);
  });

  it('rejects unknown props (strict mode)', () => {
    expect(lottiePlayerPropsSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});

describe('normaliseAnimationData', () => {
  it('returns null for undefined / null', () => {
    expect(normaliseAnimationData(undefined)).toBeNull();
  });

  it('parses a JSON string into its object form', () => {
    expect(normaliseAnimationData('{"v":"5.7.0","ip":0,"op":30}')).toEqual({
      v: '5.7.0',
      ip: 0,
      op: 30,
    });
  });

  it('returns an object verbatim', () => {
    const data = { v: '5.7.0', layers: [] };
    expect(normaliseAnimationData(data)).toBe(data);
  });

  it('returns null when the JSON string is malformed', () => {
    expect(normaliseAnimationData('{not json')).toBeNull();
  });
});

describe('computePlaceholderRings', () => {
  it('returns three rings with zero scale + opacity before any delay elapses', () => {
    const rings = computePlaceholderRings(0);
    expect(rings.length).toBe(3);
    expect(rings.map((r) => r.scale)).toEqual([0, 0, 0]);
    expect(rings.map((r) => r.opacity)).toEqual([0, 0, 0]);
  });

  it('ring 0 scales up during frames 0..40', () => {
    const r0 = computePlaceholderRings(20)[0];
    expect(r0?.scale).toBeCloseTo(0.5, 5);
  });

  it('ring scales clamp at 1 past frame = delay + 40', () => {
    const rings = computePlaceholderRings(100);
    expect(rings.map((r) => r.scale)).toEqual([1, 1, 1]);
  });

  it('ring opacity peaks at delay+20 at ~0.5, drops toward 0.15 by delay+40', () => {
    const r0At20 = computePlaceholderRings(20)[0];
    expect(r0At20?.opacity).toBeCloseTo(0.5, 5);
    const r0At40 = computePlaceholderRings(40)[0];
    expect(r0At40?.opacity).toBeCloseTo(0.15, 5);
  });
});

describe('lottiePlayer ClipDefinition', () => {
  function renderAt(frame: number, props: unknown, clipFrom = 0, clipDurationInFrames = 60) {
    const ctx = {
      frame,
      fps: 30,
      clipFrom,
      clipDurationInFrames,
      width: 640,
      height: 360,
      props,
    } as ClipRenderContext<unknown>;
    const el = lottiePlayer.render(ctx);
    return render(el);
  }

  it("registers under kind 'lottie-player' with propsSchema + themeSlots", () => {
    expect(lottiePlayer.kind).toBe('lottie-player');
    expect(lottiePlayer.propsSchema).toBe(lottiePlayerPropsSchema);
    expect(lottiePlayer.themeSlots).toEqual({
      backgroundColor: { kind: 'palette', role: 'background' },
    });
  });

  it('returns null outside the clip window', () => {
    const ctx = {
      frame: 100,
      fps: 30,
      clipFrom: 0,
      clipDurationInFrames: 30,
      width: 640,
      height: 360,
      props: {},
    } as ClipRenderContext<unknown>;
    expect(lottiePlayer.render(ctx)).toBeNull();
  });

  it('renders the placeholder when animationData is absent', () => {
    const { container } = renderAt(15, {});
    expect(container.querySelector('[data-testid="lottie-player-placeholder"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lottie-player"]')).toBeNull();
  });

  it('renders three placeholder rings', () => {
    const { container } = renderAt(30, {});
    expect(container.querySelector('[data-testid="lottie-player-ring-0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lottie-player-ring-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lottie-player-ring-2"]')).not.toBeNull();
  });

  it('renders the Lottie host (not placeholder) when animationData is inline', () => {
    // Render the component directly with an injected fake player so the
    // underlying LottieClipHost's loadAnimation effect succeeds under
    // happy-dom. The outer div's data-testid switches from placeholder
    // → lottie-player when animationData is present.
    const { container } = render(
      <LottiePlayer
        animationData={{ v: '5.7.0', ip: 0, op: 30 }}
        localFrame={15}
        fps={30}
        width={640}
        height={360}
        lottiePlayerFactory={fakeLottie}
      />,
    );
    expect(container.querySelector('[data-testid="lottie-player"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lottie-player-placeholder"]')).toBeNull();
  });

  it('renders the title overlay when supplied', () => {
    const { container } = render(
      <LottiePlayer
        animationData={{ v: '5.7.0' }}
        title="Hello"
        localFrame={30}
        fps={30}
        width={640}
        height={360}
        lottiePlayerFactory={fakeLottie}
      />,
    );
    expect(container.querySelector('[data-testid="lottie-player-title"]')?.textContent).toBe(
      'Hello',
    );
  });

  it('font requirements are conditional on the title prop', () => {
    expect(lottiePlayer.fontRequirements?.({}) ?? []).toEqual([]);
    expect(lottiePlayer.fontRequirements?.({ title: 'Hi' }) ?? []).toEqual([
      { family: 'Plus Jakarta Sans', weight: 600 },
    ]);
  });
});
