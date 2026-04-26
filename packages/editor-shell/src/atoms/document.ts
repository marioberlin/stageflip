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
import { applyInheritance } from '@stageflip/schema';
import { type Atom, atom } from 'jotai';

export const documentAtom = atom<Document | null>(null);

/**
 * Derived atom that materializes per-element placeholder references via the
 * schema-level `applyInheritance(doc)` helper (T-251). Editor surfaces that
 * read element fields directly (e.g., the slide canvas) consume this atom so
 * placeholder fills appear in the rendered DOM without invoking the full
 * RIR compile pipeline.
 *
 * Fast path: when `documentAtom` has empty `layouts` and `masters`, the
 * helper returns the input by reference and this atom resolves to the same
 * `Document` instance. Existing call-sites that subscribed to `documentAtom`
 * pre-T-251 see byte-identical state through `materializedDocumentAtom` for
 * documents without templates, so re-render churn is zero on the fast path.
 *
 * Note: `documentAtom` itself is unchanged — writes still flow through it.
 * Only **read paths from rendering surfaces** consume the materialized
 * variant. The editor's mutation flow (selectElement, updateElement, undo)
 * keeps operating on the unmaterialized document so authors can edit
 * `inheritsFrom`-bearing elements without seeing inherited fields persist
 * back into the Document.
 */
export const materializedDocumentAtom = atom<Document | null>((get) => {
  const doc = get(documentAtom);
  if (!doc) return null;
  return applyInheritance(doc);
});

const slideByIdCache = new Map<string, Atom<Slide | undefined>>();
const elementByIdCache = new Map<string, Atom<Element | undefined>>();
const materializedSlideByIdCache = new Map<string, Atom<Slide | undefined>>();

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

/**
 * Slide-by-id factory whose source is `materializedDocumentAtom` instead of
 * `documentAtom` (T-251). Use from rendering surfaces (e.g., the slide
 * canvas) so element fields filled in from a placeholder appear in the
 * rendered DOM. Mutation surfaces should keep using `slideByIdAtom` so
 * authors edit the unmaterialized document.
 */
export function materializedSlideByIdAtom(slideId: string): Atom<Slide | undefined> {
  const cached = materializedSlideByIdCache.get(slideId);
  if (cached) return cached;
  const derived = atom<Slide | undefined>((get) => {
    const doc = get(materializedDocumentAtom);
    if (!doc || doc.content.mode !== 'slide') return undefined;
    return doc.content.slides.find((s) => s.id === slideId);
  });
  materializedSlideByIdCache.set(slideId, derived);
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

/** Test-only. Clears the materialized-slide-factory cache. */
export function __clearMaterializedSlideByIdCacheForTest(): void {
  materializedSlideByIdCache.clear();
}
