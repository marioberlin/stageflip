// packages/import-google-slides/src/geometry/walk.ts
// Recursive page-element walker. Composes parent-group transforms into the
// child transform via `composeAffines` and emits a flat list of
// `(element, worldTransform)` tuples preserving the API's pageElements order.
// Groups themselves are also emitted (callers may need them for the canonical
// `ParsedGroupElement` wrap), but children carry the composed world transform.

import type { ApiPageElement } from '../api/types.js';
import { type Affine2x3, IDENTITY, composeAffines, fromApi } from './affine.js';

export interface WalkedElement {
  element: ApiPageElement;
  worldTransform: Affine2x3;
  /** Depth in the group tree. 0 = top-level. */
  depth: number;
  /** Parent group's `objectId`, or `undefined` for top-level elements. */
  parentGroupId?: string;
}

/**
 * Recursively walk page elements, composing transforms. AC #8 pin: a 3-deep
 * group fixture produces a flat list with every leaf carrying the correct
 * world transform.
 */
export function walkPageElements(
  pageElements: readonly ApiPageElement[] | undefined,
  parentTransform: Affine2x3 = IDENTITY,
): WalkedElement[] {
  const out: WalkedElement[] = [];
  walkInner(pageElements, parentTransform, 0, undefined, out);
  return out;
}

function walkInner(
  pageElements: readonly ApiPageElement[] | undefined,
  parentTransform: Affine2x3,
  depth: number,
  parentGroupId: string | undefined,
  out: WalkedElement[],
): void {
  if (!pageElements) return;
  for (const el of pageElements) {
    const local = fromApi(el.transform);
    const world = composeAffines(parentTransform, local);
    const walked: WalkedElement = { element: el, worldTransform: world, depth };
    if (parentGroupId !== undefined) walked.parentGroupId = parentGroupId;
    out.push(walked);
    if (el.elementGroup?.children) {
      walkInner(el.elementGroup.children, world, depth + 1, el.objectId, out);
    }
  }
}
