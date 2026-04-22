// apps/stageflip-slide/src/components/canvas/selection-overlay.tsx
// Bounding-box + transform-handle overlay for selected elements (T-123b).

'use client';

import { elementByIdAtom, useDocument, useEditorShellAtomValue } from '@stageflip/editor-shell';
import type { Document, Element, Slide, SlideContent, Transform } from '@stageflip/schema';
import type { CSSProperties, ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { useCanvasScale } from './canvas-scale-context';

/**
 * Renders one overlay per element id in the provided selection set. Each
 * overlay shows a blue bounding box and three layers of interactive
 * affordances:
 *
 *   - body (the bounding box itself) → move drag
 *   - 8 handles (4 corners + 4 edges) → resize
 *   - 1 rotation handle above the top center → rotate
 *
 * Coordinates: element `transform` is in canvas-space (1920×1080). The
 * overlay sits inside the scaled canvas plane, so positioning is a
 * straight copy of `transform`. Pointer-move deltas come in client-space
 * and are divided by the active canvas scale to re-enter canvas-space.
 *
 * Mutations: committed via `useDocument().updateDocument(...)`. History
 * capture (undo entries per gesture) lands with T-133.
 */

type Handle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

type GestureKind = 'move' | Handle | 'rotate';

interface ActiveGesture {
  kind: GestureKind;
  elementId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startTransform: Transform;
  /** For rotation: starting angle (degrees) from element center to pointer. */
  rotateAnchorDeg: number;
}

export interface SelectionOverlayProps {
  selectedIds: ReadonlySet<string>;
}

export function SelectionOverlay({ selectedIds }: SelectionOverlayProps): ReactElement | null {
  if (selectedIds.size === 0) return null;
  return (
    <div
      data-testid="selection-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {Array.from(selectedIds).map((id) => (
        <ElementOverlay key={id} elementId={id} />
      ))}
    </div>
  );
}

