// packages/editor-shell/src/banner-size/components.test.tsx
// T-201 — <BannerSizeGrid> + <BannerSizePreview> behaviour.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BannerSizeGrid, BannerSizePreview } from './components';
import type { BannerSize } from './math';

afterEach(cleanup);

const IAB: BannerSize[] = [
  { width: 300, height: 250, id: 'mpu', name: 'Medium Rectangle' },
  { width: 728, height: 90, id: 'lb', name: 'Leaderboard' },
  { width: 160, height: 600, id: 'skyscraper', name: 'Wide Skyscraper' },
];

describe('<BannerSizePreview>', () => {
  it('renders the dimensions as data attributes', () => {
    render(
      <BannerSizePreview
        size={{ width: 300, height: 250, id: 'mpu' }}
        widthPx={150}
        heightPx={125}
        scale={0.5}
      />,
    );
    const el = screen.getByTestId('sf-banner-preview-mpu');
    expect(el.dataset.bannerWidth).toBe('300');
    expect(el.dataset.bannerHeight).toBe('250');
    expect(el.dataset.bannerScale).toBe('0.5000');
  });

  it('falls back to WxH id when no id is supplied', () => {
    render(
      <BannerSizePreview size={{ width: 728, height: 90 }} widthPx={728} heightPx={90} scale={1} />,
    );
    expect(screen.getByTestId('sf-banner-preview-728x90')).toBeTruthy();
  });

  it('clips host content with overflow:hidden', () => {
    render(
      <BannerSizePreview
        size={{ width: 300, height: 250, id: 'mpu' }}
        widthPx={300}
        heightPx={250}
        scale={1}
      />,
    );
    expect(screen.getByTestId('sf-banner-preview-mpu').style.overflow).toBe('hidden');
  });
});

describe('<BannerSizeGrid>', () => {
  it('renders one preview per IAB banner', () => {
    render(<BannerSizeGrid sizes={IAB} container={{ width: 1500, height: 800 }} />);
    expect(screen.getByTestId('sf-banner-preview-mpu')).toBeTruthy();
    expect(screen.getByTestId('sf-banner-preview-lb')).toBeTruthy();
    expect(screen.getByTestId('sf-banner-preview-skyscraper')).toBeTruthy();
  });

  it('renders the banner name as fallback content', () => {
    render(<BannerSizeGrid sizes={IAB} container={{ width: 1500, height: 800 }} />);
    expect(screen.getByTestId('sf-banner-preview-mpu').textContent).toContain('Medium Rectangle');
  });

  it('threads currentFrame into the grid data attribute', () => {
    render(
      <BannerSizeGrid sizes={IAB} container={{ width: 1500, height: 800 }} currentFrame={42} />,
    );
    expect(screen.getByTestId('sf-banner-grid').dataset.currentFrame).toBe('42');
  });

  it('threads currentFrame to every renderPreview callback', () => {
    const calls: Array<{ id: string; frame: number }> = [];
    render(
      <BannerSizeGrid
        sizes={IAB}
        container={{ width: 1500, height: 800 }}
        currentFrame={17}
        renderPreview={(p, frame) => {
          calls.push({ id: p.size.id ?? 'x', frame });
          return null;
        }}
      />,
    );
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(call.frame).toBe(17);
  });

  it('defaults currentFrame to 0 when not supplied', () => {
    let seenFrame = -1;
    render(
      <BannerSizeGrid
        sizes={[{ width: 300, height: 250, id: 'mpu' }]}
        container={{ width: 300, height: 250 }}
        renderPreview={(_, frame) => {
          seenFrame = frame;
          return null;
        }}
      />,
    );
    expect(seenFrame).toBe(0);
  });

  it('uses the computed uniform scale for every cell', () => {
    render(<BannerSizeGrid sizes={IAB} container={{ width: 600, height: 800 }} />);
    const scales = IAB.map((s) => {
      const el = screen.getByTestId(`sf-banner-preview-${s.id}`);
      return Number(el.dataset.bannerScale);
    });
    expect(new Set(scales).size).toBe(1);
    for (const s of scales) {
      expect(s).toBeLessThan(1);
    }
  });

  it('renders nothing for empty sizes', () => {
    render(<BannerSizeGrid sizes={[]} container={{ width: 1000, height: 800 }} />);
    const grid = screen.getByTestId('sf-banner-grid');
    expect(grid.children.length).toBe(0);
  });

  it('passes the placement to renderPreview verbatim', () => {
    let captured: { widthPx: number; heightPx: number; scale: number } | null = null;
    render(
      <BannerSizeGrid
        sizes={[{ width: 300, height: 250, id: 'mpu' }]}
        container={{ width: 600, height: 800 }}
        renderPreview={(p) => {
          captured = { widthPx: p.widthPx, heightPx: p.heightPx, scale: p.scale };
          return null;
        }}
      />,
    );
    expect(captured).not.toBeNull();
    expect(captured?.scale).toBe(1); // container large enough for 1:1
    expect(captured?.widthPx).toBe(300);
    expect(captured?.heightPx).toBe(250);
  });
});
