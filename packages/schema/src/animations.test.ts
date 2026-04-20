// packages/schema/src/animations.test.ts
// Unit tests for animation + timing primitives (T-022).

import { describe, expect, it } from 'vitest';

import {
  type Animation,
  animationSchema,
  cubicBezierEasingSchema,
  easingSchema,
  keyframedAnimationSchema,
  namedEasingSchema,
  springEasingSchema,
  stepsEasingSchema,
} from './animations.js';
import {
  TIMING_KINDS,
  absoluteTimingSchema,
  anchoredTimingSchema,
  beatTimingSchema,
  eventTimingSchema,
  relativeTimingSchema,
  timingPrimitiveSchema,
} from './timing.js';

describe('timing primitives (B1–B5)', () => {
  it('TIMING_KINDS has exactly 5 unique entries', () => {
    expect(TIMING_KINDS).toHaveLength(5);
    expect(new Set(TIMING_KINDS).size).toBe(5);
  });

  it('B1 absolute: parses and rejects negative startFrame', () => {
    absoluteTimingSchema.parse({ kind: 'absolute', startFrame: 0, durationFrames: 60 });
    expect(() =>
      absoluteTimingSchema.parse({ kind: 'absolute', startFrame: -1, durationFrames: 1 }),
    ).toThrow();
  });

  it('B2 relative: allows negative offset', () => {
    relativeTimingSchema.parse({ kind: 'relative', offsetFrames: -10, durationFrames: 30 });
  });

  it('B3 anchored: defaults mySide=start, offsetFrames=0', () => {
    const parsed = anchoredTimingSchema.parse({
      kind: 'anchored',
      anchor: 'el_target',
      anchorEdge: 'end',
      durationFrames: 60,
    });
    expect(parsed.mySide).toBe('start');
    expect(parsed.offsetFrames).toBe(0);
  });

  it('B4 beat: defaults subdivision=quarter', () => {
    const parsed = beatTimingSchema.parse({ kind: 'beat', beat: 8, durationBeats: 2 });
    expect(parsed.subdivision).toBe('quarter');
  });

  it('B5 event: requires a non-empty event name', () => {
    eventTimingSchema.parse({ kind: 'event', event: 'clipComplete', durationFrames: 10 });
    expect(() =>
      eventTimingSchema.parse({ kind: 'event', event: '', durationFrames: 10 }),
    ).toThrow();
  });

  it('discriminated union dispatches on kind', () => {
    const kinds: Array<ReturnType<typeof timingPrimitiveSchema.parse>> = [
      timingPrimitiveSchema.parse({ kind: 'absolute', startFrame: 0, durationFrames: 1 }),
      timingPrimitiveSchema.parse({ kind: 'relative', offsetFrames: 0, durationFrames: 1 }),
      timingPrimitiveSchema.parse({
        kind: 'anchored',
        anchor: 'a',
        anchorEdge: 'start',
        durationFrames: 1,
      }),
      timingPrimitiveSchema.parse({ kind: 'beat', beat: 1, durationBeats: 1 }),
      timingPrimitiveSchema.parse({ kind: 'event', event: 'e', durationFrames: 1 }),
    ];
    expect(kinds.map((k) => k.kind)).toEqual(['absolute', 'relative', 'anchored', 'beat', 'event']);
  });

  it('rejects an unknown timing kind', () => {
    expect(() =>
      timingPrimitiveSchema.parse({ kind: 'fictional', startFrame: 0, durationFrames: 1 }),
    ).toThrow();
  });
});

describe('easings', () => {
  it('accepts every named easing', () => {
    for (const name of ['linear', 'ease-in-out', 'cubic-in', 'back-out', 'expo-in-out']) {
      namedEasingSchema.parse(name);
    }
  });

  it('rejects an unknown named easing', () => {
    expect(() => namedEasingSchema.parse('warp-9')).toThrow();
  });

  it('cubic-bezier: x1/x2 clamped to [0, 1]', () => {
    cubicBezierEasingSchema.parse({ kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
    expect(() =>
      cubicBezierEasingSchema.parse({ kind: 'cubic-bezier', x1: 1.5, y1: 0, x2: 0, y2: 0 }),
    ).toThrow();
  });

  it('spring: rejects damping below 0.01 (matches T-043)', () => {
    expect(() =>
      springEasingSchema.parse({ kind: 'spring', mass: 1, stiffness: 100, damping: 0 }),
    ).toThrow();
  });

  it('spring: rejects mass/stiffness <= 0', () => {
    expect(() =>
      springEasingSchema.parse({ kind: 'spring', mass: 0, stiffness: 100, damping: 10 }),
    ).toThrow();
    expect(() =>
      springEasingSchema.parse({ kind: 'spring', mass: 1, stiffness: -1, damping: 10 }),
    ).toThrow();
  });

  it('steps: accepts positive integer step count', () => {
    stepsEasingSchema.parse({ kind: 'steps', steps: 4, jump: 'jump-end' });
  });

  it('easing union accepts a named easing literal', () => {
    easingSchema.parse('linear');
  });

  it('easing union accepts a parametric cubic-bezier', () => {
    easingSchema.parse({ kind: 'cubic-bezier', x1: 0.4, y1: 0, x2: 0.2, y2: 1 });
  });
});

describe('animations', () => {
  it('fade: defaults from=0 to=1 with ease-out', () => {
    const parsed = animationSchema.parse({
      id: 'a1',
      timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
      animation: { kind: 'fade' },
    });
    if (parsed.animation.kind === 'fade') {
      expect(parsed.animation.from).toBe(0);
      expect(parsed.animation.to).toBe(1);
      expect(parsed.animation.easing).toBe('ease-out');
    }
    expect(parsed.autoplay).toBe(true);
  });

  it('slide: direction is required', () => {
    expect(() =>
      animationSchema.parse({
        id: 'a2',
        timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
        animation: { kind: 'slide' },
      }),
    ).toThrow();
  });

  it('keyframed: requires >=2 keyframes', () => {
    expect(() =>
      keyframedAnimationSchema.parse({
        kind: 'keyframed',
        property: 'opacity',
        keyframes: [{ at: 0, value: 0 }],
      }),
    ).toThrow();
    keyframedAnimationSchema.parse({
      kind: 'keyframed',
      property: 'opacity',
      keyframes: [
        { at: 0, value: 0 },
        { at: 1, value: 1 },
      ],
    });
  });

  it('runtime animation: passes through params opaquely', () => {
    const parsed = animationSchema.parse({
      id: 'a3',
      timing: { kind: 'beat', beat: 1, durationBeats: 1 },
      animation: { kind: 'runtime', runtime: 'gsap', name: 'motion-text', params: { speed: 2 } },
    });
    if (parsed.animation.kind === 'runtime') {
      expect(parsed.animation.params).toEqual({ speed: 2 });
    }
  });

  it('full animation attaches a B1–B5 timing primitive', () => {
    const anims: Animation[] = [
      {
        id: 'anim-absolute',
        autoplay: true,
        timing: { kind: 'absolute', startFrame: 30, durationFrames: 60 },
        animation: { kind: 'fade', from: 0, to: 1, easing: 'ease-in' },
      },
      {
        id: 'anim-beat',
        autoplay: true,
        timing: { kind: 'beat', beat: 4, subdivision: 'quarter', durationBeats: 1 },
        animation: { kind: 'scale', from: 0.5, to: 1.5, easing: { kind: 'spring', damping: 15 } },
      },
    ];
    for (const a of anims) animationSchema.parse(a);
  });
});