function ElementOverlay({ elementId }: { elementId: string }): ReactElement | null {
  const atom = useMemo(() => elementByIdAtom(elementId), [elementId]);
  const element = useEditorShellAtomValue(atom);
  const { updateDocument } = useDocument();
  const scale = useCanvasScale();
  const gestureRef = useRef<ActiveGesture | null>(null);

  const commit = useCallback(
    (next: Transform) => {
      updateDocument((doc) => updateElementTransform(doc, elementId, next));
    },
    [elementId, updateDocument],
  );

  const handlePointerDown = useCallback(
    (kind: GestureKind) => (event: ReactPointerEvent<HTMLElement>) => {
      if (!element) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = {
        kind,
        elementId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startTransform: { ...element.transform },
        rotateAnchorDeg: computePointerAngle(event, element.transform),
      };
    },
    [element, elementId],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== event.pointerId) return;
      const deltaX = (event.clientX - g.startClientX) / scale;
      const deltaY = (event.clientY - g.startClientY) / scale;
      const next = applyGesture(g, deltaX, deltaY, event);
      commit(next);
    },
    [commit, scale],
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g) return;
    event.currentTarget.releasePointerCapture(g.pointerId);
    gestureRef.current = null;
  }, []);

  if (!element) return null;

  const { transform } = element;
  const commonBoxStyle: CSSProperties = {
    position: 'absolute',
    left: transform.x,
    top: transform.y,
    width: transform.width,
    height: transform.height,
    transform: `rotate(${transform.rotation ?? 0}deg)`,
    transformOrigin: 'center center',
    pointerEvents: 'auto',
  };

  return (
    <div data-testid={`selection-overlay-${elementId}`} style={commonBoxStyle}>
      {/* Move-cursor body — the whole bounding box is the drag target. */}
      <button
        type="button"
        data-testid={`selection-move-${elementId}`}
        aria-label={`Move ${elementId}`}
        style={{
          ...moveBodyStyle,
          cursor: 'move',
        }}
        onPointerDown={handlePointerDown('move')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Eight resize handles. */}
      {(
        [
          ['top-left', { left: 0, top: 0, cursor: 'nwse-resize' }],
          ['top', { left: '50%', top: 0, cursor: 'ns-resize', transform: 'translate(-50%, -50%)' }],
          [
            'top-right',
            { left: '100%', top: 0, cursor: 'nesw-resize', transform: 'translate(-50%, -50%)' },
          ],
          [
            'right',
            { left: '100%', top: '50%', cursor: 'ew-resize', transform: 'translate(-50%, -50%)' },
          ],
          [
            'bottom-right',
            {
              left: '100%',
              top: '100%',
              cursor: 'nwse-resize',
              transform: 'translate(-50%, -50%)',
            },
          ],
          [
            'bottom',
            { left: '50%', top: '100%', cursor: 'ns-resize', transform: 'translate(-50%, -50%)' },
          ],
          [
            'bottom-left',
            { left: 0, top: '100%', cursor: 'nesw-resize', transform: 'translate(-50%, -50%)' },
          ],
          [
            'left',
            { left: 0, top: '50%', cursor: 'ew-resize', transform: 'translate(-50%, -50%)' },
          ],
        ] as const
      ).map(([handle, pos]) => (
        <button
          key={handle}
          type="button"
          data-testid={`selection-handle-${handle}-${elementId}`}
          data-handle={handle}
          aria-label={`Resize ${handle}`}
          style={{ ...handleStyle, ...pos }}
          onPointerDown={handlePointerDown(handle)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      ))}

      {/* Rotation handle floats above the top edge. */}
      <button
        type="button"
        data-testid={`selection-rotate-${elementId}`}
        aria-label={`Rotate ${elementId}`}
        style={rotateHandleStyle}
        onPointerDown={handlePointerDown('rotate')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gesture math
// ---------------------------------------------------------------------------

function applyGesture(
  g: ActiveGesture,
  deltaX: number,
  deltaY: number,
  event: ReactPointerEvent<HTMLElement>,
): Transform {
  const t = g.startTransform;
  switch (g.kind) {
    case 'move':
      return { ...t, x: t.x + deltaX, y: t.y + deltaY };
    case 'top-left':
      return cornerResize(t, deltaX, deltaY, { moveX: true, moveY: true });
    case 'top-right':
      return cornerResize(t, deltaX, deltaY, { moveX: false, moveY: true });
    case 'bottom-right':
      return cornerResize(t, deltaX, deltaY, { moveX: false, moveY: false });
    case 'bottom-left':
      return cornerResize(t, deltaX, deltaY, { moveX: true, moveY: false });
    case 'top':
      return edgeResize(t, { kind: 'top', deltaY });
    case 'bottom':
      return edgeResize(t, { kind: 'bottom', deltaY });
    case 'left':
      return edgeResize(t, { kind: 'left', deltaX });
    case 'right':
      return edgeResize(t, { kind: 'right', deltaX });
    case 'rotate': {
      const current = computePointerAngle(event, t);
      const next = (t.rotation ?? 0) + (current - g.rotateAnchorDeg);
      return { ...t, rotation: normalizeAngle(next) };
    }
  }
}

function cornerResize(
  t: Transform,
  deltaX: number,
  deltaY: number,
  opts: { moveX: boolean; moveY: boolean },
): Transform {
  // `moveX` encodes left-anchored corners: they move the x origin and
  // shrink width as the pointer moves right. Right-anchored corners
  // grow width as the pointer moves right. Same logic for the y axis.
  const x = opts.moveX ? t.x + deltaX : t.x;
  const width = Math.max(1, opts.moveX ? t.width - deltaX : t.width + deltaX);
  const y = opts.moveY ? t.y + deltaY : t.y;
  const height = Math.max(1, opts.moveY ? t.height - deltaY : t.height + deltaY);
  return { ...t, x, y, width, height };
}

type EdgeResize =
  | { kind: 'top'; deltaY: number }
  | { kind: 'bottom'; deltaY: number }
  | { kind: 'left'; deltaX: number }
  | { kind: 'right'; deltaX: number };

function edgeResize(t: Transform, edge: EdgeResize): Transform {
  switch (edge.kind) {
    case 'top':
      return {
        ...t,
        y: t.y + edge.deltaY,
        height: Math.max(1, t.height - edge.deltaY),
      };
    case 'bottom':
      return { ...t, height: Math.max(1, t.height + edge.deltaY) };
    case 'left':
      return {
        ...t,
        x: t.x + edge.deltaX,
        width: Math.max(1, t.width - edge.deltaX),
      };
    case 'right':
      return { ...t, width: Math.max(1, t.width + edge.deltaX) };
  }
}

function computePointerAngle(
  event: { clientX: number; clientY: number; currentTarget: Element | EventTarget },
  _transform: Transform,
): number {
  // Derive the element center in client pixels from the overlay box's
  // bounding rect. The overlay sits at transform.{x,y} inside the
  // scaled canvas plane, so `getBoundingClientRect()` already folds
  // scale + page offset into client coords.
  const target = event.currentTarget as HTMLElement;
  const box = target.closest<HTMLElement>('[data-testid^="selection-overlay-"]');
  if (!box) return 0;
  const rect = box.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const angleRad = Math.atan2(event.clientY - cy, event.clientX - cx);
  return angleRad * (180 / Math.PI);
}

function normalizeAngle(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

// ---------------------------------------------------------------------------
// Document mutation
// ---------------------------------------------------------------------------

function updateElementTransform(doc: Document, elementId: string, next: Transform): Document {
  if (doc.content.mode !== 'slide') return doc;
  const slides: Slide[] = doc.content.slides.map((slide) => ({
    ...slide,
    elements: mapElements(slide.elements, elementId, next),
  }));
  const content: SlideContent = { ...doc.content, slides };
  return { ...doc, content };
}

function mapElements(elements: Element[], elementId: string, next: Transform): Element[] {
  return elements.map((el) => {
    if (el.id === elementId) {
      return { ...el, transform: next } as Element;
    }
    if (el.type === 'group') {
      return { ...el, children: mapElements(el.children, elementId, next) };
    }
    return el;
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const moveBodyStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'transparent',
  border: '1.5px solid #81aeff',
  borderRadius: 2,
  padding: 0,
};

const handleStyle: CSSProperties = {
  position: 'absolute',
  width: 12,
  height: 12,
  padding: 0,
  background: '#81aeff',
  border: '2px solid #080f15',
  borderRadius: 2,
  transform: 'translate(-50%, -50%)',
};

const rotateHandleStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: -28,
  width: 14,
  height: 14,
  padding: 0,
  background: '#5af8fb',
  border: '2px solid #080f15',
  borderRadius: '50%',
  transform: 'translate(-50%, 0)',
  cursor: 'grab',
};
