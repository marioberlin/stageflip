// packages/runtimes/frame-runtime-bridge/src/clips/product-carousel.tsx
// T-202 — "product-carousel" display-profile clip. Cycles through 2–5
// products with a crossfade between each. Typically bound to a live feed
// via `data-source-bindings` (T-206 wave) at the export stage; the clip
// itself only knows about the resolved items array.
//
// Determinism: the active index + crossfade progress are pure functions
// of `frame` + `itemsPerSecond` + `items.length`. No `Date.now`, no
// timers — a fixed-length loop that snaps back to index 0 at the end of
// the cycle.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const carouselItemSchema = z
  .object({
    imageSrc: z.string().url(),
    name: z.string().min(1),
    price: z.string().optional(),
  })
  .strict();
export type CarouselItem = z.infer<typeof carouselItemSchema>;

export const productCarouselPropsSchema = z
  .object({
    /** 2–5 products to rotate. */
    items: z.array(carouselItemSchema).min(2).max(5),
    /**
     * Seconds each item holds at full opacity (excluding the crossfade
     * into the next). Default 2.0. Combined with `crossfadeSeconds` this
     * controls cycle length: `(hold + crossfade) * items.length`.
     */
    holdSeconds: z.number().positive().max(10).optional(),
    /** Crossfade length in seconds. Default 0.4. */
    crossfadeSeconds: z.number().positive().max(2).optional(),
    /** Product-name color. Defaults to theme foreground. */
    textColor: z.string().optional(),
    /** Price accent. Defaults to theme primary. */
    accent: z.string().optional(),
    /** Card background. Defaults to theme background. */
    background: z.string().optional(),
  })
  .strict();

export type ProductCarouselProps = z.infer<typeof productCarouselPropsSchema>;

export interface CarouselSlot {
  /** Index of the item currently mounted. */
  readonly index: number;
  /** Opacity at this frame, in [0, 1]. */
  readonly opacity: number;
}

/**
 * Compute the two-slot crossfade state for a carousel at a given frame.
 * Returns the previous item's slot + the incoming item's slot. Opacities
 * always sum to 1, so the output is renderable as two absolutely-
 * positioned layers. Exported for tests.
 */
export function carouselSlotsAtFrame(
  frame: number,
  fps: number,
  itemCount: number,
  holdSeconds: number,
  crossfadeSeconds: number,
): { current: CarouselSlot; next: CarouselSlot } {
  const cycleFrames = Math.max(1, Math.round((holdSeconds + crossfadeSeconds) * fps));
  const crossfadeFrames = Math.max(1, Math.round(crossfadeSeconds * fps));
  const holdFrames = Math.max(0, cycleFrames - crossfadeFrames);
  const totalFrames = cycleFrames * itemCount;
  const wrapped = ((frame % totalFrames) + totalFrames) % totalFrames;
  const slotIndex = Math.floor(wrapped / cycleFrames);
  const frameInSlot = wrapped - slotIndex * cycleFrames;

  if (frameInSlot < holdFrames) {
    // Full hold: only the current slot is visible.
    return {
      current: { index: slotIndex, opacity: 1 },
      next: { index: (slotIndex + 1) % itemCount, opacity: 0 },
    };
  }
  const crossfadeProgress = (frameInSlot - holdFrames) / crossfadeFrames;
  const clamped = Math.min(1, Math.max(0, crossfadeProgress));
  return {
    current: { index: slotIndex, opacity: 1 - clamped },
    next: { index: (slotIndex + 1) % itemCount, opacity: clamped },
  };
}

function renderItem(
  item: CarouselItem,
  opacity: number,
  textColor: string,
  accent: string,
  testId: string,
): ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity,
      }}
    >
      <img
        src={item.imageSrc}
        alt={item.name}
        data-testid={`${testId}-image`}
        style={{
          maxWidth: '78%',
          maxHeight: '62%',
          objectFit: 'contain',
        }}
      />
      <div
        data-testid={`${testId}-name`}
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 700,
          fontSize: 18,
          color: textColor,
          letterSpacing: '-0.01em',
          maxWidth: '88%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.name}
      </div>
      {item.price !== undefined && item.price.length > 0 ? (
        <div
          data-testid={`${testId}-price`}
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 800,
            fontSize: 22,
            color: accent,
            letterSpacing: '-0.02em',
          }}
        >
          {item.price}
        </div>
      ) : null}
    </div>
  );
}

export function ProductCarousel({
  items,
  holdSeconds = 2,
  crossfadeSeconds = 0.4,
  textColor = '#080f15',
  accent = '#0072e5',
  background = '#ffffff',
}: ProductCarouselProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { current, next } = carouselSlotsAtFrame(
    frame,
    fps,
    items.length,
    holdSeconds,
    crossfadeSeconds,
  );
  const currentItem = items[current.index] as CarouselItem;
  const nextItem = items[next.index] as CarouselItem;

  return (
    <div
      data-testid="product-carousel-clip"
      style={{
        position: 'absolute',
        inset: 0,
        background,
        overflow: 'hidden',
      }}
    >
      {renderItem(currentItem, current.opacity, textColor, accent, 'product-carousel-current')}
      {next.opacity > 0
        ? renderItem(nextItem, next.opacity, textColor, accent, 'product-carousel-next')
        : null}
    </div>
  );
}

export const productCarouselClip: ClipDefinition<unknown> = defineFrameClip<ProductCarouselProps>({
  kind: 'product-carousel',
  component: ProductCarousel,
  propsSchema: productCarouselPropsSchema,
  themeSlots: {
    textColor: { kind: 'palette', role: 'foreground' },
    accent: { kind: 'palette', role: 'primary' },
    background: { kind: 'palette', role: 'background' },
  },
  fontRequirements: () => [
    { family: 'Plus Jakarta Sans', weight: 700 },
    { family: 'Plus Jakarta Sans', weight: 800 },
  ],
});
