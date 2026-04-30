// packages/variant-gen/src/structural-sharing.ts
// Immutable-tree structural sharing helpers (T-386 D-T386-5).
//
// The architectural floor for variant-gen perf: a variant's Document tree
// shares Element nodes by reference with the source where unchanged, and
// constructs new objects only along the path from root to substituted slot.
// Pinned by AC #21 — every unchanged element in a 100-element source must
// be reference-equal to the source's corresponding element in the variant.

interface SlideShape {
  readonly id: string;
  readonly elements: ReadonlyArray<{ readonly id: string }>;
  readonly [k: string]: unknown;
}

interface SlideContentShape {
  readonly mode: 'slide';
  readonly slides: ReadonlyArray<SlideShape>;
  readonly [k: string]: unknown;
}

interface DocShape {
  readonly meta: { readonly id: string; readonly [k: string]: unknown };
  readonly content: { readonly mode: string; readonly [k: string]: unknown };
  readonly [k: string]: unknown;
}

/**
 * Set a nested property on a plain object, returning a new tree. Each level
 * along the path is shallow-cloned; siblings remain reference-shared. The
 * returned root is `!== source`; `source` is never mutated.
 */
export function setNestedProperty<T extends object>(
  source: T,
  path: ReadonlyArray<string>,
  value: unknown,
): T {
  if (path.length === 0) {
    throw new Error('setNestedProperty: path must have at least one segment');
  }
  const [head, ...tail] = path;
  if (head === undefined) {
    throw new Error('setNestedProperty: path head undefined');
  }
  const current = source as Record<string, unknown>;
  if (tail.length === 0) {
    return { ...current, [head]: value } as T;
  }
  const child = current[head];
  const updatedChild = setNestedProperty(
    (typeof child === 'object' && child !== null ? child : {}) as object,
    tail,
    value,
  );
  return { ...current, [head]: updatedChild } as T;
}

/**
 * Replace a single element (by ID) inside `document.content.slides[*].elements`.
 * Returns a new Document where:
 *   - the path root → slide → elements is shallow-cloned at each level
 *   - the targeted element is shallow-merged with `patch`
 *   - every other element + every other slide retains reference identity
 *
 * If `elementId` does not match any element on any slide, returns the
 * source unchanged (`===`). Caller code uses this to skip slot
 * substitutions that target a missing element gracefully (the variant-gen
 * substitution path requires the slot's elementId to resolve; missing
 * elements are reported up the stack as a future hardening).
 *
 * Slide mode only — variant slots on video / display content are out of
 * scope for T-386 (slot-bound text only lives on slide elements today).
 */
export function replaceElementInDocument<TDoc extends DocShape>(
  source: TDoc,
  elementId: string,
  patch: Record<string, unknown>,
): TDoc {
  const content = source.content;
  if (content.mode !== 'slide') return source;

  const slideContent = content as unknown as SlideContentShape;
  let foundSlideIndex = -1;
  let foundElementIndex = -1;
  for (let si = 0; si < slideContent.slides.length; si += 1) {
    const slide = slideContent.slides[si];
    if (!slide) continue;
    const ei = slide.elements.findIndex((e) => e.id === elementId);
    if (ei !== -1) {
      foundSlideIndex = si;
      foundElementIndex = ei;
      break;
    }
  }
  if (foundSlideIndex === -1) return source;

  const targetSlide = slideContent.slides[foundSlideIndex];
  if (!targetSlide) return source;
  const targetEl = targetSlide.elements[foundElementIndex];
  if (!targetEl) return source;

  const newEl = { ...(targetEl as Record<string, unknown>), ...patch };
  // Preserve element-array ref identity for siblings.
  const newElements = targetSlide.elements.slice();
  newElements[foundElementIndex] = newEl as { id: string };

  const newSlide = { ...targetSlide, elements: newElements };
  const newSlides = slideContent.slides.slice();
  newSlides[foundSlideIndex] = newSlide;

  const newContent = { ...slideContent, slides: newSlides };
  return { ...source, content: newContent } as TDoc;
}
