// packages/editor-shell/src/aspect-ratio/components.test.tsx
// Behavioural tests for the aspect-ratio bouncer components (T-182).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AspectRatioGrid, AspectRatioPreview } from './components';
import { COMMON_ASPECTS } from './math';

afterEach(() => cleanup());

describe('<AspectRatioPreview>', () => {
  it('renders at the supplied dimensions', () => {
    render(<AspectRatioPreview aspect={{ w: 16, h: 9 }} widthPx={320} heightPx={180} />);
    const el = screen.getByTestId('sf-aspect-preview-16:9');
    expect(el.style.width).toBe('320px');
    expect(el.style.height).toBe('180px');
    expect(el.style.overflow).toBe('hidden');
  });

  it('publishes aspect data attributes', () => {
    render(
      <AspectRatioPreview
        aspect={{ w: 9, h: 16, label: 'portrait' }}
        widthPx={90}
        heightPx={160}
      />,
    );
    const el = screen.getByTestId('sf-aspect-preview-portrait');
    expect(el.getAttribute('data-aspect-w')).toBe('9');
    expect(el.getAttribute('data-aspect-h')).toBe('16');
    expect(el.getAttribute('data-aspect-label')).toBe('portrait');
  });

  it('falls back to `w:h` when no label is given', () => {
    render(<AspectRatioPreview aspect={{ w: 4, h: 5 }} widthPx={80} heightPx={100} />);
    expect(screen.getByTestId('sf-aspect-preview-4:5')).toBeTruthy();
  });

  it('renders children inside the frame', () => {
    render(
      <AspectRatioPreview aspect={{ w: 1, h: 1 }} widthPx={100} heightPx={100}>
        <span data-testid="inner">hi</span>
      </AspectRatioPreview>,
    );
    expect(screen.getByTestId('inner').textContent).toBe('hi');
  });
});

describe('<AspectRatioGrid>', () => {
  it('renders one preview per aspect', () => {
    render(<AspectRatioGrid aspects={COMMON_ASPECTS} container={{ width: 1000, height: 400 }} />);
    expect(screen.getByTestId('sf-aspect-preview-16:9')).toBeTruthy();
    expect(screen.getByTestId('sf-aspect-preview-1:1')).toBeTruthy();
    expect(screen.getByTestId('sf-aspect-preview-9:16')).toBeTruthy();
  });

  it('defaults each preview content to the aspect label when no renderPreview is given', () => {
    render(<AspectRatioGrid aspects={[{ w: 16, h: 9 }]} container={{ width: 400, height: 200 }} />);
    expect(screen.getByTestId('sf-aspect-preview-16:9').textContent).toBe('16:9');
  });

  it('calls renderPreview for each placement', () => {
    render(
      <AspectRatioGrid
        aspects={COMMON_ASPECTS}
        container={{ width: 1000, height: 400 }}
        renderPreview={(p) => (
          <span data-testid={`inner-${p.aspect.label}`}>
            {p.widthPx.toFixed(0)}×{p.heightPx.toFixed(0)}
          </span>
        )}
      />,
    );
    // Each preview rendered its computed dimensions
    expect(screen.getByTestId('inner-16:9')).toBeTruthy();
    expect(screen.getByTestId('inner-1:1')).toBeTruthy();
    expect(screen.getByTestId('inner-9:16')).toBeTruthy();
  });

  it('sets row gap to the configured gapPx', () => {
    render(
      <AspectRatioGrid
        aspects={COMMON_ASPECTS}
        container={{ width: 1000, height: 400 }}
        layoutOptions={{ gapPx: 24 }}
      />,
    );
    const grid = screen.getByTestId('sf-aspect-grid');
    expect(grid.style.gap).toBe('24px');
  });

  it('renders nothing but the container when aspects is empty', () => {
    render(<AspectRatioGrid aspects={[]} container={{ width: 1000, height: 400 }} />);
    const grid = screen.getByTestId('sf-aspect-grid');
    expect(grid.children.length).toBe(0);
  });
});
