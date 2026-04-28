// packages/runtimes/interactive/src/fallback-rendering.test.ts
// T-306 AC #19–#20 — `renderStaticFallback` minimum DOM rendering and
// defensive empty-array handling.

import type { Element } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { renderStaticFallback } from './fallback-rendering.js';

const TF = { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 };

describe('renderStaticFallback', () => {
  it('AC #19 — text element renders into a span', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'a',
          type: 'text',
          transform: TF,
          text: 'Hello',
        } as unknown as Element,
      ],
      root,
    );
    // React renders asynchronously in the test env; wait a microtask.
    return Promise.resolve().then(() => {
      const span = root.querySelector('[data-stageflip-fallback="text"]');
      expect(span?.textContent).toBe('Hello');
      handle.root.unmount();
    });
  });

  it('AC #19 — image element renders into an img', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'b',
          type: 'image',
          transform: TF,
          src: 'http://example/x.png',
          alt: 'alt',
        } as unknown as Element,
      ],
      root,
    );
    return Promise.resolve().then(() => {
      const img = root.querySelector('[data-stageflip-fallback="image"]');
      expect(img?.getAttribute('src')).toBe('http://example/x.png');
      expect(img?.getAttribute('alt')).toBe('alt');
      handle.root.unmount();
    });
  });

  it('AC #19 — shape element renders into a div', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'c',
          type: 'shape',
          transform: TF,
        } as unknown as Element,
      ],
      root,
    );
    return Promise.resolve().then(() => {
      const div = root.querySelector('[data-stageflip-fallback="shape"]');
      expect(div).not.toBeNull();
      handle.root.unmount();
    });
  });

  it('AC #19 — unknown element type renders into a placeholder div with the type tag', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'd',
          type: 'video',
          transform: TF,
          src: 'x.mp4',
        } as unknown as Element,
      ],
      root,
    );
    return Promise.resolve().then(() => {
      const placeholder = root.querySelector('[data-stageflip-fallback="video"]');
      expect(placeholder).not.toBeNull();
      handle.root.unmount();
    });
  });

  it('AC #20 — empty array renders without throwing', () => {
    const root = document.createElement('div');
    expect(() => {
      const handle = renderStaticFallback([], root);
      handle.root.unmount();
    }).not.toThrow();
  });

  it('handle exposes the rendered element array for diagnostics', () => {
    const root = document.createElement('div');
    const elements = [
      {
        id: 'e',
        type: 'text',
        transform: TF,
        text: 'x',
      } as unknown as Element,
    ];
    const handle = renderStaticFallback(elements, root);
    expect(handle.rendered).toEqual(elements);
    handle.root.unmount();
  });

  it('text element with non-string content renders empty', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'f',
          type: 'text',
          transform: TF,
          text: 42,
        } as unknown as Element,
      ],
      root,
    );
    return Promise.resolve().then(() => {
      const span = root.querySelector('[data-stageflip-fallback="text"]');
      expect(span?.textContent).toBe('');
      handle.root.unmount();
    });
  });

  it('image element with non-string src renders without setting src/alt to anything truthy', () => {
    const root = document.createElement('div');
    const handle = renderStaticFallback(
      [
        {
          id: 'g',
          type: 'image',
          transform: TF,
        } as unknown as Element,
      ],
      root,
    );
    const img = root.querySelector('[data-stageflip-fallback="image"]');
    expect(img).not.toBeNull();
    // happy-dom may report null OR empty string for an empty-string src
    // — we only care that no real URL leaked through.
    const src = img?.getAttribute('src');
    expect(src === '' || src === null).toBe(true);
    handle.root.unmount();
  });
});
