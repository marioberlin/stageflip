// apps/stageflip-slide/src/components/filmstrip/filmstrip.tsx
// Vertical slide-thumbnail rail (T-124).

'use client';

import {
  activeSlideIdAtom,
  selectedSlideIdsAtom,
  useDocument,
  useEditorShellAtomValue,
} from '@stageflip/editor-shell';
import type { Document, Slide, SlideContent } from '@stageflip/schema';
import type { CSSProperties, ReactElement, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback } from 'react';
import { SlideThumbnail } from './slide-thumbnail';

/**
 * Scope:
 *   - Vertical list of slide thumbnails.
 *   - Click → set active slide.
 *   - Shift / Mod click → toggle multi-select via `selectedSlideIdsAtom`.
 *   - Add-slide button at the bottom appends a blank slide.
 *
 * Deferred to later iterations (plan v1.9 row notes the audit scope
 * has drag-reorder + context menu; both are meaningful standalone
 * work and not critical for the walking-skeleton editor loop):
 *   - Drag reorder
 *   - Right-click context menu (duplicate / delete / move up / down)
 */

const BLANK_SLIDE_PREFIX = 'slide-';

function makeSlideId(): string {
  const anyGlobal = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid = anyGlobal.crypto?.randomUUID?.();
  if (uuid) return `${BLANK_SLIDE_PREFIX}${uuid.replace(/-/g, '').slice(0, 12)}`;
  return `${BLANK_SLIDE_PREFIX}${Math.random().toString(36).slice(2, 12)}`;
}

export function Filmstrip(): ReactElement | null {
  const { document: doc, selectSlides, setActiveSlide, updateDocument } = useDocument();
  const activeSlideId = useEditorShellAtomValue(activeSlideIdAtom);
  const selectedSlideIds = useEditorShellAtomValue(selectedSlideIdsAtom);

  const slides: Slide[] = doc?.content.mode === 'slide' ? doc.content.slides : [];

  const handleClick = useCallback(
    (slide: Slide) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        const next = new Set(selectedSlideIds);
        if (next.has(slide.id)) next.delete(slide.id);
        else next.add(slide.id);
        selectSlides(next);
        return;
      }
      selectSlides(new Set([slide.id]));
      setActiveSlide(slide.id);
    },
    [selectSlides, selectedSlideIds, setActiveSlide],
  );

  const handleAddSlide = useCallback(() => {
    // Generate the id outside the functional updater so the updater
    // stays pure. Uses `crypto.randomUUID` when available (all modern
    // browsers + Node 19+), falling back to a counter+random combo
    // that still satisfies the id schema's URL-safe constraint.
    const newId = makeSlideId();
    updateDocument((prev) => {
      if (prev.content.mode !== 'slide') return prev;
      const newSlide: Slide = { id: newId, elements: [] };
      const content: SlideContent = {
        ...prev.content,
        slides: [...prev.content.slides, newSlide],
      };
      const nextDoc: Document = { ...prev, content };
      return nextDoc;
    });
    setActiveSlide(newId);
  }, [setActiveSlide, updateDocument]);

  if (!doc) return null;

  return (
    <aside data-testid="filmstrip" aria-label="Slides" style={railStyle}>
      <ol style={listStyle}>
        {slides.map((slide, index) => {
          const isActive = slide.id === activeSlideId;
          const isSelected = selectedSlideIds.has(slide.id);
          return (
            <li key={slide.id} style={itemStyle}>
              <button
                type="button"
                data-testid={`filmstrip-slide-${slide.id}`}
                data-slide-index={index}
                data-active={isActive || undefined}
                data-selected={isSelected || undefined}
                aria-current={isActive ? 'true' : undefined}
                aria-pressed={isSelected}
                onClick={handleClick(slide)}
                style={{
                  ...slideButtonStyle,
                  ...(isActive ? activeSlideStyle : null),
                  ...(isSelected && !isActive ? selectedSlideStyle : null),
                }}
              >
                <span style={slideIndexStyle} aria-hidden="true">
                  {index + 1}
                </span>
                <SlideThumbnail slide={slide} />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        data-testid="filmstrip-add-slide"
        onClick={handleAddSlide}
        style={addButtonStyle}
      >
        + Slide
      </button>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const railStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  width: 196,
  flexShrink: 0,
  background: '#151c23',
  overflowY: 'auto',
  borderRight: '1px solid rgba(129, 174, 255, 0.08)',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

const itemStyle: CSSProperties = {
  margin: 0,
};

const slideButtonStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'stretch',
  gap: 8,
  width: '100%',
  padding: 4,
  background: 'transparent',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: 6,
  color: '#a5acb4',
  cursor: 'pointer',
};

const activeSlideStyle: CSSProperties = {
  borderColor: '#81aeff',
  color: '#ebf1fa',
};

const selectedSlideStyle: CSSProperties = {
  borderColor: 'rgba(129, 174, 255, 0.4)',
};

const slideIndexStyle: CSSProperties = {
  alignSelf: 'flex-start',
  width: 20,
  textAlign: 'right',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  color: '#a5acb4',
  lineHeight: 1,
  paddingTop: 2,
};

const addButtonStyle: CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(129, 174, 255, 0.1)',
  border: '1px dashed rgba(129, 174, 255, 0.5)',
  borderRadius: 6,
  color: '#81aeff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
