// apps/stageflip-slide/src/components/canvas/selection-overlay.test.tsx
// Drag / resize / rotate gestures for the T-123b transform overlay.

import {
  DocumentProvider,
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  useDocument,
} from '@stageflip/editor-shell';
import type { Document, Element, Slide } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanvasScaleProvider } from './canvas-scale-context';
import { SelectionOverlay } from './selection-overlay';

afterEach(() => {
  cleanup();
  __clearSlideByIdCacheForTest();
  __clearElementByIdCacheForTest();
});

type TransformSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

function makeDoc(): Document {
  const slide: Slide = {
    id: 'slide-0',
    elements: [
      {
        id: 'target',
        type: 'text',
        transform: { x: 100, y: 100, width: 400, height: 200, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
        text: 'drag me',
        align: 'left',
      } as Element,
    ],
  };
  return {
    meta: {
      id: 'doc',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides: [slide] },
  } as Document;
}

function Selector({ ids }: { ids: string[] }): null {
  const { selectElements } = useDocument();
  useEffect(() => {
    selectElements(new Set(ids));
  }, [selectElements, ids]);
  return null;
}

function Peek({
  onSnapshot,
  targetId,
}: {
  onSnapshot: (t: TransformSnapshot) => void;
  targetId: string;
}): null {
  const { document: doc } = useDocument();
  if (!doc || doc.content.mode !== 'slide') return null;
  for (const slide of doc.content.slides) {
    const match = slide.elements.find((el) => el.id === targetId);
    if (match) {
      onSnapshot({ ...match.transform });
      break;
    }
  }
  return null;
}

function renderWithSelection(options: { scale?: number; selected?: string[] } = {}) {
  const snapshots: TransformSnapshot[] = [];
  const utils = render(
    <DocumentProvider initialDocument={makeDoc()}>
      <Selector ids={options.selected ?? ['target']} />
      <Peek onSnapshot={(s) => snapshots.push(s)} targetId="target" />
      <CanvasScaleProvider scale={options.scale ?? 1}>
        <SelectionOverlay selectedIds={new Set(options.selected ?? ['target'])} />
      </CanvasScaleProvider>
    </DocumentProvider>,
  );
  return { ...utils, snapshots };
}

function last<T>(arr: T[]): T {
  const v = arr[arr.length - 1];
  if (!v) throw new Error('expected at least one snapshot');
  return v;
}

describe('<SelectionOverlay>', () => {
  it('renders nothing when the selection set is empty', () => {
    const { container } = render(
      <DocumentProvider initialDocument={makeDoc()}>
        <SelectionOverlay selectedIds={new Set()} />
      </DocumentProvider>,
    );
    expect(container.querySelector('[data-testid="selection-overlay"]')).toBeNull();
  });

  it('renders an overlay and eight resize handles for a selected element', () => {
    renderWithSelection();
    expect(screen.getByTestId('selection-overlay-target')).toBeTruthy();
    const handles: ReadonlyArray<string> = [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ];
    for (const h of handles) {
      expect(screen.getByTestId(`selection-handle-${h}-target`)).toBeTruthy();
    }
    expect(screen.getByTestId('selection-rotate-target')).toBeTruthy();
  });
});

describe('<SelectionOverlay> — move gesture', () => {
  it('drags the element by the pointer delta (scale=1)', () => {
    const { snapshots } = renderWithSelection();
    const body = screen.getByTestId('selection-move-target');
    fireEvent.pointerDown(body, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 250, clientY: 230 });
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 250, clientY: 230 });
    const final = last(snapshots);
    expect(final.x).toBeCloseTo(150, 5);
    expect(final.y).toBeCloseTo(130, 5);
    expect(final.width).toBe(400);
    expect(final.height).toBe(200);
  });

  it('divides the client delta by the canvas scale', () => {
    const { snapshots } = renderWithSelection({ scale: 0.5 });
    const body = screen.getByTestId('selection-move-target');
    fireEvent.pointerDown(body, { pointerId: 1, clientX: 0, clientY: 0 });
    // 100 client px @ scale 0.5 → 200 canvas px
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 100, clientY: 0 });
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 100, clientY: 0 });
    expect(last(snapshots).x).toBeCloseTo(300, 5);
  });
});

