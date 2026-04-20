// packages/schema/src/animations.ts
// Animation + Easing primitives attached to elements. Animations ride the
// timing primitive that the element declares (see ./timing.ts) — the timing
// tells the compiler WHEN, the animation tells the renderer WHAT.

import { z } from 'zod';
import { colorValueSchema } from './primitives.js';
import { timingPrimitiveSchema } from './timing.js';

/* --------------------------- Easings --------------------------- */

/**
 * Named easings. Matches the 25 named easings the frame-runtime will ship
 * (T-041) — shipping the full list here keeps agents and renderers in sync.
 * Extending the set is additive; removing one is a breaking schema change.
 */
export const namedEasingSchema = z.enum([
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'quad-in',
  'quad-out',
  'quad-in-out',
  'cubic-in',
  'cubic-out',
  'cubic-in-out',
  'quart-in',
  'quart-out',
  'quart-in-out',
  'quint-in',
  'quint-out',
  'quint-in-out',
  'expo-in',
  'expo-out',
  'expo-in-out',
  'circ-in',
  'circ-out',
  'circ-in-out',
  'back-in',
  'back-out',
]);

/** cubic-bezier(x1, y1, x2, y2). Matches the CSS spec. */
export const cubicBezierEasingSchema = z
  .object({
    kind: z.literal('cubic-bezier'),
    x1: z.number().min(0).max(1),
    y1: z.number(),
    x2: z.number().min(0).max(1),
    y2: z.number(),
  })
  .strict();

/** Physics-based spring. Validation mirrors T-043: mass, stiffness > 0; damping >= 0.01. */
export const springEasingSchema = z
  .object({
    kind: z.literal('spring'),
    mass: z.number().positive().default(1),
    stiffness: z.number().positive().default(100),
    damping: z.number().min(0.01).default(10),
    initialVelocity: z.number().default(0),
  })
  .strict();

/** Stepped easing. n=1 is a classic jump-start/jump-end effect. */
export const stepsEasingSchema = z
  .object({
    kind: z.literal('steps'),
    steps: z.number().int().positive(),
    jump: z.enum(['jump-start', 'jump-end', 'jump-both', 'jump-none']).default('jump-end'),
  })
  .strict();

/** An easing is either a named keyword or a parametric schema. */
export const easingSchema = z.union([
  namedEasingSchema,
  cubicBezierEasingSchema,
  springEasingSchema,
  stepsEasingSchema,
]);

export type NamedEasing = z.infer<typeof namedEasingSchema>;
export type CubicBezierEasing = z.infer<typeof cubicBezierEasingSchema>;
export type SpringEasing = z.infer<typeof springEasingSchema>;
export type StepsEasing = z.infer<typeof stepsEasingSchema>;
export type Easing = z.infer<typeof easingSchema>;

/* --------------------------- Animation variants --------------------------- */

/** A keyframe in a keyframed animation. `at` is 0..1 over the animation duration. */
export const keyframeSchema = z
  .object({
    at: z.number().min(0).max(1),
    // Keyframes can target any animatable property; typed loosely here because
    // the renderer validates against the target's type at runtime.
    value: z.unknown(),
    easing: easingSchema.optional(),
  })
  .strict();
export type Keyframe = z.infer<typeof keyframeSchema>;

const fadeAnimationSchema = z
  .object({
    kind: z.literal('fade'),
    from: z.number().min(0).max(1).default(0),
    to: z.number().min(0).max(1).default(1),
    easing: easingSchema.default('ease-out'),
  })
  .strict();

const slideAnimationSchema = z
  .object({
    kind: z.literal('slide'),
    direction: z.enum(['up', 'down', 'left', 'right']),
    distance: z.number().default(100),
    easing: easingSchema.default('ease-out'),
  })
  .strict();

const scaleAnimationSchema = z
  .object({
    kind: z.literal('scale'),
    from: z.number().positive().default(0),
    to: z.number().positive().default(1),
    easing: easingSchema.default('ease-out'),
  })
  .strict();

const rotateAnimationSchema = z
  .object({
    kind: z.literal('rotate'),
    fromDegrees: z.number().default(0),
    toDegrees: z.number().default(360),
    easing: easingSchema.default('ease-in-out'),
  })
  .strict();

const colorAnimationSchema = z
  .object({
    kind: z.literal('color'),
    property: z.enum(['fill', 'stroke', 'color', 'background']),
    from: colorValueSchema,
    to: colorValueSchema,
    easing: easingSchema.default('linear'),
  })
  .strict();

export const keyframedAnimationSchema = z
  .object({
    kind: z.literal('keyframed'),
    property: z.string().min(1),
    keyframes: z.array(keyframeSchema).min(2),
  })
  .strict();

/** Opaque animation handled entirely by a clip runtime; params passed through. */
const runtimeAnimationSchema = z
  .object({
    kind: z.literal('runtime'),
    runtime: z.string().min(1),
    name: z.string().min(1),
    params: z.record(z.unknown()).default({}),
  })
  .strict();

/** Discriminated union of all animation kinds. */
export const animationKindSchema = z.discriminatedUnion('kind', [
  fadeAnimationSchema,
  slideAnimationSchema,
  scaleAnimationSchema,
  rotateAnimationSchema,
  colorAnimationSchema,
  keyframedAnimationSchema,
  runtimeAnimationSchema,
]);
export type AnimationKind = z.infer<typeof animationKindSchema>;

/**
 * An animation on an element. It carries a timing primitive (B1–B5) and the
 * animation itself. Multiple animations per element are allowed; the RIR
 * compiler resolves them in array order at timing-flatten time.
 */
export const animationSchema = z
  .object({
    id: z.string().min(1),
    timing: timingPrimitiveSchema,
    animation: animationKindSchema,
    // If false, the animation is staged but the element's visual does not
    // advance until a resume event. Default true.
    autoplay: z.boolean().default(true),
  })
  .strict();
export type Animation = z.infer<typeof animationSchema>;
