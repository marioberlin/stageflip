// apps/stageflip-slide/src/components/canvas/canvas-scale-context.tsx
// React context exposing the live scale-to-fit factor of <SlideCanvas>.
// Consumers (selection overlay, transform handles, future drag affordances)
// divide client-pixel deltas by this scale to get canvas-space deltas.

'use client';

import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

/** Default scale when no provider is mounted (tests that render overlays
 * in isolation). 1 = client-space ≡ canvas-space. */
const CanvasScaleContext = createContext<number>(1);

export function CanvasScaleProvider({
  scale,
  children,
}: {
  scale: number;
  children: ReactNode;
}): ReactElement {
  return <CanvasScaleContext.Provider value={scale}>{children}</CanvasScaleContext.Provider>;
}

export function useCanvasScale(): number {
  return useContext(CanvasScaleContext);
}
