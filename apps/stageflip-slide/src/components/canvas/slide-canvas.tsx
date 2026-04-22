// apps/stageflip-slide/src/components/canvas/slide-canvas.tsx
// Scale-to-fit viewport for the active slide (T-123a).

'use client';

import {
  activeSlideIdAtom,
  selectedElementIdsAtom,
  slideByIdAtom,
  useDocument,
  useEditorShellAtomValue,
} from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CanvasScaleProvider } from './canvas-scale-context';
import { ElementView } from './element-view';
import { InlineTextEditor } from './inline-text-editor';
import { SelectionOverlay } from './selection-overlay';
import { TextSelectionToolbar } from './text-selection-toolbar';

/**
 * Slide canvas reference dimensions. Editor coordinates are expressed
 * against this 1920×1080 box; `scale-to-fit` rescales the inner plane
 * to the actual viewport via a CSS `transform: scale(...)` so element
 * x/y/width/height can stay in canvas-space.
 */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export interface SlideCanvasProps {
  /**
   * Test seam. When provided the scale-to-fit logic skips ResizeObserver
   * and uses these dimensions directly. Production callers omit.
   */
  viewportSizeForTest?: { width: number; height: number };
}

/**
 * Read-only slide canvas. Resolves the active slide via the editor-shell
 * atoms (T-121b) and renders each element through `<ElementView>`.
 * Interactions arrive with T-123b; text editing with T-123c; animated
 * playback with T-123d.
 */
export function SlideCanvas({ viewportSizeForTest }: SlideCanvasProps = {}): ReactElement {
  const activeSlideId = useEditorShellAtomValue(activeSlideIdAtom);
  const slideAtom = useMemo(() => slideByIdAtom(activeSlideId), [activeSlideId]);
  const slide = useEditorShellAtomValue(slideAtom);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(
    viewportSizeForTest ?? null,
  );

  useLayoutEffect(() => {
    if (viewportSizeForTest) return;
    const el = viewportRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportSizeForTest]);

  const scale = computeScale(viewportSize);
  const selectedIds = useEditorShellAtomValue(selectedElementIdsAtom);
  const { selectElements, clearSelection } = useDocument();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleElementPointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent<HTMLElement>) => {
      event.stopPropagation();
      if (editingId && editingId !== id) setEditingId(null);
      selectElements(new Set([id]));
    },
    [editingId, selectElements],
  );

  const handleElementDoubleClick = useCallback(
    (id: string) => () => {
      setEditingId(id);
    },
    [],
  );

  const handlePlanePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Click on the bare plane (not on an element/overlay) clears selection.
      if (event.target !== event.currentTarget) return;
      setEditingId(null);
      clearSelection();
    },
    [clearSelection],
  );

  const editingElement = useMemo(() => {
    if (!editingId || !slide) return null;
    const found = slide.elements.find((el) => el.id === editingId);
    return found && found.type === 'text' ? found : null;
  }, [editingId, slide]);

  return (
    <CanvasScaleProvider scale={scale}>
      <section
        ref={viewportRef}
        data-testid="slide-canvas"
        data-active-slide-id={slide?.id ?? ''}
        aria-label="Slide canvas"
        style={viewportStyle}
      >
        <div
          data-testid="slide-canvas-plane"
          style={planeStyle(scale)}
          onPointerDown={handlePlanePointerDown}
        >
          {slide ? (
            <>
              {slide.elements.map((el) => {
                if (editingElement && editingElement.id === el.id) {
                  return (
                    <ElementView
                      key={el.id}
                      element={el}
                      onPointerDown={handleElementPointerDown(el.id)}
                      onDoubleClick={handleElementDoubleClick(el.id)}
                    >
                      <InlineTextEditor
                        element={editingElement}
                        onClose={() => setEditingId(null)}
                      />
                      <TextSelectionToolbar element={editingElement} />
                    </ElementView>
                  );
                }
                return (
                  <ElementView
                    key={el.id}
                    element={el}
                    onPointerDown={handleElementPointerDown(el.id)}
                    onDoubleClick={handleElementDoubleClick(el.id)}
                  />
                );
              })}
              {editingElement === null && (
                <SelectionOverlay
                  selectedIds={selectedIds}
                  onElementDoubleClick={(id) => setEditingId(id)}
                />
              )}
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </CanvasScaleProvider>
  );
}

function EmptyState(): ReactElement {
  return (
    <div
      data-testid="slide-canvas-empty"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a5acb4',
        fontSize: 18,
        letterSpacing: '0.04em',
      }}
    >
      No active slide
    </div>
  );
}

function computeScale(viewportSize: { width: number; height: number } | null): number {
  if (!viewportSize) return 1;
  const scaleX = viewportSize.width / CANVAS_WIDTH;
  const scaleY = viewportSize.height / CANVAS_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  return scale > 0 ? scale : 1;
}

const viewportStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--editor-canvas, #0f1620)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
};

function planeStyle(scale: number): CSSProperties {
  return {
    position: 'relative',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    flexShrink: 0,
    background: '#0b1219',
    boxShadow: '0 4px 24px rgba(0, 114, 229, 0.08)',
  };
}
