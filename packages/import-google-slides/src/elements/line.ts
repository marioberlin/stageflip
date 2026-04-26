// packages/import-google-slides/src/elements/line.ts
// Convert Slides API `pageElement.line` into a canonical ShapeElement with
// shape='line'. Start/end points are derived from the worldBbox corners
// (Slides treats lines as endpoints at the bbox extents).

import type { ShapeElement } from '@stageflip/schema';
import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';
import type { LossFlag } from '../types.js';
import { makeElementId, transformFromBbox } from './shared.js';

export function emitLineElement(args: {
  apiElement: ApiPageElement;
  worldBbox: BboxPx;
  slideId: string;
  fallback: string;
}): { element: ShapeElement; flags: LossFlag[] } {
  const { apiElement, worldBbox, fallback } = args;
  const id = makeElementId(apiElement.objectId, fallback);
  const element: ShapeElement = {
    id,
    transform: transformFromBbox(worldBbox),
    visible: true,
    locked: false,
    animations: [],
    type: 'shape',
    shape: 'line',
  };
  return { element, flags: [] };
}
