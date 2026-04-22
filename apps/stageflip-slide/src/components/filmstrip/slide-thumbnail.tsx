// apps/stageflip-slide/src/components/filmstrip/slide-thumbnail.tsx
// Miniaturized slide render used by <Filmstrip> (T-124).

'use client';

import type { Slide } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { ElementView } from '../canvas/element-view';

/**
 * 1920×1080 slide rendered at a fixed thumbnail size via CSS scale.
 * Reuses <ElementView> so the visual matches the canvas exactly —
 * no separate thumbnail renderer to keep in sync with the main one.
 *
 * The audit notes SlideMotion used a dedicated `CssSlideRenderer`
 * for speed. In this repo that optimization can land later without
 * changing this component's shape; today's need is correctness, and
 * a handful of mini slides fit comfortably inside a re-used main
 * renderer.
 */

export const THUMBNAIL_WIDTH = 160;
export const THUMBNAIL_HEIGHT = 90;

const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

export function SlideThumbnail({ slide }: { slide: Slide }): ReactElement {
  const scale = Math.min(THUMBNAIL_WIDTH / REFERENCE_WIDTH, THUMBNAIL_HEIGHT / REFERENCE_HEIGHT);
  return (
    <div data-testid={`slide-thumbnail-${slide.id}`} style={frameStyle}>
      <div style={planeStyle(scale)}>
        {slide.elements.map((el) => (
          <ElementView key={el.id} element={el} />
        ))}
      </div>
    </div>
  );
}

const frameStyle: CSSProperties = {
  position: 'relative',
  width: THUMBNAIL_WIDTH,
  height: THUMBNAIL_HEIGHT,
  overflow: 'hidden',
  background: '#0b1219',
  borderRadius: 4,
  flexShrink: 0,
};

function planeStyle(scale: number): CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
  };
}