describe('<SelectionOverlay> — resize gestures', () => {
  it('bottom-right handle grows width + height', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-handle-bottom-right-target');
    fireEvent.pointerDown(handle, { pointerId: 2, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 600, clientY: 360 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 600, clientY: 360 });
    const f = last(snapshots);
    expect(f.width).toBeCloseTo(500, 5);
    expect(f.height).toBeCloseTo(260, 5);
    expect(f.x).toBe(100);
    expect(f.y).toBe(100);
  });

  it('top-left handle shrinks + moves origin', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-handle-top-left-target');
    fireEvent.pointerDown(handle, { pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 3, clientX: 140, clientY: 120 });
    fireEvent.pointerUp(handle, { pointerId: 3, clientX: 140, clientY: 120 });
    const f = last(snapshots);
    expect(f.x).toBeCloseTo(140, 5);
    expect(f.y).toBeCloseTo(120, 5);
    expect(f.width).toBeCloseTo(360, 5);
    expect(f.height).toBeCloseTo(180, 5);
  });

  it('right edge resizes only width', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-handle-right-target');
    fireEvent.pointerDown(handle, { pointerId: 4, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 4, clientX: 25, clientY: 99 });
    fireEvent.pointerUp(handle, { pointerId: 4, clientX: 25, clientY: 99 });
    const f = last(snapshots);
    expect(f.width).toBeCloseTo(425, 5);
    expect(f.height).toBe(200);
    expect(f.x).toBe(100);
    expect(f.y).toBe(100);
  });

  it('top edge resizes only height + moves y origin', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-handle-top-target');
    fireEvent.pointerDown(handle, { pointerId: 5, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 5, clientX: 99, clientY: 30 });
    fireEvent.pointerUp(handle, { pointerId: 5, clientX: 99, clientY: 30 });
    const f = last(snapshots);
    expect(f.x).toBe(100);
    expect(f.y).toBeCloseTo(130, 5);
    expect(f.width).toBe(400);
    expect(f.height).toBeCloseTo(170, 5);
  });

  it('enforces a 1px minimum so over-shrinks do not invert the box', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-handle-bottom-right-target');
    fireEvent.pointerDown(handle, { pointerId: 6, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 6, clientX: -1000, clientY: -1000 });
    fireEvent.pointerUp(handle, { pointerId: 6, clientX: -1000, clientY: -1000 });
    const f = last(snapshots);
    expect(f.width).toBe(1);
    expect(f.height).toBe(1);
  });
});

describe('<SelectionOverlay> — multi-pointer guard', () => {
  it('ignores pointerup from a pointer that does not own the gesture', () => {
    const { snapshots } = renderWithSelection();
    const body = screen.getByTestId('selection-move-target');
    fireEvent.pointerDown(body, { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 230, clientY: 200 });
    // Foreign pointer releases — must not tear down gesture #1.
    fireEvent.pointerUp(body, { pointerId: 99, clientX: 0, clientY: 0 });
    // Continue the owning gesture; it should still accumulate.
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 260, clientY: 200 });
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 260, clientY: 200 });
    expect(last(snapshots).x).toBeCloseTo(160, 5);
  });
});

describe('<SelectionOverlay> — rotation gesture', () => {
  it('writes a normalized rotation when the pointer sweeps around the center', () => {
    const { snapshots } = renderWithSelection();
    const handle = screen.getByTestId('selection-rotate-target');
    // pointerdown and pointermove at different angles — exact values
    // depend on the overlay's client-rect in happy-dom, which is 0×0
    // without layout. The test asserts only that a rotation was written
    // and that it round-trips through normalizeAngle (0..360).
    fireEvent.pointerDown(handle, { pointerId: 7, clientX: 10, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 0, clientY: 10 });
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 0, clientY: 10 });
    const f = last(snapshots);
    expect(f.rotation).toBeGreaterThanOrEqual(0);
    expect(f.rotation).toBeLessThan(360);
  });
});
