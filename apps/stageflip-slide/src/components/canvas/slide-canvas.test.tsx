// apps/stageflip-slide/src/components/canvas/slide-canvas.test.tsx
// Covers <SlideCanvas>: active-slide resolution via atoms, empty state
// when no slide is active, element rendering, and the scale-to-fit
// computation (via the `viewportSizeForTest` seam).

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CANVAS_HEIGHT, CANVAS_WIDTH, SlideCanvas } from './slide-canvas';

afterEach(() => {
  cleanup();
});

function makeDoc(): Document {
  return {
    meta: {
      id: 'doc-test',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide-0',
          elements: [
            {
              id: 'el-1',
              type: 'text',
              transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              text: 'First',
              align: 'left',
            },
          ],
        },
        {
          id: 'slide-1',
          elements: [],
        },
      ],
    },
  } as Document;
}

function Harness({
  children,
  initialDoc,
  activate,
}: {
  children: React.ReactNode;
  initialDoc?: Document | null;
  activate?: string;
}): React.ReactElement {
  return (
    <DocumentProvider {...(initialDoc !== undefined ? { initialDocument: initialDoc } : {})}>
      {activate !== undefined ? <Activator slideId={activate} /> : null}
      {children}
    </DocumentProvider>
  );
}

function Activator({ slideId }: { slideId: string }): null {
  const { setActiveSlide } = useDocument();
  useEffect(() => {
    setActiveSlide(slideId);
  }, [setActiveSlide, slideId]);
  return null;
}

describe('<SlideCanvas>', () => {
  it('shows the empty state when no slide is active', () => {
    render(
      <Harness initialDoc={null}>
        <SlideCanvas viewportSizeForTest={{ width: 800, height: 600 }} />
      </Harness>,
    );
    expect(screen.getByTestId('slide-canvas-empty')).toBeTruthy();
  });

  it('renders the active slide and its elements when one is selected', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="slide-0">
        <SlideCanvas viewportSizeForTest={{ width: 1920, height: 1080 }} />
      </Harness>,
    );
    const canvas = screen.getByTestId('slide-canvas');
    expect(canvas.getAttribute('data-active-slide-id')).toBe('slide-0');
    expect(screen.getByTestId('element-el-1')).toBeTruthy();
    expect(screen.getByText('First')).toBeTruthy();
  });

  it('shows empty state when the active slide has no elements', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="slide-1">
        <SlideCanvas viewportSizeForTest={{ width: 1920, height: 1080 }} />
      </Harness>,
    );
    const canvas = screen.getByTestId('slide-canvas');
    expect(canvas.getAttribute('data-active-slide-id')).toBe('slide-1');
    // Empty state only renders when no slide at all — with a resolved empty
    // slide the plane still renders, just without any element children.
    const plane = screen.getByTestId('slide-canvas-plane');
    expect(plane.children.length).toBe(0);
  });

  it('falls back to empty state when active slide id does not resolve', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="does-not-exist">
        <SlideCanvas viewportSizeForTest={{ width: 1920, height: 1080 }} />
      </Harness>,
    );
    expect(screen.getByTestId('slide-canvas-empty')).toBeTruthy();
  });

  it('scale-to-fit uses the smaller axis ratio (viewport < canvas)', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="slide-0">
        <SlideCanvas viewportSizeForTest={{ width: 960, height: 540 }} />
      </Harness>,
    );
    const plane = screen.getByTestId('slide-canvas-plane');
    // 960/1920 = 0.5; 540/1080 = 0.5 → exact fit both axes.
    expect(plane.style.transform).toBe('scale(0.5)');
  });

  it('scale-to-fit clamps to the smaller axis when aspect ratios mismatch', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="slide-0">
        {/* Viewport is wider than canvas-aspect; height wins.
            960 / 1080 ≈ 0.8888…; 1920 / 1920 = 1; min = 0.888… */}
        <SlideCanvas viewportSizeForTest={{ width: 1920, height: 960 }} />
      </Harness>,
    );
    const plane = screen.getByTestId('slide-canvas-plane');
    // Height-bound → 960/1080 ≈ 0.888888…
    const match = plane.style.transform.match(/scale\(([\d.]+)\)/);
    expect(match).not.toBeNull();
    const scale = Number.parseFloat(match?.[1] ?? '0');
    expect(scale).toBeCloseTo(960 / 1080, 5);
  });

  it('plane has the canonical 1920×1080 dimensions regardless of viewport', () => {
    render(
      <Harness initialDoc={makeDoc()} activate="slide-0">
        <SlideCanvas viewportSizeForTest={{ width: 400, height: 300 }} />
      </Harness>,
    );
    const plane = screen.getByTestId('slide-canvas-plane');
    expect(plane.style.width).toBe(`${CANVAS_WIDTH}px`);
    expect(plane.style.height).toBe(`${CANVAS_HEIGHT}px`);
  });
});
