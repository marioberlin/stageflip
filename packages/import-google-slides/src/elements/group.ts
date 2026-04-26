// packages/import-google-slides/src/elements/group.ts
// Convert Slides API `pageElement.elementGroup` into a ParsedGroupElement.
// Children are emitted recursively through the per-kind dispatcher provided
// by the caller (avoids circular imports between this file and the
// per-element emitters that may, transitively, contain groups).

import type { ApiPageElement } from '../api/types.js';
import type { BboxPx } from '../geometry/affine.js';
import type { LossFlag, ParsedElement, ParsedGroupElement } from '../types.js';
import { makeElementId, transformFromBbox } from './shared.js';

export type GroupChildEmitter = (
  apiChild: ApiPageElement,
  worldBbox: BboxPx,
  fallback: string,
) => {
  element: ParsedElement;
  flags: LossFlag[];
};

export function emitGroupElement(args: {
  apiElement: ApiPageElement;
  worldBbox: BboxPx;
  slideId: string;
  fallback: string;
  childWorldBboxes: BboxPx[];
  emitChild: GroupChildEmitter;
}): { element: ParsedGroupElement; flags: LossFlag[] } {
  const { apiElement, worldBbox, fallback, childWorldBboxes, emitChild } = args;
  const id = makeElementId(apiElement.objectId, fallback);
  const flags: LossFlag[] = [];
  const apiChildren = apiElement.elementGroup?.children ?? [];
  const children: ParsedElement[] = [];
  for (let i = 0; i < apiChildren.length; i += 1) {
    const apiChild = apiChildren[i];
    const childBbox = childWorldBboxes[i];
    if (!apiChild || !childBbox) continue;
    const childFallback = `${id}_child_${i}`;
    const out = emitChild(apiChild, childBbox, childFallback);
    children.push(out.element);
    flags.push(...out.flags);
  }
  const element: ParsedGroupElement = {
    id,
    transform: transformFromBbox(worldBbox),
    visible: true,
    locked: false,
    animations: [],
    type: 'group',
    children,
    clip: false,
    groupOrigin: { x: 0, y: 0 },
    groupExtent: { width: worldBbox.width, height: worldBbox.height },
  };
  return { element, flags };
}
