// packages/runtimes/audience/src/clips/heatmap/__harness.ts
// T-469 — Test-only harness for mounting the heatmap clip's React tree
// under happy-dom with a stubbed canvas 2D context. Lets the static-
// fallback tests cover the `useEffect` → `putImageData` path without
// shipping a full canvas backend.
//
// `__`-prefixed module name marks this as test-only — the workspace's
// coverage exclude list passes it through but the file is never
// shipped to consumers.

import { act } from 'react';
import type { ReactElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';

/**
 * Options for the harness. `onPutImageData` fires once per
 * `putImageData` call inside the canvas-overlay effect.
 */
export interface JSDOMReactHarnessOptions {
  /** Invoked when the canvas effect calls `putImageData`. */
  readonly onPutImageData?: () => void;
}

/**
 * Minimal harness: opens a React root over a fresh `<div>` in
 * `document.body`, replaces `HTMLCanvasElement.prototype.getContext`
 * with a 2D-context stub, and exposes `flushEffects` for awaiting the
 * `useEffect` microtask cycle.
 */
export class JSDOMReactHarness {
  private readonly host: HTMLElement;
  private readonly reactRoot: Root;
  private readonly originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  private constructor(host: HTMLElement, root: Root) {
    this.host = host;
    this.reactRoot = root;
    this.originalGetContext = HTMLCanvasElement.prototype.getContext;
  }

  /** Create a harness, installing the canvas-context stub. */
  static async create(options: JSDOMReactHarnessOptions): Promise<JSDOMReactHarness> {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const reactRoot = createRoot(host);
    const harness = new JSDOMReactHarness(host, reactRoot);
    const onPutImageData = options.onPutImageData ?? (() => {});
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function getContextStub() {
        return {
          putImageData: (): void => {
            onPutImageData();
          },
        };
      },
    });
    return harness;
  }

  /** Render the React tree under the harness's root. */
  render(tree: ReactElement): void {
    void act(() => {
      this.reactRoot.render(tree);
    });
  }

  /** Wait one microtask cycle so React effects run. */
  async flushEffects(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
    });
  }

  /** Tear down the React root + restore the canvas stub. */
  dispose(): void {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: this.originalGetContext,
    });
    void act(() => {
      this.reactRoot.unmount();
    });
    if (this.host.parentNode !== null) {
      this.host.parentNode.removeChild(this.host);
    }
  }
}
