// apps/stageflip-slide/src/components/canvas/find-highlights-overlay.tsx
// Canvas overlay that paints find-replace match rectangles on top of
// elements in the active slide (T-139c integration).

'use client';

import {
  activeSlideIdAtom,
  findHighlightsAtom,
  slideByIdAtom,
  useEditorShellAtomValue,
} from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useMemo } from 'react';

/**
 * Draws translucent rectangles over text elements in the active slide
 * wherever `findHighlightsAtom` reports a match. Sits inside the same
 * coordinate space as `<SelectionOverlay>` so match rectangles scale
 * with the canvas transform.
 *
 * The overlay filters matches to the active slide only — matches on
 * other slides are not painted, keeping the highlight coherent with
 * what the user sees.
 *
 * Tests cover this via `<FindReplace>` integration (see
 * `editor-app-client.test.tsx`), not a dedicated unit suite: without
 * the FindReplace dialog driving the atom there's nothing to render.
 */
export function FindHighlightsOverlay(): ReactElement | null {
  const { matches, activeIndex } = useEditorShellAtomValue(findHighlightsAtom);
  const activeSlideId = useEditorShellAtomValue(activeSlideIdAtom);
  const slideAtom = useMemo(() => slideByIdAtom(activeSlideId), [activeSlideId]);
  const slide = useEditorShellAtomValue(slideAtom);

  if (!slide || matches.length === 0) return null;

  const slideMatches = matches.filter((m) => m.slideId === slide.id);
  if (slideMatches.length === 0) return null;

  return (
    <div data-testid="find-highlights-overlay" style={layerStyle} aria-hidden="true">
      {slideMatches.map((m, i) => {
        const el = slide.elements.find((e) => e.id === m.elementId);
        if (!el) return null;
        const isActive = matches.indexOf(m) === activeIndex;
        return (
          <div
            key={`${m.slideId}:${m.elementId}:${m.start}`}
            data-testid={`find-highlight-${i}`}
            data-active={isActive ? 'true' : 'false'}
            style={highlightStyle(el.transform, isActive)}
          />
        );
      })}
    </div>
  );
}

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

function highlightStyle(
  transform: { x: number; y: number; width: number; height: number },
  isActive: boolean,
): CSSProperties {
  return {
    position: 'absolute',
    left: transform.x,
    top: transform.y,
    width: transform.width,
    height: transform.height,
    background: isActive ? 'rgba(90, 248, 251, 0.25)' : 'rgba(251, 189, 64, 0.2)',
    border: `1px solid ${isActive ? '#5af8fb' : 'rgba(251, 189, 64, 0.5)'}`,
    borderRadius: 3,
    pointerEvents: 'none',
  };
}
