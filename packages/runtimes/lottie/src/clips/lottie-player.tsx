// packages/runtimes/lottie/src/clips/lottie-player.tsx
// T-131d.3 port of reference/slidemotion/.../clips/lottie-player.tsx.
//
// Prop-driven Lottie playback. Unlike `lottie-logo` which bakes
// animationData into the ClipDefinition at authoring time, this clip
// takes the JSON at render time. The reference loads it via `fetch()`
// from a URL — that violates our determinism rules for code scoped under
// `packages/runtimes/**/src/clips/**`, so this port **only accepts
// inline animation data** (an object or a JSON string). Deck authors /
// tools resolve URLs outside the clip and hand the decoded JSON in.
//
// Behaviour:
//   - `animationData` present → mount `LottieClipHost` + fade in.
//   - `animationData` absent  → render the animated placeholder
//     (three pulsing concentric rings driven by frame, no network /
//     async state).
//
// Determinism: same posture as `lottie-logo` — lottie-web is loaded
// with `autoplay: false`; every render calls `goToAndStop(ms, false)`.

import lottie from 'lottie-web';
import { type ReactElement, createElement } from 'react';
import { z } from 'zod';

import type {
  ClipDefinition,
  ClipRenderContext,
  FontRequirement,
  ThemeSlot,
} from '@stageflip/runtimes-contract';

import { LottieClipHost } from '../host.js';
import type { LottiePlayer as LottiePlayerInstance } from '../types.js';

export const lottiePlayerPropsSchema = z
  .object({
    /**
     * Pre-decoded Lottie JSON. Accepts an object (preferred) or a JSON
     * string that the clip will `JSON.parse`. `null` / `undefined` falls
     * through to the animated placeholder.
     */
    animationData: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    title: z.string().optional(),
    backgroundColor: z.string().optional(),
    scale: z.number().positive().optional(),
  })
  .strict();

export type LottiePlayerProps = z.infer<typeof lottiePlayerPropsSchema>;

/**
 * Parse an `animationData` prop into the object lottie-web expects.
 * Returns `null` if no data is present or parsing fails — the clip
 * renders the placeholder in those cases.
 */
export function normaliseAnimationData(data: LottiePlayerProps['animationData']): unknown | null {
  if (data === undefined || data === null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

/**
 * Interpolate-free fade-in helper — avoids pulling frame-runtime into
 * this package just for one clamp. Matches `interpolate(frame, [0, endF],
 * [0, 1], { clamp })`.
 */
function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export interface PlaceholderRing {
  readonly scale: number;
  readonly opacity: number;
}

/**
 * Derive the three concentric placeholder rings from the current local
 * frame. Each ring's scale grows from 0 → 1 over 40 frames starting at a
 * staggered delay (0 / 10 / 20); opacity fades 0 → 0.5 → 0.15 over the
 * same window. Exported for direct unit-test coverage.
 */
export function computePlaceholderRings(localFrame: number): readonly PlaceholderRing[] {
  const ringSpecs: { delay: number }[] = [{ delay: 0 }, { delay: 10 }, { delay: 20 }];
  return ringSpecs.map(({ delay }) => {
    const elapsed = localFrame - delay;
    const scale = clamp01(elapsed / 40);
    let opacity: number;
    if (elapsed <= 0) opacity = 0;
    else if (elapsed <= 20) opacity = clamp01(elapsed / 20) * 0.5;
    else opacity = 0.5 + clamp01((elapsed - 20) / 20) * (0.15 - 0.5);
    return { scale, opacity: Math.max(0, opacity) };
  });
}

export interface LottiePlayerComponentProps extends LottiePlayerProps {
  localFrame: number;
  fps: number;
  width: number;
  height: number;
  lottiePlayerFactory?: () => LottiePlayerInstance;
}

export function LottiePlayer({
  animationData,
  title,
  backgroundColor = '#080f15',
  scale = 1,
  localFrame,
  fps,
  width,
  height,
  lottiePlayerFactory,
}: LottiePlayerComponentProps): ReactElement {
  const data = normaliseAnimationData(animationData);
  const fadeIn = clamp01(localFrame / 15);
  const player = lottiePlayerFactory
    ? lottiePlayerFactory()
    : (lottie as unknown as LottiePlayerInstance);

  if (data !== null) {
    return (
      <div
        data-testid="lottie-player"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeIn,
          position: 'relative',
        }}
      >
        {title !== undefined ? (
          <div
            data-testid="lottie-player-title"
            style={{
              position: 'absolute',
              bottom: 40,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 18,
              fontWeight: 600,
              color: '#ebf1fa',
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            width: `${80 * scale}%`,
            height: `${80 * scale}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {createElement(LottieClipHost, {
            animationData: data,
            localFrame,
            fps,
            lottiePlayer: player,
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="lottie-player-placeholder"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
      }}
    >
      <svg
        width={width * 0.5}
        height={height * 0.5}
        viewBox="-100 -100 200 200"
        style={{ overflow: 'visible' }}
      >
        <title>Lottie placeholder — animation data not yet provided</title>
        {computePlaceholderRings(localFrame).map((ring, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-ring grid, index is the identity.
            key={i}
            cx={0}
            cy={0}
            r={40 + i * 20}
            fill="none"
            stroke="#5af8fb"
            strokeWidth={2}
            opacity={ring.opacity}
            transform={`scale(${ring.scale})`}
            data-testid={`lottie-player-ring-${i}`}
          />
        ))}
      </svg>
    </div>
  );
}

const themeSlots: Readonly<Record<string, ThemeSlot>> = {
  backgroundColor: { kind: 'palette', role: 'background' },
};

const fontRequirementsFor = (props: LottiePlayerProps): FontRequirement[] =>
  props.title !== undefined ? [{ family: 'Plus Jakarta Sans', weight: 600 }] : [];

const lottiePlayerDef: ClipDefinition<LottiePlayerProps> = {
  kind: 'lottie-player',
  propsSchema: lottiePlayerPropsSchema,
  themeSlots,
  fontRequirements: fontRequirementsFor,
  render(ctx: ClipRenderContext<LottiePlayerProps>): ReactElement | null {
    const localFrame = ctx.frame - ctx.clipFrom;
    if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
      return null;
    }
    return createElement(LottiePlayer, {
      ...ctx.props,
      localFrame,
      fps: ctx.fps,
      width: ctx.width,
      height: ctx.height,
    });
  },
};

/**
 * `lottie-player` ClipDefinition. Hand-rolled (not via
 * `defineLottieClip`) because the factory bakes `animationData` at
 * define time and this clip needs it at render time. Reuses the
 * package's `LottieClipHost` so the determinism posture
 * (`goToAndStop(ms, false)`) is identical to `lottie-logo`.
 */
export const lottiePlayer: ClipDefinition<unknown> =
  lottiePlayerDef as unknown as ClipDefinition<unknown>;
