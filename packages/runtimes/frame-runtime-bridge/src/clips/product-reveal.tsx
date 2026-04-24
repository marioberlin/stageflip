// packages/runtimes/frame-runtime-bridge/src/clips/product-reveal.tsx
// T-183b — "product-reveal" video-profile clip. A product-hero card: the
// product image slides in from below with a subtle zoom; the product name
// + price strip in from the right over it. Deterministic motion.

import {
  cubicBezier,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const productRevealPropsSchema = z
  .object({
    imageSrc: z.string().url(),
    imageAlt: z.string().optional(),
    productName: z.string(),
    price: z.string().optional(),
    /** Product name color. Defaults to theme palette.foreground. */
    textColor: z.string().optional(),
    /** Price accent. Defaults to theme palette.accent. */
    accent: z.string().optional(),
    /** Background color. Defaults to theme palette.background. */
    background: z.string().optional(),
  })
  .strict();

export type ProductRevealProps = z.infer<typeof productRevealPropsSchema>;

const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

export function ProductReveal({
  imageSrc,
  imageAlt,
  productName,
  price,
  textColor = '#f5f7fa',
  accent = '#5af8fb',
  background = '#0c1116',
}: ProductRevealProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const imageEnd = Math.ceil(fps * 0.6);
  const nameStart = Math.ceil(fps * 0.4);
  const nameEnd = Math.ceil(fps * 0.9);

  const imageY = interpolate(frame, [0, imageEnd], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const imageScale = interpolate(frame, [0, imageEnd], [0.88, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const imageOpacity = interpolate(frame, [0, Math.ceil(imageEnd * 0.6)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  const nameX = interpolate(frame, [nameStart, nameEnd], [48, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });
  const nameOpacity = interpolate(frame, [nameStart, nameEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_EXPO,
  });

  return (
    <div
      data-testid="product-reveal-clip"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 80,
        background,
        padding: 96,
      }}
    >
      <img
        data-testid="product-reveal-image"
        src={imageSrc}
        alt={imageAlt ?? productName}
        style={{
          maxWidth: '45%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `translateY(${imageY}px) scale(${imageScale})`,
          opacity: imageOpacity,
          filter: 'drop-shadow(0 24px 64px rgba(0,0,0,0.45))',
        }}
      />
      <div
        style={{
          transform: `translateX(${nameX}px)`,
          opacity: nameOpacity,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          data-testid="product-reveal-name"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 84,
            fontWeight: 800,
            color: textColor,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            maxWidth: 680,
          }}
        >
          {productName}
        </div>
        {price !== undefined && price.length > 0 ? (
          <div
            data-testid="product-reveal-price"
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 44,
              fontWeight: 700,
              color: accent,
              letterSpacing: '-0.02em',
            }}
          >
            {price}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const productRevealClip: ClipDefinition<unknown> = defineFrameClip<ProductRevealProps>({
  kind: 'product-reveal',
  component: ProductReveal,
  propsSchema: productRevealPropsSchema,
  themeSlots: {
    textColor: { kind: 'palette', role: 'foreground' },
    accent: { kind: 'palette', role: 'accent' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 700 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
