// apps/stageflip-slide/src/components/canvas/element-view.test.tsx
// Pins per-type rendering for the T-123a read-only viewport.

import type {
  Element,
  ImageElement,
  ShapeElement,
  TextElement,
  VideoElement,
} from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ElementView } from './element-view';

afterEach(() => {
  cleanup();
});

function baseTransform() {
  return { x: 100, y: 200, width: 400, height: 80, rotation: 0, opacity: 1 };
}

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: overrides.id ?? 'el-text',
    type: 'text',
    transform: baseTransform(),
    visible: true,
    locked: false,
    animations: [],
    text: 'Hello world',
    align: 'left',
    ...overrides,
  } as TextElement;
}

describe('ElementView — layout', () => {
  it('positions the element via absolute left/top/width/height', () => {
    const el = makeText();
    render(<ElementView element={el} />);
    const node = screen.getByTestId(`element-${el.id}`);
    expect(node.style.position).toBe('absolute');
    expect(node.style.left).toBe('100px');
    expect(node.style.top).toBe('200px');
    expect(node.style.width).toBe('400px');
    expect(node.style.height).toBe('80px');
  });

  it('applies rotation + opacity via CSS transform', () => {
    const el = makeText({
      transform: { ...baseTransform(), rotation: 45, opacity: 0.4 },
    });
    render(<ElementView element={el} />);
    const node = screen.getByTestId(`element-${el.id}`);
    expect(node.style.transform).toContain('rotate(45deg)');
    expect(node.style.opacity).toBe('0.4');
  });

  it('exposes element id + type as data attributes for selectors', () => {
    const el = makeText({ id: 'selector-probe' });
    render(<ElementView element={el} />);
    const node = screen.getByTestId(`element-${el.id}`);
    expect(node.dataset.elementId).toBe('selector-probe');
    expect(node.dataset.elementType).toBe('text');
  });

  it('does not render when visible is false', () => {
    const el = makeText({ visible: false });
    const { container } = render(<ElementView element={el} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ElementView — per-type content', () => {
  it('text elements render the text inside a styled span', () => {
    render(<ElementView element={makeText({ text: 'Hello world' })} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('image elements expose the asset ref via data attribute (no browser load)', () => {
    const el: ImageElement = {
      id: 'el-image',
      type: 'image',
      transform: baseTransform(),
      visible: true,
      locked: false,
      animations: [],
      src: 'asset:img-123',
      fit: 'cover',
    } as ImageElement;
    const { container } = render(<ElementView element={el} />);
    const inner = container.querySelector('[data-asset-ref]');
    expect(inner?.getAttribute('data-asset-ref')).toBe('asset:img-123');
  });

  it('shape elements render an SVG with the fill applied', () => {
    const el: ShapeElement = {
      id: 'el-shape',
      type: 'shape',
      transform: baseTransform(),
      visible: true,
      locked: false,
      animations: [],
      shape: 'rect',
      fill: '#abcdef',
    } as ShapeElement;
    const { container } = render(<ElementView element={el} />);
    const rect = container.querySelector('svg rect');
    expect(rect?.getAttribute('fill')).toBe('#abcdef');
  });

  it('ellipse shape renders an <ellipse> sized to the transform', () => {
    const el: ShapeElement = {
      id: 'el-ellipse',
      type: 'shape',
      transform: { ...baseTransform(), width: 200, height: 100 },
      visible: true,
      locked: false,
      animations: [],
      shape: 'ellipse',
      fill: '#5af8fb',
    } as ShapeElement;
    const { container } = render(<ElementView element={el} />);
    const ellipse = container.querySelector('svg ellipse');
    expect(ellipse).not.toBeNull();
    expect(ellipse?.getAttribute('rx')).toBe('100');
    expect(ellipse?.getAttribute('ry')).toBe('50');
  });

  it('video elements render a labelled placeholder and expose the asset ref', () => {
    const el: VideoElement = {
      id: 'el-video',
      type: 'video',
      transform: baseTransform(),
      visible: true,
      locked: false,
      animations: [],
      src: 'asset:clip-99',
      muted: true,
      loop: true,
      playbackRate: 1,
    } as VideoElement;
    const { container } = render(<ElementView element={el} />);
    const inner = container.querySelector('[data-asset-ref]');
    expect(inner?.getAttribute('data-asset-ref')).toBe('asset:clip-99');
    expect(inner?.textContent).toMatch(/video/i);
  });

  it('group elements render every child (not just the first)', () => {
    const a = makeText({ id: 'child-a', text: 'alpha' });
    const b = makeText({ id: 'child-b', text: 'beta' });
    const c = makeText({ id: 'child-c', text: 'gamma' });
    const group: Element = {
      id: 'el-group',
      type: 'group',
      transform: baseTransform(),
      visible: true,
      locked: false,
      animations: [],
      children: [a, b, c],
      clip: false,
    } as Element;
    render(<ElementView element={group} />);
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('beta')).toBeTruthy();
    expect(screen.getByText('gamma')).toBeTruthy();
  });

  it('chart/table/clip/embed/code render a type-labelled placeholder', () => {
    const kinds = ['chart', 'table', 'clip', 'embed', 'code'] as const;
    for (const type of kinds) {
      const { container, unmount } = render(
        <ElementView
          element={
            {
              id: `el-${type}`,
              type,
              transform: baseTransform(),
              visible: true,
              locked: false,
              animations: [],
            } as unknown as Element
          }
        />,
      );
      expect(container.textContent?.toLowerCase()).toContain(type);
      unmount();
    }
  });
});
