// packages/editor-shell/src/atoms/document.ts
// Primary document atom + fine-grained per-slide / per-element
// subscription factories.

/**
 * The editor holds one canonical `Document` (pre-compile). It is `null` at
 * module-init so no side effects fire during SSR — providers hydrate it
 * from storage or from a freshly created blank on mount.
 *
 * Fine-grained subscription factories (`slideByIdAtom`, `elementByIdAtom`)
 * let consumers subscribe to one slide or one element without depending on
 * the whole document, so unrelated mutations do not re-render them. The
 * factories memoize by id via a plain `Map` cache — `atomFamily` from
 * `jotai/utils` is deprecated in 2.19+ and slated for removal in v3, so a
 * hand-rolled cache is the forward-compatible choice.
 *
 * The document-mode discriminant is honored: slide-mode documents expose
 * `content.slides`, so we gate lookups on `content.mode === 'slide'` and
 * return `undefined` for video / display modes. Consumers that care about
 * non-slide modes should subscribe through mode-specific selectors a later
 * task will add.
 */

import type { Document, Element, Slide } from '@stageflip/schema';
import { type Atom, atom } from 'jotai';

export const documentAtom = atom<Document | null>(null);

const slideByIdCache = new Map<string, Atom<Slide | undefined>>();
const elementByIdCache = new Map<string, Atom<Element | undefined>>();

/**
 * Subscribe to the slide with the given id. Returns `undefined` when the
 * document is null, not slide-mode, or has no slide with that id. Safe to
 * call at render time — repeated calls with the same id return the same
 * atom instance.
 */
export function slideByIdAtom(slideId: string): Atom<Slide | undefined> {
  const cached = slideByIdCache.get(slideId);
  if (cached) return cached;
  const derived = atom<Slide | undefined>((get) => {
    const doc = get(documentAtom);
    if (!doc || doc.content.mode !== 'slide') return undefined;
    return doc.content.slides.find((s) => s.id === slideId);
  });
  slideByIdCache.set(slideId, derived);
  return derived;
}

/**
 * Subscribe to the element with the given id. Scans every slide — cost is
 * O(slides × elements). Hot paths that already know the containing slide
 * should prefer composing `slideByIdAtom` with a local `find` to avoid
 * the full sweep.
 */
export function elementByIdAtom(elementId: string): Atom<Element | undefined> {
  const cached = elementByIdCache.get(elementId);
  if (cached) return cached;
  const derived = atom<Element | undefined>((get) => {
    const doc = get(documentAtom);
    if (!doc || doc.content.mode !== 'slide') return undefined;
    for (const slide of doc.content.slides) {
      const match = slide.elements.find((el) => el.id === elementId);
      if (match) return match;
    }
    return undefined;
  });
  elementByIdCache.set(elementId, derived);
  return derived;
}

/** Test-only. Clears the slide-factory cache so memoization tests don't
 * leak state across cases. */
export function __clearSlideByIdCacheForTest(): void {
  slideByIdCache.clear();
}

/** Test-only. Clears the element-factory cache. */
export function __clearElementByIdCacheForTest(): void {
  elementByIdCache.clear();
}
