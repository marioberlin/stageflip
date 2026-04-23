// packages/runtimes/frame-runtime-bridge/src/clips/gif-player.tsx
// T-131e.1 port of reference/slidemotion/.../clips/gif-player.tsx.
// Displays an animated GIF (or any image-ish URL) with a fade + scale
// entrance. GIF frame advance is browser-controlled — not frame-synced —
// so this clip is the bridge-tier preview path. Deterministic export
// decodes the GIF to frames via the bake runtime (T-131e dispatcher work,
// tracked separately).

import { FrameImage, cubicBezier, interpolate, useCurrentFrame } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const gifPlayerPropsSchema = z
  .object({
    src: z.string().optional(),
    title: z.string().optional(),
    fit: z.enum(['cover', 'contain', 'fill']).optional(),
    backgroundColor: z.string().optional(),
    titleColor: z.string().optional(),
    borderRadius: z.number().nonnegative().optional(),
  })
  .strict();

export type GifPlayerProps = z.infer<typeof gifPlayerPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function GifPlayer({
  src,
  title,
  fit = 'contain',
  backgroundColor = '#080f15',
  titleColor = '#ebf1fa',
  borderRadius = 16,
}: GifPlayerProps): ReactElement {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scaleIn = interpolate(frame, [0, 20], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const hasImage = src !== undefined && src.length > 0;

  return (
    <div
      data-testid="gif-player"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: title !== undefined ? '60px 80px' : 80,
        opacity: fadeIn,
      }}
    >
      {title !== undefined ? (
        <div
          data-testid="gif-player-title"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: titleColor,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          {title}
        </div>
      ) : null}
      <div
        data-testid="gif-player-wrapper"
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${scaleIn})`,
          overflow: 'hidden',
          borderRadius,
        }}
      >
        {hasImage ? (
          <FrameImage
            src={src}
            alt={title ?? 'Animated GIF'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: fit,
              borderRadius,
            }}
          />
        ) : (
          <div
            data-testid="gif-player-placeholder"
            style={{
              width: 400,
              height: 300,
              borderRadius,
              border: '2px dashed #334155',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 14,
              color: '#64748b',
            }}
          >
            GIF Placeholder
          </div>
        )}
      </div>
    </div>
  );
}

export const gifPlayerClip: ClipDefinition<unknown> = defineFrameClip<GifPlayerProps>({
  kind: 'gif-player',
  component: GifPlayer,
  propsSchema: gifPlayerPropsSchema,
  themeSlots: {
    backgroundColor: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [{ family: 'Plus Jakarta Sans', weight: 700 }],
});
