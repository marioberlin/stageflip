// packages/editor-shell/src/find-replace/replace-all.ts
// Pure replace-all over a slide-mode Document (T-139c).

import type { Document, Element, Slide, SlideContent, TextElement } from '@stageflip/schema';
import { findMatches } from './find-matches';
import type { FindOptions } from './types';

/**
 * Rewrite every `query` occurrence inside text elements with
 * `replacement`, producing a new `Document` (structural sharing where
 * possible — untouched slides + elements keep their identity so jotai
 * subscribers don't churn).
 *
 * Returns the same `doc` reference when there are no matches or `doc`
 * isn't slide-mode, so callers can early-return without diffing.
 *
 * Element identity + ordering are preserved; only the `text` field of
 * matched text elements changes. Runs / other style fields aren't
 * touched because text elements in the StageFlip schema store flat
 * `text` — no `runs[]` at match time. When runs land in a later task,
 * this function gains a runs-aware path mirroring the reference's
 * `applyRichReplace`.
 */
export function replaceAll(
  doc: Document | null,
  query: string,
  replacement: string,
  options: FindOptions = {},
): Document {
  if (!doc) throw new Error('replaceAll requires a non-null document');
  if (doc.content.mode !== 'slide' || query === '') return doc;

  const matches = findMatches(doc, query, options);
  if (matches.length === 0) return doc;

  // Group by elementId so each element gets one rewrite. Within the
  // group, iterate rightmost-first so earlier offsets stay valid as
  // we splice.
  const byElement = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = byElement.get(m.elementId) ?? [];
    arr.push(m);
    byElement.set(m.elementId, arr);
  }

  const nextSlides: Slide[] = doc.content.slides.map((slide) => {
    let slideChanged = false;
    const nextElements = slide.elements.map<Element>((el) => {
      if (el.type !== 'text') return el;
      const group = byElement.get(el.id);
      if (!group || group.length === 0) return el;
      const sorted = [...group].sort((a, b) => b.start - a.start);
      let text = el.text;
      for (const m of sorted) {
        text = text.slice(0, m.start) + replacement + text.slice(m.start + m.length);
      }
      if (text === el.text) return el;
      slideChanged = true;
      const next: TextElement = { ...el, text };
      return next;
    });
    return slideChanged ? { ...slide, elements: nextElements } : slide;
  });

  const allSlidesSame = nextSlides.every((s, i) => s === doc.content.slides[i]);
  if (allSlidesSame) return doc;

  const content: SlideContent = { ...doc.content, slides: nextSlides };
  return { ...doc, content };
}
