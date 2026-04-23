// packages/runtimes/frame-runtime-bridge/src/clips/video-background.tsx
// T-131e.1 port of reference/slidemotion/.../clips/video-background.tsx.
// Full-bleed muted background video (via <FrameVideo>) with a timed
// title + subtitle overlay. `videoUrl` is allowed empty so the clip
// renders a placeholder frame when no source is set (matches reference
// behaviour — the text overlay still animates).

import { FrameVideo, cubicBezier, interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const videoBackgroundPropsSchema = z
  .object({
    videoUrl: z.string(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    titleColor: z.string().optional(),
    subtitleColor: z.string().optional(),
  })
  .strict();

export type VideoBackgroundProps = z.infer<typeof videoBackgroundPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function VideoBackground({
  videoUrl,
  title,
  subtitle,
  titleColor = '#ebf1fa',
  subtitleColor = '#a5acb4',
}: VideoBackgroundProps): ReactElement {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleTranslate = interpolate(frame, [10, 35], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const subtitleOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleTranslate = interpolate(frame, [25, 50], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const hasVideo = videoUrl.length > 0;

  return (
    <div
      data-testid="video-background"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#080f15',
      }}
    >
      {hasVideo ? (
        <FrameVideo
          src={videoUrl}
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : null}

      {/* Dark gradient scrim so the text reads against any video frame. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          textAlign: 'center',
        }}
      >
        {title !== undefined ? (
          <div
            data-testid="video-background-title"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 72,
              fontWeight: 800,
              color: titleColor,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              opacity: titleOpacity,
              transform: `translateY(${titleTranslate}px)`,
              textShadow: '0 2px 16px rgba(0,0,0,0.4)',
              maxWidth: 1520,
            }}
          >
            {title}
          </div>
        ) : null}
        {subtitle !== undefined ? (
          <div
            data-testid="video-background-subtitle"
            style={{
              marginTop: 24,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 20,
              fontWeight: 400,
              color: subtitleColor,
              lineHeight: 1.5,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleTranslate}px)`,
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              maxWidth: 1200,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const videoBackgroundClip: ClipDefinition<unknown> = defineFrameClip<VideoBackgroundProps>({
  kind: 'video-background',
  component: VideoBackground,
  propsSchema: videoBackgroundPropsSchema,
  themeSlots: {
    titleColor: { kind: 'palette', role: 'foreground' },
    subtitleColor: { kind: 'palette', role: 'secondary' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 400 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
