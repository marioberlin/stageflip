// packages/cdp-host-bundle/src/test-setup.ts
// happy-dom ships a minimal Canvas but `getContext('2d')` returns
// `null`, which trips import-time initialisers in `lottie-web` (and
// potentially other runtime deps). This file polyfills the method
// with a no-op 2D context stub so the modules can be imported in
// unit tests. Real Chrome (the actual bundle consumer) provides a
// working canvas — the polyfill only exists for the test lane.

if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function stubbedGetContext(
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown,
  ): unknown {
    const real = originalGetContext.call(
      this,
      contextId as '2d',
      options as CanvasRenderingContext2DSettings,
    );
    if (real !== null) return real;
    if (contextId === '2d') {
      // Minimal 2D context stub — every method is a no-op, every
      // property is settable. Enough for lottie-web's load-time
      // "create a 1x1 canvas + paint transparent" initialiser.
      return new Proxy(
        {},
        {
          get() {
            return () => undefined;
          },
          set() {
            return true;
          },
        },
      );
    }
    return null;
  } as HTMLCanvasElement['getContext'];
}
