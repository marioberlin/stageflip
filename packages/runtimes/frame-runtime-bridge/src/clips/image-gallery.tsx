// packages/runtimes/frame-runtime-bridge/src/clips/image-gallery.tsx
// T-131f.1 port of reference/slidemotion/.../clips/image-gallery.tsx.
// Crossfade slideshow with optional captions. Each image holds for `holdSec`
// then crossfades to the next over `fadeSec`. Last image stays visible past
// the end of the cycle.

import { interpolate, linear, useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const imageGalleryPropsSchema = z
  .object({
    imageUrls: z.array(z.string().url()).min(1),
    captions: z.array(z.string()).optional(),
    title: z.string().optional(),
    background: z.string().optional(),
    titleColor: z.string().optional(),
    captionColor: z.string().optional(),
    holdSec: z.number().positive().optional(),
    fadeSec: z.number().positive().optional(),
  })
  .strict();

export type ImageGalleryProps = z.infer<typeof imageGalleryPropsSchema>;

const DEFAULT_HOLD_SEC = 1.5;
const DEFAULT_FADE_SEC = 0.5;

export function ImageGallery({
  imageUrls,
  captions,
  title,
  background = '#080f15',
  titleColor = '#ebf1fa',
  captionColor = '#a5acb4',
  holdSec = DEFAULT_HOLD_SEC,
  fadeSec = DEFAULT_FADE_SEC,
}: ImageGalleryProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const count = Math.max(1, imageUrls.length);
  const perImageFrames = Math.max(1, Math.floor((holdSec + fadeSec) * fps));
  const fadeFrames = Math.max(1, Math.floor(fadeSec * fps));

  const containerFade = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      data-testid="image-gallery-clip"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 80px',
        opacity: containerFade,
      }}
    >
      {title !== undefined && title.length > 0 && (
        <div
          data-testid="image-gallery-title"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 36,
            fontWeight: 700,
            color: titleColor,
            marginBottom: 32,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 12,
        }}
      >
        {imageUrls.map((url, i) => {
          const start = i * perImageFrames;
          const end = start + perImageFrames;
          const fadeInEnd = start + fadeFrames;
          const fadeOutStart = end - fadeFrames;

          let opacity = 0;
          if (i === 0 && frame < fadeInEnd) {
            opacity = interpolate(frame, [0, fadeInEnd], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
          } else if (frame >= start && frame <= end) {
            opacity = interpolate(
              frame,
              [start, fadeInEnd, fadeOutStart, end],
              [0, 1, 1, i === count - 1 ? 1 : 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );
          } else if (i === count - 1 && frame > end) {
            opacity = 1;
          }

          const scale = interpolate(frame, [start, end], [1, 1.04], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: linear,
          });

          return (
            <img
              // biome-ignore lint/suspicious/noArrayIndexKey: positional gallery slot — slot i is the same image across renders.
              key={i}
              src={url}
              alt={captions?.[i] ?? `Image ${i + 1}`}
              data-testid={`image-gallery-image-${i}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity,
                transform: `scale(${scale})`,
                borderRadius: 12,
              }}
            />
          );
        })}
      </div>

      {captions !== undefined && captions.length > 0 && (
        <div
          data-testid="image-gallery-caption-strip"
          style={{
            marginTop: 24,
            minHeight: 28,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 400,
            color: captionColor,
            textAlign: 'center',
            position: 'relative',
            width: '100%',
          }}
        >
          {imageUrls.map((_, i) => {
            const start = i * perImageFrames;
            const end = start + perImageFrames;
            const fadeInEnd = start + fadeFrames;
            const fadeOutStart = end - fadeFrames;
            let opacity = 0;
            if (frame >= start && frame <= end) {
              opacity = interpolate(
                frame,
                [start, fadeInEnd, fadeOutStart, end],
                [0, 1, 1, i === count - 1 ? 1 : 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
            } else if (i === count - 1 && frame > end) {
              opacity = 1;
            }
            const caption = captions[i];
            if (caption === undefined || caption.length === 0) return null;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: positional caption aligned with imageUrls[].
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  opacity,
                }}
              >
                {caption}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const imageGalleryClip: ClipDefinition<unknown> = defineFrameClip<ImageGalleryProps>({
  kind: 'image-gallery',
  component: ImageGallery,
  propsSchema: imageGalleryPropsSchema,
  themeSlots: {
    background: { kind: 'palette', role: 'background' },
    titleColor: { kind: 'palette', role: 'foreground' },
    // Captions render at the same role as the title — surface would hide
    // them on most themes (see T-131b.2 reviewer note).
    captionColor: { kind: 'palette', role: 'foreground' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 400 },
    { family: 'Plus Jakarta Sans', weight: 700 },
  ],
});
