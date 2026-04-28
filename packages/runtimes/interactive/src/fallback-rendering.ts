// packages/runtimes/interactive/src/fallback-rendering.ts
// Per-T-306 D-T306-1 helpers for falling back to `staticFallback` rendering
// on tenant-deny / permission-deny. T-306 ships a minimal DOM rendering of
// the canonical-element array; per the AC #19 escape hatch, the divergence
// from `@stageflip/renderer-core` is documented here:
//
// - `text` → `<span>` with the element's `text` content + position.
// - `image` → `<img src=...>` with `alt`.
// - `shape` → `<div>` with a CSS `background`.
// - everything else → an empty `<div>` placeholder; Phase γ will add a real
//   bridge to renderer-core (or extract a shared helper). The escalation
//   trigger for that work is the third bullet in T-306 §"Escalation triggers".
//
// We DO NOT pull in `@stageflip/renderer-core` here because:
//   1. It would create a circular dependency at the workspace level
//      (renderer-core consumes runtime-tier outputs in Phase γ).
//   2. T-306 is explicitly the host package; full element rendering is a
//      Phase γ concern coordinated with the first frontier-clip ship.
//
// Browser-safe: React 19 createRoot + DOM. No Node imports.

import type { Element } from '@stageflip/schema';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';

/**
 * Result of `renderStaticFallback` — exposes the React `Root` so the
 * mount-harness can `unmount()` it on dispose.
 */
export interface StaticFallbackHandle {
  /** Underlying React root; the harness calls `unmount()` on dispose. */
  root: Root;
  /** The element array that was rendered (kept for diagnostics + tests). */
  rendered: ReadonlyArray<Element>;
}

/**
 * Render the static-fallback element array into `root`. Defensive against
 * an empty array (T-305 schema rejects it, but the function does not throw
 * — an empty render is preferable to a crashed clip in the live tree).
 */
export function renderStaticFallback(
  elements: ReadonlyArray<Element>,
  root: HTMLElement,
): StaticFallbackHandle {
  const reactRoot = createRoot(root);
  // Synchronous flush so callers can assert on DOM state immediately.
  // The static-fallback path is small and on the unmount-on-deny path —
  // a synchronous render keeps the harness's handle correct (DOM is
  // present before we return to the caller).
  flushSync(() => {
    reactRoot.render(React.createElement(StaticFallbackList, { elements }));
  });
  return { root: reactRoot, rendered: elements };
}

/**
 * Internal React component — renders each element via a tag-by-type
 * dispatch. Per the file header, this is a deliberate minimum; a full
 * bridge to `@stageflip/renderer-core` is a Phase γ task.
 */
function StaticFallbackList({
  elements,
}: {
  elements: ReadonlyArray<Element>;
}): React.ReactElement {
  return React.createElement(
    React.Fragment,
    null,
    ...elements.map((element, idx) =>
      React.createElement(StaticFallbackElement, { key: idx, element }),
    ),
  );
}

function StaticFallbackElement({
  element,
}: {
  element: Element;
}): React.ReactElement {
  switch (element.type) {
    case 'text': {
      const content = (element as { text?: unknown }).text;
      return React.createElement(
        'span',
        { 'data-stageflip-fallback': 'text' },
        typeof content === 'string' ? content : '',
      );
    }
    case 'image': {
      const src = (element as { src?: unknown }).src;
      const alt = (element as { alt?: unknown }).alt;
      return React.createElement('img', {
        'data-stageflip-fallback': 'image',
        src: typeof src === 'string' ? src : '',
        alt: typeof alt === 'string' ? alt : '',
      });
    }
    case 'shape': {
      return React.createElement('div', {
        'data-stageflip-fallback': 'shape',
      });
    }
    default:
      return React.createElement('div', {
        'data-stageflip-fallback': element.type,
      });
  }
}
