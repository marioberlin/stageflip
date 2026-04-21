// packages/cdp-host-bundle/src/browser/entry.tsx
// Browser-side entry for the CDP host bundle. Vite compiles this to
// a single IIFE at `dist/browser/bundle.js` which the
// `runtimeBundleHostHtml` builder in `@stageflip/renderer-cdp`
// inlines into the host HTML sent to Chrome.
//
// Boot steps:
//   1. Register all live runtimes (T-100d ships CSS only; T-100e
//      extends to the other five).
//   2. Read the RIRDocument from the `<script id="__sf_doc"
//      type="application/json">` tag the host HTML injects.
//   3. Render `<BootedComposition>` into `#__sf_root` at frame 0.
//   4. Expose `window.__sf.setFrame(n)` — every call re-renders the
//      composition at frame `n`.
//   5. Flip `window.__sf.ready = true`.

import type { RIRDocument } from '@stageflip/rir';
import { registerRuntime } from '@stageflip/runtimes-contract';
import { createCssRuntime, solidBackgroundClip } from '@stageflip/runtimes-css';
import { type Root, createRoot } from 'react-dom/client';

import { BootedComposition } from '../composition.js';

declare global {
  interface Window {
    __sf?: {
      setFrame: (n: number) => void;
      ready: boolean;
    };
  }
}

function boot(): void {
  // Runtime registration. T-100d = CSS only. T-100e adds the rest.
  registerRuntime(createCssRuntime([solidBackgroundClip]));

  const docScript = document.getElementById('__sf_doc');
  if (!docScript) {
    throw new Error('cdp-host-bundle: expected #__sf_doc script tag');
  }
  const rirDocument = JSON.parse(docScript.textContent ?? 'null') as RIRDocument | null;
  if (!rirDocument) {
    throw new Error('cdp-host-bundle: #__sf_doc was empty or invalid');
  }

  const rootEl = document.getElementById('__sf_root');
  if (!rootEl) {
    throw new Error('cdp-host-bundle: expected #__sf_root mount point');
  }

  // `createRoot` returns a handle; every subsequent `setFrame` reuses
  // the same root so React can diff instead of unmounting.
  const root: Root = createRoot(rootEl);

  function renderFrame(frame: number): void {
    root.render(<BootedComposition document={rirDocument as RIRDocument} frame={frame} />);
  }

  renderFrame(0);

  window.__sf = {
    setFrame: renderFrame,
    ready: true,
  };
}

boot();
